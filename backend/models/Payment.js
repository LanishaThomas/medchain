const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: { type: Number, required: true }, // in paise (INR smallest unit)
    currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed'],
      default: 'created',
      index: true
    },
    failureReason: { type: String, default: null },
    webhookProcessed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Prevent duplicate orders for the same appointment
paymentSchema.index({ appointmentId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
