const mongoose = require('mongoose');

const moodEntrySchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  mood: {
    type: String,
    required: [true, 'Mood emoji is required'],
    trim: true
  },
  moodScore: {
    type: Number,
    required: [true, 'Mood score is required'],
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'Mood score must be an integer between 1 and 5'
    }
  },
  note: {
    type: String,
    trim: true,
    maxlength: [1000, 'Note cannot exceed 1000 characters']
  },
  tags: [{
    type: String,
    trim: true
  }],
  factors: {
    sleep: {
      type: Number,
      min: 1,
      max: 5
    },
    exercise: {
      type: Boolean
    },
    socialInteraction: {
      type: Boolean
    },
    stress: {
      type: Number,
      min: 1,
      max: 5
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
moodEntrySchema.index({ patient: 1, createdAt: -1 });

// Virtual for formatted date
moodEntrySchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
});

// Ensure virtuals are included when converting to JSON
moodEntrySchema.set('toJSON', { virtuals: true });
moodEntrySchema.set('toObject', { virtuals: true });

// Static method to get mood trends
moodEntrySchema.statics.getMoodTrends = async function(patientId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const entries = await this.find({
    patient: patientId,
    createdAt: { $gte: startDate }
  }).sort({ createdAt: 1 });
  
  const averageScore = entries.length > 0
    ? entries.reduce((sum, e) => sum + e.moodScore, 0) / entries.length
    : null;
  
  return {
    entries,
    averageScore: averageScore ? Math.round(averageScore * 10) / 10 : null,
    totalEntries: entries.length
  };
};

const MoodEntry = mongoose.model('MoodEntry', moodEntrySchema);

module.exports = MoodEntry;
