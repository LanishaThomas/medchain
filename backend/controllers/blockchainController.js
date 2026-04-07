const BlockchainAuditLog = require('../models/BlockchainAuditLog');
const VersionHistory = require('../models/VersionHistory');
const MedicalRecord = require('../models/MedicalRecord');
const Prescription = require('../models/Prescription');
const Permission = require('../models/Permission');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const {
  buildDeterministicHash,
  getLatestHashFromChain,
  getLogsByEntityFromChain
} = require('../services/blockchainAuditService');

const ENTITY_MODEL_MAP = {
  profile: User,
  medicalrecord: MedicalRecord,
  prescription: Prescription,
  permission: Permission,
  appointment: Appointment,
  userprofile: User,
  user: User
};

function normalizeEntityType(entityType) {
  return String(entityType || '').replace(/[_\s-]/g, '').toLowerCase();
}

function normalizeHash(hash) {
  return String(hash || '').toLowerCase().trim();
}

function isNoChainLogError(error) {
  const chainMessage = String(error?.message || '').toLowerCase();
  return chainMessage.includes('no logs for entity') || chainMessage.includes('execution reverted');
}

async function getChainHashSetByEntityIds(entityIds) {
  const uniqueEntityIds = Array.from(
    new Set((entityIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  );

  const hashMap = new Map();

  await Promise.all(
    uniqueEntityIds.map(async (id) => {
      try {
        const chainLogs = await getLogsByEntityFromChain(id);
        const hashes = new Set(
          chainLogs.map((log) => normalizeHash(log?.dataHash)).filter(Boolean)
        );
        hashMap.set(id, hashes);
      } catch (error) {
        if (!isNoChainLogError(error)) {
          throw error;
        }
        hashMap.set(id, new Set());
      }
    })
  );

  return hashMap;
}

function serializeEntityForHash(entityType, doc) {
  const normalized = normalizeEntityType(entityType);

  if (normalized === 'userprofile' || normalized === 'user') {
    return {
      _id: doc._id,
      role: doc.role,
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      phone: doc.phone,
      dateOfBirth: doc.dateOfBirth,
      gender: doc.gender,
      hospitalId: doc.hospitalId,
      doctorProfile: doc.doctorProfile,
      patientProfile: {
        bloodType: doc.patientProfile?.bloodType,
        allergies: doc.patientProfile?.allergies,
        currentMedications: doc.patientProfile?.currentMedications,
        previousSurgeries: doc.patientProfile?.previousSurgeries,
        chronicConditions: doc.patientProfile?.chronicConditions,
        address: doc.patientProfile?.address,
        emergencyContacts: doc.patientProfile?.emergencyContacts,
        insuranceProvider: doc.patientProfile?.insuranceProvider,
        insurancePolicyNumber: doc.patientProfile?.insurancePolicyNumber,
        emergencySettings: doc.patientProfile?.emergencySettings
      }
    };
  }

  return doc;
}

exports.getLogs = async (req, res, next) => {
  try {
    const { entityType, actionType, actorId, entityId, page = 1, limit = 50 } = req.query;

    const query = {};
    if (entityType) query.entityType = entityType;
    if (actionType) query.actionType = actionType;
    if (actorId) query.actorId = actorId;
    if (entityId) query.entityId = entityId;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (parsedPage - 1) * parsedLimit;

    const [logs, total] = await Promise.all([
      BlockchainAuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parsedLimit),
      BlockchainAuditLog.countDocuments(query)
    ]);

    const chainHashMap = await getChainHashSetByEntityIds(logs.map((log) => log.entityId));

    const logsWithVerification = logs.map((log) => {
      const entityId = String(log.entityId || '');
      const localHash = normalizeHash(log.dataHash);
      const chainHashSet = chainHashMap.get(entityId) || new Set();
      const verificationStatus = chainHashSet.has(localHash) ? 'VERIFIED' : 'TAMPERED';

      return {
        ...log.toObject(),
        verificationStatus
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        logs: logsWithVerification,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          pages: Math.ceil(total / parsedLimit)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.verifyIntegrity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const normalizedType = normalizeEntityType(entityType);
    const Model = ENTITY_MODEL_MAP[normalizedType];

    if (!Model) {
      return res.status(400).json({
        success: false,
        message: `Unsupported entityType: ${entityType}`
      });
    }

    const entityDoc = await Model.findById(entityId).lean();
    if (!entityDoc) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found'
      });
    }

    const hashInput = serializeEntityForHash(entityType, entityDoc);
    const localHash = buildDeterministicHash(hashInput);
    const localHashNormalized = String(localHash).toLowerCase();

    let chainLatest = null;
    let chainHash = null;
    try {
      chainLatest = await getLatestHashFromChain(entityId);
      chainHash = chainLatest?.dataHash ? String(chainLatest.dataHash).toLowerCase() : null;
    } catch (chainError) {
      const noChainLog = isNoChainLogError(chainError);

      if (!noChainLog) {
        return next(chainError);
      }
    }

    const latestLocalTx = await BlockchainAuditLog.findOne({ entityId: String(entityId) })
      .sort({ timestamp: -1 })
      .lean();

    const anchoredHash = entityDoc?.blockchainHash ? String(entityDoc.blockchainHash).toLowerCase() : null;

    if (!chainHash) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'NOT_ANCHORED',
          verificationStatus: 'TAMPERED',
          isValid: false,
          reason: 'No blockchain log found for this entity',
          localHash,
          anchoredHash,
          chainHash: null,
          txHash: latestLocalTx?.blockchainTxHash || null,
          lastUpdated: latestLocalTx?.timestamp || null
        }
      });
    }

    const localMatchesChain = localHashNormalized === chainHash;

    if (!anchoredHash) {
      return res.status(200).json({
        success: true,
        data: {
          status: localMatchesChain ? 'VERIFIED_LEGACY' : 'UNLINKED',
          verificationStatus: localMatchesChain ? 'VERIFIED' : 'TAMPERED',
          isValid: localMatchesChain,
          reason: localMatchesChain
            ? 'Legacy entity verified directly against chain hash'
            : 'Entity is not linked to a persisted blockchain hash in database',
          localHash,
          anchoredHash: null,
          chainHash: chainLatest.dataHash,
          txHash: latestLocalTx?.blockchainTxHash || null,
          lastUpdated: latestLocalTx?.timestamp || null
        }
      });
    }

    const chainMatchesAnchor = anchoredHash === chainHash;

    let status = 'TAMPERED';
    let reason = 'Database hash does not match chain hash';
    let isValid = false;

    if (chainMatchesAnchor && localMatchesChain) {
      status = 'VALID';
      reason = 'Local data and anchored hash match chain';
      isValid = true;
    } else if (chainMatchesAnchor && !localMatchesChain) {
      status = 'TAMPERED';
      reason = 'Data changed in database after anchor was written';
    } else if (!chainMatchesAnchor && localMatchesChain) {
      status = 'NOT_SYNCED';
      reason = 'Local data matches chain, but stored blockchainHash field is stale';
    }

    return res.status(200).json({
      success: true,
      data: {
        status,
        verificationStatus: isValid ? 'VERIFIED' : 'TAMPERED',
        isValid,
        reason,
        localHash,
        anchoredHash,
        chainHash: chainLatest.dataHash,
        txHash: latestLocalTx?.blockchainTxHash || null,
        lastUpdated: latestLocalTx?.timestamp || null
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.verifyHistory = async (req, res, next) => {
  try {
    const { entityId } = req.params;
    const normalizedEntityId = String(entityId);

    const [chainLogs, dbLogs, versions] = await Promise.all([
      getLogsByEntityFromChain(normalizedEntityId),
      BlockchainAuditLog.find({ entityId: normalizedEntityId })
        .sort({ timestamp: -1 })
        .lean(),
      VersionHistory.find({ entityId: normalizedEntityId })
        .sort({ version: -1 })
        .lean()
    ]);

    const chainHashSet = new Set(chainLogs.map((log) => normalizeHash(log.dataHash)).filter(Boolean));

    const dbLogsWithVerification = dbLogs.map((log) => {
      const localHash = normalizeHash(log.dataHash);
      return {
        ...log,
        verificationStatus: chainHashSet.has(localHash) ? 'VERIFIED' : 'TAMPERED'
      };
    });

    const versionComparisons = versions.map((version) => {
      const versionHash = normalizeHash(version.versionHash);
      const anchoredOnChain = chainHashSet.has(versionHash);

      return {
        version: version.version,
        entityType: version.entityType,
        entityId: version.entityId,
        actionType: version.actionType,
        versionHash: version.versionHash,
        blockchainTxHash: version.blockchainTxHash || null,
        blockchainTimestamp: version.blockchainTimestamp || null,
        matchStatus: anchoredOnChain ? 'MATCH' : 'MISSING_ON_CHAIN',
        verificationStatus: anchoredOnChain ? 'VERIFIED' : 'TAMPERED'
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        entityId,
        chainLogs,
        dbLogs: dbLogsWithVerification,
        versions,
        versionComparisons
      }
    });
  } catch (error) {
    return next(error);
  }
};
