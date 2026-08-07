// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILienGuard} from "./interfaces/ILienGuard.sol";
import {ObligationRegistry} from "./ObligationRegistry.sol";

/// @title PriorityClaimBook
/// @notice Protocol-level disclosed / subordinate claims (P2).
/// @dev Exclusive senior claims stay on LienGuard (reserve/activate).
///      Ranks >= 1 are junior/disclosed claims only — NOT legal perfection.
contract PriorityClaimBook {
    ILienGuard public immutable guard;
    ObligationRegistry public immutable registry;

    struct DisclosedClaim {
        bytes32 claimId;
        bytes32 obligationId;
        address protocol;
        uint8 priorityRank;
        uint256 amount;
        bytes32 claimRef;
        string label;
        bool active;
        uint64 registeredAt;
        uint64 releasedAt;
    }

    mapping(bytes32 => DisclosedClaim[]) private _claimsByObligation;
    mapping(bytes32 => uint256) private _claimIndexPlusOne;
    mapping(bytes32 => bytes32) private _claimToObligation;
    mapping(bytes32 => uint256) private _nonce;

    event SubordinateClaimRegistered(
        bytes32 indexed obligationId,
        bytes32 indexed claimId,
        address indexed protocol,
        uint8 priorityRank,
        uint256 amount,
        bytes32 claimRef,
        string label
    );
    event SubordinateClaimReleased(
        bytes32 indexed obligationId,
        bytes32 indexed claimId,
        address indexed protocol
    );

    error ZeroAmount();
    error InvalidRank();
    error ObligationUnknown();
    error ClaimUnknown();
    error NotClaimProtocol();
    error ClaimInactive();
    error RankAlreadyTaken(uint8 rank);

    constructor(address guard_, address registry_) {
        guard = ILienGuard(guard_);
        registry = ObligationRegistry(registry_);
    }

    /// @notice Register a disclosed subordinate claim (priorityRank must be >= 1).
    function registerSubordinate(
        bytes32 obligationId,
        uint8 priorityRank,
        uint256 amount,
        bytes32 claimRef,
        string calldata label
    ) external returns (bytes32 claimId) {
        if (amount == 0) revert ZeroAmount();
        if (priorityRank == 0) revert InvalidRank();

        ObligationRegistry.Obligation memory o = registry.getObligation(
            obligationId
        );
        if (o.registeredAt == 0 || !o.confirmed || o.cancelled) {
            revert ObligationUnknown();
        }

        DisclosedClaim[] storage list = _claimsByObligation[obligationId];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].active && list[i].priorityRank == priorityRank) {
                revert RankAlreadyTaken(priorityRank);
            }
        }

        uint256 n = ++_nonce[obligationId];
        claimId = keccak256(
            abi.encode(
                obligationId,
                msg.sender,
                priorityRank,
                amount,
                claimRef,
                n,
                block.chainid
            )
        );

        list.push(
            DisclosedClaim({
                claimId: claimId,
                obligationId: obligationId,
                protocol: msg.sender,
                priorityRank: priorityRank,
                amount: amount,
                claimRef: claimRef,
                label: label,
                active: true,
                registeredAt: uint64(block.timestamp),
                releasedAt: 0
            })
        );
        _claimIndexPlusOne[claimId] = list.length;
        _claimToObligation[claimId] = obligationId;

        emit SubordinateClaimRegistered(
            obligationId,
            claimId,
            msg.sender,
            priorityRank,
            amount,
            claimRef,
            label
        );
    }

    function releaseSubordinate(bytes32 claimId) external {
        bytes32 obligationId = _claimToObligation[claimId];
        if (obligationId == bytes32(0)) revert ClaimUnknown();
        uint256 idx = _claimIndexPlusOne[claimId] - 1;
        DisclosedClaim storage c = _claimsByObligation[obligationId][idx];
        if (!c.active) revert ClaimInactive();
        if (c.protocol != msg.sender) revert NotClaimProtocol();

        c.active = false;
        c.releasedAt = uint64(block.timestamp);
        emit SubordinateClaimReleased(obligationId, claimId, msg.sender);
    }

    function getClaims(
        bytes32 obligationId
    ) external view returns (DisclosedClaim[] memory) {
        return _claimsByObligation[obligationId];
    }

    function getClaim(
        bytes32 claimId
    ) external view returns (DisclosedClaim memory) {
        bytes32 obligationId = _claimToObligation[claimId];
        if (obligationId == bytes32(0)) revert ClaimUnknown();
        uint256 idx = _claimIndexPlusOne[claimId] - 1;
        return _claimsByObligation[obligationId][idx];
    }

    function activeSubordinateCount(
        bytes32 obligationId
    ) external view returns (uint256 count) {
        DisclosedClaim[] storage list = _claimsByObligation[obligationId];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].active) count++;
        }
    }

    /// @notice Senior exclusive status from LienGuard + junior stack from this book.
    function prioritySnapshot(
        bytes32 obligationId
    )
        external
        view
        returns (
            ILienGuard.LienStatus memory senior,
            DisclosedClaim[] memory juniors
        )
    {
        senior = guard.status(obligationId);
        juniors = _claimsByObligation[obligationId];
    }
}
