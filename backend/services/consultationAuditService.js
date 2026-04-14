/**
 * consultationAuditService.js
 *
 * Builds a deterministic, legally-auditable blockchain record for every
 * completed ONLINE consultation.
 *
 * Payload includes:
 *   - Consultation metadata (timing, participants)
 *   - Payment details (amount, status, Razorpay IDs)
 *   - Prescription summary (medicines, notes)
 *
 * Mental-health chat data is explicitly excluded.
 * Raw files are never included — only metadata.
 */

const Payment      = require('../models/Payment');
const Prescription = require('../models/Prescription');
const Consultation = require('../models/Consultation');
const { writeAuditLog } = require('./blockchainAuditService');

// ─── Build the canonical audit payload ───────────────────────────────────────

async function buildConsultationAuditPayload(consultation, appointment) {
  // ── Payment ───────────────────────────────────────────────────────────────
  const payment = await Payment.findOne({
    appointmentId: appointment._id,
    status: 'paid'
  }).lean();

  if (!payment) {
    throw new Error(
      `Cannot audit consultation ${consultation._id}: no confirmed payment found`
    );
  }

  // ── Prescription (optional — not all consultations produce one) ───────────
  const prescription = await Prescription.findOne({
    patientId: consultation.patientId,
    doctorId:  consultation.doctorId,
    status:    { $in: ['active', 'completed'] }
  })
    .sort({ createdAt: -1 })
    .lean();

  // ── Duration ──────────────────────────────────────────────────────────────
  const startMs = consultation.startTime ? new Date(consultation.startTime).getTime() : null;
  const endMs   = consultation.endTime   ? new Date(consultation.endTime).getTime()   : null;
  const durationSeconds = startMs && endMs ? Math.round((endMs - startMs) / 1000) : null;

  // ── Canonical payload (keys sorted by buildDeterministicHash internally) ──
  const payload = {
    // Identifiers
    consultationId: consultation._id.toString(),
    appointmentId:  appointment._id.toString(),
    doctorId:       consultation.doctorId.toString(),
    patientId:      consultation.patientId.toString(),

    // Timing
    startTime:       consultation.startTime ? new Date(consultation.startTime).toISOString() : null,
    endTime:         consultation.endTime   ? new Date(consultation.endTime).toISOString()   : null,
    durationSeconds,

    // Payment
    paymentId:     payment._id.toString(),
    amount:        payment.amount,          // in paise
    currency:      payment.currency,
    paymentStatus: payment.status,
    razorpayOrderId:   payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId || null,

    // Prescription (null fields if no prescription)
    prescriptionId: prescription ? prescription._id.toString()       : null,
    medicines:      prescription ? prescription.medicines.map(m => ({
      name:   m.name,
      dosage: m.dosage,
      notes:  m.notes || ''
    })) : [],
    prescriptionNotes: prescription ? (prescription.notes || '') : null,

    // Audit metadata
    consultationType: 'online',
    timestamp: new Date().toISOString()
  };

  return { payload, payment, prescription };
}

// ─── Write audit log and update Consultation record ──────────────────────────

async function auditConsultationCompletion(consultation, appointment) {
  if (appointment.consultationType !== 'online') {
    // Only online consultations are audited on-chain
    return null;
  }

  const { payload, prescription } = await buildConsultationAuditPayload(
    consultation,
    appointment
  );

  // Write to blockchain — throws if wallet has insufficient funds or RPC fails
  const auditDoc = await writeAuditLog({
    entityType: 'CONSULTATION',
    entityId:   consultation._id.toString(),
    actorId:    consultation.doctorId.toString(),
    actionType: 'COMPLETED',
    data:       payload,
    metadata: {
      appointmentId: appointment._id.toString(),
      consultationType: 'online'
    }
  });

  // Persist hashes + linked IDs back to the Consultation document
  await Consultation.findByIdAndUpdate(consultation._id, {
    blockchainHash:      auditDoc.dataHash,
    blockchainTxHash:    auditDoc.blockchainTxHash,
    blockchainTimestamp: auditDoc.timestamp,
    prescriptionId:      prescription ? prescription._id : null
  });

  console.log(
    `[ConsultationAudit] ✅ Consultation ${consultation._id} anchored on-chain` +
    ` | tx: ${auditDoc.blockchainTxHash}`
  );

  return auditDoc;
}

// ─── Re-audit when prescription or payment changes after completion ───────────
// Call this from prescriptionController / paymentController when an update
// affects a completed online consultation.

async function reAuditConsultation(consultationId) {
  const Appointment = require('../models/Appointment');

  const consultation = await Consultation.findById(consultationId).lean();
  if (!consultation || consultation.status !== 'completed') return null;

  const appointment = await Appointment.findById(consultation.appointmentId).lean();
  if (!appointment || appointment.consultationType !== 'online') return null;

  const { payload } = await buildConsultationAuditPayload(consultation, appointment);

  // Write a NEW audit entry — never overwrite the old one
  const auditDoc = await writeAuditLog({
    entityType: 'CONSULTATION',
    entityId:   consultation._id.toString(),
    actorId:    consultation.doctorId.toString(),
    actionType: 'UPDATED',
    data:       payload,
    metadata: {
      reason: 'prescription_or_payment_updated',
      appointmentId: appointment._id.toString()
    }
  });

  // Update the latest hash on the Consultation document
  await Consultation.findByIdAndUpdate(consultation._id, {
    blockchainHash:      auditDoc.dataHash,
    blockchainTxHash:    auditDoc.blockchainTxHash,
    blockchainTimestamp: auditDoc.timestamp
  });

  console.log(
    `[ConsultationAudit] 🔄 Re-audit for consultation ${consultationId}` +
    ` | tx: ${auditDoc.blockchainTxHash}`
  );

  return auditDoc;
}

module.exports = { auditConsultationCompletion, reAuditConsultation };
