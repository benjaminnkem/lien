// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILienGuard} from "../interfaces/ILienGuard.sol";
import {MockSettlementToken} from "./MockSettlementToken.sol";

/// @title DemoFinanceB
/// @notice Independent financing protocol adapter (Protocol B).
/// @dev Separate contract from DemoFinanceA — used to prove shared-state conflict.
contract DemoFinanceB {
    ILienGuard public immutable lien;
    MockSettlementToken public immutable settlement;
    address public owner;

    uint256 public lastAttemptedAmount;
    bool public lastAttemptSucceeded;

    event FinanceAttempted(
        bytes32 indexed obligationId,
        address indexed borrower,
        uint256 amount,
        bool success
    );

    event Financed(
        bytes32 indexed obligationId,
        bytes32 indexed reservationId,
        address indexed borrower,
        uint256 amount,
        bytes32 financingRef
    );

    error NotOwner();
    error FundingFailed();

    constructor(address lien_, address settlement_) {
        lien = ILienGuard(lien_);
        settlement = MockSettlementToken(settlement_);
        owner = msg.sender;
    }

    function fundLiquidity(uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        settlement.mint(address(this), amount);
    }

    /// @notice Attempts the same reserve→fund→activate path as Protocol A.
    /// @dev On conflict, reverts before any settlement transfer.
    function finance(
        bytes32 obligationId,
        address borrower,
        uint256 amount,
        uint64 reservationExpiry
    ) external returns (bytes32 reservationId, bytes32 financingRef) {
        lastAttemptedAmount = amount;
        lastAttemptSucceeded = false;

        // Security boundary: reservation must succeed BEFORE any fund movement.
        reservationId = lien.reserve(obligationId, amount, reservationExpiry);

        bool ok = settlement.transfer(borrower, amount);
        if (!ok) revert FundingFailed();

        financingRef = keccak256(
            abi.encode(
                "DemoFinanceB",
                obligationId,
                reservationId,
                borrower,
                amount,
                block.number
            )
        );
        lien.activate(reservationId, financingRef);
        lastAttemptSucceeded = true;

        emit Financed(
            obligationId,
            reservationId,
            borrower,
            amount,
            financingRef
        );
        emit FinanceAttempted(obligationId, borrower, amount, true);
    }

    function liquidity() external view returns (uint256) {
        return settlement.balanceOf(address(this));
    }
}
