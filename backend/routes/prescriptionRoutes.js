const express = require('express');
const router = express.Router();
const { protect, isDoctor, isPatient } = require('../middleware/authMiddleware');
const {
  createPrescription,
  getDoctorPrescriptions,
  getPatientPrescriptions
} = require('../controllers/prescriptionController');

router.use(protect);

// Doctor routes
router.post('/', isDoctor, createPrescription);
router.get('/doctor', isDoctor, getDoctorPrescriptions);

// Patient routes
router.get('/patient', isPatient, getPatientPrescriptions);

module.exports = router;
