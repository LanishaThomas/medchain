const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const Permission = require('../models/Permission');
const {
  createConsultationRoom,
  generateJoinToken
} = require('../services/videoSessionService');

function parseTimeToHoursMinutes(timeText) {
  if (!timeText) {
    return null;
  }

  const normalized = String(timeText).trim();

  const hhmm = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    return {
      hours: Number(hhmm[1]),
      minutes: Number(hhmm[2])
    };
  }

  const ampm = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = Number(ampm[2]);
    const marker = ampm[3].toUpperCase();

    if (marker === 'PM' && hours !== 12) {
      hours += 12;
    }
    if (marker === 'AM' && hours === 12) {
      hours = 0;
    }

    return { hours, minutes };
  }

  return null;
}

function buildAppointmentStartDateTime(appointment) {
  const dateValue = appointment.approvedDate || appointment.requestedDate;
  const timeValue = appointment.approvedTime || appointment.requestedTime;

  const start = new Date(dateValue);
  const parsedTime = parseTimeToHoursMinutes(timeValue);
  if (parsedTime) {
    start.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
  }

  return start;
}

function validateJoinWindow(appointment) {
  const start = buildAppointmentStartDateTime(appointment);
  const durationMinutes = Number(appointment.duration || 30);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const earlyJoinMinutes = Number(process.env.CONSULTATION_JOIN_EARLY_MINUTES || 30);
  const lateJoinMinutes = Number(process.env.CONSULTATION_JOIN_LATE_MINUTES || 120);

  const allowedFrom = new Date(start.getTime() - earlyJoinMinutes * 60 * 1000);
  const allowedUntil = new Date(end.getTime() + lateJoinMinutes * 60 * 1000);
  const now = new Date();

  const isAllowed = now >= allowedFrom && now <= allowedUntil;

  return {
    isAllowed,
    now,
    start,
    end,
    allowedFrom,
    allowedUntil
  };
}

function extractId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
}

function validateOwnership(appointment, userId, role) {
  const doctorId = extractId(appointment.doctor);
  const patientId = extractId(appointment.patient);
  const requesterId = userId?.toString();

  if (role === 'doctor') {
    return doctorId === requesterId;
  }
  if (role === 'patient') {
    return patientId === requesterId;
  }
  return false;
}

async function getConsultationContext(appointmentId) {
  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName email phone dateOfBirth gender')
    .populate('doctor', 'firstName lastName email doctorProfile')
    .populate('hospital', 'name');

  if (!appointment) {
    return { appointment: null, consultation: null };
  }

  const consultation = await Consultation.findOne({ appointmentId: appointment._id });

  return {
    appointment,
    consultation
  };
}

exports.getConsultationByAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { appointment, consultation } = await getConsultationContext(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (!validateOwnership(appointment, req.user.id, req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this consultation'
      });
    }

    const hasMedicalRecordAccess = await Permission.hasAccess(
      appointment.patient._id,
      appointment.doctor._id,
      'medical_records'
    );

    const hasPrescriptionAccess = await Permission.hasAccess(
      appointment.patient._id,
      appointment.doctor._id,
      'prescriptions'
    );

    return res.status(200).json({
      success: true,
      data: {
        consultation: consultation
          ? {
              id: consultation._id,
              roomId: consultation.roomId,
              status: consultation.status,
              startTime: consultation.startTime,
              endTime: consultation.endTime
            }
          : null,
        appointment: {
          id: appointment._id,
          status: appointment.status,
          appointmentType: appointment.appointmentType,
          requestedDate: appointment.requestedDate,
          requestedTime: appointment.requestedTime,
          approvedDate: appointment.approvedDate,
          approvedTime: appointment.approvedTime,
          duration: appointment.duration,
          hospital: appointment.hospital
            ? {
                id: appointment.hospital._id,
                name: appointment.hospital.name
              }
            : null,
          patient: {
            id: appointment.patient._id,
            name: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
            email: appointment.patient.email,
            phone: appointment.patient.phone,
            dateOfBirth: appointment.patient.dateOfBirth,
            gender: appointment.patient.gender
          },
          doctor: {
            id: appointment.doctor._id,
            name: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
            specialization: appointment.doctor.doctorProfile?.specializations?.[0] || 'General Medicine',
            email: appointment.doctor.email
          }
        },
        access: {
          medicalRecords: hasMedicalRecordAccess,
          prescriptions: hasPrescriptionAccess
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load consultation context',
      error: error.message
    });
  }
};

