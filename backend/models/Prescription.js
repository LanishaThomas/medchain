const mongoose = require('mongoose');
const crypto = require('crypto');

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionNumber: { type: String, unique: true },

    // Required fields for the active prescription flow
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    medicines: [{
      name: { type: String, required: true, trim: true },
      dosage: { type: String, required: true, trim: true },
      notes: { type: String, default: '', trim: true }
    }],
    dosage: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    hash: { type: String, required: true, index: true },
    blockchainHash: { type: String, default: null },
    blockchainTxHash: { type: String, default: null, index: true },
    blockchainTimestamp: { type: Date, default: null },

    // Legacy compatibility fields
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    medications: [Object],
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    validUntil: Date
  },
  {
    timestamps: true
  }
);

prescriptionSchema.pre('validate', function() {
  if (!this.prescriptionNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.prescriptionNumber = `RX-${timestamp}-${random}`;
  }

  const normalizedMedicines = Array.isArray(this.medicines) ? this.medicines : [];

  // Keep legacy fields synchronized with current fields.
  this.patient = this.patientId;
  this.prescribedBy = this.doctorId;
  this.hospital = this.hospitalId;
  this.medications = normalizedMedicines.map((item) => ({
    name: item.name,
    dosage: item.dosage,
    notes: item.notes || ''
  }));

  if (!this.hash) {
    const payload = JSON.stringify({
      patientId: this.patientId?.toString(),
      doctorId: this.doctorId?.toString(),
      hospitalId: this.hospitalId?.toString(),
      medicines: normalizedMedicines.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        notes: m.notes || ''
      })),
      dosage: this.dosage,
      notes: this.notes || ''
    });

    this.hash = crypto.createHash('sha256').update(payload).digest('hex');
  }
});

// Static Helper: Get deterministic data for blockchain hashing
prescriptionSchema.statics.getCanonicalData = function(doc) {
  if (!doc) return null;

  const toId = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (v._id) return v._id.toString();
    return v.toString();
  };

  return {
    id: toId(doc._id),
    patientId: toId(doc.patientId),
    doctorId: toId(doc.doctorId),
    hospitalId: toId(doc.hospitalId),
    prescriptionNumber: doc.prescriptionNumber,
    medicines: Array.isArray(doc.medicines) ? doc.medicines.map(m => ({
      name: m.name,
      dosage: m.dosage,
      notes: m.notes || undefined // Use undefined to strip empty notes in normalization
    })) : [],
    dosage: doc.dosage,
    notes: doc.notes || undefined,
    status: doc.status,
    hash: doc.hash
  };
};

module.exports = mongoose.model('Prescription', prescriptionSchema);
