// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EncumbranceRegistry
/// @notice On-chain first-priority lien registry keyed by Lien asset fingerprints.
/// @dev Fingerprints are keccak256 hashes of canonical invoice fields (see @repo/sdk).
contract EncumbranceRegistry {
    struct Lien {
        address lender;
        uint64 registeredAt;
        bool active;
    }

    /// @notice fingerprint => active first-priority lien
    mapping(bytes32 => Lien) private _liens;

    event LienRegistered(
        bytes32 indexed fingerprint,
        address indexed lender,
        address indexed registrar,
        uint64 registeredAt
    );

    event LienReleased(
        bytes32 indexed fingerprint,
        address indexed lender,
        address indexed releasedBy,
        uint64 releasedAt
    );

    error ZeroFingerprint();
    error ZeroAddress();
    error AlreadyEncumbered(bytes32 fingerprint, address existingLender);
    error NotEncumbered(bytes32 fingerprint);
    error NotAuthorized(bytes32 fingerprint, address caller);

    /// @notice Register a first-priority lien on an asset fingerprint.
    /// @param fingerprint Asset fingerprint (bytes32 / 0x-prefixed keccak256)
    /// @param lender Address of the financing party holding the lien
    function registerLien(bytes32 fingerprint, address lender) external {
        if (fingerprint == bytes32(0)) revert ZeroFingerprint();
        if (lender == address(0)) revert ZeroAddress();

        Lien storage existing = _liens[fingerprint];
        if (existing.active) {
            revert AlreadyEncumbered(fingerprint, existing.lender);
        }

        uint64 registeredAt = uint64(block.timestamp);
        _liens[fingerprint] = Lien({
            lender: lender,
            registeredAt: registeredAt,
            active: true
        });

        emit LienRegistered(fingerprint, lender, msg.sender, registeredAt);
    }

    /// @notice Release an active lien. Callable by the recorded lender only.
    function releaseLien(bytes32 fingerprint) external {
        Lien storage lien = _liens[fingerprint];
        if (!lien.active) revert NotEncumbered(fingerprint);
        if (msg.sender != lien.lender) {
            revert NotAuthorized(fingerprint, msg.sender);
        }

        address lender = lien.lender;
        delete _liens[fingerprint];

        emit LienReleased(
            fingerprint,
            lender,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /// @notice Whether the fingerprint currently has an active first-priority lien.
    function isEncumbered(bytes32 fingerprint) external view returns (bool) {
        return _liens[fingerprint].active;
    }

    /// @notice Full lien record for a fingerprint (zeroed if none / released).
    function getLien(
        bytes32 fingerprint
    )
        external
        view
        returns (address lender, uint64 registeredAt, bool active)
    {
        Lien storage lien = _liens[fingerprint];
        return (lien.lender, lien.registeredAt, lien.active);
    }

    /// @notice Convenience: lender of the active lien, or address(0) if clean.
    function getLender(bytes32 fingerprint) external view returns (address) {
        Lien storage lien = _liens[fingerprint];
        if (!lien.active) return address(0);
        return lien.lender;
    }
}
