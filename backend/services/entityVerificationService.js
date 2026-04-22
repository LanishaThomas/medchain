const BlockchainAuditLog = require('../models/BlockchainAuditLog');
const { getLogsByEntityFromChain, buildDeterministicHash } = require('./blockchainAuditService');

function normalizeHash(hash) {
  return String(hash || '').toLowerCase().trim();
}

function isNoChainLogError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('no logs for entity') ||
    message.includes('execution reverted') ||
    message.includes('could not detect network') ||
    message.includes('timeout') ||
    message.includes('network error')
  );
}

async function getChainHashSet(entityId) {
  try {
    const logs = await getLogsByEntityFromChain(String(entityId));
    return { hashes: new Set(logs.map((log) => normalizeHash(log?.dataHash)).filter(Boolean)), reachable: true };
  } catch (error) {
    if (isNoChainLogError(error)) {
      return { hashes: new Set(), reachable: true }; // chain reachable but no entry
    }
    // Chain unreachable — don't penalise as TAMPERED
    console.warn('[VerificationService] Chain unreachable for', entityId, ':', error.message);
    return { hashes: new Set(), reachable: false };
  }
}

async function getVerificationStatusForEntity({ entityType, entityId, dbHash, currentData }) {
  const normalizedId = String(entityId || '').trim();
  if (!normalizedId) return 'UNVERIFIED';

  const { hashes: chainHashSet, reachable } = await getChainHashSet(normalizedId);

  // Chain unreachable — fall back to DB audit log comparison only
  if (!reachable) {
    // Compare stored blockchainHash against latest DB audit log hash
    const query = { entityId: normalizedId };
    if (entityType) query.entityType = String(entityType);
    const latestAudit = await BlockchainAuditLog.findOne(query)
      .sort({ timestamp: -1 })
      .select('dataHash')
      .lean();

    if (!latestAudit) return 'UNVERIFIED';

    const storedHash = normalizeHash(dbHash || latestAudit.dataHash);
    const auditHash  = normalizeHash(latestAudit.dataHash);

    // If stored hash matches latest audit log, treat as verified (best-effort)
    return storedHash === auditHash ? 'VERIFIED' : 'TAMPERED';
  }

  // Chain has no entry for this entity yet
  if (chainHashSet.size === 0) return 'UNVERIFIED';

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

  if (!hashToCheck) return 'UNVERIFIED';
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
