const mongoose = require('mongoose');

const emergencyAccessSchema = new mongoose.Schema({
  // Who accessed (Hospital that scanned QR)
  hospital: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital', 
    required: true 
  },
  accessedByUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }, // The hospital admin who performed the scan
  
  // Patient whose data was accessed
  patient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Access details
  accessToken: { type: String, required: true }, // The token from QR
  accessTime: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  
  // Data accessed (what was shown)
  dataAccessed: {
    bloodType: { type: Boolean, default: true },
    allergies: { type: Boolean, default: true },
    medications: { type: Boolean, default: true },
    emergencyContacts: { type: Boolean, default: true },
    surgeries: { type: Boolean, default: true },
    chronicConditions: { type: Boolean, default: true }
  },
  
  // Session tracking
  accessStatus: { 
    type: String, 
    enum: ['active', 'expired', 'revoked'], 
    default: 'active' 
  },
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revokedReason: String,
  
  // Audit info
  ipAddress: String,
  userAgent: String,
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  // Patient review
  patientReview: {
    reviewed: { type: Boolean, default: false },
    reviewedAt: Date,
    flaggedAsSuspicious: { type: Boolean, default: false },
    notes: String
  },
  
  // Notification tracking
  notificationSent: { type: Boolean, default: false },
  notificationSentAt: Date
}, {
  timestamps: true
});

// Indexes for efficient queries
emergencyAccessSchema.index({ patient: 1, accessTime: -1 });
emergencyAccessSchema.index({ hospital: 1, accessTime: -1 });
emergencyAccessSchema.index({ accessToken: 1 });
emergencyAccessSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 }); // Cleanup after 24h past expiry

// Check if access is still valid
emergencyAccessSchema.methods.isValid = function() {
  if (this.accessStatus !== 'active') return false;
  if (this.expiresAt < new Date()) {
    this.accessStatus = 'expired';
    return false;
  }
  return true;
};

// Revoke access
emergencyAccessSchema.methods.revoke = async function(userId, reason) {
  this.accessStatus = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = userId;
  this.revokedReason = reason;
  return this.save();
};

// Static: Get patient's access history
emergencyAccessSchema.statics.getPatientHistory = async function(patientId, options = {}) {
  const { page = 1, limit = 10 } = options;
  
  return this.find({ patient: patientId })
    .sort({ accessTime: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('hospital', 'name type address.city logo')
    .populate('accessedByUser', 'firstName lastName');
};

// Static: Get active access sessions for patient
emergencyAccessSchema.statics.getActiveSessions = async function(patientId) {
  return this.find({ 
    patient: patientId, 
    accessStatus: 'active',
    expiresAt: { $gt: new Date() }
  })
  .populate('hospital', 'name type address.city logo');
};

module.exports = mongoose.model('EmergencyAccessLog', emergencyAccessSchema);
