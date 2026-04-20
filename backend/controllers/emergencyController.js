/**
 * Emergency Access Controller
 * Handles QR generation, validation, and emergency data access
 */

const User = require('../models/User');
const Hospital = require('../models/Hospital');
const EmergencyAccessLog = require('../models/EmergencyAccessLog');
const Notification = require('../models/Notification');
const { encrypt, decrypt, generateAccessToken, hashToken } = require('../utils/encryption');
const { writeAuditLog } = require('../services/blockchainAuditService');

/**
 * Generate Emergency QR Token for Patient
 * POST /api/emergency/generate-qr
 */
exports.generateEmergencyQR = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { duration } = req.body; // Optional: custom duration in minutes
    
    // Get patient
    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only patients can generate emergency QR codes' 
      });
    }
    
    // Check if profile has minimum required data
    const profile = patient.patientProfile || {};
    const missingFields = [];
    
    if (!profile.bloodType) missingFields.push('Blood Type');
    if (!profile.emergencyContacts || profile.emergencyContacts.length === 0) {
      missingFields.push('Emergency Contacts');
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please complete your profile first. Missing: ${missingFields.join(', ')}`,
        missingFields
      });
    }
    
    // Generate access token
    const accessToken = generateAccessToken();
    const hashedToken = hashToken(accessToken);
    
    // Set duration (default from settings or 30 minutes)
    const accessDuration = duration || profile.emergencySettings?.accessDuration || 30;
    
    // Create expiry time
    const expiresAt = new Date(Date.now() + accessDuration * 60 * 1000);
    
    // Create QR payload
    const qrPayload = {
      pid: patientId.toString(), // patient ID
      tok: accessToken,          // access token
      exp: expiresAt.getTime(),  // expiry timestamp
      ver: 1                     // version for future compatibility
    };
    
    // Encrypt the payload
    const encryptedPayload = encrypt(qrPayload);
    
    // Update patient's emergency settings
    await User.findByIdAndUpdate(patientId, {
      'patientProfile.emergencySettings.lastQrGenerated': new Date(),
      'patientProfile.emergencySettings.qrAccessToken': hashedToken
    });

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: patientId.toString(),
      actorId: patientId.toString(),
      actionType: 'GENERATE_QR',
      data: {
        patientId: patientId.toString(),
        expiresAt: expiresAt.toISOString(),
        durationMinutes: accessDuration,
        qrAccessTokenHash: hashedToken
      },
      metadata: {
        event: 'EMERGENCY_QR_GENERATED'
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Emergency QR generated successfully',
      data: {
        qrData: encryptedPayload,
        expiresAt: expiresAt.toISOString(),
        durationMinutes: accessDuration,
        patientName: patient.fullName,
        instructions: 'Show this QR code to hospital staff in case of emergency'
      }
    });
    
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate emergency QR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update Emergency Access Duration Setting
 * PATCH /api/emergency/settings
 */
exports.updateEmergencySettings = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { accessDuration } = req.body;
    
    // Validate duration (5-120 minutes)
    if (!accessDuration || accessDuration < 5 || accessDuration > 120) {
      return res.status(400).json({
        success: false,
        message: 'Access duration must be between 5 and 120 minutes'
      });
    }
    
    await User.findByIdAndUpdate(patientId, {
      'patientProfile.emergencySettings.accessDuration': accessDuration
    });

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: patientId.toString(),
      actorId: patientId.toString(),
      actionType: 'UPDATE_SETTINGS',
      data: {
        patientId: patientId.toString(),
        accessDuration
      },
      metadata: {
        event: 'EMERGENCY_ACCESS_DURATION_UPDATED'
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Emergency settings updated',
      data: { accessDuration }
    });
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

/**
 * Hospital Scans QR and Gets Emergency Access
 * POST /api/emergency/access
 * Only hospital_admin can use this endpoint
 */
exports.accessEmergencyData = async (req, res) => {
  try {
    const { qrData, location } = req.body;
    const accessingUser = req.user;
    
    // Verify user is hospital admin
    if (accessingUser.role !== 'hospital_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only hospital staff can access emergency data'
      });
    }
    
    // Get hospital
    const hospital = await Hospital.findOne({
      $or: [
        { primaryAdmin: accessingUser.id },
        { additionalAdmins: accessingUser.id }
      ]
    });
    
    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not associated with any hospital'
      });
    }
    
    // Decrypt QR data
    const decryptedData = decrypt(qrData);
    if (!decryptedData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or corrupted QR code'
      });
    }
    
    const { pid: patientId, tok: accessToken, exp: expiryTime } = decryptedData;
    
    // Check expiry
    if (expiryTime < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'This emergency QR code has expired. Ask patient to generate a new one.'
      });
    }
    
    // Get patient
    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // Verify token matches (optional extra security)
    const hashedToken = hashToken(accessToken);
    const storedHash = patient.patientProfile?.emergencySettings?.qrAccessToken;
    
    if (storedHash && storedHash !== hashedToken) {
      return res.status(400).json({
        success: false,
        message: 'This QR code has been invalidated. A newer one was generated.'
      });
    }
    
    // Calculate remaining time
    const remainingMs = expiryTime - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    
    // Create emergency access log
    const accessLog = await EmergencyAccessLog.create({
      hospital: hospital._id,
      accessedByUser: accessingUser.id,
      patient: patientId,
      accessToken: hashedToken,
      expiresAt: new Date(expiryTime),
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      location: location || {},
      dataAccessed: {
        bloodType: true,
        allergies: true,
        medications: true,
        emergencyContacts: true,
        surgeries: true,
        chronicConditions: true
      }
    });
    
    // Create notification for patient
    await Notification.create({
      user: patientId,
      type: 'emergency',
      title: '🚨 Emergency Access Alert',
      message: `${hospital.name} accessed your emergency health data`,
      data: {
        accessLogId: accessLog._id,
        hospitalName: hospital.name,
        hospitalId: hospital._id,
        accessTime: accessLog.accessTime,
        expiresAt: accessLog.expiresAt
      },
      priority: 'urgent',
      channels: {
        inApp: true,
        email: true,
        sms: true,
        push: true
      }
    });
    
    // Mark notification as sent
    accessLog.notificationSent = true;
    accessLog.notificationSentAt = new Date();
    await accessLog.save();

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: accessLog._id.toString(),
      actorId: accessingUser.id.toString(),
      actionType: 'ACCESS',
      data: {
        accessLogId: accessLog._id.toString(),
        patientId: patientId.toString(),
        hospitalId: hospital._id.toString(),
        qrScanTime: accessLog.accessTime,
        expiresAt: accessLog.expiresAt,
        accessStatus: accessLog.accessStatus
      },
      metadata: {
        event: 'QR_SCAN_EVENT'
      }
    });

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: accessLog._id.toString(),
      actorId: accessingUser.id.toString(),
      actionType: 'GRANT',
      data: {
        accessLogId: accessLog._id.toString(),
        patientId: patientId.toString(),
        hospitalId: hospital._id.toString(),
        grantedAt: accessLog.accessTime,
        expiresAt: accessLog.expiresAt,
        dataAccessed: accessLog.dataAccessed
      },
      metadata: {
        temporary: true
      }
    });
    
    // Extract emergency data
    const profile = patient.patientProfile || {};
    const emergencyData = {
      // Patient identification
      patient: {
        id: patient._id,
        name: patient.fullName,
        age: patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null,
        gender: patient.gender,
        phone: patient.phone
      },
      
      // Critical health info
      bloodType: profile.bloodType || 'Not specified',
      
      allergies: (profile.allergies || []).map(a => ({
        allergen: a.allergen,
        severity: a.severity,
        reaction: a.reaction
      })),
      
      currentMedications: (profile.currentMedications || []).map(m => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        prescribedFor: m.prescribedFor
      })),
      
      previousSurgeries: (profile.previousSurgeries || []).map(s => ({
        name: s.name,
        date: s.date,
        hospital: s.hospital
      })),
      
      chronicConditions: profile.chronicConditions || [],
      
      emergencyContacts: (profile.emergencyContacts || []).map(c => ({
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        isPrimary: c.isPrimary
      })),
      
      // Address for context
      address: profile.address || {}
    };

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: accessLog._id.toString(),
      actorId: accessingUser.id.toString(),
      actionType: 'ACCESS',
      data: {
        accessLogId: accessLog._id.toString(),
        patientId: patientId.toString(),
        doctorOrStaffId: accessingUser.id.toString(),
        viewedAt: new Date().toISOString()
      },
      metadata: {
        event: 'EMERGENCY_DATA_VIEWED'
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Emergency access granted',
      data: {
        emergencyData,
        accessInfo: {
          accessLogId: accessLog._id,
          accessedAt: accessLog.accessTime,
          expiresAt: accessLog.expiresAt,
          remainingMinutes,
          hospitalName: hospital.name
        }
      }
    });
    
  } catch (error) {
    console.error('Emergency access error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to access emergency data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get Patient's Emergency Access History
 * GET /api/emergency/history
 */
exports.getAccessHistory = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    const logs = await EmergencyAccessLog.getPatientHistory(patientId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    const total = await EmergencyAccessLog.countDocuments({ patient: patientId });
    
    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get access history' });
  }
};

/**
 * Get Active Emergency Access Sessions
 * GET /api/emergency/active-sessions
 */
exports.getActiveSessions = async (req, res) => {
  try {
    const patientId = req.user.id;
    
    const sessions = await EmergencyAccessLog.getActiveSessions(patientId);
    
    res.status(200).json({
      success: true,
      data: { sessions }
    });
    
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get active sessions' });
  }
};

/**
 * Revoke Emergency Access
 * POST /api/emergency/revoke/:logId
 */
exports.revokeAccess = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { logId } = req.params;
    const { reason } = req.body;
    
    const accessLog = await EmergencyAccessLog.findOne({
      _id: logId,
      patient: patientId,
      accessStatus: 'active'
    });
    
    if (!accessLog) {
      return res.status(404).json({
        success: false,
        message: 'Access session not found or already expired/revoked'
      });
    }
    
    await accessLog.revoke(patientId, reason || 'Revoked by patient');

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: accessLog._id.toString(),
      actorId: patientId.toString(),
      actionType: 'REVOKE',
      data: {
        accessLogId: accessLog._id.toString(),
        patientId: patientId.toString(),
        revokedAt: accessLog.revokedAt,
        reason: accessLog.revokedReason || reason || ''
      }
    });
    
    // Notify hospital that access was revoked
    const hospital = await Hospital.findById(accessLog.hospital);
    if (hospital?.primaryAdmin) {
      await Notification.create({
        user: hospital.primaryAdmin,
        type: 'emergency',
        title: 'Emergency Access Revoked',
        message: `Patient has revoked emergency access`,
        data: {
          accessLogId: accessLog._id,
          revokedAt: accessLog.revokedAt
        },
        priority: 'high'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Emergency access revoked successfully'
    });
    
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke access' });
  }
};

/**
 * Mark Access Log as Reviewed by Patient
 * PATCH /api/emergency/review/:logId
 */
exports.reviewAccessLog = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { logId } = req.params;
    const { flaggedAsSuspicious, notes } = req.body;
    
    const accessLog = await EmergencyAccessLog.findOneAndUpdate(
      { _id: logId, patient: patientId },
      {
        'patientReview.reviewed': true,
        'patientReview.reviewedAt': new Date(),
        'patientReview.flaggedAsSuspicious': flaggedAsSuspicious || false,
        'patientReview.notes': notes
      },
      { new: true }
    );
    
    if (!accessLog) {
      return res.status(404).json({
        success: false,
        message: 'Access log not found'
      });
    }

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: accessLog._id.toString(),
      actorId: patientId.toString(),
      actionType: 'REVIEW',
      data: {
        accessLogId: accessLog._id.toString(),
        patientId: patientId.toString(),
        reviewedAt: accessLog.patientReview?.reviewedAt || new Date(),
        flaggedAsSuspicious: !!accessLog.patientReview?.flaggedAsSuspicious,
        notes: accessLog.patientReview?.notes || ''
      },
      metadata: {
        event: 'EMERGENCY_ACCESS_REVIEWED'
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Access log reviewed',
      data: { accessLog }
    });
    
  } catch (error) {
    console.error('Review access error:', error);
    res.status(500).json({ success: false, message: 'Failed to review access log' });
  }
};

/**
 * Invalidate Current QR Token (generate new one to invalidate old)
 * POST /api/emergency/invalidate-qr
 */
exports.invalidateCurrentQR = async (req, res) => {
  try {
    const patientId = req.user.id;
    
    // Generate new token hash (invalidates old QR)
    const newToken = generateAccessToken();
    const hashedToken = hashToken(newToken);
    
    await User.findByIdAndUpdate(patientId, {
      'patientProfile.emergencySettings.qrAccessToken': hashedToken
    });

    await writeAuditLog({
      entityType: 'EMERGENCY_ACCESS',
      entityId: patientId.toString(),
      actorId: patientId.toString(),
      actionType: 'INVALIDATE_QR',
      data: {
        patientId: patientId.toString(),
        qrAccessTokenHash: hashedToken,
        invalidatedAt: new Date().toISOString()
      },
      metadata: {
        event: 'EMERGENCY_QR_INVALIDATED'
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Previous QR code invalidated. Generate a new one when needed.'
    });
    
  } catch (error) {
    console.error('Invalidate QR error:', error);
    res.status(500).json({ success: false, message: 'Failed to invalidate QR' });
  }
};

// Helper function to calculate age
function calculateAge(dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

module.exports = exports;

/**
 * View Emergency Data via Link (no auth required)
 * GET /api/emergency/view?token=<encryptedPayload>
 *
 * Used when the QR cannot be scanned — the encrypted token is passed
 * as a URL query param. Returns the same emergency data as the QR scan.
 */
exports.viewEmergencyDataByLink = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Decrypt the payload
    const decryptedData = decrypt(token);
    if (!decryptedData) {
      return res.status(400).json({ success: false, message: 'Invalid or corrupted token' });
    }

    const { pid, tok, exp } = decryptedData;

    // Check expiry
    if (Date.now() > exp) {
      return res.status(410).json({
        success: false,
        message: 'This emergency link has expired. Ask the patient to generate a new one.'
      });
    }

    // Fetch patient
    const patient = await User.findById(pid);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Verify token
    const hashedToken = hashToken(tok);
    const storedHash = patient.patientProfile?.emergencySettings?.qrAccessToken;
    if (storedHash && storedHash !== hashedToken) {
      return res.status(401).json({
        success: false,
        message: 'This link has been invalidated. Ask the patient to generate a new one.'
      });
    }

    const profile = patient.patientProfile || {};

    return res.status(200).json({
      success: true,
      data: {
        patient: {
          name: patient.fullName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          bloodType: profile.bloodType,
          allergies: profile.allergies || [],
          currentMedications: profile.currentMedications || [],
          previousSurgeries: profile.previousSurgeries || [],
          chronicConditions: profile.chronicConditions || [],
          emergencyContacts: profile.emergencyContacts || [],
          insuranceProvider: profile.insuranceProvider || null,
          insurancePolicyNumber: profile.insurancePolicyNumber || null
        },
        expiresAt: new Date(exp).toISOString(),
        accessedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('viewEmergencyDataByLink error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve emergency data' });
  }
};
