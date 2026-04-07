const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Permission = require('../models/Permission');
const DoctorHospitalMapping = require('../models/DoctorHospitalMapping');
const {
  executeWithBlockchainConsistency,
  hashFromResult,
  buildSnapshot,
  restoreSnapshot
} = require('../services/blockchainConsistencyService');

async function syncAppointmentIntegrity({
  appointment,
  actorId,
  actionType,
  hashSource,
  metadata = {},
  previousSnapshot = null,
  createMode = false
}) {
  await executeWithBlockchainConsistency(
    async () => ({
      entityType: 'APPOINTMENT',
      entityId: appointment._id.toString(),
      actorId: actorId.toString(),
      actionType,
      hashSource,
      metadata,
      dbState: {
        model: 'Appointment',
        operation: createMode ? 'CREATE' : 'UPDATE',
        id: appointment._id.toString()
      },
      previousSnapshot,
      createdId: appointment._id,
      onSuccess: async (auditDoc) => {
        await Appointment.updateOne(
          { _id: appointment._id },
          {
            $set: {
              blockchainHash: auditDoc.dataHash,
              blockchainTxHash: auditDoc.blockchainTxHash,
              blockchainTimestamp: auditDoc.timestamp
            }
          }
        );
      }
    }),
    async (operationResult) => {
      if (createMode) {
        await Appointment.findByIdAndDelete(operationResult.createdId);
        return;
      }
      await restoreSnapshot(Appointment, operationResult.previousSnapshot);
    },
    hashFromResult
  );
}

/**
 * @desc    Patient requests an appointment
 * @route   POST /api/appointments/request
 * @access  Patient only
 */