async function joinConsultation(req, res, role) {
  const { appointmentId } = req.params;
  const userId = req.user.id;

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  if (appointment.status !== 'approved') {
    return res.status(400).json({
      success: false,
      message: 'Only approved appointments can start consultation'
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && appointment.appointmentType !== 'telemedicine') {
    return res.status(400).json({
      success: false,
      message: 'Only online (telemedicine) appointments support meeting sessions'
    });
  }

  if (!validateOwnership(appointment, userId, role)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to join this consultation'
    });
  }

  const windowValidation = validateJoinWindow(appointment);
  if (!windowValidation.isAllowed) {
    return res.status(403).json({
      success: false,
      message: 'Consultation can only be joined within the allowed appointment window',
      data: {
        allowedFrom: windowValidation.allowedFrom,
        allowedUntil: windowValidation.allowedUntil,
        appointmentStart: windowValidation.start,
        appointmentEnd: windowValidation.end
      }
    });
  }

  const consultation = await createConsultationRoom(
    appointment._id,
    appointment.doctor,
    appointment.patient
  );

  if (consultation.status !== 'ongoing') {
    consultation.status = 'ongoing';
    consultation.startTime = consultation.startTime || new Date();
    consultation.endTime = null;
    await consultation.save();
  }

  const tokenData = generateJoinToken(userId.toString(), consultation.roomId, role);

  return res.status(200).json({
    success: true,
    message: 'Consultation join token generated',
    data: {
      consultationId: consultation._id,
      roomId: consultation.roomId,
      status: consultation.status,
      startTime: consultation.startTime,
      token: tokenData.token,
      provider: tokenData.provider,
      appId: tokenData.appId,
      rtcUid: tokenData.rtcUid,
      role,
      expiresAt: tokenData.expiresAt,
      ttlSeconds: tokenData.ttlSeconds
    }
  });
}

exports.joinAsDoctor = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'This action requires doctor privileges'
      });
    }

    return await joinConsultation(req, res, 'doctor');
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to join consultation as doctor',
      error: error.message
    });
  }
};

exports.joinAsPatient = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'This action requires patient privileges'
      });
    }

    return await joinConsultation(req, res, 'patient');
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to join consultation as patient',
      error: error.message
    });
  }
};

exports.endConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const isDoctor = appointment.doctor.toString() === userId.toString();
    const isPatient = appointment.patient.toString() === userId.toString();

    if (!isDoctor && !isPatient) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to end this consultation'
      });
    }

    const consultation = await Consultation.findOne({ appointmentId: appointment._id });
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    consultation.status = 'completed';
    consultation.endTime = new Date();
    if (!consultation.startTime) {
      consultation.startTime = consultation.endTime;
    }
    await consultation.save();

    const consultationReasonRegex = new RegExp(`Consultation session access for appointment ${appointment._id}`, 'i');

    const expireResult = await Permission.updateMany(
      {
        patient: appointment.patient,
        doctor: appointment.doctor,
        status: 'approved',
        requestReason: { $regex: consultationReasonRegex }
      },
      {
        $set: {
          status: 'expired',
          revokedAt: new Date(),
          revocationReason: 'Consultation session ended'
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Consultation ended successfully',
      data: {
        consultationId: consultation._id,
        status: consultation.status,
        startTime: consultation.startTime,
        endTime: consultation.endTime,
        expiredPermissions: expireResult.modifiedCount || 0
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to end consultation',
      error: error.message
    });
  }
};
