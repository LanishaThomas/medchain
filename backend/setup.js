/**
 * MedChain Backend Setup Script
 * Run with: node setup.js
 * This creates all necessary directories and model files
 */

const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

// Directories to create
const directories = ['config', 'models', 'utils'];

// Create directories
console.log('📁 Creating directories...');
directories.forEach(dir => {
  const dirPath = path.join(baseDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  ✓ ${dir}/`);
  }
});

// ====================
// CONFIG FILES
// ====================
console.log('\n⚙️  Creating config files...');

const databaseJs = `const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    
    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log(\`MongoDB Connected: \${conn.connection.host}\`);

    mongoose.connection.on('error', (err) => {
      console.error(\`MongoDB connection error: \${err}\`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error(\`Error connecting to MongoDB: \${error.message}\`);
    process.exit(1);
  }
};

module.exports = connectDB;
`;

fs.writeFileSync(path.join(baseDir, 'config', 'database.js'), databaseJs);
console.log('  ✓ config/database.js');

// ====================
// MODELS
// ====================
console.log('\n📝 Creating models...');

// User Model
const userModel = `const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  CAREGIVER: 'caregiver',
  HOSPITAL_ADMIN: 'hospital_admin'
};

const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true, default: 'USA' }
}, { _id: false });

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  relationship: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true }
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Authentication
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\\w+([.-]?\\w+)*@\\w+([.-]?\\w+)*(\\.\\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Role
  role: {
    type: String,
    enum: Object.values(ROLES),
    required: [true, 'Role is required']
  },

  // Profile Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\\d\\s\\-+()]+$/, 'Please enter a valid phone number']
  },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: GENDERS },
  address: addressSchema,
  profileImage: { type: String },

  // Blockchain Integration
  walletAddress: {
    type: String,
    sparse: true,
    unique: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address']
  },

  // Patient-specific fields
  patientInfo: {
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null] },
    allergies: [{ type: String, trim: true }],
    chronicConditions: [{ type: String, trim: true }],
    emergencyContacts: [emergencyContactSchema],
    insuranceProvider: { type: String, trim: true },
    insurancePolicyNumber: { type: String, trim: true }
  },

  // Doctor-specific fields
  doctorInfo: {
    licenseNumber: { type: String, trim: true },
    licenseState: { type: String, trim: true },
    licenseExpiry: { type: Date },
    specializations: [{ type: String, trim: true }],
    qualifications: [{
      degree: { type: String, trim: true },
      institution: { type: String, trim: true },
      year: { type: Number }
    }],
    yearsOfExperience: { type: Number, min: 0 },
    bio: { type: String, maxlength: 1000 }
  },

  // Caregiver-specific fields
  caregiverInfo: {
    relationshipToPatient: { type: String, trim: true },
    patientsUnderCare: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    permissions: {
      canViewRecords: { type: Boolean, default: false },
      canBookAppointments: { type: Boolean, default: false },
      canReceiveNotifications: { type: Boolean, default: true }
    }
  },

  // Hospital Admin - reference to their hospital
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

  // Account Status
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,

  // Two-Factor Authentication
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false },

  // Consent & Privacy
  privacyConsent: {
    consentGiven: { type: Boolean, default: false },
    consentDate: Date,
    ipAddress: String
  },
  dataProcessingConsent: {
    consentGiven: { type: Boolean, default: false },
    consentDate: Date
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'doctorInfo.licenseNumber': 1 }, { sparse: true });
userSchema.index({ walletAddress: 1 }, { sparse: true });
userSchema.index({ hospitalId: 1 }, { sparse: true });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return \`\${this.firstName} \${this.lastName}\`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours
  const MAX_LOGIN_ATTEMPTS = 5;

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }
  
  return this.updateOne(updates);
};

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email, isActive: true }).select('+password');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.isLocked()) {
    throw new Error('Account is temporarily locked. Please try again later.');
  }

  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    await user.incrementLoginAttempts();
    throw new Error('Invalid credentials');
  }

  if (user.loginAttempts > 0) {
    await user.updateOne({
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 }
    });
  }

  return user;
};

// Remove sensitive fields from JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.GENDERS = GENDERS;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'User.js'), userModel);
console.log('  ✓ models/User.js');

// Hospital Model
const hospitalModel = `const mongoose = require('mongoose');

const HOSPITAL_TYPES = [
  'general', 'specialty', 'teaching', 'community', 'psychiatric',
  'rehabilitation', 'childrens', 'veterans', 'clinic', 'urgent_care'
];

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
};

const operatingHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  isOpen: { type: Boolean, default: true },
  openTime: { type: String },
  closeTime: { type: String },
  is24Hours: { type: Boolean, default: false }
}, { _id: false });

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  headOfDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
});

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  postalCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true, default: 'USA' },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  }
}, { _id: false });

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hospital name is required'],
    trim: true,
    maxlength: [200, 'Hospital name cannot exceed 200 characters']
  },
  slug: { type: String, unique: true, lowercase: true },
  type: {
    type: String,
    enum: HOSPITAL_TYPES,
    required: [true, 'Hospital type is required']
  },
  description: { type: String, trim: true, maxlength: [2000, 'Description cannot exceed 2000 characters'] },

  // Registration & Verification
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  taxId: { type: String, trim: true },
  licenseNumber: { type: String, required: [true, 'License number is required'], trim: true },
  licenseExpiry: { type: Date, required: [true, 'License expiry date is required'] },
  accreditations: [{
    name: { type: String, trim: true },
    issuedBy: { type: String, trim: true },
    validUntil: Date,
    certificateUrl: String
  }],
  
  verificationStatus: {
    type: String,
    enum: Object.values(VERIFICATION_STATUS),
    default: VERIFICATION_STATUS.PENDING
  },
  verificationNotes: String,
  verifiedAt: Date,

  // Contact Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  phone: { type: String, required: [true, 'Phone number is required'], trim: true },
  fax: { type: String, trim: true },
  website: { type: String, trim: true },
  emergencyPhone: { type: String, trim: true },

  // Location
  address: { type: addressSchema, required: true },

  // Administration - Self-registered
  primaryAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Primary administrator is required']
  },
  additionalAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Operational Details
  departments: [departmentSchema],
  specialties: [{ type: String, trim: true }],
  facilities: [{ type: String, trim: true }],
  bedCount: { type: Number, min: 0 },
  operatingHours: [operatingHoursSchema],
  is24HoursEmergency: { type: Boolean, default: false },

  // Media
  logo: { type: String },
  images: [{ type: String }],
  
  // Blockchain Integration
  walletAddress: {
    type: String,
    sparse: true,
    unique: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address']
  },
  
  // Settings
  settings: {
    appointmentDuration: { type: Number, default: 30 },
    maxAdvanceBookingDays: { type: Number, default: 90 },
    allowOnlineBooking: { type: Boolean, default: true },
    requireApprovalForDoctors: { type: Boolean, default: true },
    autoApproveVerifiedDoctors: { type: Boolean, default: false }
  },

  isActive: { type: Boolean, default: true },
  deactivationReason: String,
  deactivatedAt: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
