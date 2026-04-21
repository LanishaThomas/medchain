const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const MedicalRecord = require('../models/MedicalRecord');
const Permission = require('../models/Permission');
const { protect } = require('../middleware/authMiddleware');
const { upload, uploadToCloudinary, deleteFile, deleteLocalFile, UPLOADS_DIR } = require('../utils/cloudinary');
const { writeAuditLog } = require('../services/blockchainAuditService');
const {
  executeWithBlockchainConsistency,
  hashFromResult,
  buildSnapshot,
  restoreSnapshot
} = require('../services/blockchainConsistencyService');
const { attachVerificationStatus, getVerificationStatusForEntity } = require('../services/entityVerificationService');

// Helper: Determine file type from mimetype
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'document';
  return 'other';
};

// Helper: build current-data payload for tamper detection
const getMedicalRecordCurrentData = (item) => ({
  id: item._id?.toString(),
  patient: item.patient?.toString(),
  uploadedBy: item.uploadedBy?.toString(),
  title: item.title,
  description: item.description || '',
  fileName: item.fileName,
  fileSize: item.fileSize,
  fileType: item.fileType,
  mimeType: item.mimeType,
  recordType: item.recordType,
  fileHash: item.fileHash || ''
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('❌ Multer error:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({
        success: false,
        message: err.message + '. Allowed types: JPEG, PNG, GIF, PDF, DOC, DOCX'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error'
    });
  }
  next();
};

// ==========================================
// UPLOAD MEDICAL RECORD  (multer saves to disk, then optionally to Cloudinary)
// ==========================================

