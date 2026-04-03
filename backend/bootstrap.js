/**
 * Simple Bootstrap Script
 * Creates models and utils directories with all necessary files
 * Usage: node bootstrap.js
 */

const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const modelsDir = path.join(baseDir, 'models');
const utilsDir = path.join(baseDir, 'utils');

// Create directories
[modelsDir, utilsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created: ${path.relative(baseDir, dir)}`);
  }
});

// User Model
fs.writeFileSync(path.join(modelsDir, 'User.js'), `const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: String,
  role: { type: String, enum: ['patient', 'doctor', 'caregiver', 'hospital_admin'], default: 'patient' },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(pwd) {
  return bcrypt.compare(pwd, this.password);
};

module.exports = mongoose.model('User', userSchema);
`);
console.log('✓ Created: models/User.js');

// Hospital Model
fs.writeFileSync(path.join(modelsDir, 'Hospital.js'), `const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  registrationNumber: { type: String, required: true, unique: true },
  licenseNumber: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  address: String,
  city: String,
  state: String,
  primaryAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  specialties: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hospital', hospitalSchema);
`);
console.log('✓ Created: models/Hospital.js');

// DoctorHospitalMapping Model
fs.writeFileSync(path.join(modelsDir, 'DoctorHospitalMapping.js'), `const mongoose = require('mongoose');

const dhMappingSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
  employmentType: String,
  department: String,
  schedule: [Object],
  permissions: Object,
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

dhMappingSchema.index({ doctor: 1, hospital: 1 }, { unique: true });

module.exports = mongoose.model('DoctorHospitalMapping', dhMappingSchema);
`);
console.log('✓ Created: models/DoctorHospitalMapping.js');

// MedicalRecord Model
fs.writeFileSync(path.join(modelsDir, 'MedicalRecord.js'), `const mongoose = require('mongoose');

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
`);
console.log('✓ Created: models/MedicalRecord.js');

// Permission Model
fs.writeFileSync(path.join(modelsDir, 'Permission.js'), `const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  grantedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  permissionType: String,
  specificRecords: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' }],
  validFrom: Date,
  validUntil: Date,
  actions: Object,
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Permission', permissionSchema);
`);
console.log('✓ Created: models/Permission.js');

// Prescription Model
fs.writeFileSync(path.join(modelsDir, 'Prescription.js'), `const mongoose = require('mongoose');

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
`);
console.log('✓ Created: models/Prescription.js');

// Appointment Model
fs.writeFileSync(path.join(modelsDir, 'Appointment.js'), `const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentNumber: { type: String, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  scheduledDate: Date,
  scheduledTime: String,
  status: { type: String, enum: ['scheduled', 'confirmed', 'completed', 'cancelled'], default: 'scheduled' },
  reason: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
`);
console.log('✓ Created: models/Appointment.js');

// EmergencyAccessLog Model
fs.writeFileSync(path.join(modelsDir, 'EmergencyAccessLog.js'), `const mongoose = require('mongoose');

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
`);
console.log('✓ Created: models/EmergencyAccessLog.js');

// Notification Model
fs.writeFileSync(path.join(modelsDir, 'Notification.js'), `const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: String,
  title: String,
  message: String,
  channels: [String],
  isRead: { type: Boolean, default: false },
  readAt: Date,
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
`);
console.log('✓ Created: models/Notification.js');

// Models Index
fs.writeFileSync(path.join(modelsDir, 'index.js'), `module.exports = {
  User: require('./User'),
  Hospital: require('./Hospital'),
  DoctorHospitalMapping: require('./DoctorHospitalMapping'),
  MedicalRecord: require('./MedicalRecord'),
  Permission: require('./Permission'),
  Prescription: require('./Prescription'),
  Appointment: require('./Appointment'),
  EmergencyAccessLog: require('./EmergencyAccessLog'),
  Notification: require('./Notification')
};
`);
console.log('✓ Created: models/index.js');

// JWT Utils
fs.writeFileSync(path.join(utilsDir, 'jwt.js'), `const jwt = require('jsonwebtoken');

const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret', { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || 'your-secret');
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = { generateToken, verifyToken, decodeToken };
`);
console.log('✓ Created: utils/jwt.js');

// Validators Utils
fs.writeFileSync(path.join(utilsDir, 'validators.js'), `const validateEmail = (email) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
const validatePassword = (pwd) => pwd.length >= 8;
const validatePhone = (phone) => /^\\+?1?\\d{9,15}$/.test(phone);
const validateObjectId = (id) => /^[a-f\\d]{24}$/i.test(id);

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateObjectId
};
`);
console.log('✓ Created: utils/validators.js');

// Error Handler
fs.writeFileSync(path.join(utilsDir, 'errorHandler.js'), `class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = \`\${statusCode}\`.startsWith('4') ? 'fail' : 'error';
  }
}

module.exports = { AppError };
`);
console.log('✓ Created: utils/errorHandler.js');

console.log('\n✅ Bootstrap complete!');
console.log('📦 Now run: npm install mongoose bcryptjs jsonwebtoken');
console.log('🚀 Then: npm run dev\n');
