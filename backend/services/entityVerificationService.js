const BlockchainAuditLog = require('../models/BlockchainAuditLog');
const { getLogsByEntityFromChain } = require('./blockchainAuditService');

function normalizeHash(hash) {
  return String(hash || '').toLowerCase().trim();
}

function isNoChainLogError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('no logs for entity') || message.includes('execution reverted');
}

async function getChainHashSet(entityId) {
  try {
    const logs = await getLogsByEntityFromChain(String(entityId));
    return new Set(logs.map((log) => normalizeHash(log?.dataHash)).filter(Boolean));
  } catch (error) {
    if (isNoChainLogError(error)) {
      return new Set();
    }
    throw error;
  }
}

async function getVerificationStatusForEntity({ entityType, entityId, dbHash }) {
  const normalizedId = String(entityId || '').trim();
  if (!normalizedId) return 'TAMPERED';

  let hashToCheck = normalizeHash(dbHash);

  if (!hashToCheck) {
    const query = { entityId: normalizedId };
    if (entityType) query.entityType = String(entityType);

    const latestAudit = await BlockchainAuditLog.findOne(query)
      .sort({ timestamp: -1 })
      .select('dataHash')
      .lean();

    hashToCheck = normalizeHash(latestAudit?.dataHash);
  }

  if (!hashToCheck) {
    return 'TAMPERED';
  }

  const chainHashSet = await getChainHashSet(normalizedId);
  return chainHashSet.has(hashToCheck) ? 'VERIFIED' : 'TAMPERED';
}

async function attachVerificationStatus(items, { entityType, getId, getHash }) {
  const list = Array.isArray(items) ? items : [items];

  const resolved = await Promise.all(
    list.map(async (item) => {
      const entityId = getId(item);
      const dbHash = getHash(item);
      const verificationStatus = await getVerificationStatusForEntity({
        entityType,
        entityId,
        dbHash
      });

      return {
        ...item,
        verificationStatus
      };
    })
  );

  return Array.isArray(items) ? resolved : resolved[0];
}

module.exports = {
  getVerificationStatusForEntity,
  attachVerificationStatus
};
