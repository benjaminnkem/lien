// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILienGuard} from "./interfaces/ILienGuard.sol";
import {ObligationRegistry} from "./ObligationRegistry.sol";

/// @title LienGuard
/// @notice Atomic reservation / encumbrance control plane for canonical obligations.
/// @dev Reservation doubles as the PRD LienClearance (protocol-bound, one-time, expiring).
contract LienGuard is ILienGuard {
    struct Reservation {
        bytes32 obligationId;
        address protocol;
        uint256 amount;
        uint64 issuedAt;
        uint64 expiry;
        uint256 nonce;
        bool active;
        bool consumed;
    }

    struct Claim {
        LienState state;
        address claimController;
        uint256 securedAmount;
        uint64 reservedUntil;
        bytes32 activeReservationId;
        bytes32 financingRef;
        bytes32 repaymentRef;
        uint64 activatedAt;
        uint64 dischargedAt;
    }

    ObligationRegistry public immutable registry;

    mapping(bytes32 => Claim) private _claims;
    mapping(bytes32 => Reservation) private _reservations;
    mapping(bytes32 => uint256) private _reservationNonce;

    event ReservationCreated(
        bytes32 indexed obligationId,
        bytes32 indexed reservationId,
        address indexed protocol,
        uint256 amount,
        uint64 expiry
    );
    event ClearanceIssued(
        bytes32 indexed obligationId,
        bytes32 indexed reservationId,
        address indexed protocol,
        uint256 amount,
        uint64 expiresAt,
        uint256 nonce
    );
    event ReservationExpired(
        bytes32 indexed obligationId,
        bytes32 indexed reservationId
    );
    event ClaimActivated(
        bytes32 indexed obligationId,
        bytes32 indexed reservationId,
        bytes32 financingRef,
        address indexed protocol,
        uint256 amount
    );
    event ClaimDischarged(
        bytes32 indexed obligationId,
        bytes32 repaymentRef,
        address indexed protocol
    );
    event FinancingConflict(
        bytes32 indexed obligationId,
        address indexed attemptedProtocol,
        uint8 reasonCode
    );

    error ObligationNotFinanceable(bytes32 obligationId);
    error ReservationConflict(bytes32 obligationId);
    error ReservationUnknown(bytes32 reservationId);
    error ReservationExpiredError(bytes32 reservationId);
    error ReservationConsumed(bytes32 reservationId);
    error UnauthorizedProtocol(bytes32 reservationId, address caller);
    error InvalidState(bytes32 obligationId, LienState current);
    error ZeroAmount();
    error InvalidExpiry();
    error AlreadyEncumbered(bytes32 obligationId);
    error UnauthorizedDischarge(bytes32 obligationId, address caller);

    uint8 public constant REASON_RESERVATION_CONFLICT = 1;
    uint8 public constant REASON_ASSET_ALREADY_ENCUMBERED = 2;
    uint8 public constant REASON_OBLIGATION_NOT_VERIFIED = 3;
    uint8 public constant REASON_RESERVATION_EXPIRED = 4;
    uint8 public constant REASON_CLEARANCE_REPLAY = 5;
    uint8 public constant REASON_IDENTITY_NOT_ELIGIBLE = 6;
    uint8 public constant REASON_COMPLIANCE_BLOCKED = 7;

    constructor(address registry_) {
        registry = ObligationRegistry(registry_);
    }

    function reserve(
        bytes32 obligationId,
        uint256 financingAmount,
        uint64 expiry
    ) external returns (bytes32 reservationId) {
        if (financingAmount == 0) revert ZeroAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (!registry.isFinanceable(obligationId)) {
            emit FinancingConflict(
                obligationId,
                msg.sender,
                REASON_OBLIGATION_NOT_VERIFIED
            );
            revert ObligationNotFinanceable(obligationId);
        }

        Claim storage claim = _claims[obligationId];
        _cleanupExpired(obligationId, claim);

        if (claim.state == LienState.Encumbered) {
            emit FinancingConflict(
                obligationId,
                msg.sender,
                REASON_ASSET_ALREADY_ENCUMBERED
            );
            revert AlreadyEncumbered(obligationId);
        }

        if (
            claim.state == LienState.Reserved &&
            claim.activeReservationId != bytes32(0)
        ) {
            Reservation storage existing = _reservations[
                claim.activeReservationId
            ];
            if (existing.active && existing.expiry > block.timestamp) {
                emit FinancingConflict(
                    obligationId,
                    msg.sender,
                    REASON_RESERVATION_CONFLICT
                );
                revert ReservationConflict(obligationId);
            }
        }

        if (
            claim.state != LienState.Unregistered &&
            claim.state != LienState.Verified &&
            claim.state != LienState.Discharged &&
            claim.state != LienState.Reserved
        ) {
            revert InvalidState(obligationId, claim.state);
        }

        uint256 n = ++_reservationNonce[obligationId];
        reservationId = keccak256(
            abi.encode(
                obligationId,
                msg.sender,
                financingAmount,
                expiry,
                n,
                block.chainid
            )
        );

        _reservations[reservationId] = Reservation({
            obligationId: obligationId,
            protocol: msg.sender,
            amount: financingAmount,
            issuedAt: uint64(block.timestamp),
            expiry: expiry,
            nonce: n,
            active: true,
            consumed: false
        });

        claim.state = LienState.Reserved;
        claim.claimController = msg.sender;
        claim.securedAmount = financingAmount;
        claim.reservedUntil = expiry;
        claim.activeReservationId = reservationId;
        claim.financingRef = bytes32(0);
        claim.repaymentRef = bytes32(0);
        claim.activatedAt = 0;
        claim.dischargedAt = 0;

        emit ReservationCreated(
            obligationId,
            reservationId,
            msg.sender,
            financingAmount,
            expiry
        );
        emit ClearanceIssued(
            obligationId,
            reservationId,
            msg.sender,
            financingAmount,
            expiry,
            n
        );
    }

    function activate(
        bytes32 reservationId,
        bytes32 financingRef
    ) external {
        Reservation storage r = _reservations[reservationId];
        if (r.protocol == address(0)) revert ReservationUnknown(reservationId);
        if (r.protocol != msg.sender) {
            revert UnauthorizedProtocol(reservationId, msg.sender);
        }
        if (r.consumed) {
            emit FinancingConflict(
                r.obligationId,
                msg.sender,
                REASON_CLEARANCE_REPLAY
            );
            revert ReservationConsumed(reservationId);
        }
        if (!r.active) revert ReservationUnknown(reservationId);
        if (r.expiry <= block.timestamp) {
            emit FinancingConflict(
                r.obligationId,
                msg.sender,
                REASON_RESERVATION_EXPIRED
            );
            revert ReservationExpiredError(reservationId);
        }

        Claim storage claim = _claims[r.obligationId];
        if (claim.state != LienState.Reserved) {
            revert InvalidState(r.obligationId, claim.state);
        }
        if (claim.activeReservationId != reservationId) {
            revert ReservationConflict(r.obligationId);
        }

        r.active = false;
        r.consumed = true;

        claim.state = LienState.Encumbered;
        claim.claimController = msg.sender;
        claim.securedAmount = r.amount;
        claim.reservedUntil = 0;
        claim.activeReservationId = bytes32(0);
        claim.financingRef = financingRef;
        claim.activatedAt = uint64(block.timestamp);

        emit ClaimActivated(
            r.obligationId,
            reservationId,
            financingRef,
            msg.sender,
            r.amount
        );
    }

    function discharge(
        bytes32 obligationId,
        bytes32 repaymentRef
    ) external {
        Claim storage claim = _claims[obligationId];
        if (claim.state != LienState.Encumbered) {
            revert InvalidState(obligationId, claim.state);
        }
        if (claim.claimController != msg.sender) {
            revert UnauthorizedDischarge(obligationId, msg.sender);
        }

        claim.state = LienState.Discharged;
        claim.repaymentRef = repaymentRef;
        claim.dischargedAt = uint64(block.timestamp);
        claim.securedAmount = 0;
        claim.activeReservationId = bytes32(0);
        claim.reservedUntil = 0;

        emit ClaimDischarged(obligationId, repaymentRef, msg.sender);
    }

    function expireReservation(bytes32 obligationId) external {
        Claim storage claim = _claims[obligationId];
        if (claim.state != LienState.Reserved) {
            revert InvalidState(obligationId, claim.state);
        }
        bytes32 rid = claim.activeReservationId;
        Reservation storage r = _reservations[rid];
        if (r.expiry > block.timestamp) revert InvalidExpiry();

        r.active = false;
        claim.state = LienState.Verified;
        claim.claimController = address(0);
        claim.securedAmount = 0;
        claim.reservedUntil = 0;
        claim.activeReservationId = bytes32(0);

        emit ReservationExpired(obligationId, rid);
    }

    function status(
        bytes32 obligationId
    ) external view returns (LienStatus memory) {
        Claim storage claim = _claims[obligationId];
        LienState state = claim.state;

        if (
            state == LienState.Reserved &&
            claim.reservedUntil != 0 &&
            claim.reservedUntil <= block.timestamp
        ) {
            state = LienState.Verified;
        }

        if (state == LienState.Unregistered) {
            try registry.isFinanceable(obligationId) returns (bool ok) {
                if (ok) state = LienState.Verified;
            } catch {}
        }

        return
            LienStatus({
                state: state,
                claimController: claim.claimController,
                securedAmount: claim.securedAmount,
                reservedUntil: claim.reservedUntil,
                activeReservationId: claim.activeReservationId,
                financingRef: claim.financingRef,
                repaymentRef: claim.repaymentRef
            });
    }

    function getReservation(
        bytes32 reservationId
    ) external view returns (Reservation memory) {
        return _reservations[reservationId];
    }

    function getClearance(
        bytes32 reservationId
    ) external view returns (Clearance memory) {
        Reservation storage r = _reservations[reservationId];
        if (r.protocol == address(0)) revert ReservationUnknown(reservationId);
        return
            Clearance({
                obligationId: r.obligationId,
                protocol: r.protocol,
                chainId: block.chainid,
                financingAmount: r.amount,
                reservationId: reservationId,
                issuedAt: r.issuedAt,
                expiresAt: r.expiry,
                nonce: r.nonce,
                active: r.active,
                consumed: r.consumed
            });
    }

    function _cleanupExpired(
        bytes32 obligationId,
        Claim storage claim
    ) internal {
        if (claim.state != LienState.Reserved) return;
        if (claim.reservedUntil == 0 || claim.reservedUntil > block.timestamp) {
            return;
        }
        bytes32 rid = claim.activeReservationId;
        if (rid != bytes32(0)) {
            _reservations[rid].active = false;
            emit ReservationExpired(obligationId, rid);
        }
        claim.state = LienState.Verified;
        claim.claimController = address(0);
        claim.securedAmount = 0;
        claim.reservedUntil = 0;
        claim.activeReservationId = bytes32(0);
    }
}
