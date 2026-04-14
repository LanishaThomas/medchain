const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const blockchainController = require('../controllers/blockchainController');

router.use(protect);
router.get('/logs', blockchainController.getLogs);

// Dedicated consultation audit verification (must be before generic :entityType route)
router.get('/verify/consultation/:consultationId', blockchainController.verifyConsultation);

router.get('/verify/:entityType/:entityId', blockchainController.verifyIntegrity);
router.get('/verify-history/:entityId', blockchainController.verifyHistory);

module.exports = router;
