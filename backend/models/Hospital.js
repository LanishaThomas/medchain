const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  // Basic Info
  name: { 
    type: String, 
    required: [true, 'Hospital name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  slug: { 
    type: String, 
    unique: true, 
    lowercase: true 
  },
  type: {
    type: String,
    enum: ['general', 'specialty', 'teaching', 'community', 'clinic', 'urgent_care'],
    default: 'general'
  },
  description: { 
    type: String, 
    maxlength: 2000 
  },
  
  // Registration & License
  registrationNumber: { 
    type: String, 
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  licenseNumber: { 
    type: String, 
    required: [true, 'License number is required'],
    trim: true
  },
  licenseExpiry: Date,
  taxId: String,
  
  // Contact
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  phone: { 
    type: String, 
    required: [true, 'Phone is required']
  },
  emergencyPhone: String,
  website: String,
  
  // Address
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'USA' },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Administration - Hospital admin is the user who registered
  primaryAdmin: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: [true, 'Primary admin is required']
  },
  additionalAdmins: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  
  // Verification (self-verified for now, can add manual review later)
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'verified', 'rejected', 'suspended'], 
    default: 'verified' // Auto-verified on registration
  },
  verificationNotes: String,
  verifiedAt: Date,
  
  // Medical Info
  specialties: [{ type: String, trim: true }],
  departments: [{
    name: String,
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true }
  }],
  facilities: [String],
  bedCount: { type: Number, min: 0 },
  
  // Operating Hours
  operatingHours: [{
    day: { 
      type: String, 
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    isOpen: { type: Boolean, default: true },
    openTime: String,
    closeTime: String,
    is24Hours: { type: Boolean, default: false }
  }],
  is24HoursEmergency: { type: Boolean, default: false },
  
  // Settings
  settings: {
    appointmentDuration: { type: Number, default: 30 },
    maxAdvanceBookingDays: { type: Number, default: 90 },
    allowOnlineBooking: { type: Boolean, default: true },
    requireDoctorApproval: { type: Boolean, default: true },
    autoApproveDoctors: { type: Boolean, default: false }
  },
  
  // Media
  logo: String,
  images: [String],
  
  // Blockchain
  walletAddress: {
    type: String,
    sparse: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address']
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  deactivatedAt: Date,
  deactivationReason: String,

  // Blockchain audit reference
  blockchainHash: { type: String, default: null },
  blockchainTxHash: { type: String, default: null }
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

// Generate slug before save
hospitalSchema.pre('save', function() {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + 
      '-' + Date.now().toString(36);
  }
});

// Virtual: Doctor count
hospitalSchema.virtual('doctorCount', {
  ref: 'DoctorHospitalMapping',
  localField: '_id',
  foreignField: 'hospital',
  count: true,
  match: { status: 'approved' }
});

// Virtual: Pending applications count
hospitalSchema.virtual('pendingApplications', {
  ref: 'DoctorHospitalMapping',
  localField: '_id',
  foreignField: 'hospital',
  count: true,
  match: { status: 'pending' }
});

// Check if user is admin
hospitalSchema.methods.isAdmin = function(userId) {
  const id = userId.toString();
  return this.primaryAdmin.toString() === id || 
         this.additionalAdmins.some(a => a.toString() === id);
};

// Add admin
hospitalSchema.methods.addAdmin = async function(userId) {
  if (!this.additionalAdmins.includes(userId)) {
    this.additionalAdmins.push(userId);
    await this.save();
  }
};

// Remove admin
hospitalSchema.methods.removeAdmin = async function(userId) {
  if (this.primaryAdmin.toString() === userId.toString()) {
    throw new Error('Cannot remove primary admin');
  }
  this.additionalAdmins = this.additionalAdmins.filter(a => a.toString() !== userId.toString());
  await this.save();
};

// Static: Find by admin
hospitalSchema.statics.findByAdmin = function(userId) {
  return this.findOne({
    $or: [
      { primaryAdmin: userId },
      { additionalAdmins: userId }
    ],
    isActive: true
  });
};

const Hospital = mongoose.model('Hospital', hospitalSchema);

module.exports = Hospital;