hospitalSchema.index({ name: 'text', description: 'text' });
hospitalSchema.index({ 'address.city': 1, 'address.state': 1 });
hospitalSchema.index({ verificationStatus: 1, isActive: 1 });
hospitalSchema.index({ specialties: 1 });
hospitalSchema.index({ type: 1 });
hospitalSchema.index({ slug: 1 }, { unique: true });

// Generate slug before saving
hospitalSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + 
      '-' + Date.now().toString(36);
  }
  next();
});

// Virtual for active doctors count
hospitalSchema.virtual('doctorCount', {
  ref: 'DoctorHospitalMapping',
  localField: '_id',
  foreignField: 'hospital',
  count: true,
  match: { status: 'approved', isActive: true }
});

// Method to check if user is admin
hospitalSchema.methods.isAdmin = function(userId) {
  const userIdStr = userId.toString();
  return this.primaryAdmin.toString() === userIdStr || 
         this.additionalAdmins.some(admin => admin.toString() === userIdStr);
};

const Hospital = mongoose.model('Hospital', hospitalSchema);

module.exports = Hospital;
module.exports.HOSPITAL_TYPES = HOSPITAL_TYPES;
module.exports.VERIFICATION_STATUS = VERIFICATION_STATUS;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Hospital.js'), hospitalModel);
console.log('  ✓ models/Hospital.js');

// DoctorHospitalMapping Model
const doctorHospitalMappingModel = `const mongoose = require('mongoose');

const MAPPING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  RESIGNED: 'resigned'
};

const EMPLOYMENT_TYPE = {
  FULL_TIME: 'full_time',
  PART_TIME: 'part_time',
  VISITING: 'visiting',
  CONSULTANT: 'consultant',
  RESIDENT: 'resident',
  INTERN: 'intern'
};

const scheduleSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  maxPatients: { type: Number, default: 20 },
  isAvailable: { type: Boolean, default: true }
}, { _id: false });

const doctorHospitalMappingSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor reference is required']
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital reference is required']
  },

  // Application Details
  applicationDate: { type: Date, default: Date.now },
  applicationNote: { type: String, maxlength: 1000 },
  
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

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNotes: String,
  rejectionReason: String,

  // Employment Details
  employmentType: {
    type: String,
    enum: Object.values(EMPLOYMENT_TYPE),
    default: EMPLOYMENT_TYPE.FULL_TIME
  },
  department: { type: String, trim: true },
  designation: { type: String, trim: true },
  specialtiesAtHospital: [{ type: String, trim: true }],
  joiningDate: Date,
  
  // Schedule
  schedule: [scheduleSlotSchema],
  consultationFee: {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' }
  },
  averageConsultationDuration: { type: Number, default: 30 },
  
  // Location
  roomNumber: { type: String, trim: true },
  floor: { type: String, trim: true },
  building: { type: String, trim: true },

  // Contact
  hospitalEmail: { type: String, lowercase: true, trim: true },
  hospitalPhone: { type: String, trim: true },
  hospitalExtension: { type: String, trim: true },

  // Availability
  isAvailable: { type: Boolean, default: true },
  unavailabilityReason: String,
  unavailableFrom: Date,
  unavailableUntil: Date,

  // Permissions
  permissions: {
    canAccessPatientRecords: { type: Boolean, default: true },
    canCreatePrescriptions: { type: Boolean, default: true },
    canOrderTests: { type: Boolean, default: true },
    canAdmitPatients: { type: Boolean, default: false },
    canPerformSurgery: { type: Boolean, default: false },
    canApproveDischarge: { type: Boolean, default: false }
  },

  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
doctorHospitalMappingSchema.index({ doctor: 1, hospital: 1 }, { unique: true });
doctorHospitalMappingSchema.index({ hospital: 1, status: 1 });
doctorHospitalMappingSchema.index({ doctor: 1, status: 1 });

// Methods
doctorHospitalMappingSchema.methods.approve = async function(reviewerId, notes) {
  this.status = MAPPING_STATUS.APPROVED;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  this.joiningDate = this.joiningDate || new Date();
  return this.save();
};

doctorHospitalMappingSchema.methods.reject = async function(reviewerId, reason) {
  this.status = MAPPING_STATUS.REJECTED;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Static methods
doctorHospitalMappingSchema.statics.getDoctorHospitals = function(doctorId) {
  return this.find({
    doctor: doctorId,
    status: MAPPING_STATUS.APPROVED,
    isActive: true
  }).populate('hospital', 'name address type logo');
};

doctorHospitalMappingSchema.statics.getHospitalDoctors = function(hospitalId) {
  return this.find({
    hospital: hospitalId,
    status: MAPPING_STATUS.APPROVED,
    isActive: true
  }).populate('doctor', 'firstName lastName doctorInfo profileImage');
};

doctorHospitalMappingSchema.statics.getPendingApplications = function(hospitalId) {
  return this.find({
    hospital: hospitalId,
    status: MAPPING_STATUS.PENDING
  })
  .populate('doctor', 'firstName lastName email phone doctorInfo profileImage')
  .sort({ applicationDate: 1 });
};

const DoctorHospitalMapping = mongoose.model('DoctorHospitalMapping', doctorHospitalMappingSchema);

module.exports = DoctorHospitalMapping;
module.exports.MAPPING_STATUS = MAPPING_STATUS;
module.exports.EMPLOYMENT_TYPE = EMPLOYMENT_TYPE;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'DoctorHospitalMapping.js'), doctorHospitalMappingModel);
console.log('  ✓ models/DoctorHospitalMapping.js');

// MedicalRecord Model
const medicalRecordModel = `const mongoose = require('mongoose');

