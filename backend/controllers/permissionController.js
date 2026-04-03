const Permission = require('../models/Permission');
const User = require('../models/User');

// ============================================
// DOCTOR: REQUEST ACCESS
// ============================================

/**
 * @desc    Doctor requests access to patient's medical data
 * @route   POST /api/permissions/request-access
 * @access  Private (Doctor)
 */
exports.requestAccess = async (req, res, next) => {
  try {
    const { patientId, accessType, expiryDate, reason } = req.body;
    const doctorId = req.user.id;

    // Validate patient exists
    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if access request already exists
    const existingRequest = await Permission.findOne({
      patient: patientId,
      doctor: doctorId,
      accessType: accessType,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${existingRequest.status} request for ${accessType} access`
      });
    }

    // Validate expiry date
    if (!expiryDate || new Date(expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be in the future'
      });
    }

    // Create permission request
    const permission = await Permission.create({
      patient: patientId,
      doctor: doctorId,
      accessType: accessType || 'medical_records',
      requestReason: reason || 'Medical consultation',
      expiryDate: new Date(expiryDate),
      status: 'pending',
      hospital: req.user.hospitalId // If doctor is at a hospital
    });

    // Populate for response
    await permission.populate('patient', 'firstName lastName email phone');
    await permission.populate('doctor', 'firstName lastName email role');

    console.log(`📋 Access request created:`, {
      doctorId: req.user.id,
      patientId: patientId,
      accessType: accessType,
      requestId: permission._id
    });

    res.status(201).json({
      success: true,
      message: 'Access request sent to patient',
      data: {
        requestId: permission._id,
        status: permission.status,
        accessType: permission.accessType,
        requestReason: permission.requestReason,
        expiryDate: permission.expiryDate,
        requestedAt: permission.requestedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DOCTOR: GET REQUEST STATUS
// ============================================

/**
 * @desc    Get status of doctor's access requests
 * @route   GET /api/permissions/my-requests
 * @access  Private (Doctor)
 */
exports.getMyAccessRequests = async (req, res, next) => {
  try {
    const doctorId = req.user.id;

    const requests = await Permission.find({ doctor: doctorId })
      .populate('patient', 'firstName lastName email phone')
      .sort({ requestedAt: -1 });

    const summary = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      revoked: requests.filter(r => r.status === 'revoked').length
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        requests: requests.map(r => ({
          id: r._id,
          patientId: r.patient._id,
          patientName: `${r.patient.firstName} ${r.patient.lastName}`,
          patientEmail: r.patient.email,
          accessType: r.accessType,
          status: r.status,
          requestReason: r.requestReason,
          requestedAt: r.requestedAt,
          approvedAt: r.approvedAt,
          rejectionReason: r.rejectionReason,
          expiryDate: r.expiryDate,
          daysRemaining: r.daysRemaining
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DOCTOR: SEARCH PATIENTS
// ============================================

/**
 * @desc    Search for patients by ID or phone to request access
 * @route   GET /api/permissions/search-patients
 * @access  Private (Doctor)
 */
exports.searchPatients = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least 3 characters to search'
      });
    }

    // Search by name, email, or phone
    const patients = await User.find({
      role: 'patient',
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ]
    }).select('_id firstName lastName email phone createdAt').limit(20);

    // Get permission status for each patient
    const patientsWithStatus = await Promise.all(
      patients.map(async (patient) => {
        const permission = await Permission.findOne({
          patient: patient._id,
          doctor: req.user.id,
          status: { $in: ['pending', 'approved', 'revoked'] }
        });

        return {
          id: patient._id,
          name: `${patient.firstName} ${patient.lastName}`,
          email: patient.email,
          phone: patient.phone,
          joinedAt: patient.createdAt,
          permissionStatus: permission?.status || 'none'
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        count: patientsWithStatus.length,
        patients: patientsWithStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// PATIENT: GET PENDING REQUESTS
// ============================================

/**
 * @desc    Get pending access requests for patient
 * @route   GET /api/permissions/pending
 * @access  Private (Patient)
 */
exports.getPendingRequests = async (req, res, next) => {
  try {
    const patientId = req.user.id;

    const pendingRequests = await Permission.find({
      patient: patientId,
      status: 'pending'
    })
      .populate('doctor', 'firstName lastName email role hospital')
      .sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        count: pendingRequests.length,
        requests: pendingRequests.map(r => ({
          id: r._id,
          doctorId: r.doctor._id,
          doctorName: `${r.doctor.firstName} ${r.doctor.lastName}`,
          doctorEmail: r.doctor.email,
          doctorRole: r.doctor.role,
          accessType: r.accessType,
          requestReason: r.requestReason,
          requestedAt: r.requestedAt,
          expiryDate: r.expiryDate,
          daysRequested: Math.ceil((r.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// PATIENT: APPROVE ACCESS
// ============================================

/**
 * @desc    Patient approves doctor's access request
 * @route   POST /api/permissions/:permissionId/approve
 * @access  Private (Patient)
 */
exports.approveAccess = async (req, res, next) => {
  try {
    const { permissionId } = req.params;
    const { notes } = req.body;
    const patientId = req.user.id;

    const permission = await Permission.findById(permissionId);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission request not found'
      });
    }

    // Verify ownership - compare both as strings
    const permissionPatientId = permission.patient.toString();
    const currentUserId = patientId.toString();
    
    console.log('DEBUG approve:', {
      permissionPatientId,
      currentUserId,
      match: permissionPatientId === currentUserId
    });

    if (permissionPatientId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve this request'
      });
    }

    if (permission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve a ${permission.status} request`
      });
    }

    // Approve
    await permission.approve(notes);
    await permission.populate('doctor', 'firstName lastName email');
    await permission.populate('patient', 'firstName lastName');

    console.log(`✅ Permission approved:`, {
      permissionId: permission._id,
      patientId: patientId,
      doctorId: permission.doctor._id,
      accessType: permission.accessType
    });

    res.status(200).json({
      success: true,
      message: 'Access approved successfully',
      data: {
        id: permission._id,
        doctor: `${permission.doctor.firstName} ${permission.doctor.lastName}`,
        accessType: permission.accessType,
        status: permission.status,
        approvedAt: permission.approvedAt,
        expiryDate: permission.expiryDate,
        daysRemaining: permission.daysRemaining
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// PATIENT: REJECT ACCESS
// ============================================

/**
 * @desc    Patient rejects doctor's access request
 * @route   POST /api/permissions/:permissionId/reject
 * @access  Private (Patient)
 */
exports.rejectAccess = async (req, res, next) => {
  try {
    const { permissionId } = req.params;
    const { reason } = req.body;
    const patientId = req.user.id;

    const permission = await Permission.findById(permissionId);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission request not found'
      });
    }

    // Verify ownership - compare both as strings
    const permissionPatientId = permission.patient.toString();
    const currentUserId = patientId.toString();

    if (permissionPatientId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this request'
      });
    }

    if (permission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a ${permission.status} request`
      });
    }

    // Reject
    await permission.reject(reason);
    await permission.populate('doctor', 'firstName lastName email');

    console.log(`❌ Permission rejected:`, {
      permissionId: permission._id,
      patientId: patientId,
      doctorId: permission.doctor._id
    });

    res.status(200).json({
      success: true,
      message: 'Access request rejected',
      data: {
        id: permission._id,
        doctor: `${permission.doctor.firstName} ${permission.doctor.lastName}`,
        status: permission.status,
        rejectedAt: permission.rejectedAt,
        reason: permission.rejectionReason
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// PATIENT: REVOKE ACCESS
// ============================================

/**
 * @desc    Patient revokes doctor's access
 * @route   POST /api/permissions/:permissionId/revoke
 * @access  Private (Patient)
 */
exports.revokeAccess = async (req, res, next) => {
  try {
    const { permissionId } = req.params;
    const { reason } = req.body;
    const patientId = req.user.id;

    const permission = await Permission.findById(permissionId);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    // Verify ownership - compare both as strings
    const permissionPatientId = permission.patient.toString();
    const currentUserId = patientId.toString();

    if (permissionPatientId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to revoke this permission'
      });
    }

    if (permission.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Can only revoke approved permissions'
      });
    }

    // Revoke
    await permission.revoke(reason);
    await permission.populate('doctor', 'firstName lastName email');

    console.log(`🔓 Permission revoked:`, {
      permissionId: permission._id,
      patientId: patientId,
      doctorId: permission.doctor._id
    });

    res.status(200).json({
      success: true,
      message: 'Access revoked successfully',
      data: {
        id: permission._id,
        doctor: `${permission.doctor.firstName} ${permission.doctor.lastName}`,
        status: permission.status,
        revokedAt: permission.revokedAt,
        reason: permission.revocationReason
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// PATIENT: GET ALL PERMISSIONS
// ============================================

/**
 * @desc    Get all permissions (active, revoked, rejected) for patient
 * @route   GET /api/permissions
 * @access  Private (Patient)
 */
exports.getPatientPermissions = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const { status } = req.query;

    let query = { patient: patientId };
    if (status) {
      query.status = status;
    }

    const permissions = await Permission.find(query)
      .populate('doctor', 'firstName lastName email role')
      .sort({ requestedAt: -1 });

    const grouped = {
      active: permissions.filter(p => p.isActive),
      pending: permissions.filter(p => p.status === 'pending'),
      revoked: permissions.filter(p => p.status === 'revoked'),
      rejected: permissions.filter(p => p.status === 'rejected'),
      expired: permissions.filter(p => p.status === 'expired')
    };

    res.status(200).json({
      success: true,
      data: {
        summary: {
          total: permissions.length,
          active: grouped.active.length,
          pending: grouped.pending.length,
          revoked: grouped.revoked.length,
          rejected: grouped.rejected.length,
          expired: grouped.expired.length
        },
        permissions: permissions.map(p => ({
          id: p._id,
          doctor: `${p.doctor.firstName} ${p.doctor.lastName}`,
          doctorEmail: p.doctor.email,
          accessType: p.accessType,
          status: p.status,
          requestReason: p.requestReason,
          requestedAt: p.requestedAt,
          approvedAt: p.approvedAt,
          expiryDate: p.expiryDate,
          daysRemaining: p.daysRemaining,
          isActive: p.isActive
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// MIDDLEWARE: CHECK ACCESS
// ============================================

/**
 * Middleware to check if doctor has permission to access patient data
 */
exports.checkAccess = async (req, res, next) => {
  try {
    const doctorId = req.user.id;
    const patientId = req.params.patientId || req.body.patientId;
    const accessType = req.query.accessType || 'medical_records';

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }

    // Check permission
    const hasAccess = await Permission.hasAccess(patientId, doctorId, accessType);

    if (!hasAccess) {
      console.log(`❌ Access denied: Doctor ${doctorId} tried to access patient ${patientId}`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this patient\'s data'
      });
    }

    // Record access
    const permission = await Permission.findOne({
      patient: patientId,
      doctor: doctorId,
      accessType: accessType,
      status: 'approved'
    });

    if (permission) {
      await permission.recordAccess();
    }

    // Proceed
    next();
  } catch (error) {
    next(error);
  }
};