const requestAppointment = async (req, res) => {
  try {
    const patientId = req.user.id;  // Changed from req.user._id to req.user.id
    const { 
      doctorId, 
      hospitalId,
      requestedDate, 
      requestedTime, 
      reason,
      symptoms,
      appointmentType,
      priority,
      duration
    } = req.body;

    // Validate required fields
    if (!doctorId || !requestedDate || !requestedTime || !reason) {
      console.log('❌ Validation failed:', { doctorId, requestedDate, requestedTime, reason });
      return res.status(400).json({
        success: false,
        message: 'Doctor, date, time, and reason are required'
      });
    }

    console.log('✅ Patient ID:', patientId);
    console.log('✅ Request data:', {
      patientId,
      doctorId,
      hospitalId,
      requestedDate,
      requestedTime,
      reason,
      appointmentType,
      priority
    });

    // Verify doctor exists and is approved at hospital
    console.log('🔍 Verifying doctor:', doctorId);
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      console.log('❌ Doctor not found:', doctorId);
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    console.log('✅ Doctor found:', doctor.firstName, doctor.lastName);

    // If hospital specified, verify doctor is approved there
    if (hospitalId) {
      console.log('🔍 Verifying hospital mapping:', { doctorId, hospitalId });
      const mapping = await DoctorHospitalMapping.findOne({
        doctor: doctorId,
        hospital: hospitalId,
        status: 'approved'
      });
      if (!mapping) {
        console.log('❌ No approved mapping found');
        return res.status(400).json({
          success: false,
          message: 'Doctor is not affiliated with this hospital'
        });
      }
      console.log('✅ Mapping verified');
    }

    // Check for conflicting appointments (same doctor, same time, same date)
    const requestDate = new Date(requestedDate);
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      requestedDate: {
        $gte: new Date(requestDate.setHours(0, 0, 0, 0)),
        $lt: new Date(requestDate.setHours(23, 59, 59, 999))
      },
      requestedTime: requestedTime,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked or pending. Please choose another time.'
      });
    }

    // Create appointment request
    console.log('📝 Creating appointment...');
    const appointment = new Appointment({
      patient: patientId,
      doctor: doctorId,
      hospital: hospitalId || null,
      requestedDate: new Date(requestedDate),
      requestedTime,
      reason,
      symptoms: symptoms || [],
      appointmentType: appointmentType || 'consultation',
      priority: priority || 'normal',
      duration: duration || 30,
      status: 'pending',
      requestedAt: new Date()
    });

    console.log('💾 Saving appointment...');
    await appointment.save();
    console.log('✅ Appointment saved:', appointment._id);

    await syncAppointmentIntegrity({
      appointment,
      actorId: patientId,
      actionType: 'CREATE',
      createMode: true,
      hashSource: {
        id: appointment._id.toString(),
        appointmentNumber: appointment.appointmentNumber,
        patient: appointment.patient.toString(),
        doctor: appointment.doctor.toString(),
        hospital: appointment.hospital ? appointment.hospital.toString() : null,
        requestedDate: appointment.requestedDate,
        requestedTime: appointment.requestedTime,
        reason: appointment.reason,
        status: appointment.status,
        appointmentType: appointment.appointmentType,
        priority: appointment.priority
      }
    });

    // Populate for response
    console.log('📦 Populating appointment data...');
    await appointment.populate('doctor', 'firstName lastName doctorProfile');
    await appointment.populate('hospital', 'name');
    console.log('✅ Populated successfully');

    res.status(201).json({
      success: true,
      message: 'Appointment request submitted. Waiting for doctor approval.',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        doctor: {
          id: appointment.doctor._id,
          name: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
          specialization: appointment.doctor.doctorProfile?.specializations?.[0] || 'General Medicine'
        },
        hospital: appointment.hospital ? appointment.hospital.name : null,
        requestedDate: appointment.requestedDate,
        requestedTime: appointment.requestedTime,
        reason: appointment.reason,
        appointmentType: appointment.appointmentType,
        status: appointment.status,
        requestedAt: appointment.requestedAt
      }
    });

  } catch (error) {
    console.error('❌ Request appointment error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to request appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Get patient's appointments
 * @route   GET /api/appointments/my-appointments
 * @access  Patient only
 */
const getMyAppointments = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { patient: patientId };
    if (status) query.status = status;

    const appointments = await Appointment.find(query)
      .populate('doctor', 'firstName lastName doctorProfile phone')
      .populate('hospital', 'name address')
      .sort({ requestedDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: appointments.map(apt => ({
        id: apt._id,
        appointmentNumber: apt.appointmentNumber,
        doctor: {
          id: apt.doctor._id,
          name: `Dr. ${apt.doctor.firstName} ${apt.doctor.lastName}`,
          specialization: apt.doctor.doctorProfile?.specializations?.[0] || 'General Medicine',
          phone: apt.doctor.phone
        },
        hospital: apt.hospital ? {
          name: apt.hospital.name,
          address: apt.hospital.address
        } : null,
        requestedDate: apt.requestedDate,
        requestedTime: apt.requestedTime,
        approvedDate: apt.approvedDate,
        approvedTime: apt.approvedTime,
        proposedDate: apt.proposedDate,
        proposedTime: apt.proposedTime,
        reason: apt.reason,
        appointmentType: apt.appointmentType,
        priority: apt.priority,
        status: apt.status,
        doctorResponse: apt.doctorResponse,
        meetingLink: apt.meetingLink,
        requestedAt: apt.requestedAt,
        respondedAt: apt.respondedAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get my appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

/**
 * @desc    Get pending appointment requests for doctor
 * @route   GET /api/appointments/pending
 * @access  Doctor only
 */
const getPendingAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;

    const appointments = await Appointment.find({
      doctor: doctorId,
      status: 'pending'
    })
      .populate('patient', 'firstName lastName phone email dateOfBirth gender')
      .populate('hospital', 'name')
      .sort({ requestedDate: 1, requestedTime: 1 });

    res.json({
      success: true,
      count: appointments.length,
      data: appointments.map(apt => ({
        id: apt._id,
        appointmentNumber: apt.appointmentNumber,
        patient: {
          id: apt.patient._id,
          name: `${apt.patient.firstName} ${apt.patient.lastName}`,
          phone: apt.patient.phone,
          email: apt.patient.email,
          age: apt.patient.dateOfBirth 
            ? Math.floor((Date.now() - new Date(apt.patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
            : null,
          gender: apt.patient.gender
        },
        hospital: apt.hospital ? apt.hospital.name : null,
        requestedDate: apt.requestedDate,
        requestedTime: apt.requestedTime,
        reason: apt.reason,
        symptoms: apt.symptoms,
        appointmentType: apt.appointmentType,
        priority: apt.priority,
        duration: apt.duration,
        requestedAt: apt.requestedAt
      }))
    });

  } catch (error) {
    console.error('Get pending appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending appointments',
      error: error.message
    });
  }
};

/**
 * @desc    Get all appointments for doctor (with filters)
 * @route   GET /api/appointments/doctor
 * @access  Doctor only
 */
const getDoctorAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { status, date, page = 1, limit = 20 } = req.query;

    const query = { doctor: doctorId };
    
    if (status) {
      query.status = status;
    }
    
    if (date) {
      const searchDate = new Date(date);
      query.$or = [
        { 
          approvedDate: {
            $gte: new Date(searchDate.setHours(0, 0, 0, 0)),
            $lt: new Date(searchDate.setHours(23, 59, 59, 999))
          }
        },
        {
          requestedDate: {
            $gte: new Date(searchDate.setHours(0, 0, 0, 0)),
            $lt: new Date(searchDate.setHours(23, 59, 59, 999))
          },
          approvedDate: null
        }
      ];
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName phone email')
      .populate('hospital', 'name')
      .sort({ requestedDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    // Get counts by status
    const statusCounts = await Appointment.aggregate([
      { $match: { doctor: doctorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = {
      pending: 0,
      approved: 0,
      completed: 0,
      rejected: 0,
      rescheduled: 0,
      cancelled: 0,
      no_show: 0
    };
    statusCounts.forEach(s => {
      counts[s._id] = s.count;
    });

    res.json({
      success: true,
      counts,
      data: appointments.map(apt => ({
        id: apt._id,
        appointmentNumber: apt.appointmentNumber,
        patient: {
          id: apt.patient._id,
          name: `${apt.patient.firstName} ${apt.patient.lastName}`,
          phone: apt.patient.phone,
          email: apt.patient.email
        },
        hospital: apt.hospital ? apt.hospital.name : null,
        requestedDate: apt.requestedDate,
        requestedTime: apt.requestedTime,
        approvedDate: apt.approvedDate,
        approvedTime: apt.approvedTime,
        reason: apt.reason,
        appointmentType: apt.appointmentType,
        priority: apt.priority,
        status: apt.status,
        doctorNotes: apt.doctorNotes,
        requestedAt: apt.requestedAt,
        respondedAt: apt.respondedAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get doctor appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

/**
 * @desc    Get today's appointments for doctor
 * @route   GET /api/appointments/today
 * @access  Doctor only
 */
const getTodayAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await Appointment.find({
      doctor: doctorId,
      status: 'approved',
      $or: [
        { approvedDate: { $gte: today, $lt: tomorrow } },
        { requestedDate: { $gte: today, $lt: tomorrow }, approvedDate: null }
      ]
    })
      .populate('patient', 'firstName lastName phone')
      .populate('hospital', 'name')
      .sort({ approvedTime: 1 });

    res.json({
      success: true,
      count: appointments.length,
      data: appointments.map(apt => ({
        id: apt._id,
        appointmentNumber: apt.appointmentNumber,
        patient: {
          id: apt.patient._id,
          name: `${apt.patient.firstName} ${apt.patient.lastName}`,
          phone: apt.patient.phone
        },
        hospital: apt.hospital ? apt.hospital.name : null,
        time: apt.approvedTime || apt.requestedTime,
        reason: apt.reason,
        appointmentType: apt.appointmentType,
        priority: apt.priority,
        duration: apt.duration,
        meetingLink: apt.meetingLink
      }))
    });

  } catch (error) {
    console.error('Get today appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s appointments',
      error: error.message
    });
  }
};

/**
 * @desc    Doctor approves an appointment
 * @route   POST /api/appointments/:id/approve
 * @access  Doctor only
 */
const approveAppointment = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;
    const { approvedDate, approvedTime, notes, meetingLink } = req.body;

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify this doctor owns the appointment
    if (appointment.doctor.toString() !== doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve this appointment'
      });
    }

    if (appointment.status !== 'pending' && appointment.status !== 'rescheduled') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve appointment with status: ${appointment.status}`
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Update appointment
    appointment.status = 'approved';
    appointment.approvedDate = approvedDate ? new Date(approvedDate) : appointment.requestedDate;
    appointment.approvedTime = approvedTime || appointment.requestedTime;
    appointment.doctorNotes = notes;
    appointment.meetingLink = meetingLink;
    appointment.respondedAt = new Date();

    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: doctorId,
      actionType: 'APPROVE',
      previousSnapshot,
      hashSource: {
        id: appointment._id.toString(),
        appointmentNumber: appointment.appointmentNumber,
        approvedDate: appointment.approvedDate,
        approvedTime: appointment.approvedTime,
        status: appointment.status,
        doctorNotes: appointment.doctorNotes || ''
      }
    });

    // Populate for response
    await appointment.populate('patient', 'firstName lastName email phone');

    res.json({
      success: true,
      message: 'Appointment approved successfully',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        approvedDate: appointment.approvedDate,
        approvedTime: appointment.approvedTime,
        status: appointment.status
      }
    });

  } catch (error) {
    console.error('Approve appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve appointment',
      error: error.message
    });
  }
};

/**
 * @desc    Doctor rejects an appointment
 * @route   POST /api/appointments/:id/reject
 * @access  Doctor only
 */
const rejectAppointment = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify this doctor owns the appointment
    if (appointment.doctor.toString() !== doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this appointment'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject appointment with status: ${appointment.status}`
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Update appointment
    appointment.status = 'rejected';
    appointment.doctorResponse = reason;
    appointment.respondedAt = new Date();

    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: doctorId,
      actionType: 'REJECT',
      previousSnapshot,
      hashSource: {
        id: appointment._id.toString(),
        appointmentNumber: appointment.appointmentNumber,
        status: appointment.status,
        reason: appointment.doctorResponse,
        respondedAt: appointment.respondedAt
      }
    });

    res.json({
      success: true,
      message: 'Appointment rejected',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        status: appointment.status,
        reason: appointment.doctorResponse
      }
    });

  } catch (error) {
    console.error('Reject appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject appointment',
      error: error.message
    });
  }
};

/**
 * @desc    Doctor reschedules an appointment
 * @route   POST /api/appointments/:id/reschedule
 * @access  Doctor only
 */
const rescheduleAppointment = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;
    const { proposedDate, proposedTime, message } = req.body;

    if (!proposedDate || !proposedTime) {
      return res.status(400).json({
        success: false,
        message: 'Proposed date and time are required'
      });
    }

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify this doctor owns the appointment
    if (appointment.doctor.toString() !== doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reschedule this appointment'
      });
    }

    if (appointment.status !== 'pending' && appointment.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule appointment with status: ${appointment.status}`
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Check for conflicts at new time
    const propDate = new Date(proposedDate);
    const conflict = await Appointment.findOne({
      doctor: doctorId,
      _id: { $ne: id },
      status: { $in: ['pending', 'approved'] },
      $or: [
        { 
          approvedDate: {
            $gte: new Date(propDate.setHours(0, 0, 0, 0)),
            $lt: new Date(propDate.setHours(23, 59, 59, 999))
          },
          approvedTime: proposedTime
        },
        {
          requestedDate: {
            $gte: new Date(propDate.setHours(0, 0, 0, 0)),
            $lt: new Date(propDate.setHours(23, 59, 59, 999))
          },
          requestedTime: proposedTime
        }
      ]
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'The proposed time slot is already booked'
      });
    }

    // Update appointment
    appointment.status = 'rescheduled';
    appointment.proposedDate = new Date(proposedDate);
    appointment.proposedTime = proposedTime;
    appointment.doctorResponse = message || 'Doctor has proposed a new time for this appointment.';
    appointment.respondedAt = new Date();

    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: doctorId,
      actionType: 'UPDATE',
      previousSnapshot,
      metadata: { event: 'RESCHEDULE' },
      hashSource: {
        id: appointment._id.toString(),
        status: appointment.status,
        proposedDate: appointment.proposedDate,
        proposedTime: appointment.proposedTime,
        message: appointment.doctorResponse
      }
    });

    await appointment.populate('patient', 'firstName lastName');

    res.json({
      success: true,
      message: 'Reschedule proposal sent to patient',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        originalDate: appointment.requestedDate,
        originalTime: appointment.requestedTime,
        proposedDate: appointment.proposedDate,
        proposedTime: appointment.proposedTime,
        status: appointment.status
      }
    });

  } catch (error) {
    console.error('Reschedule appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule appointment',
      error: error.message
    });
  }
};

/**
 * @desc    Patient accepts reschedule proposal
 * @route   POST /api/appointments/:id/accept-reschedule
 * @access  Patient only
 */
const acceptReschedule = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify this patient owns the appointment
    if (appointment.patient.toString() !== patientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this reschedule'
      });
    }

    if (appointment.status !== 'rescheduled') {
      return res.status(400).json({
        success: false,
        message: 'No reschedule proposal to accept'
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Accept the reschedule
    appointment.status = 'approved';
    appointment.approvedDate = appointment.proposedDate;
    appointment.approvedTime = appointment.proposedTime;
    appointment.patientAcceptedReschedule = true;

    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: patientId,
      actionType: 'UPDATE',
      previousSnapshot,
      metadata: { event: 'RESCHEDULE_ACCEPTED' },
      hashSource: {
        id: appointment._id.toString(),
        status: appointment.status,
        approvedDate: appointment.approvedDate,
        approvedTime: appointment.approvedTime,
        patientAcceptedReschedule: appointment.patientAcceptedReschedule
      }
    });

    await appointment.populate('doctor', 'firstName lastName');

    res.json({
      success: true,
      message: 'Reschedule accepted! Appointment confirmed.',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        doctor: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        confirmedDate: appointment.approvedDate,
        confirmedTime: appointment.approvedTime,
        status: appointment.status
      }
    });

  } catch (error) {
    console.error('Accept reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept reschedule',
      error: error.message
    });
  }
};

/**
 * @desc    Patient declines reschedule (cancels appointment)
 * @route   POST /api/appointments/:id/decline-reschedule
 * @access  Patient only
 */
const declineReschedule = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify this patient owns the appointment
    if (appointment.patient.toString() !== patientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to decline this reschedule'
      });
    }

    if (appointment.status !== 'rescheduled') {
      return res.status(400).json({
        success: false,
        message: 'No reschedule proposal to decline'
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Cancel the appointment
    appointment.status = 'cancelled';
    appointment.cancelledBy = 'patient';
    appointment.cancellationReason = 'Patient declined reschedule proposal';
    appointment.cancelledAt = new Date();
    appointment.patientAcceptedReschedule = false;

    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: patientId,
      actionType: 'REJECT',
      previousSnapshot,
      metadata: { event: 'RESCHEDULE_DECLINED' },
      hashSource: {
        id: appointment._id.toString(),
        status: appointment.status,
        cancellationReason: appointment.cancellationReason,
        cancelledAt: appointment.cancelledAt
      }
    });

    res.json({
      success: true,
      message: 'Reschedule declined. Appointment cancelled.',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        status: appointment.status
      }
    });

  } catch (error) {
    console.error('Decline reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline reschedule',
      error: error.message
    });
  }
};

/**
 * @desc    Cancel an appointment
 * @route   POST /api/appointments/:id/cancel
 * @access  Patient or Doctor
 */
const cancelAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify ownership
    const isPatient = appointment.patient.toString() === userId.toString();
    const isDoctor = appointment.doctor.toString() === userId.toString();
    
    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    if (['completed', 'cancelled', 'no_show', 'rejected'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel appointment with status: ${appointment.status}`
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Cancel
    appointment.status = 'cancelled';
    appointment.cancelledBy = userRole;
    appointment.cancellationReason = reason || 'No reason provided';
    appointment.cancelledAt = new Date();

    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: userId,
      actionType: 'UPDATE',
      previousSnapshot,
      metadata: { event: 'CANCEL' },
      hashSource: {
        id: appointment._id.toString(),
        status: appointment.status,
        cancelledBy: appointment.cancelledBy,
        cancellationReason: appointment.cancellationReason,
        cancelledAt: appointment.cancelledAt
      }
    });

    res.json({
      success: true,
      message: 'Appointment cancelled',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        status: appointment.status,
        cancelledBy: appointment.cancelledBy
      }
    });

  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

/**
 * @desc    Doctor marks appointment as completed
 * @route   POST /api/appointments/:id/complete
 * @access  Doctor only
 */
const completeAppointment = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;
    const { notes } = req.body;

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify this doctor owns the appointment
    if (appointment.doctor.toString() !== doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this appointment'
      });
    }

    if (appointment.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Can only complete approved appointments'
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Complete
    appointment.status = 'completed';
    appointment.doctorNotes = notes || appointment.doctorNotes;
    appointment.completedAt = new Date();

    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: doctorId,
      actionType: 'UPDATE',
      previousSnapshot,
      metadata: { event: 'COMPLETE' },
      hashSource: {
        id: appointment._id.toString(),
        status: appointment.status,
        doctorNotes: appointment.doctorNotes,
        completedAt: appointment.completedAt
      }
    });

    res.json({
      success: true,
      message: 'Appointment marked as completed',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        status: appointment.status,
        completedAt: appointment.completedAt
      }
    });

  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete appointment',
      error: error.message
    });
  }
};

