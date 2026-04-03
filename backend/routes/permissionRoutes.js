const express = require('express');
const router = express.Router();
const { protect, isDoctor, isPatient } = require('../middleware/authMiddleware');
const permissionController = require('../controllers/permissionController');

// All permission routes require authentication
router.use(protect);

// ============================================
// DOCTOR ROUTES
// ============================================

/**
 * @route   POST /api/permissions/request-access
 * @desc    Doctor requests access to patient's data
 * @access  Private (Doctor)
 */
router.post('/request-access', isDoctor, permissionController.requestAccess);

/**
 * @route   GET /api/permissions/my-requests
 * @desc    Get doctor's access requests status
 * @access  Private (Doctor)
 */
router.get('/my-requests', isDoctor, permissionController.getMyAccessRequests);

/**
 * @route   GET /api/permissions/search-patients
 * @desc    Search for patients to request access
 * @access  Private (Doctor)
 */
router.get('/search-patients', isDoctor, permissionController.searchPatients);

// ============================================
// PATIENT ROUTES
// ============================================

/**
 * @route   GET /api/permissions/pending
 * @desc    Get pending access requests
 * @access  Private (Patient)
 */
router.get('/pending', isPatient, permissionController.getPendingRequests);

/**
 * @route   GET /api/permissions
 * @desc    Get all permissions (active, pending, revoked, rejected)
 * @access  Private (Patient)
 */
router.get('/', isPatient, permissionController.getPatientPermissions);

/**
 * @route   POST /api/permissions/:permissionId/approve
 * @desc    Patient approves access request
 * @access  Private (Patient)
 */
router.post('/:permissionId/approve', isPatient, permissionController.approveAccess);

/**
 * @route   POST /api/permissions/:permissionId/reject
 * @desc    Patient rejects access request
 * @access  Private (Patient)
 */
router.post('/:permissionId/reject', isPatient, permissionController.rejectAccess);

/**
 * @route   POST /api/permissions/:permissionId/revoke
 * @desc    Patient revokes approved access
 * @access  Private (Patient)
 */
router.post('/:permissionId/revoke', isPatient, permissionController.revokeAccess);

module.exports = router;