router.post('/upload', protect, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📤 Upload request:', {
      user: req.user?.email,
      hasFile: !!req.file,
      file: req.file ? { name: req.file.originalname, size: req.file.size, path: req.file.path } : null
    });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { title, description, recordType, patientId, clinicalData, tags } = req.body;

    if (!title) {
      deleteLocalFile(req.file.path);
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    // Determine patient
    let targetPatientId;
    if (req.user.role === 'patient') {
      targetPatientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      if (!patientId) {
        deleteLocalFile(req.file.path);
        return res.status(400).json({ success: false, message: 'Patient ID is required for doctor uploads' });
      }
      const hasPermission = await Permission.hasAccess(patientId, req.user.id, 'medical_records');
      if (!hasPermission) {
        deleteLocalFile(req.file.path);
        return res.status(403).json({ success: false, message: 'No permission to upload for this patient' });
      }
      targetPatientId = patientId;
    } else {
      deleteLocalFile(req.file.path);
      return res.status(403).json({ success: false, message: 'Only patients and doctors can upload' });
    }

    // File hash
    const fileHash = require('crypto').createHash('sha256')
      .update(`${req.file.filename}-${Date.now()}-${req.file.size}`)
      .digest('hex');

    // Parse optional fields
    let parsedClinicalData = {};
    if (clinicalData) { try { parsedClinicalData = JSON.parse(clinicalData); } catch(e) {} }
    let parsedTags = [];
    if (tags) { try { parsedTags = JSON.parse(tags); } catch(e) { parsedTags = tags.split(',').map(t => t.trim()); } }

    // Try Cloudinary upload (file already saved locally by multer)
    let fileUrl = `/api/medical-records/files/${req.file.filename}`;
    let filePublicId = req.file.filename;
    let storageMode = 'local';

    const cloud = await uploadToCloudinary(req.file.path, req.user.id);
    if (cloud) {
      fileUrl = cloud.url;
      filePublicId = cloud.publicId;
      storageMode = 'cloudinary';
    }

    const medicalRecord = new MedicalRecord({
      patient: targetPatientId,
      uploadedBy: req.user.id,
      hospital: req.user.hospitalId || null,
      title: title.trim(),
      description: description?.trim() || '',
      fileUrl,
      filePublicId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: getFileType(req.file.mimetype),
      mimeType: req.file.mimetype,
      recordType: recordType || 'other',
      clinicalData: parsedClinicalData,
      fileHash,
      tags: parsedTags,
      storageMode,
      localPath: req.file.path
    });

    await medicalRecord.save();

    await executeWithBlockchainConsistency(
      async () => ({
        entityType: 'MEDICAL_RECORD',
        entityId: medicalRecord._id.toString(),
        actorId: req.user.id.toString(),
        actionType: 'CREATE',
        hashSource: {
          id: medicalRecord._id.toString(),
          patient: medicalRecord.patient.toString(),
          uploadedBy: medicalRecord.uploadedBy.toString(),
          hospital: medicalRecord.hospital ? medicalRecord.hospital.toString() : null,
          title: medicalRecord.title,
          description: medicalRecord.description,
          fileHash: medicalRecord.fileHash,
          fileName: medicalRecord.fileName,
          fileSize: medicalRecord.fileSize,
          fileType: medicalRecord.fileType,
          mimeType: medicalRecord.mimeType,
          recordType: medicalRecord.recordType,
          clinicalData: medicalRecord.clinicalData,
          tags: medicalRecord.tags || [],
          status: medicalRecord.status
        },
        metadata: {
          storageMode: medicalRecord.storageMode
        },
        versioning: {
          beforeSnapshot: null,
          afterSnapshot: buildSnapshot(medicalRecord),
          metadata: {
            storageMode: medicalRecord.storageMode
          }
        },
        dbState: {
          model: 'MedicalRecord',
          operation: 'CREATE',
          id: medicalRecord._id.toString()
        },
        createdId: medicalRecord._id,
        onSuccess: async (auditDoc) => {
          await MedicalRecord.updateOne(
            { _id: medicalRecord._id },
            {
              $set: {
                blockchainHash: auditDoc.dataHash,
                blockchainTxHash: auditDoc.blockchainTxHash,
                blockchainTimestamp: auditDoc.timestamp
              }
            }
          );
        }
      }),
      async (operationResult) => {
        await MedicalRecord.findByIdAndDelete(operationResult.createdId);
      },
      hashFromResult
    );

    await medicalRecord.populate([
      { path: 'uploadedBy', select: 'firstName lastName role' },
      { path: 'hospital', select: 'name' }
    ]);

    console.log('✅ Record created:', medicalRecord._id, '| storage:', storageMode);

    res.status(201).json({
      success: true,
      message: 'Medical record uploaded successfully',
      data: {
        record: {
          ...medicalRecord.toObject(),
          verificationStatus: await getVerificationStatusForEntity({
            entityType: 'MEDICAL_RECORD',
            entityId: medicalRecord._id,
            dbHash: medicalRecord.blockchainHash
          })
        }
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error.message);
    if (req.file?.path) deleteLocalFile(req.file.path);
    res.status(500).json({
      success: false,
      message: 'Failed to upload medical record',
      error: error.message
    });
  }
});

// ==========================================
// GET MY RECORDS (Patient)
// ==========================================
router.get('/my-records', protect, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Only patients can access this endpoint'
      });
    }

    const { recordType, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    // Build filter
    const filter = {
      patient: req.user.id,
      status: 'active'
    };
    
    if (recordType) filter.recordType = recordType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [records, total] = await Promise.all([
      MedicalRecord.find(filter)
        .populate('uploadedBy', 'firstName lastName role')
        .populate('hospital', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MedicalRecord.countDocuments(filter)
    ]);

    const recordsWithVerification = await attachVerificationStatus(
      records.map((record) => ({ ...record.toObject() })),
      {
        entityType: 'MEDICAL_RECORD',
        getId: (item) => item._id,
        getHash: (item) => item.blockchainHash,
        getCurrentData: getMedicalRecordCurrentData
      }
    );

    res.json({
      success: true,
      data: {
        records: recordsWithVerification,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medical records',
      error: error.message
    });
  }
});

