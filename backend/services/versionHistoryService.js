const VersionHistory = require('../models/VersionHistory');

async function getNextVersion(entityType, entityId) {
  const latest = await VersionHistory.findOne({
    entityType: String(entityType),
    entityId: String(entityId)
  })
    .sort({ version: -1 })
    .select('version')
    .lean();

  return latest ? latest.version + 1 : 1;
}

async function createVersionHistoryEntry({
  entityType,
  entityId,
  actionType,
  actorId,
  beforeSnapshot = null,
  afterSnapshot = null,
  metadata = {},
  auditDoc
}) {
  if (!entityType || !entityId || !actionType) {
    throw new Error('entityType, entityId, and actionType are required for version history');
  }

  const version = await getNextVersion(entityType, entityId);

  return VersionHistory.create({
    entityType: String(entityType),
    entityId: String(entityId),
    version,
    actionType: String(actionType),
    actorId: actorId ? String(actorId) : 'system',
    beforeSnapshot,
    afterSnapshot,
    versionHash: auditDoc?.dataHash || null,
    blockchainTxHash: auditDoc?.blockchainTxHash || null,
    blockchainHash: auditDoc?.dataHash || null,
    blockchainTimestamp: auditDoc?.timestamp || null,
    metadata
  });
}

module.exports = {
  createVersionHistoryEntry
};