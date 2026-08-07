// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILienGuard} from "../interfaces/ILienGuard.sol";
import {MockSettlementToken} from "./MockSettlementToken.sol";

/// @title DemoFinanceA
/// @notice Independent financing protocol adapter (Protocol A).
/// @dev Flow: reserve → settle dUSDC to borrower → activate encumbrance.
contract DemoFinanceA {
    ILienGuard public immutable lien;
    MockSettlementToken public immutable settlement;
    address public owner;

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

    /// @notice Atomically reserves, transfers settlement, activates claim.
    function finance(
        bytes32 obligationId,
        address borrower,
        uint256 amount,
        uint64 reservationExpiry
    ) external returns (bytes32 reservationId, bytes32 financingRef) {
        reservationId = lien.reserve(obligationId, amount, reservationExpiry);

        bool ok = settlement.transfer(borrower, amount);
        if (!ok) revert FundingFailed();

        financingRef = keccak256(
            abi.encode(
                "DemoFinanceA",
                obligationId,
                reservationId,
                borrower,
                amount,
                block.number
            )
        );
        lien.activate(reservationId, financingRef);

        emit Financed(
            obligationId,
            reservationId,
            borrower,
            amount,
            financingRef
        );
    }

    function repay(
        bytes32 obligationId,
        address from,
        uint256 amount,
        bytes32 repaymentRef
    ) external {
        bool ok = settlement.transferFrom(from, address(this), amount);
        if (!ok) revert FundingFailed();
        lien.discharge(obligationId, repaymentRef);
    }

    function liquidity() external view returns (uint256) {
        return settlement.balanceOf(address(this));
    }
}