// ==========================================
// GET PATIENT RECORDS (Doctor with permission)
// ==========================================
router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { recordType, startDate, endDate, page = 1, limit = 20 } = req.query;

    // Check access
    if (req.user.role === 'patient') {
      // Patient can only access their own records
      if (req.user.id !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'You can only access your own records'
        });
      }
    } else if (req.user.role === 'doctor') {
      // Doctor needs permission
      const hasPermission = await Permission.hasAccess(patientId, req.user.id, 'medical_records');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this patient\'s records'
        });
      }
      
      // Record access for audit
      const permission = await Permission.findOne({
        patient: patientId,
        doctor: req.user.id,
        status: 'approved'
      });
      if (permission) {
        await permission.recordAccess();
      }

    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Build filter
    const filter = {
      patient: patientId,
      status: 'active'
    };
    
    if (recordType) filter.recordType = recordType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [records, total] = await Promise.all([
      MedicalRecord.find(filter)
        .populate('uploadedBy', 'firstName lastName role')
        .populate('hospital', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MedicalRecord.countDocuments(filter)
    ]);

    if (req.user.role === 'doctor') {
      await writeAuditLog({
        entityType: 'ACCESS_EVENT',
        entityId: patientId.toString(),
        actorId: req.user.id.toString(),
        actionType: 'ACCESS',
        data: {
          patientId: patientId.toString(),
          doctorId: req.user.id.toString(),
          accessedAt: new Date().toISOString(),
          purpose: 'medical_records',
          recordCount: records.length
        },
        metadata: {
          endpoint: '/api/medical-records/patient/:patientId'
        }
      });
    }

    const recordsWithVerification = await attachVerificationStatus(
      records.map((record) => ({ ...record.toObject() })),
      {
        entityType: 'MEDICAL_RECORD',
        getId: (item) => item._id,
        getHash: (item) => item.blockchainHash,
        getCurrentData: getMedicalRecordCurrentData
      }
    );

    res.json({
      success: true,
      data: {
        records: recordsWithVerification,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get patient records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch records',
      error: error.message
    });
  }
});

// ==========================================
// GET SINGLE RECORD
// ==========================================
router.get('/:recordId', protect, async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await MedicalRecord.findById(recordId)
      .populate('uploadedBy', 'firstName lastName role')
      .populate('hospital', 'name')
      .populate('patient', 'firstName lastName email');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    // Check access
    const accessResult = await MedicalRecord.canAccess(recordId, req.user.id, req.user.role);
    if (!accessResult.allowed) {
      return res.status(403).json({
        success: false,
        message: accessResult.reason
      });
    }

    // Log access
    await record.logAccess(req.user.id, 'view', req.ip);

    if (req.user.role === 'doctor') {
      await writeAuditLog({
        entityType: 'ACCESS_EVENT',
        entityId: record.patient.toString(),
        actorId: req.user.id.toString(),
        actionType: 'ACCESS',
        data: {
          patientId: record.patient.toString(),
          doctorId: req.user.id.toString(),
          recordId: record._id.toString(),
          accessedAt: new Date().toISOString(),
          purpose: 'medical_record_view'
        },
        metadata: {
          endpoint: '/api/medical-records/:recordId'
        }
      });
    }

    res.json({
      success: true,
      data: {
        record: {
          ...record.toObject(),
          verificationStatus: await getVerificationStatusForEntity({
            entityType: 'MEDICAL_RECORD',
            entityId: record._id,
            dbHash: record.blockchainHash
          })
        }
      }
    });

  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch record',
      error: error.message
    });
  }
});

// ==========================================
// DOWNLOAD RECORD
// ==========================================
router.get('/:recordId/download', protect, async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await MedicalRecord.findById(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    // Check access
    const accessResult = await MedicalRecord.canAccess(recordId, req.user.id, req.user.role);
    if (!accessResult.allowed) {
      return res.status(403).json({
        success: false,
        message: accessResult.reason
      });
    }

    // For doctors, check if download is allowed in permission
    if (req.user.role === 'doctor') {
      const permission = await Permission.findOne({
        patient: record.patient,
        doctor: req.user.id,
        status: 'approved'
      });
      
      if (!permission?.allowedActions?.download) {
        return res.status(403).json({
          success: false,
          message: 'Download permission not granted'
        });
      }
    }

    // Log download access
    await record.logAccess(req.user.id, 'download', req.ip);

    if (req.user.role === 'doctor') {
      await writeAuditLog({
        entityType: 'ACCESS_EVENT',
        entityId: record.patient.toString(),
        actorId: req.user.id.toString(),
        actionType: 'ACCESS',
        data: {
          patientId: record.patient.toString(),
          doctorId: req.user.id.toString(),
          recordId: record._id.toString(),
          accessedAt: new Date().toISOString(),
          purpose: 'medical_record_download'
        },
        metadata: {
          endpoint: '/api/medical-records/:recordId/download'
        }
      });
    }

    // Return the file URL for download
    res.json({
      success: true,
      data: {
        downloadUrl: record.fileUrl,
        fileName: record.fileName,
        mimeType: record.mimeType
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download URL',
      error: error.message
    });
  }
});

