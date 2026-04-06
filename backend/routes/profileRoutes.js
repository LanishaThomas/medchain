/**
 * Profile Routes
 * Patient and Doctor profile management
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');

// Helper middleware to check roles
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('🔐 Authorization check:', {
      userRole: req.user?.role,
      requiredRoles: roles,
      userId: req.user?.id,
      email: req.user?.email
    });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Your role: ${req.user.role}. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
};

// Patient profile routes
router.get('/patient', protect, authorize('patient'), profileController.getPatientProfile);
router.put('/patient', protect, authorize('patient'), profileController.updatePatientProfile);

// Doctor access to patient emergency info
router.get(
  '/patient/:patientId/emergency-info', 
  protect, 
  authorize('doctor'), 
  profileController.getPatientEmergencyInfo
);

router.get(
  '/patient/:patientId/details',
  protect,
  authorize('doctor'),
  profileController.getPatientProfileForDoctor
);

// Doctor profile routes
router.get('/doctor', protect, authorize('doctor'), profileController.getDoctorProfile);
router.get('/doctor/:doctorId', profileController.getDoctorProfile); // Public (optional auth)
router.get('/doctor/slug/:slug', profileController.getDoctorProfileBySlug); // Public by slug
router.get('/doctor/public/:slug', profileController.getDoctorProfileBySlug); // Public by slug (alias)
router.put('/doctor', protect, authorize('doctor'), profileController.updateDoctorProfile);
router.post('/doctor/generate-slug', protect, authorize('doctor'), profileController.generateShareableSlug);

module.exports = router;
