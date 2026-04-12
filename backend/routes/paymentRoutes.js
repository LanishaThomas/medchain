const express = require('express');
const router = express.Router();
const { protect, isPatient } = require('../middleware/authMiddleware');
const {
  createOrder,
  verifyPayment,
  webhook,
  getPaymentStatus
} = require('../controllers/paymentController');

/**
 * Webhook MUST be registered before express.json() parses the body.
 * We handle raw body capture in server.js via a dedicated middleware.
 * This route does NOT use the `protect` middleware — Razorpay calls it directly.
 */
router.post('/webhook', webhook);

// All routes below require authentication
router.use(protect);

router.post('/create-order/:appointmentId', isPatient, createOrder);
router.post('/verify', isPatient, verifyPayment);
router.get('/status/:appointmentId', getPaymentStatus);

module.exports = router;
