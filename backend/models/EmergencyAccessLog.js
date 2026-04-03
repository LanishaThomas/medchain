const mongoose = require('mongoose');

const emergencyAccessSchema = new mongoose.Schema({
  accessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recordsAccessed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' }],
  reason: String,
  ipAddress: String,
  reviewStatus: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  accessTime: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmergencyAccessLog', emergencyAccessSchema);
