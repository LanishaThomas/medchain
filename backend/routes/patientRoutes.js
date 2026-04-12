const express = require('express');
const router = express.Router();
const { protect, isPatient } = require('../middleware/authMiddleware');
const { MoodEntry, GratitudeJournal } = require('../models');

// All routes require authentication and patient role
router.use(protect);
router.use(isPatient);

// @route   POST /api/patient/mood
// @desc    Save a new mood entry
// @access  Private (Patient only)
router.post('/mood', async (req, res) => {
  try {
    const { mood, moodScore, note, tags, factors } = req.body;

    // Validation
    if (!mood || !moodScore) {
      return res.status(400).json({
        success: false,
        message: 'Mood and mood score are required'
      });
    }

    if (moodScore < 1 || moodScore > 5) {
      return res.status(400).json({
        success: false,
        message: 'Mood score must be between 1 and 5'
      });
    }

    // Create mood entry
    const moodEntry = await MoodEntry.create({
      patient: req.user.id,
      mood,
      moodScore,
      note: note || '',
      tags: tags || [],
      factors: factors || {}
    });

    res.status(201).json({
      success: true,
      message: 'Mood entry saved successfully',
      data: {
        id: moodEntry._id,
        mood: moodEntry.mood,
        moodScore: moodEntry.moodScore,
        note: moodEntry.note,
        createdAt: moodEntry.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving mood entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save mood entry',
      error: error.message
    });
  }
});

// @route   GET /api/patient/mood-history
// @desc    Get mood history for current patient
// @access  Private (Patient only)
router.get('/mood-history', async (req, res) => {
  try {
    const { days, limit } = req.query;
    
    let query = { patient: req.user.id };
    
    // Filter by days if provided
    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      query.createdAt = { $gte: startDate };
    }

    const moodEntries = await MoodEntry.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 50);

    res.status(200).json({
      success: true,
      data: moodEntries.map(entry => ({
        id: entry._id,
        mood: entry.mood,
        moodScore: entry.moodScore,
        note: entry.note,
        tags: entry.tags,
        createdAt: entry.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching mood history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mood history',
      error: error.message
    });
  }
});

// @route   GET /api/patient/mood-trends
// @desc    Get mood trends and statistics
// @access  Private (Patient only)
router.get('/mood-trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const trends = await MoodEntry.getMoodTrends(req.user.id, parseInt(days));
    
    // Calculate additional stats
    const moodDistribution = {};
    trends.entries.forEach(entry => {
      moodDistribution[entry.moodScore] = (moodDistribution[entry.moodScore] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        averageScore: trends.averageScore,
        totalEntries: trends.totalEntries,
        moodDistribution,
        recentEntries: trends.entries.slice(-7).map(e => ({
          id: e._id,
          mood: e.mood,
          moodScore: e.moodScore,
          createdAt: e.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching mood trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mood trends',
      error: error.message
    });
  }
});

// @route   DELETE /api/patient/mood/:id
// @desc    Delete a mood entry
// @access  Private (Patient only)
router.delete('/mood/:id', async (req, res) => {
  try {
    const moodEntry = await MoodEntry.findOneAndDelete({
      _id: req.params.id,
      patient: req.user.id
    });

    if (!moodEntry) {
      return res.status(404).json({
        success: false,
        message: 'Mood entry not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Mood entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting mood entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete mood entry',
      error: error.message
    });
  }
});

// ─── Gratitude Journal ──────────────────────────────────────────────────────

// @route   POST /api/patient/gratitude
// @desc    Save a gratitude journal entry
// @access  Private (Patient only)
router.post('/gratitude', async (req, res) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'entries must be a non-empty array'
      });
    }

    const validEntries = entries.map(e => String(e).trim()).filter(Boolean);
    if (validEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one thing you are grateful for'
      });
    }

    const journal = await GratitudeJournal.create({
      patient: req.user.id,
      entries: validEntries
    });

    res.status(201).json({
      success: true,
      message: 'Gratitude journal saved',
      data: {
        id: journal._id,
        entries: journal.entries,
        createdAt: journal.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving gratitude journal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save gratitude journal',
      error: error.message
    });
  }
});

// @route   GET /api/patient/gratitude
// @desc    Get all gratitude journal entries for the patient
// @access  Private (Patient only)
router.get('/gratitude', async (req, res) => {
  try {
    const journals = await GratitudeJournal.find({ patient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      data: journals.map(j => ({
        id: j._id,
        entries: j.entries,
        createdAt: j.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching gratitude journals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gratitude journals',
      error: error.message
    });
  }
});

module.exports = router;
