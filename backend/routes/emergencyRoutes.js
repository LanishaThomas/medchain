/**
 * Emergency Access Routes
 * Handles QR generation and emergency data access
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const emergencyController = require('../controllers/emergencyController');

// Helper middleware to check roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
};

// Patient routes (generate QR, view history, manage access)
router.post('/generate-qr', protect, authorize('patient'), emergencyController.generateEmergencyQR);
router.patch('/settings', protect, authorize('patient'), emergencyController.updateEmergencySettings);
router.get('/history', protect, authorize('patient'), emergencyController.getAccessHistory);
router.get('/active-sessions', protect, authorize('patient'), emergencyController.getActiveSessions);
router.post('/revoke/:logId', protect, authorize('patient'), emergencyController.revokeAccess);
router.patch('/review/:logId', protect, authorize('patient'), emergencyController.reviewAccessLog);
router.post('/invalidate-qr', protect, authorize('patient'), emergencyController.invalidateCurrentQR);

// Hospital routes (scan QR and access data)
router.post('/access', protect, authorize('hospital_admin'), emergencyController.accessEmergencyData);

// Public emergency link — no auth required, token in query string
// Used when QR cannot be scanned (e.g. share link via SMS/WhatsApp)
router.get('/view', emergencyController.viewEmergencyDataByLink);

module.exports = router;