const RECORD_TYPES = [
  'consultation', 'lab_result', 'imaging', 'prescription', 'surgery',
  'vaccination', 'allergy', 'vital_signs', 'diagnosis', 'discharge_summary',
  'referral', 'clinical_notes', 'pathology', 'procedure', 'therapy'
];

const RECORD_STATUS = {
  DRAFT: 'draft',
  FINAL: 'final',
  AMENDED: 'amended',
  ARCHIVED: 'archived'
};

const attachmentSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number },
  ipfsHash: { type: String },
  cloudinaryUrl: { type: String },
  encryptionKey: { type: String, select: false },
  uploadedAt: { type: Date, default: Date.now }
});

const amendmentSchema = new mongoose.Schema({
  amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amendedAt: { type: Date, default: Date.now },
  reason: { type: String, required: true },
  previousContent: { type: mongoose.Schema.Types.Mixed },
  newContent: { type: mongoose.Schema.Types.Mixed }
});

const medicalRecordSchema = new mongoose.Schema({
  // Patient Reference
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient reference is required']
  },

  // Creator Reference
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator reference is required']
  },
  creatorRole: {
    type: String,
    enum: ['doctor', 'hospital_admin', 'system'],
    required: true
  },

  // Hospital Context
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital'
  },

  // Record Classification
  recordType: {
    type: String,
    enum: RECORD_TYPES,
    required: [true, 'Record type is required']
  },
  category: { type: String, trim: true },
  subcategory: { type: String, trim: true },

  // Record Content
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 200
  },
  description: { type: String, trim: true },
  
  // Clinical Data
  clinicalData: {
    chiefComplaint: { type: String },
    historyOfPresentIllness: { type: String },
    physicalExamination: { type: mongoose.Schema.Types.Mixed },
    diagnosis: [{
      code: { type: String },
      codeSystem: { type: String, enum: ['ICD-10', 'ICD-11', 'SNOMED'] },
      description: { type: String },
      isPrimary: { type: Boolean, default: false }
    }],
    procedures: [{
      code: { type: String },
      codeSystem: { type: String },
      description: { type: String },
      performedAt: { type: Date }
    }],
    vitalSigns: {
      bloodPressureSystolic: { type: Number },
      bloodPressureDiastolic: { type: Number },
      heartRate: { type: Number },
      temperature: { type: Number },
      respiratoryRate: { type: Number },
      oxygenSaturation: { type: Number },
      weight: { type: Number },
      height: { type: Number },
      recordedAt: { type: Date }
    },
    labResults: [{
      testName: { type: String },
      testCode: { type: String },
      value: { type: mongoose.Schema.Types.Mixed },
      unit: { type: String },
      referenceRange: { type: String },
      isAbnormal: { type: Boolean },
      performedAt: { type: Date }
    }]
  },

  // Attachments
  attachments: [attachmentSchema],

  // Blockchain Integration
  blockchain: {
    transactionHash: { type: String },
    blockNumber: { type: Number },
    ipfsHash: { type: String },
    contentHash: { type: String },
    timestamp: { type: Date }
  },

  // Encryption
  encryption: {
    isEncrypted: { type: Boolean, default: false },
    algorithm: { type: String },
    keyId: { type: String }
  },

  // Status
  status: {
    type: String,
    enum: Object.values(RECORD_STATUS),
    default: RECORD_STATUS.DRAFT
  },

  // Amendments
  amendments: [amendmentSchema],
  amendmentCount: { type: Number, default: 0 },

  // Related Records
  relatedRecords: [{
    record: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
    relationship: { type: String }
  }],

  // Linked Appointment/Prescription
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },

  // Access Control
  accessLevel: {
    type: String,
    enum: ['private', 'shared', 'emergency'],
    default: 'private'
  },
  
  // Dates
  encounterDate: { type: Date },
  expiresAt: { type: Date },

  // Metadata
  tags: [{ type: String, trim: true }],
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
medicalRecordSchema.index({ patient: 1, recordType: 1, createdAt: -1 });
medicalRecordSchema.index({ patient: 1, status: 1 });
medicalRecordSchema.index({ hospital: 1, createdAt: -1 });
medicalRecordSchema.index({ createdBy: 1 });
medicalRecordSchema.index({ 'blockchain.transactionHash': 1 }, { sparse: true });
medicalRecordSchema.index({ tags: 1 });
medicalRecordSchema.index({ title: 'text', description: 'text' });

