const express = require('express');
const router = express.Router();
const {
  requestAppointment,
  getMyAppointments,
  getPendingAppointments,
  getDoctorAppointments,
  getTodayAppointments,
  approveAppointment,
  rejectAppointment,
  rescheduleAppointment,
  acceptReschedule,
  declineReschedule,
  cancelAppointment,
  completeAppointment,
  markNoShow,
  getAvailableDoctors,
  getAppointmentById
} = require('../controllers/appointmentController');
const { protect, isDoctor, isPatient } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// ===================
// PATIENT ROUTES
// ===================

// Get available doctors for booking
router.get('/doctors', isPatient, getAvailableDoctors);

// Request a new appointment
router.post('/request', isPatient, requestAppointment);

// Get patient's own appointments
router.get('/my-appointments', isPatient, getMyAppointments);

// Accept reschedule proposal
router.post('/:id/accept-reschedule', isPatient, acceptReschedule);

// Decline reschedule proposal
router.post('/:id/decline-reschedule', isPatient, declineReschedule);

// ===================
// DOCTOR ROUTES
// ===================

// Get pending appointment requests
router.get('/pending', isDoctor, getPendingAppointments);

// Get all doctor's appointments
router.get('/doctor', isDoctor, getDoctorAppointments);

// Get today's appointments
router.get('/today', isDoctor, getTodayAppointments);

// Approve appointment
router.post('/:id/approve', isDoctor, approveAppointment);

// Reject appointment
router.post('/:id/reject', isDoctor, rejectAppointment);

// Reschedule appointment
router.post('/:id/reschedule', isDoctor, rescheduleAppointment);

// Mark appointment as completed
router.post('/:id/complete', isDoctor, completeAppointment);

// Mark appointment as no-show
router.post('/:id/no-show', isDoctor, markNoShow);

// ===================
// SHARED ROUTES
// ===================

// Get appointment by ID (patient or doctor)
router.get('/:id', getAppointmentById);

// Cancel appointment (patient or doctor)
router.post('/:id/cancel', cancelAppointment);

module.exports = router;
