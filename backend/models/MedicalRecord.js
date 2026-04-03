const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  recordType: String,
  title: { type: String, required: true },
  clinicalData: Object,
  attachments: [String],
  status: { type: String, enum: ['draft', 'final', 'amended'], default: 'draft' },
  blockchainHash: String,
  ipfsHash: String,
  createdAt: { type: Date, default: Date.now }
});

medicalRecordSchema.index({ patient: 1, createdAt: -1 });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
