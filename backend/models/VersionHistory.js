const mongoose = require('mongoose');

const versionHistorySchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true,
      index: true
    },
    entityId: {
      type: String,
      required: true,
      index: true
    },
    version: {
      type: Number,
      required: true
    },
    actionType: {
      type: String,
      required: true,
      index: true
    },
    actorId: {
      type: String,
      default: 'system',
      index: true
    },
    beforeSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    afterSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    versionHash: {
      type: String,
      required: true,
      index: true
    },
    blockchainTxHash: {
      type: String,
      default: null,
      index: true
    },
    blockchainHash: {
      type: String,
      default: null,
      index: true
    },
    blockchainTimestamp: {
      type: Date,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

versionHistorySchema.index({ entityType: 1, entityId: 1, version: -1 });

module.exports = mongoose.model('VersionHistory', versionHistorySchema);