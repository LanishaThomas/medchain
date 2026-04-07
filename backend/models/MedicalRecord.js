const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  // Core ownership
  patient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Patient is required'],
    index: true
  },
  
  // Who uploaded (doctor or patient themselves)
  uploadedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  
  // Hospital association (if uploaded by doctor)
  hospital: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital' 
  },
  
  // File information
  title: { 
    type: String, 
    required: [true, 'Record title is required'],
    trim: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  // Cloudinary file storage
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  
  filePublicId: {
    type: String,
    required: true
  },
  
  fileName: {
    type: String,
    required: true
  },
  
  fileSize: {
    type: Number,
    required: true
  },
  
  fileType: {
    type: String,
    enum: ['image', 'pdf', 'document', 'other'],
    default: 'other'
  },
  
  mimeType: {
    type: String,
    required: true
  },
  
  // Record categorization
  recordType: {
    type: String,
    enum: [
      'lab_report',
      'prescription',
      'imaging',       // X-ray, MRI, CT scan
      'discharge_summary',
      'consultation_notes',
      'vaccination',
      'insurance',
      'other'
    ],
    default: 'other',
    index: true
  },
  
  // Clinical metadata (optional)
  clinicalData: {
    testName: String,
    testDate: Date,
    labName: String,
    doctorName: String,
    diagnosis: String,
    notes: String
  },
  
  // Blockchain integration (future)
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
  },
  
  // File integrity
  fileHash: {
    type: String,
    required: true
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'archived', 'deleted'], 
    default: 'active',
    index: true
  },
  
  // Audit trail
  accessLog: [{
    accessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    accessedAt: { type: Date, default: Date.now },
    action: { type: String, enum: ['view', 'download'] },
    ipAddress: String
  }],
  
  // Tags for searching
  tags: [String],
  
  // Storage tracking
  storageMode: {
    type: String,
    enum: ['cloudinary', 'local'],
    default: 'cloudinary'
  },
  
  localPath: {
    type: String
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
medicalRecordSchema.index({ patient: 1, createdAt: -1 });
medicalRecordSchema.index({ patient: 1, recordType: 1 });
medicalRecordSchema.index({ uploadedBy: 1, createdAt: -1 });
medicalRecordSchema.index({ hospital: 1, patient: 1 });
medicalRecordSchema.index({ fileHash: 1 }, { unique: true });

// Virtual: formatted file size
medicalRecordSchema.virtual('formattedSize').get(function() {
  const bytes = this.fileSize;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
});

// Method: Log access
medicalRecordSchema.methods.logAccess = async function(userId, action, ipAddress) {
  this.accessLog.push({
    accessedBy: userId,
    action: action,
    ipAddress: ipAddress
  });
  // Keep only last 100 access logs
  if (this.accessLog.length > 100) {
    this.accessLog = this.accessLog.slice(-100);
  }
  return this.save();
};

// Static: Get patient's records
medicalRecordSchema.statics.getPatientRecords = function(patientId, filters = {}) {
  const query = { patient: patientId, status: 'active' };
  
  if (filters.recordType) query.recordType = filters.recordType;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  return this.find(query)
    .populate('uploadedBy', 'firstName lastName role')
    .populate('hospital', 'name')
    .sort({ createdAt: -1 });
};

// Static: Check if user can access record
medicalRecordSchema.statics.canAccess = async function(recordId, userId, userRole) {
  const record = await this.findById(recordId);
  if (!record) return { allowed: false, reason: 'Record not found' };
  
  // Patient can always access their own records
  if (record.patient.toString() === userId.toString()) {
    return { allowed: true, reason: 'Owner' };
  }
  
  // Doctor needs permission
  if (userRole === 'doctor') {
    const Permission = mongoose.model('Permission');
    const hasAccess = await Permission.hasAccess(record.patient, userId, 'medical_records');
    if (hasAccess) {
      return { allowed: true, reason: 'Permission granted' };
    }
    return { allowed: false, reason: 'No permission' };
  }
  
  return { allowed: false, reason: 'Access denied' };
};

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
