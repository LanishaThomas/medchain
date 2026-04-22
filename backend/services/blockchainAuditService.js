const { ethers } = require('ethers');
const BlockchainAuditLog = require('../models/BlockchainAuditLog');

const ABI = [
  'function storeHash(bytes32 dataHash, string entityType, string entityId, string actionType) external',
  'function storeHashWithActor(bytes32 dataHash, string entityType, string entityId, string actionType, string actorId) external',
  'function getLatestHash(string entityId) external view returns ((bytes32 dataHash,string entityType,string entityId,string actorId,uint256 timestamp,string actionType))',
  'function getLogsByEntity(string entityId) external view returns ((bytes32 dataHash,string entityType,string entityId,string actorId,uint256 timestamp,string actionType)[])',
  'function getAllLogs() external view returns ((bytes32 dataHash,string entityType,string entityId,string actorId,uint256 timestamp,string actionType)[])'
];

let cachedClient = null;

function createInsufficientFundsError({ walletAddress, balanceWei, estimatedCostWei }) {
  const error = new Error('Insufficient blockchain wallet funds to write audit log. Fund signer wallet with test MATIC and retry.');
  error.code = 'INSUFFICIENT_FUNDS';
  error.shortMessage = 'Insufficient blockchain wallet funds';
  error.details = {
    walletAddress,
    balanceWei: balanceWei.toString(),
    estimatedCostWei: estimatedCostWei.toString(),
    balanceMatic: ethers.formatEther(balanceWei),
    estimatedCostMatic: ethers.formatEther(estimatedCostWei)
  };
  return error;
}

function toPlainObject(value) {
  if (!value || typeof value !== 'object') return value;

  if (typeof value.toObject === 'function') {
    return value.toObject({
      depopulate: true,
      virtuals: false,
      getters: false,
      flattenMaps: true,
      versionKey: false
    });
  }

  return value;
}

function stableNormalize(value, seen = new WeakSet()) {
  const normalizedInput = toPlainObject(value);

  if (normalizedInput === null || normalizedInput === undefined) {
    return normalizedInput;
  }

  if (normalizedInput instanceof Date) {
    return normalizedInput.toISOString();
  }

  if (Array.isArray(normalizedInput)) {
    return normalizedInput
      .map((item) => stableNormalize(item, seen))
      .filter((item) => item !== undefined && item !== null);
  }

  if (typeof normalizedInput === 'bigint') {
    return normalizedInput.toString();
  }

  if (Buffer.isBuffer(normalizedInput)) {
    return normalizedInput.toString('hex');
  }

  if (normalizedInput && typeof normalizedInput === 'object') {
    if (seen.has(normalizedInput)) {
      return '[Circular]';
    }

    seen.add(normalizedInput);

    return Object.keys(normalizedInput)
      .sort()
      .reduce((acc, key) => {
        const v = normalizedInput[key];
        if (v !== undefined && v !== null) {
          acc[key] = stableNormalize(v, seen);
        }
        return acc;
      }, {});
  }

  return normalizedInput;
}

function deterministicStringify(data) {
  return JSON.stringify(stableNormalize(data));
}

function buildDeterministicHash(data) {
  const serialized = deterministicStringify(data);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(serialized));
  // Debug log to help identify tampering false positives
  console.log(`[BLOCKCHAIN_DEBUG] Hashing Data: ${serialized.substring(0, 200)}... Hash: ${hash}`);
  return hash;
}

function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.POLYGON_AMOY_RPC_URL || process.env.RPC_URL;
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

  if (!rpcUrl) {
    throw new Error('Missing BLOCKCHAIN_RPC_URL (or POLYGON_AMOY_RPC_URL/RPC_URL)');
  }

  if (!privateKey) {
    throw new Error('Missing BLOCKCHAIN_PRIVATE_KEY (or PRIVATE_KEY)');
  }

  if (!contractAddress) {
    throw new Error('Missing BLOCKCHAIN_CONTRACT_ADDRESS');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, ABI, wallet);

  cachedClient = { provider, wallet, contract, contractAddress };
  return cachedClient;
}

async function writeAuditLog({ entityType, entityId, actorId, actionType, data, metadata = {} }) {
  const { provider, wallet, contract, contractAddress } = getClient();

  if (!entityType || !entityId || !actionType) {
    throw new Error('entityType, entityId, and actionType are required');
  }

  const actor = actorId ? String(actorId) : 'system';
  const normalizedEntityId = String(entityId);

  const previousLog = await BlockchainAuditLog.findOne({ entityId: normalizedEntityId })
    .sort({ timestamp: -1 })
    .select('dataHash blockchainTxHash timestamp')
    .lean();

  const dataHash = buildDeterministicHash(data);

  // Preflight cost check to fail fast with a clean error instead of raw tx blob errors.
  const estimatedGas = await contract.storeHashWithActor.estimateGas(
    dataHash,
    String(entityType),
    normalizedEntityId,
    String(actionType),
    actor
  );

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;

  if (!gasPrice) {
    throw new Error('Unable to determine network gas price for blockchain audit write');
  }

  const estimatedCost = estimatedGas * gasPrice;
  const balance = await provider.getBalance(wallet.address);

  if (balance < estimatedCost) {
    throw createInsufficientFundsError({
      walletAddress: wallet.address,
      balanceWei: balance,
      estimatedCostWei: estimatedCost
    });
  }

  let tx;
  try {
    tx = await contract.storeHashWithActor(
      dataHash,
      String(entityType),
      normalizedEntityId,
      String(actionType),
      actor
    );
  } catch (error) {
    if (error?.code === 'INSUFFICIENT_FUNDS') {
      throw createInsufficientFundsError({
        walletAddress: wallet.address,
        balanceWei: balance,
        estimatedCostWei: estimatedCost
      });
    }
    throw error;
  }

  const receipt = await tx.wait();
  const resolvedTxHash = receipt?.transactionHash || receipt?.hash || tx.hash;

  console.log('Block Number:', Number(receipt.blockNumber));
  console.log('Transaction Hash:', resolvedTxHash);

  const network = await provider.getNetwork();
  const eventTimestamp = new Date();

  const doc = await BlockchainAuditLog.create({
    dataHash,
    previousDataHash: previousLog?.dataHash || null,
    previousTxHash: previousLog?.blockchainTxHash || null,
    entityType: String(entityType),
    entityId: normalizedEntityId,
    actorId: actor,
    actionType: String(actionType),
    metadata,
    timestamp: eventTimestamp,
    blockchainTxHash: resolvedTxHash,
    blockNumber: Number(receipt.blockNumber),
    chainId: Number(network.chainId),
    contractAddress
  });

  return doc;
}

async function getLatestHashFromChain(entityId) {
  const { contract } = getClient();
  const latest = await contract.getLatestHash(String(entityId));
  return {
    dataHash: latest.dataHash,
    entityType: latest.entityType,
    entityId: latest.entityId,
    actorId: latest.actorId,
    timestamp: Number(latest.timestamp),
    actionType: latest.actionType
  };
}

async function getLogsByEntityFromChain(entityId) {
  const { contract } = getClient();
  const logs = await contract.getLogsByEntity(String(entityId));
  return logs.map((entry) => ({
    dataHash: entry.dataHash,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actorId: entry.actorId,
    timestamp: Number(entry.timestamp),
    actionType: entry.actionType
  }));
}

module.exports = {
  writeAuditLog,
  deterministicStringify,
  buildDeterministicHash,
  getLatestHashFromChain,
  getLogsByEntityFromChain
};
