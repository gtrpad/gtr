// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {CloneERC20} from "./CloneERC20.sol";

interface ILaunchpadRouters {
    function isRouter(address) external view returns (bool);
}

/// @notice The meme token of a market. Whole supply is minted to the launchpad
/// at creation; metadata URI is written once and never changes. The launchpad
/// and its registered routers can move balances without approvals so selling
/// through the site is a single transaction.
contract LaunchToken is CloneERC20 {
    address public launchpad;
    string public tokenURI;

    function initialize(string calldata name_, string calldata symbol_, string calldata uri_, address launchpad_, uint256 supply)
        external
    {
        _initERC20(name_, symbol_);
        launchpad = launchpad_;
        tokenURI = uri_;
        _mint(launchpad_, supply);
    }

    function _trustedSpender(address spender) internal view override returns (bool) {
        return spender == launchpad || ILaunchpadRouters(launchpad).isRouter(spender);
    }
}
