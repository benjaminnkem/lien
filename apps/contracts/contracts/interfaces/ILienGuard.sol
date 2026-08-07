// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILienGuard {
    enum LienState {
        Unregistered,
        Verified,
        Reserved,
        Encumbered,
        Discharged,
        Cancelled,
        Defaulted,
        Disputed
    }

    struct LienStatus {
        LienState state;
        address claimController;
        uint256 securedAmount;
        uint64 reservedUntil;
        bytes32 activeReservationId;
        bytes32 financingRef;
        bytes32 repaymentRef;
    }

    /// @notice Protocol-bound one-time clearance (PRD LienClearance).
    struct Clearance {
        bytes32 obligationId;
        address protocol;
        uint256 chainId;
        uint256 financingAmount;
        bytes32 reservationId;
        uint64 issuedAt;
        uint64 expiresAt;
        uint256 nonce;
        bool active;
        bool consumed;
    }

    function reserve(
        bytes32 obligationId,
        uint256 financingAmount,
        uint64 expiry
    ) external returns (bytes32 reservationId);

    function activate(
        bytes32 reservationId,
        bytes32 financingRef
    ) external;

    function discharge(
        bytes32 obligationId,
        bytes32 repaymentRef
    ) external;

    function status(
        bytes32 obligationId
    ) external view returns (LienStatus memory);

    function getClearance(
        bytes32 reservationId
    ) external view returns (Clearance memory);
}
