#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const dirs = ['models', 'utils'];

// Create directories
console.log('Creating directories...\n');
dirs.forEach(dir => {
  const dirPath = path.join(baseDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  } else {
    console.log(`⊘ Directory already exists: ${dir}`);
  }
});

console.log('\nCreating models and utilities...\n');

// ============================================
// USER MODEL
// ============================================

const userModel = `const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\\w+([\\.\\-]?\\w+)*@\\w+([\\.\\-]?\\w+)*(\\.\\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    phone: {
      type: String,
      match: [/^\\+?1?\\d{9,15}$/, 'Please provide a valid phone number']
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say']
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'caregiver', 'hospital_admin', 'super_admin'],
      required: [true, 'Role is required'],
      default: 'patient'
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    medicalLicense: {
      licenseNumber: String,
      issuingBody: String,
      issuingDate: Date,
      expiryDate: Date,
      documentUrl: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      }
    },
    specializations: [
      {
        specialty: String,
        certificationUrl: String,
        yearsOfExperience: Number
      }
    ],
    hospitalMappings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DoctorHospitalMapping'
      }
    ],
    emergencyContacts: [
      {
        name: String,
        relationship: String,
        phone: String,
        email: String
      }
    ],
    linkedPatients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    avatar: String,
    bio: String,
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: String,
    verificationTokenExpiry: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockReason: String,
    blockedAt: Date,
    lastLogin: Date,
    passwordResetToken: String,
    passwordResetExpiry: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    notificationPreferences: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: true },
      appointmentReminders: { type: Boolean, default: true },
      prescriptionUpdates: { type: Boolean, default: true },
      medicalAlerts: { type: Boolean, default: true }
    },
    dataProcessingConsent: {
      type: Boolean,
      default: false
    },
    dataProcessingConsentDate: Date,
    privacyPolicyAccepted: {
      type: Boolean,
      default: false
    },
    privacyPolicyAcceptedDate: Date,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ hospital: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

UserSchema.virtual('fullName').get(function () {
  return \\\`\\\${this.firstName} \\\${this.lastName}\\\`;
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

UserSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      \\$set: { loginAttempts: 1 },
      \\$unset: { lockUntil: 1 }
    });
  }
  const updates = { \\$inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000;
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.\\$set = { lockUntil: Date.now() + lockTime };
  }
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    \\$set: { loginAttempts: 0 },
    \\$unset: { lockUntil: 1 }
  });
};

UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  delete obj.verificationToken;
  delete obj.passwordResetToken;
  return obj;
};

UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findDoctors = function () {
  return this.find({ role: 'doctor', isActive: true });
};

UserSchema.statics.findPatients = function () {
  return this.find({ role: 'patient', isActive: true });
};

module.exports = mongoose.model('User', UserSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'User.js'), userModel);
console.log('✓ Created models/User.js');

// ============================================
// HOSPITAL MODEL
// ============================================

const hospitalModel = `const mongoose = require('mongoose');

const HospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true
    },
    email: {
      type: String,
      required: [true, 'Hospital email is required'],
      unique: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: [true, 'Hospital phone is required']
    },
    website: String,
    address: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      zipCode: {
        type: String,
        required: true
      },
      country: {
        type: String,
        required: true
      },
      latitude: Number,
      longitude: Number
    },
    description: String,
    totalBeds: {
      type: Number,
      min: 1
    },
    departments: [
      {
        name: String,
        headOfDepartment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ],
    facilities: [String],
    emergencyServices: {
      type: Boolean,
      default: false
    },
    icu: {
      type: Boolean,
      default: false
    },
    operatingTheaters: Number,
    diagnosticLabs: {
      type: Boolean,
      default: false
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    primaryAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    rejectionReason: String,
    verificationDate: Date,
    verificationDocuments: [
      {
        documentType: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    ipfsHash: String,
    blockchainHash: String,
    isActive: {
      type: Boolean,
      default: true
    },
    isApproved: {
      type: Boolean,
      default: false
    },
    approvalDate: Date,
    suspensionReason: String,
    suspendedAt: Date,
    operationalHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
    },
    emergencyContact: {
      name: String,
      phone: String,
      email: String
    },
    totalDoctors: {
      type: Number,
      default: 0
    },
    totalPatients: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

HospitalSchema.index({ name: 'text', description: 'text' });
HospitalSchema.index({ 'address.city': 1 });
HospitalSchema.index({ registrationNumber: 1 });
HospitalSchema.index({ verificationStatus: 1 });
HospitalSchema.index({ isActive: 1 });

HospitalSchema.virtual('fullAddress').get(function () {
  const { street, city, state, zipCode, country } = this.address || {};
  return \\\`\\\${street}, \\\${city}, \\\${state} \\\${zipCode}, \\\${country}\\\`;
});

HospitalSchema.methods.approve = async function () {
  this.isApproved = true;
  this.verificationStatus = 'verified';
  this.approvalDate = Date.now();
  return this.save();
};

HospitalSchema.methods.reject = async function (reason) {
  this.verificationStatus = 'rejected';
  this.rejectionReason = reason;
  return this.save();
};

HospitalSchema.methods.suspend = async function (reason) {
  this.isActive = false;
  this.suspensionReason = reason;
  this.suspendedAt = Date.now();
  return this.save();
};

HospitalSchema.methods.reactivate = async function () {
  this.isActive = true;
  this.suspensionReason = null;
  this.suspendedAt = null;
  return this.save();
};

HospitalSchema.statics.findApproved = function () {
  return this.find({ isApproved: true, isActive: true });
};

HospitalSchema.statics.findPending = function () {
  return this.find({ verificationStatus: 'pending' });
};

module.exports = mongoose.model('Hospital', HospitalSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Hospital.js'), hospitalModel);
console.log('✓ Created models/Hospital.js');

// ============================================
// DOCTOR HOSPITAL MAPPING
// ============================================

const doctorHospitalMapping = `const mongoose = require('mongoose');

const DoctorHospitalMappingSchema = new mongoose.Schema(
  {
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
    department: {
      type: String,
      required: [true, 'Department is required']
    },
    designation: {
      type: String,
      enum: ['consultant', 'senior_consultant', 'junior_consultant', 'resident', 'intern'],
      required: true
    },
    specialization: String,
    qualifications: [String],
    appointmentSettings: {
      availableForAppointments: {
        type: Boolean,
        default: true
      },
      consultationFee: {
        type: Number,
        min: 0
      },
      maxAppointmentsPerDay: Number,
      appointmentDuration: {
        type: Number,
        default: 30
      }
    },
    workingSchedule: {
      monday: { available: Boolean, startTime: String, endTime: String },
      tuesday: { available: Boolean, startTime: String, endTime: String },
      wednesday: { available: Boolean, startTime: String, endTime: String },
      thursday: { available: Boolean, startTime: String, endTime: String },
      friday: { available: Boolean, startTime: String, endTime: String },
      saturday: { available: Boolean, startTime: String, endTime: String },
      sunday: { available: Boolean, startTime: String, endTime: String }
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvalDate: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectionReason: String,
    isActive: {
      type: Boolean,
      default: true
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    suspension: {
      isSuspended: {
        type: Boolean,
        default: false
      },
      reason: String,
      suspendedAt: Date,
      suspendedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    totalAppointments: {
      type: Number,
      default: 0
    },
    totalPatients: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    cancellationRate: {
      type: Number,
      default: 0
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

DoctorHospitalMappingSchema.index({ doctor: 1, hospital: 1 }, { unique: true });
DoctorHospitalMappingSchema.index({ hospital: 1 });
DoctorHospitalMappingSchema.index({ approvalStatus: 1 });
DoctorHospitalMappingSchema.index({ isActive: 1 });

DoctorHospitalMappingSchema.methods.approve = async function (approvedBy) {
  this.approvalStatus = 'approved';
  this.approvalDate = Date.now();
  this.approvedBy = approvedBy;
  return this.save();
};

DoctorHospitalMappingSchema.methods.reject = async function (reason, approvedBy) {
  this.approvalStatus = 'rejected';
  this.rejectionReason = reason;
  this.approvedBy = approvedBy;
  return this.save();
};

DoctorHospitalMappingSchema.methods.suspend = async function (reason, suspendedBy) {
  this.suspension.isSuspended = true;
  this.suspension.reason = reason;
  this.suspension.suspendedAt = Date.now();
  this.suspension.suspendedBy = suspendedBy;
  this.isActive = false;
  return this.save();
};

DoctorHospitalMappingSchema.methods.reactivate = async function () {
  this.suspension.isSuspended = false;
  this.suspension.reason = null;
  this.suspension.suspendedAt = null;
  this.isActive = true;
  return this.save();
};

DoctorHospitalMappingSchema.statics.findApprovedByHospital = function (hospitalId) {
  return this.find({ hospital: hospitalId, approvalStatus: 'approved', isActive: true });
};

DoctorHospitalMappingSchema.statics.findPendingApprovals = function (hospitalId) {
  return this.find({ hospital: hospitalId, approvalStatus: 'pending' });
};

module.exports = mongoose.model('DoctorHospitalMapping', DoctorHospitalMappingSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'DoctorHospitalMapping.js'), doctorHospitalMapping);
console.log('✓ Created models/DoctorHospitalMapping.js');

// ============================================
// MEDICAL RECORD MODEL
// ============================================

const medicalRecord = `const mongoose = require('mongoose');

const MedicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required']
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor is required']
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    recordType: {
      type: String,
      enum: ['consultation', 'prescription', 'lab_report', 'imaging', 'diagnosis', 'surgery', 'admission', 'discharge', 'vaccination', 'other'],
      required: true
    },
    visitDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    diagnosis: {
      icd10Code: String,
      description: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe', 'critical']
      }
    },
    symptoms: [String],
    vitals: {
      bloodPressure: String,
      heartRate: Number,
      temperature: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number,
      bmi: Number
    },
    clinicalNotes: String,
    treatment: {
      type: String,
      description: String,
      duration: String,
      instructions: String
    },
    attachments: [
      {
        type: String,
        fileType: String,
        fileName: String,
        fileSize: Number,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    ipfsHash: String,
    blockchainHash: String,
    merkleRoot: String,
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        accessType: {
          type: String,
          enum: ['view', 'edit'],
          default: 'view'
        },
        grantedAt: { type: Date, default: Date.now }
      }
    ],
    emergencyAccessLogs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmergencyAccessLog'
      }
    ],
    patientConsent: {
      type: Boolean,
      default: true
    },
    consentDate: Date,
    consentWithdrawnDate: Date,
    isConfidential: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    archivedAt: Date,
    labValues: mongoose.Schema.Types.Mixed,
    imagingDetails: mongoose.Schema.Types.Mixed,
    additionalData: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

MedicalRecordSchema.index({ patient: 1 });
MedicalRecordSchema.index({ doctor: 1 });
MedicalRecordSchema.index({ hospital: 1 });
MedicalRecordSchema.index({ visitDate: -1 });
MedicalRecordSchema.index({ recordType: 1 });
MedicalRecordSchema.index({ 'diagnosis.icd10Code': 1 });
MedicalRecordSchema.index({ ipfsHash: 1 });
MedicalRecordSchema.index({ blockchainHash: 1 });

MedicalRecordSchema.virtual('recordAge').get(function () {
  return Math.floor((Date.now() - this.visitDate) / (1000 * 60 * 60 * 24));
});

MedicalRecordSchema.methods.shareWith = async function (userId, accessType = 'view') {
  const existingShare = this.sharedWith.find(s => s.user.toString() === userId.toString());
  if (!existingShare) {
    this.sharedWith.push({ user: userId, accessType });
  }
  return this.save();
};

MedicalRecordSchema.methods.revokeAccess = async function (userId) {
  this.sharedWith = this.sharedWith.filter(s => s.user.toString() !== userId.toString());
  return this.save();
};

MedicalRecordSchema.methods.archive = async function () {
  this.isArchived = true;
  this.archivedAt = Date.now();
  return this.save();
};

MedicalRecordSchema.methods.lockFromEditing = async function () {
  this.isConfidential = true;
  return this.save();
};

MedicalRecordSchema.statics.findByPatient = function (patientId) {
  return this.find({ patient: patientId, isArchived: false });
};

MedicalRecordSchema.statics.findByDoctor = function (doctorId) {
  return this.find({ doctor: doctorId });
};

MedicalRecordSchema.statics.findByType = function (type) {
  return this.find({ recordType: type });
};

module.exports = mongoose.model('MedicalRecord', MedicalRecordSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'MedicalRecord.js'), medicalRecord);
console.log('✓ Created models/MedicalRecord.js');

// ============================================
// PERMISSION MODEL
// ============================================

const permissionModel = `const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Permission name is required'],
      unique: true
    },
    description: String,
    resource: {
      type: String,
      required: true,
      enum: ['user', 'hospital', 'doctor', 'patient', 'medical_record', 'prescription', 'appointment', 'emergency_access', 'notification']
    },
    action: {
      type: String,
      required: true,
      enum: ['create', 'read', 'update', 'delete', 'approve', 'reject', 'share', 'emergency_access']
    },
    assignedRoles: [
      {
        type: String,
        enum: ['patient', 'doctor', 'caregiver', 'hospital_admin', 'super_admin']
      }
    ],
    conditions: {
      type: mongoose.Schema.Types.Mixed
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

PermissionSchema.index({ resource: 1, action: 1 }, { unique: true });
PermissionSchema.index({ assignedRoles: 1 });
PermissionSchema.index({ name: 1 });

PermissionSchema.methods.assignToRole = async function (role) {
  if (!this.assignedRoles.includes(role)) {
    this.assignedRoles.push(role);
  }
  return this.save();
};

PermissionSchema.methods.removeFromRole = async function (role) {
  this.assignedRoles = this.assignedRoles.filter(r => r !== role);
  return this.save();
};

PermissionSchema.statics.findByRole = function (role) {
  return this.find({ assignedRoles: role, isActive: true });
};

PermissionSchema.statics.findByResourceAndAction = function (resource, action) {
  return this.findOne({ resource, action, isActive: true });
};

PermissionSchema.statics.checkPermission = async function (role, resource, action) {
  const permission = await this.findOne({
    resource,
    action,
    assignedRoles: role,
    isActive: true
  });
  return !!permission;
};

module.exports = mongoose.model('Permission', PermissionSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Permission.js'), permissionModel);
console.log('✓ Created models/Permission.js');

// ============================================
// PRESCRIPTION MODEL
// ============================================

const prescriptionModel = `const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required']
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor is required']
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalRecord'
    },
    prescriptionNumber: {
      type: String,
      unique: true,
      required: true
    },
    prescriptionDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    diagnosis: String,
    chiefComplaint: String,
    medications: [
      {
        medicineId: String,
        medicineName: {
          type: String,
          required: true
        },
        dosage: {
          amount: Number,
          unit: String
        },
        frequency: {
          type: String,
          enum: ['once_daily', 'twice_daily', 'thrice_daily', 'four_times_daily', 'as_needed', 'every_12_hours', 'every_8_hours', 'other']
        },
        duration: {
          value: Number,
          unit: String
        },
        route: {
          type: String,
          enum: ['oral', 'intravenous', 'intramuscular', 'topical', 'inhalation', 'rectal', 'other']
        },
        sideEffects: [String],
        contraindications: [String],
        instructions: String,
        notes: String
      }
    ],
    investigations: [
      {
        testName: String,
        urgency: {
          type: String,
          enum: ['routine', 'urgent'],
          default: 'routine'
        },
        reason: String
      }
    ],
    allergies: [String],
    dietaryRestrictions: [String],
    followUpDate: Date,
    followUpNotes: String,
    digitalSignature: String,
    ipfsHash: String,
    blockchainHash: String,
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'expired'],
      default: 'active'
    },
    expiryDate: Date,
    issuedCount: {
      type: Number,
      default: 0
    },
    renewalCount: {
      type: Number,
      default: 0
    },
    refillAllowed: {
      type: Boolean,
      default: true
    },
    refillsRemaining: Number,
    cancelReason: String,
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

PrescriptionSchema.index({ patient: 1 });
PrescriptionSchema.index({ doctor: 1 });
PrescriptionSchema.index({ prescriptionDate: -1 });
PrescriptionSchema.index({ status: 1 });
PrescriptionSchema.index({ prescriptionNumber: 1 });

PrescriptionSchema.methods.renew = async function () {
  this.renewalCount += 1;
  this.expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  return this.save();
};

PrescriptionSchema.methods.cancel = async function (reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancelReason = reason;
  this.cancelledAt = Date.now();
  this.cancelledBy = cancelledBy;
  return this.save();
};

PrescriptionSchema.methods.isExpired = function () {
  if (!this.expiryDate) return false;
  return Date.now() > this.expiryDate;
};

PrescriptionSchema.statics.findActiveByPatient = function (patientId) {
  return this.find({ patient: patientId, status: 'active' });
};

PrescriptionSchema.statics.findByDoctor = function (doctorId) {
  return this.find({ doctor: doctorId });
};

module.exports = mongoose.model('Prescription', PrescriptionSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Prescription.js'), prescriptionModel);
console.log('✓ Created models/Prescription.js');

// ============================================
// APPOINTMENT MODEL
// ============================================

const appointmentModel = `const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required']
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor is required']
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true
    },
    doctorHospitalMapping: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorHospitalMapping'
    },
    appointmentNumber: {
      type: String,
      unique: true,
      required: true
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required']
    },
    appointmentTime: {
      startTime: {
        type: String,
        required: true
      },
      endTime: String,
      durationMinutes: {
        type: Number,
        default: 30
      }
    },
    consultationType: {
      type: String,
      enum: ['in_person', 'online', 'phone'],
      default: 'in_person'
    },
    reason: {
      type: String,
      required: [true, 'Reason for appointment is required']
    },
    symptoms: [String],
    department: String,
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'],
      default: 'scheduled'
    },
    cancellationReason: String,
    cancelledBy: {
      type: String,
      enum: ['patient', 'doctor', 'hospital']
    },
    cancelledAt: Date,
    cancellationFee: {
      type: Number,
      default: 0
    },
    originalAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    rescheduleCount: {
      type: Number,
      default: 0
    },
    consultationFee: {
      type: Number,
      required: true,
      default: 0
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: String,
    transactionId: String,
    actualStartTime: Date,
    actualEndTime: Date,
    notes: String,
    nextAppointmentDate: Date,
    patientRating: {
      type: Number,
      min: 1,
      max: 5
    },
    patientFeedback: String,
    doctorRating: {
      type: Number,
      min: 1,
      max: 5
    },
    doctorFeedback: String,
    reminderSent: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      reminder24h: { type: Boolean, default: false },
      reminder1h: { type: Boolean, default: false }
    },
    meetingDetails: {
      platform: String,
      joinUrl: String,
      meetingId: String,
      accessCode: String
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

AppointmentSchema.index({ patient: 1 });
AppointmentSchema.index({ doctor: 1 });
AppointmentSchema.index({ hospital: 1 });
AppointmentSchema.index({ appointmentDate: 1 });
AppointmentSchema.index({ status: 1 });
AppointmentSchema.index({ appointmentNumber: 1 });

AppointmentSchema.methods.confirm = async function () {
  this.status = 'confirmed';
  return this.save();
};

AppointmentSchema.methods.complete = async function (notes) {
  this.status = 'completed';
  this.actualEndTime = Date.now();
  if (notes) this.notes = notes;
  return this.save();
};

AppointmentSchema.methods.cancel = async function (reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = Date.now();
  return this.save();
};

AppointmentSchema.statics.findUpcoming = function (doctorId, limit = 10) {
  return this.find({
    doctor: doctorId,
    appointmentDate: { \\$gte: Date.now() },
    status: { \\$in: ['scheduled', 'confirmed'] }
  }).sort({ appointmentDate: 1 }).limit(limit);
};

module.exports = mongoose.model('Appointment', AppointmentSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Appointment.js'), appointmentModel);
console.log('✓ Created models/Appointment.js');

// ============================================
// EMERGENCY ACCESS LOG
// ============================================

const emergencyAccessLog = `const mongoose = require('mongoose');

const EmergencyAccessLogSchema = new mongoose.Schema(
  {
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      required: true
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    accessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    accessType: {
      type: String,
      enum: ['emergency', 'authorized_sharing', 'caregiver_access', 'hospital_access'],
      required: true
    },
    reason: {
      type: String,
      required: [true, 'Reason for access is required']
    },
    emergencyDetails: {
      emergencyType: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      location: String,
      firstResponder: String
    },
    accessTime: {
      type: Date,
      default: Date.now,
      required: true
    },
    duration: Number,
    dataAccessed: [String],
    ipAddress: String,
    userAgent: String,
    deviceInfo: String,
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'auto_approved'],
      default: 'auto_approved'
    },
    approvalReason: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalTime: Date,
    denialReason: String,
    patientNotified: {
      type: Boolean,
      default: false
    },
    notificationTime: Date,
    notificationMethod: String,
    sessionId: String,
    auditTrail: [
      {
        action: String,
        timestamp: { type: Date, default: Date.now },
        details: mongoose.Schema.Types.Mixed
      }
    ],
    additionalNotes: String
  },
  {
    timestamps: true
  }
);

EmergencyAccessLogSchema.index({ medicalRecord: 1 });
EmergencyAccessLogSchema.index({ patient: 1 });
EmergencyAccessLogSchema.index({ accessedBy: 1 });
EmergencyAccessLogSchema.index({ accessTime: -1 });
EmergencyAccessLogSchema.index({ accessType: 1 });
EmergencyAccessLogSchema.index({ approvalStatus: 1 });

EmergencyAccessLogSchema.methods.approve = async function (approvedBy, reason) {
  this.approvalStatus = 'approved';
  this.approvedBy = approvedBy;
  this.approvalReason = reason;
  this.approvalTime = Date.now();
  return this.save();
};

EmergencyAccessLogSchema.methods.deny = async function (reason) {
  this.approvalStatus = 'denied';
  this.denialReason = reason;
  this.approvalTime = Date.now();
  return this.save();
};

EmergencyAccessLogSchema.methods.notifyPatient = async function (method = 'email') {
  this.patientNotified = true;
  this.notificationTime = Date.now();
  this.notificationMethod = method;
  return this.save();
};

EmergencyAccessLogSchema.statics.findByPatient = function (patientId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    patient: patientId,
    accessTime: { \\$gte: startDate }
  }).sort({ accessTime: -1 });
};

module.exports = mongoose.model('EmergencyAccessLog', EmergencyAccessLogSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'EmergencyAccessLog.js'), emergencyAccessLog);
console.log('✓ Created models/EmergencyAccessLog.js');

// ============================================
// NOTIFICATION MODEL
// ============================================

const notificationModel = `const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required']
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: [
        'appointment_scheduled', 'appointment_reminder', 'appointment_cancelled', 
        'appointment_rescheduled', 'prescription_issued', 'prescription_refill',
        'medical_record_shared', 'emergency_access_occurred', 'emergency_access_approved',
        'medical_record_updated', 'doctor_rating_request', 'hospital_admin_task',
        'verification_status_update', 'account_security_alert', 'message'
      ],
      required: true
    },
    title: {
      type: String,
      required: [true, 'Title is required']
    },
    message: {
      type: String,
      required: [true, 'Message is required']
    },
    description: String,
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['appointment', 'prescription', 'medical_record', 'hospital', 'user']
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId
      }
    },
    deliveryMethods: {
      email: {
        enabled: { type: Boolean, default: true },
        sent: { type: Boolean, default: false },
        sentAt: Date,
        status: String
      },
      sms: {
        enabled: { type: Boolean, default: false },
        sent: { type: Boolean, default: false },
        sentAt: Date,
        status: String
      },
      inApp: {
        enabled: { type: Boolean, default: true },
        sent: { type: Boolean, default: true },
        sentAt: { type: Date, default: Date.now }
      },
      push: {
        enabled: { type: Boolean, default: false },
        sent: { type: Boolean, default: false },
        sentAt: Date,
        status: String
      }
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending'
    },
    readAt: Date,
    isRead: {
      type: Boolean,
      default: false
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal'
    },
    scheduledFor: Date,
    sendAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    actionUrl: String,
    actionData: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
    failureReason: String,
    retryCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ sendAt: 1 });
NotificationSchema.index({ status: 1 });

NotificationSchema.methods.markAsRead = async function () {
  this.isRead = true;
  this.readAt = Date.now();
  this.status = 'read';
  return this.save();
};

NotificationSchema.methods.markAsDelivered = async function () {
  this.status = 'delivered';
  return this.save();
};

NotificationSchema.statics.findUnreadByRecipient = function (recipientId) {
  return this.find({ recipient: recipientId, isRead: false }).sort({ createdAt: -1 });
};

NotificationSchema.statics.findPendingToSend = function () {
  return this.find({
    status: 'pending',
    sendAt: { \\$lte: Date.now() },
    expiresAt: { \\$gt: Date.now() }
  }).limit(100);
};

module.exports = mongoose.model('Notification', NotificationSchema);
`;

fs.writeFileSync(path.join(baseDir, 'models', 'Notification.js'), notificationModel);
console.log('✓ Created models/Notification.js');

// ============================================
// MODELS INDEX
// ============================================

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
console.log('✓ Created models/index.js');

// ============================================
// JWT UTILITIES
// ============================================

const jwtUtils = `const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || '30d';

const generateToken = (payload, expiresIn = JWT_EXPIRE) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

const generateTokens = (payload) => {
  const accessToken = generateToken(payload, JWT_EXPIRE);
  const refreshToken = generateToken(payload, REFRESH_TOKEN_EXPIRE);
  return {
    accessToken,
    refreshToken
  };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

const generatePasswordResetToken = (userId) => {
  const payload = {
    userId,
    type: 'password_reset'
  };
  return generateToken(payload, '1h');
};

const generateEmailVerificationToken = (userId, email) => {
  const payload = {
    userId,
    email,
    type: 'email_verification'
  };
  return generateToken(payload, '24h');
};

const generate2FAToken = (userId) => {
  const payload = {
    userId,
    type: '2fa'
  };
  return generateToken(payload, '15m');
};

module.exports = {
  generateToken,
  generateTokens,
  verifyToken,
  decodeToken,
  extractTokenFromHeader,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  generate2FAToken
};
`;

fs.writeFileSync(path.join(baseDir, 'utils', 'jwt.js'), jwtUtils);
console.log('✓ Created utils/jwt.js');

// ============================================
// VALIDATORS
// ============================================

const validators = `const validator = require('validator');

const validateEmail = (email) => {
  if (!email) return false;
  return validator.isEmail(email);
};

const validatePhone = (phone) => {
  if (!phone) return false;
  const phoneRegex = /^\\+?1?\\d{9,15}$/;
  return phoneRegex.test(phone.replace(/\\s/g, ''));
};

const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  if (!/[!@#\\$%\\^&\\*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#\\$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateUserInput = (data) => {
  const errors = {};

  if (data.email && !validateEmail(data.email)) {
    errors.email = 'Please provide a valid email address';
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.phone = 'Please provide a valid phone number';
  }

  if (data.firstName) {
    if (typeof data.firstName !== 'string' || data.firstName.trim().length < 2) {
      errors.firstName = 'First name must be at least 2 characters long';
    }
  }

  if (data.lastName) {
    if (typeof data.lastName !== 'string' || data.lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters long';
    }
  }

  if (data.password) {
    const passwordCheck = validatePasswordStrength(data.password);
    if (!passwordCheck.isValid) {
      errors.password = passwordCheck.errors;
    }
  }

  if (data.role) {
    const validRoles = ['patient', 'doctor', 'caregiver', 'hospital_admin', 'super_admin'];
    if (!validRoles.includes(data.role)) {
      errors.role = 'Invalid role selected';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

const validateHospitalInput = (data) => {
  const errors = {};

  if (data.email && !validateEmail(data.email)) {
    errors.email = 'Please provide a valid email address';
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.phone = 'Please provide a valid phone number';
  }

  if (data.name && (typeof data.name !== 'string' || data.name.trim().length < 3)) {
    errors.name = 'Hospital name must be at least 3 characters long';
  }

  if (data.totalBeds && (!Number.isInteger(data.totalBeds) || data.totalBeds < 1)) {
    errors.totalBeds = 'Total beds must be a positive integer';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

const validateAppointmentInput = (data) => {
  const errors = {};

  if (!data.appointmentDate) {
    errors.appointmentDate = 'Appointment date is required';
  } else if (new Date(data.appointmentDate) < new Date()) {
    errors.appointmentDate = 'Appointment date cannot be in the past';
  }

  if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length < 5) {
    errors.reason = 'Appointment reason must be at least 5 characters long';
  }

  if (data.consultationType) {
    const validTypes = ['in_person', 'online', 'phone'];
    if (!validTypes.includes(data.consultationType)) {
      errors.consultationType = 'Invalid consultation type';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return validator.escape(input.trim());
};

const validateURL = (url) => {
  return validator.isURL(url);
};

const validateDate = (date) => {
  return date instanceof Date && !isNaN(date);
};

module.exports = {
  validateEmail,
  validatePhone,
  validatePasswordStrength,
  validateUserInput,
  validateHospitalInput,
  validateAppointmentInput,
  sanitizeInput,
  validateURL,
  validateDate
};
`;

fs.writeFileSync(path.join(baseDir, 'utils', 'validators.js'), validators);
console.log('✓ Created utils/validators.js');

// ============================================
// ERROR HANDLER
// ============================================

const errorHandler = `class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = \\\`\\\${statusCode}\\\`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = {}) {
    super(message, 400);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(\\\`\\\${resource} not found\\\`, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

class BadRequestError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500);
    this.name = 'InternalServerError';
  }
}

class UnprocessableEntityError extends AppError {
  constructor(message, details = {}) {
    super(message, 422);
    this.details = details;
    this.name = 'UnprocessableEntityError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

const formatErrorResponse = (error) => {
  const response = {
    success: false,
    status: error.status || 'error',
    statusCode: error.statusCode || 500,
    message: error.message || 'An error occurred',
    timestamp: new Date().toISOString()
  };

  if (error.errors && typeof error.errors === 'object') {
    response.errors = error.errors;
  }

  if (error.details && typeof error.details === 'object') {
    response.details = error.details;
  }

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  return response;
};

const handleMongooseValidationError = (error) => {
  const errors = {};
  Object.keys(error.errors).forEach((field) => {
    errors[field] = error.errors[field].message;
  });
  return new ValidationError('Validation failed', errors);
};

const handleMongooseDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyPattern)[0];
  return new ConflictError(\\\`\\\${field} already exists\\\`);
};

const handleJWTError = (error) => {
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token has expired');
  }
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  return new AuthenticationError('Authentication failed');
};

const errorHandlerMiddleware = (error, req, res, next) => {
  let customError = error;

  if (error.name === 'ValidationError') {
    customError = handleMongooseValidationError(error);
  } else if (error.code === 11000) {
    customError = handleMongooseDuplicateKeyError(error);
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    customError = handleJWTError(error);
  } else if (!(error instanceof AppError)) {
    customError = new InternalServerError(error.message || 'An error occurred');
  }

  const response = formatErrorResponse(customError);
  res.status(customError.statusCode).json(response);
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  InternalServerError,
  UnprocessableEntityError,
  RateLimitError,
  formatErrorResponse,
  handleMongooseValidationError,
  handleMongooseDuplicateKeyError,
  handleJWTError,
  errorHandlerMiddleware
};
`;

fs.writeFileSync(path.join(baseDir, 'utils', 'errorHandler.js'), errorHandler);
console.log('✓ Created utils/errorHandler.js');

console.log('\n' + '='.repeat(60));
console.log('✅ All models and utilities created successfully!');
console.log('='.repeat(60));

console.log('\n📁 Directory Structure:');
console.log(\`
models/
  ├── User.js                    (User model with authentication)
  ├── Hospital.js               (Hospital self-registration)
  ├── DoctorHospitalMapping.js   (Doctor-Hospital mapping)
  ├── MedicalRecord.js           (Medical records with blockchain)
  ├── Permission.js              (Access control)
  ├── Prescription.js            (Prescription management)
  ├── Appointment.js             (Appointment scheduling)
  ├── EmergencyAccessLog.js       (Emergency access audit)
  ├── Notification.js            (Notification system)
  └── index.js                   (Export all models)

utils/
  ├── jwt.js                     (JWT token utilities)
  ├── validators.js              (Input validation)
  └── errorHandler.js            (Error handling classes)
\`);

console.log('\n💡 Usage Example:');
console.log(\`
const { 
  User, Hospital, DoctorHospitalMapping, 
  MedicalRecord, Appointment, Prescription,
  Permission, EmergencyAccessLog, Notification
} = require('./models');

const { 
  generateToken, verifyToken 
} = require('./utils/jwt');

const { 
  validateUserInput, validateEmail 
} = require('./utils/validators');

const { 
  AppError, ValidationError 
} = require('./utils/errorHandler');
\`);

console.log('\n✨ Features Implemented:');
console.log('✓ Bcrypt password hashing with salt rounds');
console.log('✓ Role-based access control (Patient, Doctor, Caregiver, Hospital Admin, Super Admin)');
console.log('✓ Medical license verification workflow');
console.log('✓ Doctor-Hospital approval system');
console.log('✓ Medical record sharing and consent management');
console.log('✓ Emergency access logging and audit trail');
console.log('✓ Blockchain/IPFS hash support for medical records');
console.log('✓ Appointment scheduling with payment tracking');
console.log('✓ Prescription management with refill tracking');
console.log('✓ Notification delivery via multiple channels');
console.log('✓ JWT token generation and verification');
console.log('✓ Comprehensive input validation');
console.log('✓ Custom error handling classes');
console.log('✓ Database indexes for performance');
console.log('✓ Virtual fields and computed properties');
console.log('✓ Pre-save middleware for password hashing');

console.log('\n🎉 You can now use these models in your controllers and routes!');
`;

fs.writeFileSync(path.join(baseDir, 'setup-models.js'), setupModelsJs);
console.log('Setup script created: setup-models.js');