// ==========================================
// UPDATE RECORD (Owner only - limited fields)
// ==========================================
router.patch('/:recordId', protect, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { title, description, recordType, tags, clinicalData } = req.body;

    const record = await MedicalRecord.findById(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    // Only patient owner can update
    if (record.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the record owner can update this record'
      });
    }

    // Update allowed fields
    const previousSnapshot = buildSnapshot(record);

    if (title) record.title = title.trim();
    if (description !== undefined) record.description = description.trim();
    if (recordType) record.recordType = recordType;
    if (tags) {
      record.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    }
    if (clinicalData) {
      record.clinicalData = typeof clinicalData === 'string' 
        ? JSON.parse(clinicalData) 
        : clinicalData;
    }

    await record.save();

    await executeWithBlockchainConsistency(
      async () => ({
        entityType: 'MEDICAL_RECORD',
        entityId: record._id.toString(),
        actorId: req.user.id.toString(),
        actionType: 'UPDATE',
        hashSource: {
          id: record._id.toString(),
          patient: record.patient.toString(),
          title: record.title,
          description: record.description,
          recordType: record.recordType,
          tags: record.tags,
          clinicalData: record.clinicalData,
          status: record.status,
          fileHash: record.fileHash
        },
        dbState: {
          model: 'MedicalRecord',
          operation: 'UPDATE',
          id: record._id.toString()
        },
        versioning: {
          beforeSnapshot: previousSnapshot,
          afterSnapshot: buildSnapshot(record),
          metadata: {
            source: 'record_update'
          }
        },
        previousSnapshot,
        onSuccess: async (auditDoc) => {
          await MedicalRecord.updateOne(
            { _id: record._id },
            {
              $set: {
                blockchainHash: auditDoc.dataHash,
                blockchainTxHash: auditDoc.blockchainTxHash,
                blockchainTimestamp: auditDoc.timestamp
              }
            }
          );
        }
      }),
      async (operationResult) => {
        await restoreSnapshot(MedicalRecord, operationResult.previousSnapshot);
      },
      hashFromResult
    );

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: {
        record: {
          ...record.toObject(),
          verificationStatus: await getVerificationStatusForEntity({
            entityType: 'MEDICAL_RECORD',
            entityId: record._id,
            dbHash: record.blockchainHash
          })
        }
      }
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update record',
      error: error.message
    });
  }
});

// ==========================================
// DELETE RECORD (Soft delete - Owner only)
// ==========================================
router.delete('/:recordId', protect, async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await MedicalRecord.findById(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    // Only patient owner can delete
    if (record.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the record owner can delete this record'
      });
    }

    // Soft delete
    const previousSnapshot = buildSnapshot(record);

    record.status = 'deleted';
    await record.save();

    await executeWithBlockchainConsistency(
      async () => ({
        entityType: 'MEDICAL_RECORD',
        entityId: record._id.toString(),
        actorId: req.user.id.toString(),
        actionType: 'UPDATE',
        hashSource: {
          id: record._id.toString(),
          patient: record.patient.toString(),
          status: record.status
        },
        metadata: {
          event: 'SOFT_DELETE'
        },
        dbState: {
          model: 'MedicalRecord',
          operation: 'UPDATE',
          id: record._id.toString()
        },
        versioning: {
          beforeSnapshot: previousSnapshot,
          afterSnapshot: buildSnapshot(record),
          metadata: {
            source: 'record_soft_delete'
          }
        },
        previousSnapshot,
        onSuccess: async (auditDoc) => {
          await MedicalRecord.updateOne(
            { _id: record._id },
            {
              $set: {
                blockchainHash: auditDoc.dataHash,
                blockchainTxHash: auditDoc.blockchainTxHash,
                blockchainTimestamp: auditDoc.timestamp
              }
            }
          );
        }
      }),
      async (operationResult) => {
        await restoreSnapshot(MedicalRecord, operationResult.previousSnapshot);
      },
      hashFromResult
    );

    res.json({
      success: true,
      message: 'Record deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete record',
      error: error.message
    });
  }
});

