const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
      index: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed'],
      default: 'scheduled',
      index: true
    },
    startTime: { type: Date, default: null },
    endTime:   { type: Date, default: null },

    // Linked records (set at completion time)
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    paymentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Payment',      default: null },

    // Blockchain audit (written when consultation completes)
    blockchainHash:      { type: String, default: null, index: true },
    blockchainTxHash:    { type: String, default: null, index: true },
    blockchainTimestamp: { type: Date,   default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Consultation', consultationSchema);
