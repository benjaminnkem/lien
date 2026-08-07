// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title ObligationRegistry
/// @notice Canonical economic obligations for verified RWA claims.
/// @dev Obligation identity is EIP-712 typed terms, NOT a raw PDF hash.
contract ObligationRegistry is EIP712 {
    using ECDSA for bytes32;

    /// @dev Identity hash excludes evidenceRoot so modified PDFs can share one Obligation ID.
    bytes32 public constant OBLIGATION_TERMS_TYPEHASH =
        keccak256(
            "ObligationTerms(address supplier,address obligor,string currency,uint256 faceValue,uint64 dueDate,string invoiceReference,string purchaseOrderReference,string jurisdiction,uint256 version,bytes32 nonce)"
        );

    struct ObligationTerms {
        address supplier;
        address obligor;
        string currency;
        uint256 faceValue;
        uint64 dueDate;
        string invoiceReference;
        string purchaseOrderReference;
        bytes32 evidenceRoot;
        string jurisdiction;
        uint256 version;
        bytes32 nonce;
    }

    struct Obligation {
        bytes32 obligationId;
        address supplier;
        address obligor;
        string currency;
        uint256 faceValue;
        uint64 dueDate;
        string invoiceReference;
        string purchaseOrderReference;
        bytes32 evidenceRoot;
        string jurisdiction;
        uint256 version;
        bytes32 nonce;
        bool confirmed;
        bool cancelled;
        uint64 registeredAt;
        uint64 confirmedAt;
    }

    mapping(bytes32 => Obligation) private _obligations;
    mapping(bytes32 => bool) private _usedNonces;

    event ObligationRegistered(
        bytes32 indexed obligationId,
        address indexed supplier,
        address indexed obligor,
        bytes32 evidenceRoot,
        string invoiceReference,
        uint256 faceValue
    );

    event ObligationConfirmed(
        bytes32 indexed obligationId,
        address indexed obligor,
        uint64 confirmedAt
    );

    event ObligationCancelled(bytes32 indexed obligationId, address indexed by);

    error ZeroAddress();
    error ZeroValue();
    error EmptyField();
    error ObligationExists(bytes32 obligationId);
    error ObligationUnknown(bytes32 obligationId);
    error AlreadyConfirmed(bytes32 obligationId);
    error AlreadyCancelled(bytes32 obligationId);
    error InvalidObligorSignature();
    error NonceAlreadyUsed(bytes32 nonce);
    error Unauthorized();

    constructor() EIP712("LIEN ObligationRegistry", "1") {}

    function hashTerms(
        ObligationTerms calldata terms
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    OBLIGATION_TERMS_TYPEHASH,
                    terms.supplier,
                    terms.obligor,
                    keccak256(bytes(terms.currency)),
                    terms.faceValue,
                    terms.dueDate,
                    keccak256(bytes(terms.invoiceReference)),
                    keccak256(bytes(terms.purchaseOrderReference)),
                    keccak256(bytes(terms.jurisdiction)),
                    terms.version,
                    terms.nonce
                )
            );
    }

    function obligationId(
        ObligationTerms calldata terms
    ) public view returns (bytes32) {
        return _hashTypedDataV4(hashTerms(terms));
    }

    function register(
        ObligationTerms calldata terms
    ) external returns (bytes32 id) {
        return _register(terms, msg.sender);
    }

    /// @notice Relayer path: supplier proves ownership of terms via EIP-712 signature.
    function registerWithSupplierSig(
        ObligationTerms calldata terms,
        bytes calldata supplierSignature
    ) external returns (bytes32 id) {
        address recovered = ECDSA.recover(
            _hashTypedDataV4(hashTerms(terms)),
            supplierSignature
        );
        if (recovered != terms.supplier) revert Unauthorized();
        return _register(terms, terms.supplier);
    }

    function _register(
        ObligationTerms calldata terms,
        address expectedSupplier
    ) internal returns (bytes32 id) {
        if (terms.supplier == address(0) || terms.obligor == address(0)) {
            revert ZeroAddress();
        }
        if (terms.supplier != expectedSupplier) revert Unauthorized();
        if (terms.faceValue == 0) revert ZeroValue();
        if (bytes(terms.currency).length == 0) revert EmptyField();
        if (bytes(terms.invoiceReference).length == 0) revert EmptyField();
        if (terms.nonce == bytes32(0)) revert EmptyField();
        if (_usedNonces[terms.nonce]) revert NonceAlreadyUsed(terms.nonce);

        id = obligationId(terms);
        if (_obligations[id].registeredAt != 0) revert ObligationExists(id);

        _usedNonces[terms.nonce] = true;
        _obligations[id] = Obligation({
            obligationId: id,
            supplier: terms.supplier,
            obligor: terms.obligor,
            currency: terms.currency,
            faceValue: terms.faceValue,
            dueDate: terms.dueDate,
            invoiceReference: terms.invoiceReference,
            purchaseOrderReference: terms.purchaseOrderReference,
            evidenceRoot: terms.evidenceRoot,
            jurisdiction: terms.jurisdiction,
            version: terms.version,
            nonce: terms.nonce,
            confirmed: false,
            cancelled: false,
            registeredAt: uint64(block.timestamp),
            confirmedAt: 0
        });

        emit ObligationRegistered(
            id,
            terms.supplier,
            terms.obligor,
            terms.evidenceRoot,
            terms.invoiceReference,
            terms.faceValue
        );
    }

    /// @notice Obligor confirms the economic terms via EIP-712 signature.
    function confirm(
        ObligationTerms calldata terms,
        bytes calldata obligorSignature
    ) external returns (bytes32 id) {
        id = obligationId(terms);
        Obligation storage o = _obligations[id];
        if (o.registeredAt == 0) revert ObligationUnknown(id);
        if (o.cancelled) revert AlreadyCancelled(id);
        if (o.confirmed) revert AlreadyConfirmed(id);

        address recovered = ECDSA.recover(
            _hashTypedDataV4(hashTerms(terms)),
            obligorSignature
        );
        if (recovered != o.obligor) revert InvalidObligorSignature();
        if (msg.sender != o.obligor && msg.sender != o.supplier) {
            // allow supplier to submit the signed confirmation from obligor
            if (recovered != o.obligor) revert Unauthorized();
        }

        o.confirmed = true;
        o.confirmedAt = uint64(block.timestamp);
        emit ObligationConfirmed(id, o.obligor, o.confirmedAt);
    }

    function cancel(bytes32 id) external {
        Obligation storage o = _obligations[id];
        if (o.registeredAt == 0) revert ObligationUnknown(id);
        if (o.cancelled) revert AlreadyCancelled(id);
        if (msg.sender != o.supplier && msg.sender != o.obligor) {
            revert Unauthorized();
        }
        o.cancelled = true;
        emit ObligationCancelled(id, msg.sender);
    }

    function getObligation(
        bytes32 id
    ) external view returns (Obligation memory) {
        if (_obligations[id].registeredAt == 0) revert ObligationUnknown(id);
        return _obligations[id];
    }

    function isFinanceable(bytes32 id) external view returns (bool) {
        Obligation storage o = _obligations[id];
        return o.registeredAt != 0 && o.confirmed && !o.cancelled;
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