/**
 * @desc    Doctor marks appointment as no-show
 * @route   POST /api/appointments/:id/no-show
 * @access  Doctor only
 */
const markNoShow = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify this doctor owns the appointment
    if (appointment.doctor.toString() !== doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (appointment.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Can only mark approved appointments as no-show'
      });
    }

    const previousSnapshot = buildSnapshot(appointment);

    // Mark no-show
    appointment.status = 'no_show';
    await appointment.save();

    await syncAppointmentIntegrity({
      appointment,
      actorId: doctorId,
      actionType: 'UPDATE',
      previousSnapshot,
      metadata: { event: 'NO_SHOW' },
      hashSource: {
        id: appointment._id.toString(),
        status: appointment.status
      }
    });

    res.json({
      success: true,
      message: 'Appointment marked as no-show',
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        status: appointment.status
      }
    });

  } catch (error) {
    console.error('Mark no-show error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark no-show',
      error: error.message
    });
  }
};

/**
 * @desc    Get available doctors for booking
 * @route   GET /api/appointments/doctors
 * @access  Patient only
 */
const getAvailableDoctors = async (req, res) => {
  try {
    const { specialization, hospitalId } = req.query;

    // Find approved doctors
    let query = { status: 'approved' };
    if (hospitalId) {
      query.hospital = hospitalId;
    }

    const mappings = await DoctorHospitalMapping.find(query)
      .populate({
        path: 'doctor',
        select: 'firstName lastName doctorProfile phone email'
      })
      .populate('hospital', 'name address');

    // Filter out null doctors and by specialization if provided
    const doctors = mappings
      .filter(m => {
        if (!m.doctor) return false;
        if (specialization) {
          return m.doctor.doctorProfile?.specializations?.includes(specialization);
        }
        return true;
      })
      .map(m => ({
        id: m.doctor._id,
        name: `Dr. ${m.doctor.firstName} ${m.doctor.lastName}`,
        specialization: m.doctor.doctorProfile?.specializations?.[0] || 'General Medicine',
        hospital: {
          id: m.hospital._id,
          name: m.hospital.name,
          address: m.hospital.address
        },
        department: m.department
      }));

    // Remove duplicates (doctor may be at multiple hospitals)
    const uniqueDoctors = [];
    const seen = new Set();
    for (const doc of doctors) {
      const key = `${doc.id}-${doc.hospital.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueDoctors.push(doc);
      }
    }

    res.json({
      success: true,
      count: uniqueDoctors.length,
      data: uniqueDoctors
    });

  } catch (error) {
    console.error('Get available doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      error: error.message
    });
  }
};

/**
 * @desc    Get appointment by ID
 * @route   GET /api/appointments/:id
 * @access  Patient or Doctor (owner)
 */
const getAppointmentById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate('patient', 'firstName lastName phone email dateOfBirth gender')
      .populate('doctor', 'firstName lastName doctorProfile phone email')
      .populate('hospital', 'name address phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify ownership
    const isPatient = appointment.patient._id.toString() === userId.toString();
    const isDoctor = appointment.doctor._id.toString() === userId.toString();
    
    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this appointment'
      });
    }

    res.json({
      success: true,
      data: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        patient: {
          id: appointment.patient._id,
          name: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          phone: appointment.patient.phone,
          email: appointment.patient.email,
          dateOfBirth: appointment.patient.dateOfBirth,
          gender: appointment.patient.gender
        },
        doctor: {
          id: appointment.doctor._id,
          name: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
          specialization: appointment.doctor.doctorProfile?.specializations?.[0] || 'General Medicine',
          phone: appointment.doctor.phone,
          email: appointment.doctor.email
        },
        hospital: appointment.hospital ? {
          id: appointment.hospital._id,
          name: appointment.hospital.name,
          address: appointment.hospital.address,
          phone: appointment.hospital.phone
        } : null,
        requestedDate: appointment.requestedDate,
        requestedTime: appointment.requestedTime,
        approvedDate: appointment.approvedDate,
        approvedTime: appointment.approvedTime,
        proposedDate: appointment.proposedDate,
        proposedTime: appointment.proposedTime,
        reason: appointment.reason,
        symptoms: appointment.symptoms,
        appointmentType: appointment.appointmentType,
        priority: appointment.priority,
        duration: appointment.duration,
        status: appointment.status,
        doctorResponse: appointment.doctorResponse,
        doctorNotes: isDoctor ? appointment.doctorNotes : undefined,
        meetingLink: appointment.meetingLink,
        requestedAt: appointment.requestedAt,
        respondedAt: appointment.respondedAt,
        completedAt: appointment.completedAt,
        cancelledAt: appointment.cancelledAt,
        cancelledBy: appointment.cancelledBy,
        cancellationReason: appointment.cancellationReason
      }
    });

  } catch (error) {
    console.error('Get appointment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment',
      error: error.message
    });
  }
};

module.exports = {
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
};
