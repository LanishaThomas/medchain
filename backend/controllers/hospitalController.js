const Hospital = require('../models/Hospital');
const User = require('../models/User');
const DoctorHospitalMapping = require('../models/DoctorHospitalMapping');
const Notification = require('../models/Notification');

// ============================================
// DOCTOR APPROVAL MANAGEMENT
// ============================================

/**
 * @desc    Get pending doctor applications
 * @route   GET /api/hospital/applications/pending
 * @access  Private (Hospital Admin only)
 */
exports.getPendingApplications = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    // Find hospital where user is admin
    const hospital = await Hospital.findByAdmin(adminId);
    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin of any hospital'
      });
    }

    // Get pending applications
    const applications = await DoctorHospitalMapping.getPendingApplications(hospital._id);

    res.status(200).json({
      success: true,
      data: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        count: applications.length,
        applications: applications.map(app => ({
          applicationId: app._id,
          doctor: {
            id: app.doctor._id,
            fullName: `${app.doctor.firstName} ${app.doctor.lastName}`,
            email: app.doctor.email,
            phone: app.doctor.phone,
            profileImage: app.doctor.profileImage,
            licenseNumber: app.doctor.doctorProfile?.licenseNumber,
            specializations: app.doctor.doctorProfile?.specializations,
            yearsOfExperience: app.doctor.doctorProfile?.yearsOfExperience
          },
          applicationNote: app.applicationNote,
          employmentType: app.employmentType,
          department: app.department,
          appliedAt: app.appliedAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all doctor applications (all statuses)
 * @route   GET /api/hospital/applications
 * @access  Private (Hospital Admin only)
 */
exports.getAllApplications = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    // Find hospital where user is admin
    const hospital = await Hospital.findByAdmin(adminId);
    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin of any hospital'
      });
    }

    // Build query
    const query = { hospital: hospital._id };
    if (status) query.status = status;

    // Get applications with pagination
    const applications = await DoctorHospitalMapping.find(query)
      .populate('doctor', 'firstName lastName email phone doctorProfile profileImage')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ appliedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await DoctorHospitalMapping.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        applications: applications.map(app => ({
          applicationId: app._id,
          doctor: {
            id: app.doctor._id,
            fullName: `${app.doctor.firstName} ${app.doctor.lastName}`,
            email: app.doctor.email,
            phone: app.doctor.phone,
            profileImage: app.doctor.profileImage,
            licenseNumber: app.doctor.doctorProfile?.licenseNumber,
            specializations: app.doctor.doctorProfile?.specializations
          },
          status: app.status,
          applicationNote: app.applicationNote,
          employmentType: app.employmentType,
          department: app.department,
          reviewedBy: app.reviewedBy ? `${app.reviewedBy.firstName} ${app.reviewedBy.lastName}` : null,
          reviewedAt: app.reviewedAt,
          reviewNotes: app.reviewNotes,
          rejectionReason: app.rejectionReason,
          appliedAt: app.appliedAt,
          joiningDate: app.joiningDate
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve a doctor application
 * @route   POST /api/hospital/applications/:applicationId/approve
 * @access  Private (Hospital Admin only)
 */
exports.approveDoctor = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { applicationId } = req.params;
    const { notes, department, schedule, consultationFee, permissions } = req.body;

    // Find application
    const application = await DoctorHospitalMapping.findById(applicationId)
      .populate('hospital')
      .populate('doctor', 'firstName lastName email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify admin belongs to this hospital
    if (!application.hospital.isAdmin(adminId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this application'
      });
    }

    // Check if already processed
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application has already been ${application.status}`
      });
    }

    // Update application with additional details if provided
    if (department) application.department = department;
    if (schedule) application.schedule = schedule;
    if (consultationFee) application.consultationFee = consultationFee;
    if (permissions) application.permissions = { ...application.permissions, ...permissions };

    // Approve
    await application.approve(adminId, notes);

    // Create notification for doctor
    await Notification.create({
      user: application.doctor._id,
      type: 'doctor_application',
      title: 'Application Approved',
      message: `Your application to join ${application.hospital.name} has been approved!`,
      priority: 'high',
      data: {
        hospitalId: application.hospital._id,
        hospitalName: application.hospital.name,
        applicationId: application._id
      }
    });

    res.status(200).json({
      success: true,
      message: 'Doctor application approved successfully',
      data: {
        applicationId: application._id,
        doctor: {
          id: application.doctor._id,
          fullName: `${application.doctor.firstName} ${application.doctor.lastName}`,
          email: application.doctor.email
        },
        status: application.status,
        joiningDate: application.joiningDate,
        reviewedAt: application.reviewedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a doctor application
 * @route   POST /api/hospital/applications/:applicationId/reject
 * @access  Private (Hospital Admin only)
 */
exports.rejectDoctor = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { applicationId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Find application
    const application = await DoctorHospitalMapping.findById(applicationId)
      .populate('hospital')
      .populate('doctor', 'firstName lastName email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify admin belongs to this hospital
    if (!application.hospital.isAdmin(adminId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this application'
      });
    }

    // Check if already processed
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application has already been ${application.status}`
      });
    }

    // Reject
    await application.reject(adminId, reason);

    // Create notification for doctor
    await Notification.create({
      user: application.doctor._id,
      type: 'doctor_application',
      title: 'Application Update',
      message: `Your application to join ${application.hospital.name} was not approved. Reason: ${reason}`,
      priority: 'high',
      data: {
        hospitalId: application.hospital._id,
        hospitalName: application.hospital.name,
        applicationId: application._id,
        rejectionReason: reason
      }
    });

    res.status(200).json({
      success: true,
      message: 'Doctor application rejected',
      data: {
        applicationId: application._id,
        doctor: {
          id: application.doctor._id,
          fullName: `${application.doctor.firstName} ${application.doctor.lastName}`
        },
        status: application.status,
        rejectionReason: reason
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Suspend a doctor
 * @route   POST /api/hospital/doctors/:doctorId/suspend
 * @access  Private (Hospital Admin only)
 */
exports.suspendDoctor = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { doctorId } = req.params;
    const { reason } = req.body;

    // Find hospital where user is admin
    const hospital = await Hospital.findByAdmin(adminId);
    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin of any hospital'
      });
    }

    // Find mapping
    const mapping = await DoctorHospitalMapping.findOne({
      doctor: doctorId,
      hospital: hospital._id,
      status: 'approved'
    }).populate('doctor', 'firstName lastName email');

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found in your hospital'
      });
    }

    // Suspend
    await mapping.suspend(adminId, reason);

    // Notify doctor
    await Notification.create({
      user: mapping.doctor._id,
      type: 'account_status',
      title: 'Hospital Access Suspended',
      message: `Your access to ${hospital.name} has been suspended. ${reason ? `Reason: ${reason}` : ''}`,
      priority: 'high',
      data: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        reason
      }
    });

    res.status(200).json({
      success: true,
      message: 'Doctor suspended successfully',
      data: {
        doctor: {
          id: mapping.doctor._id,
          fullName: `${mapping.doctor.firstName} ${mapping.doctor.lastName}`
        },
        status: mapping.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reactivate a suspended doctor
 * @route   POST /api/hospital/doctors/:doctorId/reactivate
 * @access  Private (Hospital Admin only)
 */
exports.reactivateDoctor = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { doctorId } = req.params;
    const { notes } = req.body;

    // Find hospital where user is admin
    const hospital = await Hospital.findByAdmin(adminId);
    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin of any hospital'
      });
    }

    // Find mapping
    const mapping = await DoctorHospitalMapping.findOne({
      doctor: doctorId,
      hospital: hospital._id,
      status: 'suspended'
    }).populate('doctor', 'firstName lastName email');

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Suspended doctor not found'
      });
    }

    // Reactivate
    await mapping.reactivate(adminId, notes);

    // Notify doctor
    await Notification.create({
      user: mapping.doctor._id,
      type: 'account_status',
      title: 'Hospital Access Restored',
      message: `Your access to ${hospital.name} has been restored.`,
      priority: 'normal',
      data: {
        hospitalId: hospital._id,
        hospitalName: hospital.name
      }
    });

    res.status(200).json({
      success: true,
      message: 'Doctor reactivated successfully',
      data: {
        doctor: {
          id: mapping.doctor._id,
          fullName: `${mapping.doctor.firstName} ${mapping.doctor.lastName}`
        },
        status: mapping.status
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// HOSPITAL DOCTORS LIST
// ============================================

/**
 * @desc    Get all doctors in hospital
 * @route   GET /api/hospital/doctors
 * @access  Private (Hospital Admin only)
 */
exports.getHospitalDoctors = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { status, department, page = 1, limit = 20 } = req.query;

    // Find hospital where user is admin
    const hospital = await Hospital.findByAdmin(adminId);
    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin of any hospital'
      });
    }

    // Build query
    const query = { 
      hospital: hospital._id,
      status: status || 'approved'
    };
    if (department) query.department = department;

    // Get doctors with pagination
    const mappings = await DoctorHospitalMapping.find(query)
      .populate('doctor', 'firstName lastName email phone doctorProfile profileImage')
      .sort({ joiningDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await DoctorHospitalMapping.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        doctors: mappings.map(m => ({
          mappingId: m._id,
          doctor: {
            id: m.doctor._id,
            fullName: `${m.doctor.firstName} ${m.doctor.lastName}`,
            email: m.doctor.email,
            phone: m.doctor.phone,
            profileImage: m.doctor.profileImage,
            licenseNumber: m.doctor.doctorProfile?.licenseNumber,
            specializations: m.doctor.doctorProfile?.specializations,
            yearsOfExperience: m.doctor.doctorProfile?.yearsOfExperience
          },
          status: m.status,
          employmentType: m.employmentType,
          department: m.department,
          designation: m.designation,
          schedule: m.schedule,
          consultationFee: m.consultationFee,
          isAvailable: m.isAvailable,
          joiningDate: m.joiningDate
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// HOSPITAL PROFILE
// ============================================

/**
 * @desc    Get hospital profile (admin view)
 * @route   GET /api/hospital/profile
 * @access  Private (Hospital Admin only)
 */
exports.getHospitalProfile = async (req, res, next) => {
  try {
    const adminId = req.user.id;

    // Find hospital where user is admin
    const hospital = await Hospital.findByAdmin(adminId)
      .populate('primaryAdmin', 'firstName lastName email')
      .populate('additionalAdmins', 'firstName lastName email');

    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin of any hospital'
      });
    }

    // Get counts
    const MedicalRecord = require('../models/MedicalRecord');
    const [approvedDoctors, pendingApplications, totalRecords] = await Promise.all([
      DoctorHospitalMapping.countDocuments({ hospital: hospital._id, status: 'approved' }),
      DoctorHospitalMapping.countDocuments({ hospital: hospital._id, status: 'pending' }),
      MedicalRecord.countDocuments({ hospital: hospital._id, status: 'active' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        hospital: {
          id: hospital._id,
          name: hospital.name,
          slug: hospital.slug,
          type: hospital.type,
          description: hospital.description,
          registrationNumber: hospital.registrationNumber,
          licenseNumber: hospital.licenseNumber,
          licenseExpiry: hospital.licenseExpiry,
          email: hospital.email,
          phone: hospital.phone,
          emergencyPhone: hospital.emergencyPhone,
          website: hospital.website,
          address: hospital.address,
          specialties: hospital.specialties,
          departments: hospital.departments,
          facilities: hospital.facilities,
          bedCount: hospital.bedCount,
          operatingHours: hospital.operatingHours,
          is24HoursEmergency: hospital.is24HoursEmergency,
          settings: hospital.settings,
          logo: hospital.logo,
          images: hospital.images,
          verificationStatus: hospital.verificationStatus,
          isActive: hospital.isActive,
          createdAt: hospital.createdAt
        },
        admins: {
          primary: hospital.primaryAdmin,
          additional: hospital.additionalAdmins
        },
        stats: {
          approvedDoctors,
          pendingApplications,
          totalRecords
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update hospital profile
 * @route   PUT /api/hospital/profile
 * @access  Private (Hospital Admin only)
 */
exports.updateHospitalProfile = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const updateFields = req.body;

    // Find hospital where user is admin
    const hospital = await Hospital.findByAdmin(adminId);
    if (!hospital) {
      return res.status(403).json({
        success: false,
        message: 'You are not an admin of any hospital'
      });
    }

    // Fields that cannot be updated
    const protectedFields = ['registrationNumber', 'primaryAdmin', 'verificationStatus', 'walletAddress'];
    protectedFields.forEach(field => delete updateFields[field]);

    // Update
    Object.assign(hospital, updateFields);
    await hospital.save();

    res.status(200).json({
      success: true,
      message: 'Hospital profile updated successfully',
      data: {
        hospital: {
          id: hospital._id,
          name: hospital.name,
          email: hospital.email,
          phone: hospital.phone,
          address: hospital.address,
          settings: hospital.settings
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all registered hospitals (for patients)
 * @route   GET /api/hospital/list
 * @access  Private (Any authenticated user)
 */
exports.getAllHospitals = async (req, res, next) => {
  try {
    console.log('🔍 Fetching hospitals for booking...');
    
    // Only filter by isActive - no verification required
    const hospitals = await Hospital.find({ isActive: true })
      .select('name type description email phone address specialties facilities bedCount is24HoursEmergency logo')
      .sort({ name: 1 });

    console.log(`✅ Found ${hospitals.length} active hospitals`);
    if (hospitals.length === 0) {
      console.log('⚠️  No active hospitals found! Check database:');
      const allHospitals = await Hospital.find({}).select('name isActive');
      console.log('   All hospitals in DB:', allHospitals.map(h => ({ 
        name: h.name, 
        isActive: h.isActive
      })));
    }

    res.status(200).json({
      success: true,
      count: hospitals.length,
      data: hospitals.map(h => ({
        id: h._id,
        name: h.name,
        type: h.type,
        description: h.description,
        email: h.email,
        phone: h.phone,
        address: h.address,
        specialties: h.specialties,
        facilities: h.facilities,
        bedCount: h.bedCount,
        is24HoursEmergency: h.is24HoursEmergency,
        logo: h.logo
      }))
    });
  } catch (error) {
    console.error('❌ Error in getAllHospitals:', error);
    next(error);
  }
};
