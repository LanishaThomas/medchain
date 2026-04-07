const mongoose = require('mongoose');

const blockchainAuditLogSchema = new mongoose.Schema({
  dataHash: {
    type: String,
    required: true,
    index: true
  },
  previousDataHash: {
    type: String,
    default: null
  },
  previousTxHash: {
    type: String,
    default: null
  },
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
  actorId: {
    type: String,
    default: 'system',
    index: true
  },
  actionType: {
    type: String,
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  blockchainTxHash: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  chainId: {
    type: Number,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

blockchainAuditLogSchema.index({ entityType: 1, actionType: 1, timestamp: -1 });
blockchainAuditLogSchema.index({ entityId: 1, timestamp: -1 });

module.exports = mongoose.model('BlockchainAuditLog', blockchainAuditLogSchema);
