const BlockchainAuditLog = require('../models/BlockchainAuditLog');
const { getLogsByEntityFromChain, buildDeterministicHash } = require('./blockchainAuditService');

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
    if (isNoChainLogError(error)) return new Set();
    throw error;
  }
}

/**
 * Verify entity integrity.
 *
 * Strategy:
 *  1. If `currentData` is provided, recompute its hash and check if it exists on chain.
 *     This detects direct MongoDB tampering — the recomputed hash won't match any chain entry.
 *  2. Otherwise fall back to checking the stored `dbHash` against chain (legacy behaviour).
 */
async function getVerificationStatusForEntity({ entityType, entityId, dbHash, currentData }) {
  const normalizedId = String(entityId || '').trim();
  if (!normalizedId) return 'TAMPERED';

  const chainHashSet = await getChainHashSet(normalizedId);
  if (chainHashSet.size === 0) return 'TAMPERED';

  // Primary: recompute hash from current live data and check against chain
  if (currentData) {
    const liveHash = normalizeHash(buildDeterministicHash(currentData));
    return chainHashSet.has(liveHash) ? 'VERIFIED' : 'TAMPERED';
  }

  // Fallback: use stored blockchainHash
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

  if (!hashToCheck) return 'TAMPERED';
  return chainHashSet.has(hashToCheck) ? 'VERIFIED' : 'TAMPERED';
}

async function attachVerificationStatus(items, { entityType, getId, getHash, getCurrentData }) {
  const list = Array.isArray(items) ? items : [items];

  const resolved = await Promise.all(
    list.map(async (item) => {
      const entityId = getId(item);
      const dbHash = getHash(item);
      const currentData = getCurrentData ? getCurrentData(item) : null;
      const verificationStatus = await getVerificationStatusForEntity({
        entityType,
        entityId,
        dbHash,
        currentData
      });
      return { ...item, verificationStatus };
    })
  );

  return Array.isArray(items) ? resolved : resolved[0];
}

module.exports = { getVerificationStatusForEntity, attachVerificationStatus };