// Pre-save: Update amendment count
medicalRecordSchema.pre('save', function(next) {
  if (this.isModified('amendments')) {
    this.amendmentCount = this.amendments.length;
  }
  next();
});

// Static method to get patient records
medicalRecordSchema.statics.getPatientRecords = function(patientId, options = {}) {
  const query = { patient: patientId, isDeleted: false };
  
  if (options.recordType) query.recordType = options.recordType;
  if (options.status) query.status = options.status;
  
  return this.find(query)
    .populate('createdBy', 'firstName lastName role')
    .populate('hospital', 'name')
    .sort({ createdAt: -1 });
};

const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);

module.exports = MedicalRecord;
module.exports.RECORD_TYPES = RECORD_TYPES;
module.exports.RECORD_STATUS = RECORD_STATUS;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'MedicalRecord.js'), medicalRecordModel);
console.log('  ✓ models/MedicalRecord.js');

// Permission Model
const permissionModel = `const mongoose = require('mongoose');

const PERMISSION_TYPES = {
  FULL_ACCESS: 'full_access',
  READ_ONLY: 'read_only',
  SPECIFIC_RECORDS: 'specific_records',
  TIME_LIMITED: 'time_limited',
  EMERGENCY: 'emergency'
};

const PERMISSION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired'
};

const permissionSchema = new mongoose.Schema({
  // Owner of the records
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner reference is required']
  },

  // Who is granted access
  grantedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Granted to reference is required']
  },
  grantedToRole: {
    type: String,
    enum: ['doctor', 'caregiver', 'hospital_admin', 'researcher'],
    required: true
  },

  // Hospital context (if applicable)
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

  // Permission Type
  permissionType: {
    type: String,
    enum: Object.values(PERMISSION_TYPES),
    required: true
  },

  // Specific Records Access
  specificRecords: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalRecord'
  }],

  // Record Type Restrictions
  allowedRecordTypes: [{
    type: String,
    enum: [
      'consultation', 'lab_result', 'imaging', 'prescription', 'surgery',
      'vaccination', 'allergy', 'vital_signs', 'diagnosis', 'discharge_summary',
      'referral', 'clinical_notes', 'pathology', 'procedure', 'therapy'
    ]
  }],

  // Date Range Access
  dateRestriction: {
    from: { type: Date },
    to: { type: Date }
  },

  // Time Validity
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date },

  // Status
  status: {
    type: String,
    enum: Object.values(PERMISSION_STATUS),
    default: PERMISSION_STATUS.PENDING
  },

  // Actions Allowed
  actions: {
    canView: { type: Boolean, default: true },
    canDownload: { type: Boolean, default: false },
    canShare: { type: Boolean, default: false },
    canAddNotes: { type: Boolean, default: false }
  },

  // Purpose
  purpose: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Blockchain
  blockchain: {
    transactionHash: { type: String },
    smartContractAddress: { type: String },
    tokenId: { type: String }
  },

  // Audit
  grantedAt: { type: Date },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revocationReason: String,

  // Access Log
  lastAccessedAt: Date,
  accessCount: { type: Number, default: 0 },

  // Notifications
  notifyOnAccess: { type: Boolean, default: true },
  notifyOnExpiry: { type: Boolean, default: true }

}, {
  timestamps: true
});

// Indexes
permissionSchema.index({ owner: 1, status: 1 });
permissionSchema.index({ grantedTo: 1, status: 1 });
permissionSchema.index({ owner: 1, grantedTo: 1 });
permissionSchema.index({ validUntil: 1 });

// Method to grant permission
permissionSchema.methods.grant = async function(granterId) {
  this.status = PERMISSION_STATUS.ACTIVE;
  this.grantedAt = new Date();
  this.grantedBy = granterId;
  return this.save();
};

// Method to revoke permission
permissionSchema.methods.revoke = async function(revokerId, reason) {
  this.status = PERMISSION_STATUS.REVOKED;
  this.revokedAt = new Date();
  this.revokedBy = revokerId;
  this.revocationReason = reason;
  return this.save();
};

// Method to log access
permissionSchema.methods.logAccess = async function() {
  this.lastAccessedAt = new Date();
  this.accessCount += 1;
  return this.save();
};

// Static method to check access
permissionSchema.statics.checkAccess = async function(ownerId, requesterId, recordId = null) {
  const now = new Date();
  
  const query = {
    owner: ownerId,
    grantedTo: requesterId,
    status: PERMISSION_STATUS.ACTIVE,
    validFrom: { $lte: now },
    $or: [
      { validUntil: { $exists: false } },
      { validUntil: null },
      { validUntil: { $gte: now } }
    ]
  };

  const permissions = await this.find(query);
  
  if (!permissions.length) return null;

  if (recordId) {
    const hasAccess = permissions.some(p => 
      p.permissionType === PERMISSION_TYPES.FULL_ACCESS ||
      p.specificRecords.some(r => r.toString() === recordId.toString())
    );
    if (!hasAccess) return null;
  }

  return permissions[0];
};

// Static method to expire old permissions
permissionSchema.statics.expireOldPermissions = async function() {
  const now = new Date();
  return this.updateMany(
    { status: PERMISSION_STATUS.ACTIVE, validUntil: { $lt: now } },
    { status: PERMISSION_STATUS.EXPIRED }
  );
};

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;
module.exports.PERMISSION_TYPES = PERMISSION_TYPES;
module.exports.PERMISSION_STATUS = PERMISSION_STATUS;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Permission.js'), permissionModel);
console.log('  ✓ models/Permission.js');

// Prescription Model
const prescriptionModel = `const mongoose = require('mongoose');

