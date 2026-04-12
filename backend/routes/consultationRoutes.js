const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const consultationController = require('../controllers/consultationController');

router.use(protect);

router.get('/:appointmentId', consultationController.getConsultationByAppointment);
router.post('/:appointmentId/doctor/join', consultationController.joinAsDoctor);
router.post('/:appointmentId/patient/join', consultationController.joinAsPatient);
router.post('/:appointmentId/end', consultationController.endConsultation);

module.exports = router;
