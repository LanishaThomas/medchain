const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Authentication
  email: { 
    type: String, 
    lowercase: true,
    sparse: true,
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  password: { 
    type: String, 
    minlength: [8, 'Password must be at least 8 characters'],
    select: false 
  },
  phone: { 
    type: String,
    sparse: true,
    unique: true,
    match: [/^\+?[1-9]\d{9,14}$/, 'Invalid phone number']
  },
  
  // Profile
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  profileImage: String,
  dateOfBirth: Date,
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  
  // Role & Permissions
  role: { 
    type: String, 
    enum: ['patient', 'doctor', 'caregiver', 'hospital_admin'], 
    required: true 
  },
  
  // Hospital Admin Link
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital' 
  },
  
  // Doctor-specific
  doctorProfile: {
    licenseNumber: String,
    licenseState: String,
    licenseExpiry: Date,
    specializations: [String],
    qualifications: [{
      degree: String,
      institution: String,
      year: Number
    }],
    yearsOfExperience: Number,
    bio: String,
    // Credentials for public profile
    certificates: [{
      title: { type: String, required: true },
      issuingOrganization: String,
      issueDate: Date,
      expiryDate: Date,
      certificateUrl: String, // Cloudinary URL
      verificationUrl: String
    }],
    achievements: [{
      title: { type: String, required: true },
      description: String,
      date: Date,
      category: { type: String, enum: ['award', 'publication', 'research', 'fellowship', 'other'] }
    }],
    consultationFee: Number,
    languages: [String],
    // Profile sharing settings
    profileSettings: {
      isPublic: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      shareableSlug: String // unique URL slug for profile
    }
  },
  
  // Patient-specific
  patientProfile: {
    // Basic mandatory health info (required for emergency access)
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    allergies: [{
      allergen: { type: String, required: true },
      severity: { type: String, enum: ['mild', 'moderate', 'severe', 'life-threatening'] },
      reaction: String
    }],
    currentMedications: [{
      name: { type: String, required: true },
      dosage: String,
      frequency: String,
      prescribedFor: String,
      startDate: Date
    }],
    previousSurgeries: [{
      name: { type: String, required: true },
      date: Date,
      hospital: String,
      notes: String
    }],
    chronicConditions: [String],
    // Address (required)
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'India' }
    },
    // Emergency contacts (required for emergency access)
    emergencyContacts: [{
      name: { type: String, required: true },
      relationship: { type: String, required: true },
      phone: { type: String, required: true },
      isPrimary: { type: Boolean, default: false }
    }],
    // Insurance
    insuranceProvider: String,
    insurancePolicyNumber: String,
    // Emergency QR settings
    emergencySettings: {
      accessDuration: { type: Number, default: 30 }, // minutes
      lastQrGenerated: Date,
      qrAccessToken: String // encrypted token for validation
    },
    // Profile completion tracking
    isProfileComplete: { type: Boolean, default: false }
  },
  
  // Caregiver-specific
  caregiverProfile: {
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inviteToken: String,
    inviteExpires: Date,
    patientsUnderCare: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    permissions: {
      canViewRecords: { type: Boolean, default: false },
      canBookAppointments: { type: Boolean, default: false },
      canReceiveNotifications: { type: Boolean, default: true }
    }
  },
  
  // OTP Authentication (for patients)
  otp: {
    code: { type: String, select: false },
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
    lastSentAt: Date
  },
  
  // Refresh Tokens
  refreshTokens: {
    type: [{
      token: { type: String, select: false },
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now },
      deviceInfo: String,
      ipAddress: String
    }],
    default: []
  },
  
  // Email Verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: Date,
  
  // Password Reset
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: Date,
  
  // Account Security
  isActive: { type: Boolean, default: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  lastLoginIp: String,
  
  // Wallet for Blockchain
  walletAddress: {
    type: String,
    sparse: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ hospitalId: 1 });
userSchema.index({ 'doctorProfile.licenseNumber': 1 }, { sparse: true });

// Remove old indexes on model creation
userSchema.pre('init', function() {
  // This helps avoid duplicate index warnings
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save: Hash password
userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  const LOCK_TIME = 30 * 60 * 1000; // 30 minutes
  const MAX_ATTEMPTS = 5;

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 }
  });
};

// Generate OTP
userSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code: crypto.createHash('sha256').update(otp).digest('hex'),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    attempts: 0,
    lastSentAt: new Date()
  };
  return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function(candidateOTP) {
  if (!this.otp || !this.otp.code) return { valid: false, message: 'No OTP found' };
  if (this.otp.expiresAt < Date.now()) return { valid: false, message: 'OTP expired' };
  if (this.otp.attempts >= 3) return { valid: false, message: 'Too many attempts' };
  
  const hashedOTP = crypto.createHash('sha256').update(candidateOTP).digest('hex');
  if (hashedOTP !== this.otp.code) {
    this.otp.attempts += 1;
    return { valid: false, message: 'Invalid OTP' };
  }
  
  return { valid: true };
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return token;
};

// Generate caregiver invite token
userSchema.methods.generateCaregiverInviteToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.caregiverProfile.inviteToken = crypto.createHash('sha256').update(token).digest('hex');
  this.caregiverProfile.inviteExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  return token;
};

// Add refresh token
userSchema.methods.addRefreshToken = function(token, deviceInfo, ipAddress) {
  // Ensure refreshTokens array exists
  if (!this.refreshTokens) {
    this.refreshTokens = [];
  }
  
  // Remove expired tokens
  this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt > Date.now());
  
  // Limit to 5 active sessions
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift();
  }
  
  this.refreshTokens.push({
    token: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    deviceInfo: deviceInfo || 'unknown',
    ipAddress: ipAddress || 'unknown'
  });
};

// Verify refresh token
userSchema.methods.verifyRefreshToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const tokenDoc = this.refreshTokens.find(t => 
    t.token === hashedToken && t.expiresAt > Date.now()
  );
  return !!tokenDoc;
};

// Remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== hashedToken);
};

// Remove sensitive fields from JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.refreshTokens;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.__v;
  return obj;
};

// Static: Find by credentials (email/password)
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email, isActive: true }).select('+password');
  if (!user) throw new Error('Invalid credentials');
  if (user.isLocked()) throw new Error('Account locked. Try again later.');
  
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incLoginAttempts();
    throw new Error('Invalid credentials');
  }
  
  await user.resetLoginAttempts();
  return user;
};

// Static: Find by phone
userSchema.statics.findByPhone = async function(phone) {
  return this.findOne({ phone, isActive: true });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
