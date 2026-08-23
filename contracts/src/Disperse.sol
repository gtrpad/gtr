// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Holder payouts in one transaction: the keeper approves the coin and
/// sends a list of recipients and amounts. Emits one event per market round so
/// the payout is verifiable on chain.
contract Disperse {
    using SafeERC20 for IERC20;

    event Dispersed(address indexed token, address indexed market, uint256 recipients, uint256 total);

    error LengthMismatch();

    function disperse(IERC20 token, address market, address[] calldata to, uint256[] calldata amounts) external {
        if (to.length != amounts.length) revert LengthMismatch();
        uint256 total;
        for (uint256 i; i < to.length; ++i) {
            token.safeTransferFrom(msg.sender, to[i], amounts[i]);
            total += amounts[i];
        }
        emit Dispersed(address(token), market, to.length, total);
    }
}