const PRESCRIPTION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  ON_HOLD: 'on_hold'
};

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  genericName: { type: String, trim: true },
  brandName: { type: String, trim: true },
  dosage: { type: String, required: true },
  dosageUnit: { type: String, enum: ['mg', 'ml', 'g', 'mcg', 'IU', 'units'], default: 'mg' },
  form: {
    type: String,
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'patch', 'suppository', 'other']
  },
  route: {
    type: String,
    enum: ['oral', 'topical', 'intravenous', 'intramuscular', 'subcutaneous', 'inhalation', 'rectal', 'ophthalmic', 'otic', 'nasal', 'other'],
    default: 'oral'
  },
  frequency: { type: String, required: true },
  duration: { type: String },
  quantity: { type: Number },
  refills: { type: Number, default: 0 },
  refillsRemaining: { type: Number },
  instructions: { type: String },
  sideEffects: [{ type: String }],
  contraindications: [{ type: String }],
  startDate: { type: Date },
  endDate: { type: Date },
  isChronic: { type: Boolean, default: false }
});

const prescriptionSchema = new mongoose.Schema({
  prescriptionNumber: {
    type: String,
    unique: true,
    required: true
  },

  // Patient
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Prescriber
  prescribedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Hospital Context
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

  // Related Records
  medicalRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

  // Medications
  medications: [medicationSchema],

  // Diagnosis
  diagnosis: [{
    code: { type: String },
    codeSystem: { type: String, enum: ['ICD-10', 'ICD-11', 'SNOMED'] },
    description: { type: String }
  }],

  // Status
  status: {
    type: String,
    enum: Object.values(PRESCRIPTION_STATUS),
    default: PRESCRIPTION_STATUS.ACTIVE
  },

  // Notes
  notes: { type: String, maxlength: 2000 },
  pharmacistNotes: { type: String },

  // Pharmacy
  pharmacy: {
    name: { type: String },
    address: { type: String },
    phone: { type: String },
    dispensedAt: { type: Date },
    dispensedBy: { type: String }
  },

  // Digital Signature
  digitalSignature: {
    signature: { type: String },
    signedAt: { type: Date },
    algorithm: { type: String }
  },

  // Blockchain
  blockchain: {
    transactionHash: { type: String },
    ipfsHash: { type: String }
  },

  // Validity
  prescribedDate: { type: Date, default: Date.now },
  validUntil: { type: Date },

  // Flags
  isControlledSubstance: { type: Boolean, default: false },
  requiresSpecialHandling: { type: Boolean, default: false },

  // History
  refillHistory: [{
    refillDate: { type: Date },
    refillBy: { type: String },
    pharmacy: { type: String },
    quantity: { type: Number }
  }]

}, {
  timestamps: true
});

// Indexes
prescriptionSchema.index({ patient: 1, status: 1, createdAt: -1 });
prescriptionSchema.index({ prescribedBy: 1, createdAt: -1 });
prescriptionSchema.index({ hospital: 1 });
prescriptionSchema.index({ prescriptionNumber: 1 }, { unique: true });

