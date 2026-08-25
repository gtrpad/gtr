// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

import {AttentionFeed} from "../src/AttentionFeed.sol";
import {PegVault} from "../src/PegVault.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";

/// Runs against a Robinhood Chain fork: real PoolManager, real USDG, real ETH/USDG pool.
contract ForkTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    IPoolManager constant PM = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    IERC20 constant USDG = IERC20(0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168);

    AttentionFeed feed;
    PegVault vault;
    Launchpad pad;
    Router router;
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address whale = makeAddr("whale");
    bytes32 constant WORD = keccak256("bitcoin");
    uint256 constant DL = type(uint256).max;

    function setUp() public {
        vm.createSelectFork(vm.envString("RH_RPC_URL"));
        feed = new AttentionFeed(address(this));
        vault = new PegVault(address(this), USDG, feed, treasury, 50);
        pad = new Launchpad(
            address(this),
            PM,
            vault,
            Launchpad.Config({openCapUsd: 5000e18, migCapUsd: 35000e18, holdersBps: 4000, buybackBps: 3000, treasury: treasury})
        );
        router = new Router(address(this), PM, vault, pad, 500, 10);
        pad.setRouter(address(router), true);
        vault.addWord(WORD, "Bitcoin", "BITCOIN");
        bytes32[] memory w = new bytes32[](1);
        uint128[] memory p = new uint128[](1);
        w[0] = WORD;
        p[0] = 2.445e18; // 2 445 views/day → $2.445
        feed.push(w, p);
        vm.deal(alice, 10 ether);
        vm.deal(whale, 10 ether);
    }

    function test_fork_ethRouteToMigration() public {
        // ETH → USDG → coin → curve, on the real ETH/USDG pool
        vm.prank(alice);
        (address token, uint256 out) = router.createWithEth{value: 0.05 ether}("Bitcoin Meme", "BTCM", "ipfs://x", WORD, 200, 0, DL);
        assertGt(out, 0);
        uint256 quote = router.quoteBuy(token, Router.Cur.ETH, 0.01 ether);
        vm.prank(alice);
        uint256 got = router.buyWithEth{value: 0.01 ether}(token, quote, alice, DL);
        assertEq(got, quote);

        // whale completes the curve with ETH (≈ $10.6k ≈ 4.3 ETH at ~$2.5k)
        vm.prank(whale);
        router.buyWithEth{value: 6 ether}(token, 0, whale, DL);
        Launchpad.Market memory m = pad.getMarket(token);
        assertTrue(m.migrated, "migrated");
        (uint160 sqrtP,,,) = PM.getSlot0(m.poolKey.toId());
        assertGt(sqrtP, 0);

        // trade on the real pool and exit to ETH
        uint256 qs = router.quoteSell(token, Router.Cur.ETH, got);
        uint256 before = alice.balance;
        vm.prank(alice);
        uint256 e = router.sellForEth(token, got, qs, alice, DL);
        assertEq(alice.balance - before, e);
        assertGt(e, 0.005 ether);

        // fees collected and swept in the word coin, then redeemed to USDG
        pad.collectPoolFees(token);
        (uint256 h, uint256 b, uint256 p) = pad.sweep(token);
        assertGt(h + b + p, 0);
        vm.prank(treasury);
        uint256 usdgOut = vault.sell(WORD, h, 0, treasury);
        assertGt(usdgOut, 0);
        console2.log("holders share USDG", usdgOut);
    }
}
