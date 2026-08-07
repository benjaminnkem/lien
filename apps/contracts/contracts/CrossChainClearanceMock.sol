// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CrossChainClearanceMock
/// @notice Architecture demo for multi-chain clearance messaging (P2).
/// @dev NOT a bridge. Does not move assets across chains. Posts and consumes
///      hashed clearance commitments as if a remote domain acknowledged them.
contract CrossChainClearanceMock {
    struct RemoteClearance {
        bytes32 recordId;
        bytes32 obligationId;
        uint256 sourceChainId;
        uint256 targetChainId;
        bytes32 clearanceHash;
        address poster;
        uint64 postedAt;
        bool active;
        bool consumed;
    }

    mapping(bytes32 => RemoteClearance) private _records;
    mapping(bytes32 => uint256) private _nonce;

    event CrossChainClearancePosted(
        bytes32 indexed recordId,
        bytes32 indexed obligationId,
        uint256 sourceChainId,
        uint256 targetChainId,
        bytes32 clearanceHash,
        address poster
    );
    event CrossChainClearanceConsumed(
        bytes32 indexed recordId,
        bytes32 indexed obligationId,
        address consumer
    );

    error RecordUnknown();
    error AlreadyConsumed();
    error Inactive();
    error ZeroTarget();

    /// @notice Post a mock cross-domain clearance commitment.
    function postClearance(
        bytes32 obligationId,
        uint256 targetChainId,
        bytes32 clearanceHash
    ) external returns (bytes32 recordId) {
        if (targetChainId == 0) revert ZeroTarget();
        uint256 n = ++_nonce[obligationId];
        recordId = keccak256(
            abi.encode(
                obligationId,
                block.chainid,
                targetChainId,
                clearanceHash,
                msg.sender,
                n
            )
        );
        _records[recordId] = RemoteClearance({
            recordId: recordId,
            obligationId: obligationId,
            sourceChainId: block.chainid,
            targetChainId: targetChainId,
            clearanceHash: clearanceHash,
            poster: msg.sender,
            postedAt: uint64(block.timestamp),
            active: true,
            consumed: false
        });
        emit CrossChainClearancePosted(
            recordId,
            obligationId,
            block.chainid,
            targetChainId,
            clearanceHash,
            msg.sender
        );
    }

    /// @notice One-time mock consumption on the "remote" side of the architecture.
    function consumeClearance(bytes32 recordId) external {
        RemoteClearance storage r = _records[recordId];
        if (r.poster == address(0)) revert RecordUnknown();
        if (r.consumed) revert AlreadyConsumed();
        if (!r.active) revert Inactive();
        r.consumed = true;
        r.active = false;
        emit CrossChainClearanceConsumed(
            recordId,
            r.obligationId,
            msg.sender
        );
    }

    function getRecord(
        bytes32 recordId
    ) external view returns (RemoteClearance memory) {
        return _records[recordId];
    }
}