// Pre-save: Generate prescription number
prescriptionSchema.pre('save', async function(next) {
  if (!this.prescriptionNumber) {
    const date = new Date();
    const prefix = 'RX';
    const timestamp = date.getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.prescriptionNumber = \`\${prefix}-\${timestamp}-\${random}\`;
  }

  // Set refillsRemaining for new medications
  this.medications.forEach(med => {
    if (med.refillsRemaining === undefined) {
      med.refillsRemaining = med.refills;
    }
  });

  next();
});

// Static method to get active prescriptions
prescriptionSchema.statics.getActiveForPatient = function(patientId) {
  return this.find({
    patient: patientId,
    status: PRESCRIPTION_STATUS.ACTIVE,
    $or: [
      { validUntil: { $exists: false } },
      { validUntil: { $gte: new Date() } }
    ]
  })
  .populate('prescribedBy', 'firstName lastName doctorInfo')
  .populate('hospital', 'name')
  .sort({ createdAt: -1 });
};

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;
module.exports.PRESCRIPTION_STATUS = PRESCRIPTION_STATUS;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Prescription.js'), prescriptionModel);
console.log('  ✓ models/Prescription.js');

// Appointment Model
const appointmentModel = `const mongoose = require('mongoose');

const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled'
};

const APPOINTMENT_TYPES = [
  'consultation', 'follow_up', 'routine_checkup', 'emergency',
  'vaccination', 'lab_test', 'imaging', 'procedure', 'therapy',
  'telemedicine', 'surgery_consultation', 'specialist_referral'
];

const appointmentSchema = new mongoose.Schema({
  appointmentNumber: {
    type: String,
    unique: true,
    required: true
  },

  // Patient
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Doctor
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Hospital
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },

  // Doctor-Hospital Mapping (for context)
  doctorMapping: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DoctorHospitalMapping'
  },

  // Type & Reason
  appointmentType: {
    type: String,
    enum: APPOINTMENT_TYPES,
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  symptoms: [{ type: String, trim: true }],

  // Scheduling
  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String, required: true },
  duration: { type: Number, default: 30 },
  endTime: { type: String },

  // Status
  status: {
    type: String,
    enum: Object.values(APPOINTMENT_STATUS),
    default: APPOINTMENT_STATUS.SCHEDULED
  },
  statusHistory: [{
    status: { type: String, enum: Object.values(APPOINTMENT_STATUS) },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String
  }],

  // Check-in/out
  checkedInAt: Date,
  consultationStartedAt: Date,
  consultationEndedAt: Date,

  // Location
  location: {
    building: { type: String },
    floor: { type: String },
    room: { type: String },
    instructions: { type: String }
  },

  // Telemedicine
  isTelemedicine: { type: Boolean, default: false },
  telemedicine: {
    platform: { type: String },
    meetingLink: { type: String },
    meetingId: { type: String },
    password: { type: String }
  },

  // Fees
  consultationFee: {
    amount: { type: Number },
    currency: { type: String, default: 'USD' },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    paymentMethod: String,
    transactionId: String
  },

  // Notes
  patientNotes: { type: String, maxlength: 1000 },
  doctorNotes: { type: String, maxlength: 2000 },
  internalNotes: { type: String, maxlength: 500 },

  // Related Records
  medicalRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },

  // Reminders
  reminders: [{
    type: { type: String, enum: ['email', 'sms', 'push'] },
    scheduledFor: Date,
    sentAt: Date,
    status: { type: String, enum: ['pending', 'sent', 'failed'] }
  }],

  // Cancellation/Rescheduling
  cancellation: {
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    isRefunded: Boolean
  },
  rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  rescheduledTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

  // Booking Details
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookedAt: { type: Date, default: Date.now },
  bookingSource: {
    type: String,
    enum: ['web', 'mobile', 'phone', 'walk_in', 'referral'],
    default: 'web'
  },

  // Priority
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },

  // Recurring
  isRecurring: { type: Boolean, default: false },
  recurringPattern: {
    frequency: { type: String, enum: ['weekly', 'biweekly', 'monthly'] },
    endDate: Date,
    parentAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }
  }

}, {
  timestamps: true
});

// Indexes
appointmentSchema.index({ patient: 1, scheduledDate: -1 });
appointmentSchema.index({ doctor: 1, scheduledDate: 1, status: 1 });
appointmentSchema.index({ hospital: 1, scheduledDate: 1 });
appointmentSchema.index({ appointmentNumber: 1 }, { unique: true });
appointmentSchema.index({ status: 1, scheduledDate: 1 });

