const mongoose = require('mongoose');

const gratitudeJournalSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  entries: {
    type: [String],
    required: true,
    validate: {
      validator: (arr) => arr.length >= 1 && arr.length <= 10,
      message: 'Journal must have between 1 and 10 entries'
    }
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for fast patient + date queries
gratitudeJournalSchema.index({ patient: 1, createdAt: -1 });

module.exports = mongoose.model('GratitudeJournal', gratitudeJournalSchema);
