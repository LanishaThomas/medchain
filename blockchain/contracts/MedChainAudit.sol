// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MedChainAudit {
    struct AuditLog {
        bytes32 dataHash;
        string entityType;
        string entityId;
        string actorId;
        uint256 timestamp;
        string actionType;
    }

    AuditLog[] private logs;
    mapping(string => uint256[]) private entityToIndexes;

    event HashStored(
        uint256 indexed logIndex,
        bytes32 indexed dataHash,
        string entityType,
        string entityId,
        string actorId,
        uint256 timestamp,
        string actionType
    );

    function storeHash(
        bytes32 dataHash,
        string calldata entityType,
        string calldata entityId,
        string calldata actionType
    ) external {
        _storeHash(dataHash, entityType, entityId, actionType, "");
    }

    function storeHashWithActor(
        bytes32 dataHash,
        string calldata entityType,
        string calldata entityId,
        string calldata actionType,
        string calldata actorId
    ) external {
        _storeHash(dataHash, entityType, entityId, actionType, actorId);
    }

    function _storeHash(
        bytes32 dataHash,
        string calldata entityType,
        string calldata entityId,
        string calldata actionType,
        string memory actorId
    ) internal {
        require(dataHash != bytes32(0), "dataHash required");
        require(bytes(entityType).length > 0, "entityType required");
        require(bytes(entityId).length > 0, "entityId required");
        require(bytes(actionType).length > 0, "actionType required");

        uint256 index = logs.length;
        logs.push(
            AuditLog({
                dataHash: dataHash,
                entityType: entityType,
                entityId: entityId,
                actorId: actorId,
                timestamp: block.timestamp,
                actionType: actionType
            })
        );

        entityToIndexes[entityId].push(index);

        emit HashStored(
            index,
            dataHash,
            entityType,
            entityId,
            actorId,
            block.timestamp,
            actionType
        );
    }

    function getLogsByEntity(string calldata entityId) external view returns (AuditLog[] memory) {
        uint256[] memory indexes = entityToIndexes[entityId];
        AuditLog[] memory result = new AuditLog[](indexes.length);

        for (uint256 i = 0; i < indexes.length; i++) {
            result[i] = logs[indexes[i]];
        }

        return result;
    }

    function getLatestHash(string calldata entityId) external view returns (AuditLog memory) {
        uint256[] memory indexes = entityToIndexes[entityId];
        require(indexes.length > 0, "No logs for entity");
        return logs[indexes[indexes.length - 1]];
    }

    function getAllLogs() external view returns (AuditLog[] memory) {
        return logs;
    }

    function totalLogs() external view returns (uint256) {
        return logs.length;
    }
}