// Pre-save: Generate appointment number
appointmentSchema.pre('save', async function(next) {
  if (!this.appointmentNumber) {
    const date = new Date();
    const prefix = 'APT';
    const timestamp = date.getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.appointmentNumber = \`\${prefix}-\${timestamp}-\${random}\`;
  }
  next();
});

// Method to cancel appointment
appointmentSchema.methods.cancel = async function(userId, reason) {
  this.status = APPOINTMENT_STATUS.CANCELLED;
  this.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: userId,
    reason: reason
  };
  this.statusHistory.push({
    status: APPOINTMENT_STATUS.CANCELLED,
    changedBy: userId,
    reason: reason
  });
  return this.save();
};

// Static method to get doctor's schedule
appointmentSchema.statics.getDoctorSchedule = function(doctorId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    doctor: doctorId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW] }
  })
  .populate('patient', 'firstName lastName phone')
  .populate('hospital', 'name')
  .sort({ scheduledTime: 1 });
};

// Static method to check slot availability
appointmentSchema.statics.isSlotAvailable = async function(doctorId, hospitalId, date, time) {
  const existing = await this.findOne({
    doctor: doctorId,
    hospital: hospitalId,
    scheduledDate: date,
    scheduledTime: time,
    status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.RESCHEDULED] }
  });
  return !existing;
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
module.exports.APPOINTMENT_STATUS = APPOINTMENT_STATUS;
module.exports.APPOINTMENT_TYPES = APPOINTMENT_TYPES;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Appointment.js'), appointmentModel);
console.log('  ✓ models/Appointment.js');

// EmergencyAccessLog Model
const emergencyAccessLogModel = `const mongoose = require('mongoose');

const ACCESS_REASONS = [
  'unconscious_patient',
  'life_threatening_emergency',
  'patient_incapacitated',
  'urgent_care_required',
  'disaster_response',
  'public_health_emergency',
  'other'
];

const emergencyAccessLogSchema = new mongoose.Schema({
  // Who accessed
  accessedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessorRole: {
    type: String,
    enum: ['doctor', 'hospital_admin', 'emergency_responder'],
    required: true
  },

  // Patient whose records were accessed
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Hospital context
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

  // What was accessed
  recordsAccessed: [{
    record: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
    recordType: { type: String },
    accessedAt: { type: Date, default: Date.now }
  }],

  // Access Details
  accessReason: {
    type: String,
    enum: ACCESS_REASONS,
    required: true
  },
  reasonDescription: {
    type: String,
    required: true,
    maxlength: 1000
  },

  // Emergency Context
  emergencyType: { type: String, trim: true },
  emergencyLocation: {
    address: { type: String },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  emergencyContactNotified: { type: Boolean, default: false },

  // Duration
  accessStarted: { type: Date, default: Date.now },
  accessEnded: Date,
  accessDuration: { type: Number },

  // IP & Device Info
  ipAddress: { type: String },
  userAgent: { type: String },
  deviceInfo: { type: String },

  // Verification
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  verificationNotes: String,

  // Follow-up
  requiresReview: { type: Boolean, default: true },
  reviewStatus: {
    type: String,
    enum: ['pending', 'reviewed', 'flagged', 'cleared'],
    default: 'pending'
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNotes: String,

  // Notification Tracking
  notifications: [{
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['email', 'sms', 'push', 'in_app'] },
    sentAt: Date,
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: Date
  }],

  // Blockchain Record
  blockchain: {
    transactionHash: { type: String },
    recordedAt: Date
  }

}, {
  timestamps: true
});

// Indexes
emergencyAccessLogSchema.index({ accessedBy: 1, createdAt: -1 });
emergencyAccessLogSchema.index({ patient: 1, createdAt: -1 });
emergencyAccessLogSchema.index({ hospital: 1, createdAt: -1 });
emergencyAccessLogSchema.index({ reviewStatus: 1 });

// Pre-save: Calculate access duration
emergencyAccessLogSchema.pre('save', function(next) {
  if (this.accessEnded && this.accessStarted) {
    this.accessDuration = Math.round((this.accessEnded - this.accessStarted) / 1000);
  }
  next();
});

// Method to end access
emergencyAccessLogSchema.methods.endAccess = async function() {
  this.accessEnded = new Date();
  this.accessDuration = Math.round((this.accessEnded - this.accessStarted) / 1000);
  return this.save();
};

// Method to verify access
emergencyAccessLogSchema.methods.verify = async function(verifierId, notes) {
  this.isVerified = true;
  this.verifiedBy = verifierId;
  this.verifiedAt = new Date();
  this.verificationNotes = notes;
  return this.save();
};

// Method to review access
emergencyAccessLogSchema.methods.review = async function(reviewerId, status, notes) {
  this.reviewStatus = status;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  this.requiresReview = false;
  return this.save();
};

// Static method to get pending reviews
emergencyAccessLogSchema.statics.getPendingReviews = function() {
  return this.find({ requiresReview: true, reviewStatus: 'pending' })
    .populate('accessedBy', 'firstName lastName role')
    .populate('patient', 'firstName lastName')
    .populate('hospital', 'name')
    .sort({ createdAt: -1 });
};

// Static method to get patient's emergency access history
emergencyAccessLogSchema.statics.getPatientAccessHistory = function(patientId) {
  return this.find({ patient: patientId })
    .populate('accessedBy', 'firstName lastName role')
    .populate('hospital', 'name')
    .sort({ createdAt: -1 });
};

const EmergencyAccessLog = mongoose.model('EmergencyAccessLog', emergencyAccessLogSchema);

module.exports = EmergencyAccessLog;
module.exports.ACCESS_REASONS = ACCESS_REASONS;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'EmergencyAccessLog.js'), emergencyAccessLogModel);
console.log('  ✓ models/EmergencyAccessLog.js');

// Notification Model
const notificationModel = `const mongoose = require('mongoose');

const NOTIFICATION_TYPES = {
  APPOINTMENT_REMINDER: 'appointment_reminder',
  APPOINTMENT_CONFIRMED: 'appointment_confirmed',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment_rescheduled',
  NEW_PRESCRIPTION: 'new_prescription',
  PRESCRIPTION_REFILL: 'prescription_refill',
  RECORD_SHARED: 'record_shared',
  PERMISSION_REQUESTED: 'permission_requested',
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked',
  EMERGENCY_ACCESS: 'emergency_access',
  DOCTOR_APPROVED: 'doctor_approved',
  DOCTOR_REJECTED: 'doctor_rejected',
  HOSPITAL_VERIFIED: 'hospital_verified',
  LAB_RESULTS_READY: 'lab_results_ready',
  MESSAGE_RECEIVED: 'message_received',
  SYSTEM_ALERT: 'system_alert'
};

const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'push'];

const PRIORITY_LEVELS = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

const notificationSchema = new mongoose.Schema({
  // Recipient
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Type & Category
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPES),
    required: true
  },
  category: {
    type: String,
    enum: ['appointment', 'medical', 'permission', 'system', 'administrative'],
    required: true
  },

  // Content
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  shortMessage: {
    type: String,
    maxlength: 160
  },

  // Priority
  priority: {
    type: String,
    enum: Object.values(PRIORITY_LEVELS),
    default: PRIORITY_LEVELS.NORMAL
  },

  // Delivery
  channels: [{
    type: String,
    enum: NOTIFICATION_CHANNELS
  }],
  deliveryStatus: {
    in_app: {
      sent: { type: Boolean, default: false },
      sentAt: Date
    },
    email: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      emailId: String
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      messageId: String
    },
    push: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      pushId: String
    }
  },

  // Read Status
  isRead: { type: Boolean, default: false },
  readAt: Date,

  // Action
  action: {
    type: { type: String, enum: ['link', 'deep_link', 'callback', 'none'] },
    url: String,
    label: String
  },

  // Related Entities
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['appointment', 'prescription', 'medical_record', 'permission', 'hospital', 'user']
    },
    entityId: { type: mongoose.Schema.Types.ObjectId }
  },

  // Metadata
  metadata: { type: mongoose.Schema.Types.Mixed },

  // Scheduling
  scheduledFor: Date,
  expiresAt: Date,

  // Sender
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderType: { type: String, enum: ['user', 'system', 'automated'] },

  // Grouping
  groupId: { type: String },
  groupCount: { type: Number, default: 1 }

}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1 }, { sparse: true });
notificationSchema.index({ expiresAt: 1 }, { sparse: true });
notificationSchema.index({ groupId: 1 }, { sparse: true });

// Method to mark as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return this;
};

// Method to update delivery status
notificationSchema.methods.updateDeliveryStatus = async function(channel, status, messageId = null) {
  if (this.deliveryStatus[channel]) {
    this.deliveryStatus[channel].sent = status;
    this.deliveryStatus[channel].sentAt = new Date();
    if (messageId) {
      this.deliveryStatus[channel][\`\${channel}Id\`] = messageId;
    }
    return this.save();
  }
  return this;
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const query = { recipient: userId };
  
  if (options.unreadOnly) query.isRead = false;
  if (options.type) query.type = options.type;
  if (options.category) query.category = options.category;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this({
    ...data,
    channels: data.channels || ['in_app'],
    deliveryStatus: {
      in_app: { sent: true, sentAt: new Date() }
    }
  });
  return notification.save();
};

// Static method to delete expired notifications
notificationSchema.statics.deleteExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.NOTIFICATION_CHANNELS = NOTIFICATION_CHANNELS;
module.exports.PRIORITY_LEVELS = PRIORITY_LEVELS;
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Notification.js'), notificationModel);
console.log('  ✓ models/Notification.js');

// Models Index
const modelsIndex = `const User = require('./User');
const Hospital = require('./Hospital');
const DoctorHospitalMapping = require('./DoctorHospitalMapping');
const MedicalRecord = require('./MedicalRecord');
const Permission = require('./Permission');
const Prescription = require('./Prescription');
const Appointment = require('./Appointment');
const EmergencyAccessLog = require('./EmergencyAccessLog');
const Notification = require('./Notification');

module.exports = {
  User,
  Hospital,
  DoctorHospitalMapping,
  MedicalRecord,
  Permission,
  Prescription,
  Appointment,
  EmergencyAccessLog,
  Notification
};
`;

fs.writeFileSync(path.join(baseDir, 'models', 'index.js'), modelsIndex);
console.log('  ✓ models/index.js');

// ====================
// UTILS
// ====================
console.log('\n🔧 Creating utils...');

// JWT Utils
const jwtUtils = `const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

const generateAuthTokens = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    hospitalId: user.hospitalId || null
  };

  return {
    accessToken: generateToken(payload),
    refreshToken: generateRefreshToken({ id: user._id }),
    expiresIn: JWT_EXPIRES_IN
  };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  generateAuthTokens
};
`;

fs.writeFileSync(path.join(baseDir, 'utils', 'jwt.js'), jwtUtils);
console.log('  ✓ utils/jwt.js');

// Validators
const validators = `const validateEmail = (email) => {
  const re = /^\\w+([.-]?\\w+)*@\\w+([.-]?\\w+)*(\\.\\w{2,3})+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$/;
  return re.test(password);
};

