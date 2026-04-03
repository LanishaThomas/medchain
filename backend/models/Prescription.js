const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  prescriptionNumber: { type: String, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medications: [Object],
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  validUntil: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
