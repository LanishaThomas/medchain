const {
  writeAuditLog,
  buildDeterministicHash
} = require('./blockchainAuditService');
const { createVersionHistoryEntry } = require('./versionHistoryService');

async function executeWithBlockchainConsistency(operationFn, rollbackFn, hashFn) {
  let operationResult = null;
  let operationCompleted = false;

  try {
    operationResult = await operationFn();
    operationCompleted = true;

    const hashData = await hashFn(operationResult);

    const auditDoc = await writeAuditLog({
      entityType: operationResult.entityType,
      entityId: operationResult.entityId,
      actorId: operationResult.actorId,
      actionType: operationResult.actionType,
      data: hashData,
      metadata: operationResult.metadata || {}
    });

    if (operationResult.versioning) {
      await createVersionHistoryEntry({
        entityType: operationResult.entityType,
        entityId: operationResult.entityId,
        actionType: operationResult.actionType,
        actorId: operationResult.actorId,
        beforeSnapshot: operationResult.versioning.beforeSnapshot || null,
        afterSnapshot: operationResult.versioning.afterSnapshot || null,
        metadata: operationResult.versioning.metadata || operationResult.metadata || {},
        auditDoc
      });
    }

    if (typeof operationResult.onSuccess === 'function') {
      await operationResult.onSuccess(auditDoc);
    }

    return {
      ...operationResult,
      auditDoc,
      blockchainTxHash: auditDoc.blockchainTxHash,
      blockchainHash: auditDoc.dataHash
    };
  } catch (error) {
    console.error('[CONSISTENCY] Blockchain consistency failure', {
      message: error.message,
      stack: error.stack,
      operationCompleted,
      dbState: operationResult?.dbState || 'unknown'
    });

    if (operationCompleted) {
      try {
        await rollbackFn(operationResult, error);
        console.error('[CONSISTENCY] Rollback status: success');
      } catch (rollbackError) {
        console.error('[CONSISTENCY] Rollback status: failed', {
          message: rollbackError.message,
          stack: rollbackError.stack
        });
        error.rollbackError = rollbackError;
      }
    }

    throw error;
  }
}

function buildSnapshot(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') {
    return doc.toObject({ depopulate: true, virtuals: false });
  }
  return JSON.parse(JSON.stringify(doc));
}

async function restoreSnapshot(Model, snapshot) {
  if (!snapshot?._id) {
    throw new Error('Snapshot with _id is required to restore');
  }
  await Model.replaceOne({ _id: snapshot._id }, snapshot, { upsert: true });
}

function hashFromResult(operationResult) {
  return operationResult.hashSource;
}

module.exports = {
  executeWithBlockchainConsistency,
  buildSnapshot,
  restoreSnapshot,
  hashFromResult,
  buildDeterministicHash
};
