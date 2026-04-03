const mongoose = require('mongoose');

const MAPPING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  RESIGNED: 'resigned'
};

const dhMappingSchema = new mongoose.Schema({
  // Core Relationship
  doctor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Doctor is required']
  },
  hospital: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital', 
    required: [true, 'Hospital is required']
  },
  
  // Application Details
  applicationNote: {
    type: String,
    maxlength: 1000
  },
  
  // Status & Approval
  status: { 
    type: String, 
    enum: Object.values(MAPPING_STATUS), 
    default: MAPPING_STATUS.PENDING 
  },
  statusHistory: [{
    status: { type: String, enum: Object.values(MAPPING_STATUS) },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }],
  
  // Review Details
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNotes: String,
  rejectionReason: String,
  
  // Employment
  employmentType: {
    type: String,
    enum: ['full_time', 'part_time', 'visiting', 'consultant', 'resident', 'intern'],
    default: 'full_time'
  },
  department: String,
  designation: String,
  specialtiesAtHospital: [String],
  joiningDate: Date,
  
  // Schedule
  schedule: [{
    day: { 
      type: String, 
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    startTime: String,
    endTime: String,
    maxPatients: { type: Number, default: 20 },
    isAvailable: { type: Boolean, default: true }
  }],
  
  // Consultation
  consultationFee: {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' }
  },
  consultationDuration: { type: Number, default: 30 },
  
  // Location in Hospital
  roomNumber: String,
  floor: String,
  building: String,
  
  // Contact at Hospital
  hospitalEmail: String,
  hospitalPhone: String,
  
  // Availability
  isAvailable: { type: Boolean, default: true },
  unavailableReason: String,
  unavailableFrom: Date,
  unavailableUntil: Date,
  
  // Permissions at this Hospital
  permissions: {
    canAccessRecords: { type: Boolean, default: true },
    canCreatePrescriptions: { type: Boolean, default: true },
    canOrderTests: { type: Boolean, default: true },
    canAdmitPatients: { type: Boolean, default: false },
    canPerformSurgery: { type: Boolean, default: false }
  },
  
  // Flags
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },
  
  // Timestamps
  appliedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique index
dhMappingSchema.index({ doctor: 1, hospital: 1 }, { unique: true });
dhMappingSchema.index({ hospital: 1, status: 1 });
dhMappingSchema.index({ doctor: 1, status: 1 });

// Track status changes
dhMappingSchema.pre('save', function() {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this._statusChangedBy,
      reason: this._statusChangeReason
    });
  }
});

// Approve doctor
dhMappingSchema.methods.approve = async function(adminId, notes) {
  this.status = MAPPING_STATUS.APPROVED;
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  this.joiningDate = new Date();
  this._statusChangedBy = adminId;
  this._statusChangeReason = notes || 'Application approved';
  return this.save();
};

// Reject doctor
dhMappingSchema.methods.reject = async function(adminId, reason) {
  this.status = MAPPING_STATUS.REJECTED;
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  this._statusChangedBy = adminId;
  this._statusChangeReason = reason;
  return this.save();
};

// Suspend doctor
dhMappingSchema.methods.suspend = async function(adminId, reason) {
  this.status = MAPPING_STATUS.SUSPENDED;
  this.isActive = false;
  this._statusChangedBy = adminId;
  this._statusChangeReason = reason;
  return this.save();
};

// Reactivate doctor
dhMappingSchema.methods.reactivate = async function(adminId, notes) {
  this.status = MAPPING_STATUS.APPROVED;
  this.isActive = true;
  this._statusChangedBy = adminId;
  this._statusChangeReason = notes || 'Reactivated';
  return this.save();
};

// Static: Get doctor's hospitals
dhMappingSchema.statics.getDoctorHospitals = function(doctorId) {
  return this.find({
    doctor: doctorId,
    status: MAPPING_STATUS.APPROVED,
    isActive: true
  }).populate('hospital', 'name address type logo slug');
};

// Static: Get hospital's doctors
dhMappingSchema.statics.getHospitalDoctors = function(hospitalId, status = null) {
  const query = { hospital: hospitalId };
  if (status) query.status = status;
  else query.status = MAPPING_STATUS.APPROVED;
  
  return this.find(query)
    .populate('doctor', 'firstName lastName email phone doctorProfile profileImage');
};

// Static: Get pending applications
dhMappingSchema.statics.getPendingApplications = function(hospitalId) {
  return this.find({
    hospital: hospitalId,
    status: MAPPING_STATUS.PENDING
  })
  .populate('doctor', 'firstName lastName email phone doctorProfile profileImage')
  .sort({ appliedAt: 1 });
};

// Static: Check if doctor is approved at hospital
dhMappingSchema.statics.isApproved = async function(doctorId, hospitalId) {
  const mapping = await this.findOne({
    doctor: doctorId,
    hospital: hospitalId,
    status: MAPPING_STATUS.APPROVED,
    isActive: true
  });
  return !!mapping;
};

const DoctorHospitalMapping = mongoose.model('DoctorHospitalMapping', dhMappingSchema);

module.exports = DoctorHospitalMapping;
module.exports.MAPPING_STATUS = MAPPING_STATUS;
