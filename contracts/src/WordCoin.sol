// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {CloneERC20} from "./CloneERC20.sol";

/// @notice One ERC-20 per catalogue word. Only the PegVault mints and burns;
/// its price is held by the attention feed, not by trading.
contract WordCoin is CloneERC20 {
    error NotVault();

    address public vault;
    bytes32 public wordId;

    function initialize(string calldata name_, string calldata symbol_, bytes32 wordId_, address vault_) external {
        _initERC20(name_, symbol_);
        vault = vault_;
        wordId = wordId_;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }

    /// @dev The vault may pull coins for `sell` without an approval step.
    function _trustedSpender(address spender) internal view override returns (bool) {
        return spender == vault;
    }
}