// ==========================================
// PERMANENTLY DELETE (Hard delete with Cloudinary cleanup)
// ==========================================
router.delete('/:recordId/permanent', protect, async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await MedicalRecord.findById(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    // Only patient owner can permanently delete
    if (record.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the record owner can permanently delete this record'
      });
    }

    const previousSnapshot = buildSnapshot(record);

    // Delete from Cloudinary
    try {
      const resourceType = record.fileType === 'image' ? 'image' : 'raw';
      await deleteFile(record.filePublicId, resourceType);
    } catch (cloudinaryError) {
      console.error('Cloudinary delete error:', cloudinaryError);
      // Continue with DB deletion even if Cloudinary fails
    }

    // Delete from database
    await MedicalRecord.findByIdAndDelete(recordId);

    await executeWithBlockchainConsistency(
      async () => ({
        entityType: 'MEDICAL_RECORD',
        entityId: record._id.toString(),
        actorId: req.user.id.toString(),
        actionType: 'UPDATE',
        hashSource: {
          id: record._id.toString(),
          patient: record.patient.toString(),
          status: 'permanently_deleted'
        },
        metadata: {
          event: 'HARD_DELETE'
        },
        dbState: {
          model: 'MedicalRecord',
          operation: 'DELETE',
          id: record._id.toString()
        },
        versioning: {
          beforeSnapshot: previousSnapshot,
          afterSnapshot: null,
          metadata: {
            source: 'record_hard_delete'
          }
        },
        previousSnapshot
      }),
      async (operationResult) => {
        await restoreSnapshot(MedicalRecord, operationResult.previousSnapshot);
      },
      hashFromResult
    );

    res.json({
      success: true,
      message: 'Record permanently deleted'
    });

  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete record',
      error: error.message
    });
  }
});

// ==========================================
// GET RECORD STATISTICS
// ==========================================
router.get('/stats/summary', protect, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Only patients can access their statistics'
      });
    }

    const stats = await MedicalRecord.aggregate([
      { $match: { patient: req.user.id, status: 'active' } },
      {
        $group: {
          _id: '$recordType',
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' }
        }
      }
    ]);

    const totalRecords = stats.reduce((sum, s) => sum + s.count, 0);
    const totalSize = stats.reduce((sum, s) => sum + s.totalSize, 0);

    res.json({
      success: true,
      data: {
        totalRecords,
        totalSize,
        formattedSize: totalSize < 1024 * 1024 
          ? (totalSize / 1024).toFixed(1) + ' KB'
          : (totalSize / (1024 * 1024)).toFixed(1) + ' MB',
        byType: stats.map(s => ({
          type: s._id,
          count: s.count,
          size: s.totalSize
        }))
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// ==========================================
// SERVE LOCAL FILES
// ==========================================
const path = require('path');
const fs = require('fs');

router.get('/files/:filename', protect, (req, res) => {
  const { filename } = req.params;
  
  // Search for file in user directories under UPLOADS_DIR
  const searchFile = (dir) => {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = searchFile(fullPath);
        if (found) return found;
      } else if (entry.name === filename) {
        return fullPath;
      }
    }
    return null;
  };

  const filePath = searchFile(UPLOADS_DIR);
  if (!filePath) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  res.sendFile(filePath);
});

module.exports = router;
