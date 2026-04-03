const express = require('express');
const router = express.Router();
const { protect, isDoctor } = require('../middleware/authMiddleware');
const DoctorHospitalMapping = require('../models/DoctorHospitalMapping');

// All routes require authentication and doctor role
router.use(protect);
router.use(isDoctor);

/**
 * @route   GET /api/doctor/approval-status
 * @desc    Get doctor's approval status at all hospitals
 * @access  Private (Doctor only)
 */
router.get('/approval-status', async (req, res, next) => {
  try {
    const doctorId = req.user.id;

    // Get all hospital mappings for this doctor
    const mappings = await DoctorHospitalMapping.find({ doctor: doctorId })
      .populate('hospital', 'name slug type address logo')
      .sort({ appliedAt: -1 });

    const applications = mappings.map(m => ({
      applicationId: m._id,
      hospital: {
        id: m.hospital._id,
        name: m.hospital.name,
        slug: m.hospital.slug,
        type: m.hospital.type,
        address: m.hospital.address
      },
      status: m.status,
      employmentType: m.employmentType,
      department: m.department,
      appliedAt: m.appliedAt,
      reviewedAt: m.reviewedAt,
      joiningDate: m.joiningDate,
      rejectionReason: m.rejectionReason
    }));

    const approved = applications.filter(a => a.status === 'approved');
    const pending = applications.filter(a => a.status === 'pending');
    const rejected = applications.filter(a => a.status === 'rejected');

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalApplications: applications.length,
          approved: approved.length,
          pending: pending.length,
          rejected: rejected.length,
          canPractice: approved.length > 0
        },
        applications
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/doctor/hospitals
 * @desc    Get doctor's approved hospitals
 * @access  Private (Doctor only)
 */
router.get('/hospitals', async (req, res, next) => {
  try {
    const doctorId = req.user.id;

    const approvedMappings = await DoctorHospitalMapping.find({
      doctor: doctorId,
      status: 'approved',
      isActive: true
    }).populate('hospital', 'name slug type address logo phone email');

    res.status(200).json({
      success: true,
      data: {
        count: approvedMappings.length,
        hospitals: approvedMappings.map(m => ({
          mappingId: m._id,
          hospital: {
            id: m.hospital._id,
            name: m.hospital.name,
            slug: m.hospital.slug,
            type: m.hospital.type,
            address: m.hospital.address,
            phone: m.hospital.phone,
            email: m.hospital.email
          },
          employmentType: m.employmentType,
          department: m.department,
          schedule: m.schedule,
          consultationFee: m.consultationFee,
          permissions: m.permissions,
          joiningDate: m.joiningDate
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
