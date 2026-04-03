const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospitalController');
const { protect, isHospitalAdmin } = require('../middleware/authMiddleware');
const { validate, validateParams, doctorApprovalSchema, doctorRejectionSchema, objectIdSchema } = require('../utils/validators');
const { z } = require('zod');

// Public/general routes (only auth required)
/**
 * @route   GET /api/hospital/list
 * @desc    Get all registered hospitals (for patients to select)
 * @access  Private (Any authenticated user)
 */
router.get('/list', protect, hospitalController.getAllHospitals);

// All routes below require authentication and hospital admin role
router.use(protect);
router.use(isHospitalAdmin);

// ============================================
// DOCTOR APPLICATION MANAGEMENT
// ============================================

/**
 * @route   GET /api/hospital/applications/pending
 * @desc    Get pending doctor applications
 * @access  Private (Hospital Admin only)
 */
router.get('/applications/pending', hospitalController.getPendingApplications);

/**
 * @route   GET /api/hospital/applications
 * @desc    Get all doctor applications (with filters)
 * @access  Private (Hospital Admin only)
 */
router.get('/applications', hospitalController.getAllApplications);

/**
 * @route   POST /api/hospital/applications/:applicationId/approve
 * @desc    Approve a doctor application
 * @access  Private (Hospital Admin only)
 */
router.post(
  '/applications/:applicationId/approve',
  validateParams(z.object({ applicationId: objectIdSchema })),
  validate(doctorApprovalSchema),
  hospitalController.approveDoctor
);

/**
 * @route   POST /api/hospital/applications/:applicationId/reject
 * @desc    Reject a doctor application
 * @access  Private (Hospital Admin only)
 */
router.post(
  '/applications/:applicationId/reject',
  validateParams(z.object({ applicationId: objectIdSchema })),
  validate(doctorRejectionSchema),
  hospitalController.rejectDoctor
);

// ============================================
// DOCTOR MANAGEMENT
// ============================================

/**
 * @route   GET /api/hospital/doctors
 * @desc    Get all doctors in hospital
 * @access  Private (Hospital Admin only)
 */
router.get('/doctors', hospitalController.getHospitalDoctors);

/**
 * @route   POST /api/hospital/doctors/:doctorId/suspend
 * @desc    Suspend a doctor
 * @access  Private (Hospital Admin only)
 */
router.post(
  '/doctors/:doctorId/suspend',
  validateParams(z.object({ doctorId: objectIdSchema })),
  hospitalController.suspendDoctor
);

/**
 * @route   POST /api/hospital/doctors/:doctorId/reactivate
 * @desc    Reactivate a suspended doctor
 * @access  Private (Hospital Admin only)
 */
router.post(
  '/doctors/:doctorId/reactivate',
  validateParams(z.object({ doctorId: objectIdSchema })),
  hospitalController.reactivateDoctor
);

// ============================================
// HOSPITAL PROFILE
// ============================================

/**
 * @route   GET /api/hospital/profile
 * @desc    Get hospital profile (admin view)
 * @access  Private (Hospital Admin only)
 */
router.get('/profile', hospitalController.getHospitalProfile);

/**
 * @route   PUT /api/hospital/profile
 * @desc    Update hospital profile
 * @access  Private (Hospital Admin only)
 */
router.put('/profile', hospitalController.updateHospitalProfile);

module.exports = router;
