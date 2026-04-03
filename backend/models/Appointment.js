const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentNumber: { 
    type: String, 
    unique: true,
    sparse: true
  },
  
  // Core relationships
  patient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  doctor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  hospital: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital',
    index: true
  },
  
  // Requested vs Approved times (for rescheduling)
  requestedDate: {
    type: Date,
    required: true
  },
  requestedTime: {
    type: String,
    required: true
  },
  approvedDate: {
    type: Date
  },
  approvedTime: {
    type: String
  },
  
  // Duration in minutes
  duration: {
    type: Number,
    default: 30,
    min: 15,
    max: 120
  },
  
  // Appointment type
  appointmentType: {
    type: String,
    enum: ['consultation', 'follow_up', 'checkup', 'emergency', 'procedure', 'telemedicine'],
    default: 'consultation'
  },
  
  // Status workflow: pending → approved/rejected/rescheduled → completed/cancelled/no_show
  status: { 
    type: String, 
    enum: [
      'pending',      // Patient requested, waiting for doctor
      'approved',     // Doctor approved
      'rejected',     // Doctor rejected
      'rescheduled',  // Doctor proposed new time
      'completed',    // Appointment finished
      'cancelled',    // Cancelled by either party
      'no_show'       // Patient didn't show up
    ], 
    default: 'pending',
    index: true
  },
  
  // Reason for appointment (from patient)
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Symptoms (optional)
  symptoms: [{
    type: String
  }],
  
  // Priority level
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  
  // Doctor's notes (internal)
  doctorNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Response from doctor (rejection reason or reschedule message)
  doctorResponse: {
    type: String,
    maxlength: 500
  },
  
  // Rescheduled times (when doctor proposes new time)
  proposedDate: {
    type: Date
  },
  proposedTime: {
    type: String
  },
  
  // Patient response to reschedule
  patientAcceptedReschedule: {
    type: Boolean
  },
  
  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: String,
    enum: ['patient', 'doctor', 'system']
  },
  cancellationReason: {
    type: String
  },
  
  // Meeting link for telemedicine
  meetingLink: {
    type: String
  },
  
  // Reminders sent
  remindersSent: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push']
    },
    sentAt: Date
  }]
}, {
  timestamps: true
});

// Generate appointment number before save
appointmentSchema.pre('save', async function() {
  if (!this.appointmentNumber) {
    const date = new Date();
    const prefix = `APT${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.constructor.countDocuments({
      appointmentNumber: { $regex: `^${prefix}` }
    });
    this.appointmentNumber = `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
});

// Virtual for final confirmed date/time
appointmentSchema.virtual('confirmedDate').get(function() {
  return this.approvedDate || this.requestedDate;
});

appointmentSchema.virtual('confirmedTime').get(function() {
  return this.approvedTime || this.requestedTime;
});

// Virtual to check if appointment is in the past
appointmentSchema.virtual('isPast').get(function() {
  const appointmentDate = this.approvedDate || this.requestedDate;
  return appointmentDate < new Date();
});

// Virtual to check if appointment is today
appointmentSchema.virtual('isToday').get(function() {
  const appointmentDate = this.approvedDate || this.requestedDate;
  const today = new Date();
  return appointmentDate.toDateString() === today.toDateString();
});

// Instance methods
appointmentSchema.methods.approve = function(approvedDate, approvedTime, doctorNotes) {
  if (this.status !== 'pending' && this.status !== 'rescheduled') {
    throw new Error('Can only approve pending or rescheduled appointments');
  }
  this.status = 'approved';
  this.approvedDate = approvedDate || this.requestedDate;
  this.approvedTime = approvedTime || this.requestedTime;
  this.doctorNotes = doctorNotes;
  this.respondedAt = new Date();
  return this.save();
};

appointmentSchema.methods.reject = function(reason) {
  if (this.status !== 'pending') {
    throw new Error('Can only reject pending appointments');
  }
  this.status = 'rejected';
  this.doctorResponse = reason;
  this.respondedAt = new Date();
  return this.save();
};

appointmentSchema.methods.reschedule = function(proposedDate, proposedTime, message) {
  if (this.status !== 'pending' && this.status !== 'approved') {
    throw new Error('Can only reschedule pending or approved appointments');
  }
  this.status = 'rescheduled';
  this.proposedDate = proposedDate;
  this.proposedTime = proposedTime;
  this.doctorResponse = message;
  this.respondedAt = new Date();
  return this.save();
};

appointmentSchema.methods.acceptReschedule = function() {
  if (this.status !== 'rescheduled') {
    throw new Error('No reschedule to accept');
  }
  this.status = 'approved';
  this.approvedDate = this.proposedDate;
  this.approvedTime = this.proposedTime;
  this.patientAcceptedReschedule = true;
  return this.save();
};

appointmentSchema.methods.cancel = function(cancelledBy, reason) {
  if (['completed', 'cancelled', 'no_show', 'rejected'].includes(this.status)) {
    throw new Error('Cannot cancel this appointment');
  }
  this.status = 'cancelled';
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  return this.save();
};

appointmentSchema.methods.complete = function(notes) {
  if (this.status !== 'approved') {
    throw new Error('Can only complete approved appointments');
  }
  this.status = 'completed';
  this.doctorNotes = notes || this.doctorNotes;
  this.completedAt = new Date();
  return this.save();
};

appointmentSchema.methods.markNoShow = function() {
  if (this.status !== 'approved') {
    throw new Error('Can only mark approved appointments as no-show');
  }
  this.status = 'no_show';
  return this.save();
};

// Static methods
appointmentSchema.statics.getPatientAppointments = function(patientId, status = null) {
  const query = { patient: patientId };
  if (status) query.status = status;
  return this.find(query)
    .populate('doctor', 'firstName lastName specialization')
    .populate('hospital', 'name')
    .sort({ requestedDate: -1 });
};

appointmentSchema.statics.getDoctorAppointments = function(doctorId, status = null) {
  const query = { doctor: doctorId };
  if (status) query.status = status;
  return this.find(query)
    .populate('patient', 'firstName lastName phone email')
    .populate('hospital', 'name')
    .sort({ requestedDate: -1 });
};

appointmentSchema.statics.getPendingForDoctor = function(doctorId) {
  return this.find({ 
    doctor: doctorId, 
    status: 'pending' 
  })
    .populate('patient', 'firstName lastName phone email')
    .populate('hospital', 'name')
    .sort({ requestedDate: 1 });
};

appointmentSchema.statics.getTodayAppointments = function(doctorId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    doctor: doctorId,
    status: 'approved',
    $or: [
      { approvedDate: { $gte: today, $lt: tomorrow } },
      { requestedDate: { $gte: today, $lt: tomorrow }, approvedDate: null }
    ]
  })
    .populate('patient', 'firstName lastName phone')
    .populate('hospital', 'name')
    .sort({ approvedTime: 1 });
};

// Compound indexes for common queries
appointmentSchema.index({ doctor: 1, status: 1 });
appointmentSchema.index({ patient: 1, status: 1 });
appointmentSchema.index({ doctor: 1, requestedDate: 1 });
appointmentSchema.index({ hospital: 1, requestedDate: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