const validatePhone = (phone) => {
  const re = /^[\\d\\s\\-+()]{10,}$/;
  return re.test(phone);
};

const validateWalletAddress = (address) => {
  const re = /^0x[a-fA-F0-9]{40}$/;
  return re.test(address);
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

const validateObjectId = (id) => {
  const re = /^[a-fA-F0-9]{24}$/;
  return re.test(id);
};

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateWalletAddress,
  sanitizeInput,
  validateObjectId
};
`;

fs.writeFileSync(path.join(baseDir, 'utils', 'validators.js'), validators);
console.log('  ✓ utils/validators.js');

// Error Handler Util
const errorHandler = `class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = \`\${statusCode}\`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleCastErrorDB = (err) => {
  const message = \`Invalid \${err.path}: \${err.value}\`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(?:(?=(\\\\?))\\2.)*?\\1/)[0];
  const message = \`Duplicate field value: \${value}. Please use another value.\`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = \`Invalid input data. \${errors.join('. ')}\`;
  return new AppError(message, 400);
};

const handleJWTError = () => 
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () => 
  new AppError('Your token has expired. Please log in again.', 401);

module.exports = {
  AppError,
  handleCastErrorDB,
  handleDuplicateFieldsDB,
  handleValidationErrorDB,
  handleJWTError,
  handleJWTExpiredError
};
`;

fs.writeFileSync(path.join(baseDir, 'utils', 'errorHandler.js'), errorHandler);
console.log('  ✓ utils/errorHandler.js');

console.log('\n✅ Setup complete!');
console.log('\nNext steps:');
console.log('1. Update .env with your MongoDB URI');
console.log('2. Run: npm install');
console.log('3. Run: npm run dev');
