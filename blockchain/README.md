# MedChain Polygon Audit Contract

This package deploys the immutable MedChain audit contract used by the backend.

## Contract

- `contracts/MedChainAudit.sol`
- Stores deterministic data hashes and metadata for critical healthcare events.
- Append-only log retrieval is available via:
	- `getLogsByEntity(entityId)`
	- `getAllLogs()`

## Prerequisites

1. Fund a wallet on Polygon Amoy testnet.
2. Set environment variables in `blockchain/.env`:

```bash
RPC_URL=https://rpc-amoy.polygon.technology
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

## Deploy To Polygon Amoy

```bash
npm install
npx hardhat ignition deploy --network amoy ignition/modules/MedChainAudit.ts
```

After deployment, copy contract address and set in backend env:

```bash
BLOCKCHAIN_CONTRACT_ADDRESS=0xDeployedContractAddress
BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology
BLOCKCHAIN_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

## Verification

After backend is running, hit any critical endpoint (for example appointment request or permission approval), then inspect:

1. `backend` Mongo collection `blockchainauditlogs`
2. PolygonScan Amoy transaction hash from `blockchainTxHash`
