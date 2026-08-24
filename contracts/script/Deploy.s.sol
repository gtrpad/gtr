// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

import {AttentionFeed} from "../src/AttentionFeed.sol";
import {PegVault} from "../src/PegVault.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";
import {Buyback} from "../src/Buyback.sol";
import {Disperse} from "../src/Disperse.sol";

/// forge script script/Deploy.s.sol --rpc-url rh --broadcast
/// env: DEPLOYER_PK, OWNER (admin, defaults to deployer), KEEPER, TREASURY (defaults to keeper)
contract Deploy is Script {
    IPoolManager constant PM = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    IERC20 constant USDG = IERC20(0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168);

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        address owner = vm.envOr("OWNER", deployer);
        address keeper = vm.envAddress("KEEPER");
        address treasury = vm.envOr("TREASURY", keeper);

        vm.startBroadcast(pk);
        AttentionFeed feed = new AttentionFeed(deployer);
        feed.setUpdater(keeper, true);
        PegVault vault = new PegVault(deployer, USDG, feed, treasury, 50);
        Launchpad pad = new Launchpad(
            deployer,
            PM,
            vault,
            Launchpad.Config({openCapUsd: 5000e18, migCapUsd: 35000e18, holdersBps: 4000, buybackBps: 3000, treasury: treasury})
        );
        Router router = new Router(deployer, PM, vault, pad, 500, 10);
        pad.setRouter(address(router), true);
        Buyback buyback = new Buyback(deployer, PM);
        buyback.setKeeper(keeper, true);
        Disperse disperse = new Disperse();
        if (owner != deployer) {
            feed.transferOwnership(owner);
            vault.transferOwnership(owner);
            pad.transferOwnership(owner);
            router.transferOwnership(owner);
            buyback.transferOwnership(owner);
        }
        vm.stopBroadcast();

        console2.log("FEED", address(feed));
        console2.log("VAULT", address(vault));
        console2.log("LAUNCHPAD", address(pad));
        console2.log("ROUTER", address(router));
        console2.log("BUYBACK", address(buyback));
        console2.log("DISPERSE", address(disperse));
        console2.log("WORDCOIN_IMPL", vault.wordCoinImpl());
        console2.log("LAUNCHTOKEN_IMPL", pad.tokenImpl());
    }
}
