const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  // Who owns the data (patient)
  patient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Patient is required'],
    index: true
  },
  
  // Who is requesting access (doctor)
  doctor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Doctor is required'],
    index: true
  },
  
  // Access Control
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'revoked', 'expired'],
    default: 'pending',
    index: true
  },
  
  // Access Type (what data can be accessed)
  accessType: {
    type: String,
    enum: ['medical_records', 'prescriptions', 'appointments', 'test_results', 'full_access'],
    default: 'medical_records',
    required: true
  },
  
  // Time Bounds
  requestedAt: { 
    type: Date, 
    default: Date.now 
  },
  approvedAt: Date,
  rejectedAt: Date,
  revokedAt: Date,
  expiryDate: { 
    type: Date,
    required: [true, 'Expiry date is required'],
    validate: {
      validator: function(v) {
        // Expiry must be in the future
        return v > new Date();
      },
      message: 'Expiry date must be in the future'
    }
  },
  
  // Request Details
  requestReason: {
    type: String,
    maxlength: 500,
    required: [true, 'Reason for access request is required']
  },
  
  // Response Details
  approvalReason: String,
  rejectionReason: String,
  revocationReason: String,
  
  // Patient decision
  approvedBy: mongoose.Schema.Types.ObjectId,
  approvalNotes: String,
  
  // Specific Records (if limiting to specific records)
  specificRecords: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MedicalRecord' 
  }],
  
  // Actions allowed
  allowedActions: {
    view: { type: Boolean, default: true },
    download: { type: Boolean, default: false },
    share: { type: Boolean, default: false },
    print: { type: Boolean, default: false }
  },
  
  // Audit
  lastAccessedAt: Date,
  accessCount: { type: Number, default: 0 },
  
  // Metadata
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  department: String,

  blockchainHash: {
    type: String,
    default: null
  },
  blockchainTxHash: {
    type: String,
    default: null,
    index: true
  },
  blockchainTimestamp: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique index - one active permission per doctor-patient pair per access type
permissionSchema.index({ patient: 1, doctor: 1, accessType: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { status: { $in: ['pending', 'approved'] } }
});

// Indexes for quick lookups
permissionSchema.index({ patient: 1, status: 1 });
permissionSchema.index({ doctor: 1, status: 1 });
permissionSchema.index({ expiryDate: 1, status: 1 });

// Virtual: Is this permission currently valid?
permissionSchema.virtual('isActive').get(function() {
  return this.status === 'approved' && 
         this.expiryDate > new Date();
});

// Virtual: Days remaining
permissionSchema.virtual('daysRemaining').get(function() {
  if (!this.isActive) return 0;
  const diff = this.expiryDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Method: Approve permission
permissionSchema.methods.approve = async function(notes = '') {
  if (this.status !== 'pending') {
    throw new Error('Only pending permissions can be approved');
  }
  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvalNotes = notes;
  return this.save();
};

// Method: Reject permission
permissionSchema.methods.reject = async function(reason = '') {
  if (this.status !== 'pending') {
    throw new Error('Only pending permissions can be rejected');
  }
  this.status = 'rejected';
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Method: Revoke permission
permissionSchema.methods.revoke = async function(reason = '') {
  if (this.status !== 'approved') {
    throw new Error('Only approved permissions can be revoked');
  }
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revocationReason = reason;
  return this.save();
};

// Method: Check if permission is valid
permissionSchema.methods.isValid = function() {
  return this.isActive;
};

// Method: Record access
permissionSchema.methods.recordAccess = async function() {
  if (!this.isValid()) {
    throw new Error('This permission is no longer valid');
  }
  this.lastAccessedAt = new Date();
  this.accessCount += 1;
  return this.save();
};

// Static: Check if doctor has access to patient data
permissionSchema.statics.hasAccess = async function(patientId, doctorId, accessType = 'medical_records') {
  const permission = await this.findOne({
    patient: patientId,
    doctor: doctorId,
    accessType: { $in: [accessType, 'full_access'] },
    status: 'approved',
    expiryDate: { $gt: new Date() }
  });
  return !!permission;
};

// Static: Get active permissions for patient
permissionSchema.statics.getPatientPermissions = function(patientId) {
  return this.find({ patient: patientId })
    .populate('doctor', 'firstName lastName email role')
    .sort({ requestedAt: -1 });
};

// Static: Get pending permissions for patient
permissionSchema.statics.getPendingPermissions = function(patientId) {
  return this.find({ patient: patientId, status: 'pending' })
    .populate('doctor', 'firstName lastName email role hospital')
    .sort({ requestedAt: -1 });
};

// Static: Get doctor's pending requests
permissionSchema.statics.getDoctorPendingRequests = function(doctorId) {
  return this.find({ doctor: doctorId, status: 'pending' })
    .populate('patient', 'firstName lastName phone email')
    .sort({ requestedAt: -1 });
};

// Auto-expire permissions
permissionSchema.statics.expirePermissions = async function() {
  const result = await this.updateMany(
    {
      status: 'approved',
      expiryDate: { $lt: new Date() }
    },
    {
      status: 'expired',
      revokedAt: new Date()
    }
  );
  return result;
};

// Static Helper: Get deterministic data for blockchain hashing
permissionSchema.statics.getCanonicalData = function(doc) {
  if (!doc) return null;

  const toId = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (v._id) return v._id.toString();
    return v.toString();
  };

  const formatDate = (d) => {
    if (!d) return null;
    return (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
  };

  return {
    id: toId(doc._id),
    patientId: toId(doc.patient),
    doctorId: toId(doc.doctor),
    status: doc.status,
    accessType: doc.accessType,
    requestedAt: formatDate(doc.requestedAt),
    approvedAt: formatDate(doc.approvedAt),
    expiryDate: formatDate(doc.expiryDate),
    requestReason: doc.requestReason || '',
    rejectionReason: doc.rejectionReason || null
  };
};

module.exports = mongoose.model('Permission', permissionSchema);
