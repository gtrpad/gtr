// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {FullMath} from "v4-core/libraries/FullMath.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {LiquidityAmounts} from "v4-periphery/libraries/LiquidityAmounts.sol";

import {AttentionFeed} from "../src/AttentionFeed.sol";
import {PegVault} from "../src/PegVault.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";
import {Buyback} from "../src/Buyback.sol";
import {WordCoin} from "../src/WordCoin.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {MockUSDG, MockTrend} from "./MockUSDG.sol";

contract LaunchpadTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    PoolManager pm;
    MockUSDG usdg;
    AttentionFeed feed;
    PegVault vault;
    Launchpad pad;
    Router router;
    Buyback buyback;
    PoolModifyLiquidityTest lp;

    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address whale = makeAddr("whale");

    bytes32 constant WORD = keccak256("recession");
    uint256 constant PRICE = 0.3e18; // $0.30 per coin
    uint256 constant DL = type(uint256).max;

    address coin;

    receive() external payable {}

    function setUp() public {
        pm = new PoolManager(address(this));
        usdg = new MockUSDG();
        feed = new AttentionFeed(address(this));
        feed.setUpdater(keeper, true);
        vault = new PegVault(address(this), IERC20(address(usdg)), feed, treasury, 50);
        pad = new Launchpad(
            address(this),
            pm,
            vault,
            Launchpad.Config({openCapUsd: 5000e18, migCapUsd: 35000e18, holdersBps: 4000, buybackBps: 3000, treasury: treasury})
        );
        router = new Router(address(this), pm, vault, pad, 500, 10);
        pad.setRouter(address(router), true);
        buyback = new Buyback(address(this), pm);
        lp = new PoolModifyLiquidityTest(pm);

        coin = vault.addWord(WORD, "Recession", "RECESSION");
        bytes32[] memory w = new bytes32[](1);
        uint128[] memory p = new uint128[](1);
        w[0] = WORD;
        p[0] = uint128(PRICE);
        vm.prank(keeper);
        feed.push(w, p);

        _seedEthUsdgPool(2500e6);

        usdg.mint(alice, 100_000e6);
        usdg.mint(bob, 100_000e6);
        usdg.mint(whale, 1_000_000e6);
        vm.deal(bob, 100 ether);
        vm.deal(whale, 100 ether);
        vm.prank(alice);
        usdg.approve(address(router), type(uint256).max);
        vm.prank(bob);
        usdg.approve(address(router), type(uint256).max);
        vm.prank(whale);
        usdg.approve(address(router), type(uint256).max);
    }

    /// ETH/USDG pool at `usdgPerEth` (6 dec) with 100 ETH + matching USDG, full range.
    function _seedEthUsdgPool(uint256 usdgPerEth) internal {
        PoolKey memory key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(usdg)), 500, 10, IHooks(address(0)));
        // price1per0 = usdgPerEth / 1e18 (raw units)
        uint160 sqrtP = uint160(Math.sqrt(FullMath.mulDiv(usdgPerEth, 1 << 192, 1e18)));
        pm.initialize(key, sqrtP);
        uint256 ethAmt = 100 ether;
        uint256 usdgAmt = usdgPerEth * 100;
        usdg.mint(address(this), usdgAmt);
        usdg.approve(address(lp), type(uint256).max);
        int24 minT = TickMath.minUsableTick(10);
        int24 maxT = TickMath.maxUsableTick(10);
        uint128 liq = LiquidityAmounts.getLiquidityForAmounts(
            sqrtP, TickMath.getSqrtPriceAtTick(minT), TickMath.getSqrtPriceAtTick(maxT), ethAmt, usdgAmt
        );
        vm.deal(address(this), ethAmt + 1 ether);
        lp.modifyLiquidity{value: ethAmt}(key, ModifyLiquidityParams(minT, maxT, int256(uint256(liq)), 0), "");
    }

    function _create(address who, uint256 usdgIn) internal returns (address token) {
        vm.prank(who);
        (token,) = router.createWithUsdg("Recession Meme", "RCSN", "ipfs://meta", WORD, 200, usdgIn, 0, DL);
    }

    // ───────────── word coin peg ─────────────

    function test_pegBuySellBounded() public {
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        uint256 out = vault.buy(WORD, 300e6, 0, alice); // $300 → ~995 coins after 0.5% fee
        assertApproxEqRel(out, 995 ether, 1e15);
        assertEq(usdg.balanceOf(treasury), 1.5e6);
        (, uint256 reserve,) = vault.words(WORD);
        assertEq(reserve, 298.5e6);
        // feed doubles: only half of the coins can exit at the new price
        vm.stopPrank();
        _push(0.6e18);
        uint256 maxSell = vault.maxSellable(WORD);
        assertApproxEqRel(maxSell, 497.5 ether, 1e15);
        vm.startPrank(alice);
        vm.expectRevert();
        vault.sell(WORD, out, 0, alice);
        uint256 got = vault.sell(WORD, maxSell, 0, alice);
        assertApproxEqAbs(got, 298.5e6 * 995 / 1000, 2);
        vm.stopPrank();
    }

    function test_staleFeedBlocksTrading() public {
        address token = _create(alice, 100e6);
        vm.warp(block.timestamp + 37 hours);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AttentionFeed.StalePrice.selector, WORD));
        router.buyWithUsdg(token, 1e6, 0, alice, DL);
    }

    // ───────────── curve ─────────────

    function test_createAndCurveMath() public {
        address token = _create(alice, 1000e6);
        Launchpad.Market memory m = pad.getMarket(token);
        assertEq(m.coin, coin);
        assertEq(m.creator, alice);
        assertEq(m.feeBps, 200);
        // opening cap $5000 at $0.30/coin = 16 666.67 coin; price0 = cap/1e9 tokens
        uint256 cap0Coin = 5000e18 * 1e18 / PRICE;
        uint256 p0 = cap0Coin * 1e18 / pad.SUPPLY();
        // vQ0/vB0 == p0
        uint256 vQ0 = m.k / (m.vBase + (pad.CURVE_SUPPLY() - m.curveSupply)); // reconstruct: k/vB0
        uint256 vB0 = m.vBase + (pad.CURVE_SUPPLY() - m.curveSupply);
        assertApproxEqRel(vQ0 * 1e18 / vB0, p0, 1e12);
        // final price is 7x the opening price when the curve sells out
        uint256 pFinal = (m.k / (vB0 - pad.CURVE_SUPPLY())) * 1e18 / (vB0 - pad.CURVE_SUPPLY());
        assertApproxEqRel(pFinal, p0 * 7, 1e14);
        // alice got tokens for her first buy, fees booked 40/30/30
        assertGt(IERC20(token).balanceOf(alice), 0);
        assertGt(m.totalFees, 0);
        assertEq(m.feeHolders, m.totalFees * 4000 / 10_000);
        assertEq(m.feeBuyback, m.totalFees * 3000 / 10_000);
        assertEq(m.feeProtocol, m.totalFees - m.feeHolders - m.feeBuyback);
        assertEq(IERC20(coin).balanceOf(address(pad)), m.raised + m.totalFees);
    }

    function test_quoteMatchesBuyAndSell() public {
        address token = _create(alice, 100e6);
        uint256 q = router.quoteBuy(token, Router.Cur.USDG, 500e6);
        vm.prank(bob);
        uint256 got = router.buyWithUsdg(token, 500e6, 0, bob, DL);
        assertEq(got, q);

        uint256 qEth = router.quoteBuy(token, Router.Cur.ETH, 0.1 ether);
        vm.prank(bob);
        uint256 gotEth = router.buyWithEth{value: 0.1 ether}(token, 0, bob, DL);
        assertEq(gotEth, qEth);

        uint256 half = IERC20(token).balanceOf(bob) / 2;
        uint256 qs = router.quoteSell(token, Router.Cur.USDG, half);
        uint256 before = usdg.balanceOf(bob);
        vm.prank(bob);
        uint256 gotUsdg = router.sellForUsdg(token, half, 0, bob, DL);
        assertEq(gotUsdg, qs);
        assertEq(usdg.balanceOf(bob) - before, gotUsdg);

        uint256 rest = IERC20(token).balanceOf(bob);
        uint256 qe = router.quoteSell(token, Router.Cur.ETH, rest);
        uint256 ethBefore = bob.balance;
        vm.prank(bob);
        uint256 gotE = router.sellForEth(token, rest, 0, bob, DL);
        assertEq(gotE, qe);
        assertEq(bob.balance - ethBefore, gotE);
        assertEq(IERC20(token).balanceOf(bob), 0);
    }

    function test_slippageGuard() public {
        address token = _create(alice, 100e6);
        uint256 q = router.quoteBuy(token, Router.Cur.USDG, 500e6);
        vm.prank(bob);
        vm.expectRevert(Router.Slippage.selector);
        router.buyWithUsdg(token, 500e6, q + 1, bob, DL);
    }

    function test_feedMoveDoesNotMoveCurve() public {
        address token = _create(alice, 100e6);
        uint256 pBefore = pad.curvePrice(token);
        _push(0.9e18);
        assertEq(pad.curvePrice(token), pBefore);
        // but a new market at the new price fixes a 3x smaller cap in coin
        address token2 = _create(alice, 0);
        Launchpad.Market memory m2 = pad.getMarket(token2);
        Launchpad.Market memory m1 = pad.getMarket(token);
        uint256 vB1 = m1.vBase + (pad.CURVE_SUPPLY() - m1.curveSupply);
        assertApproxEqRel((m1.k / vB1) * 1e18 / vB1, (m2.k / m2.vBase) * 1e18 / m2.vBase * 3, 1e12);
    }

    // ───────────── migration ─────────────

    function test_migrationAndPoolTrading() public {
        address token = _create(alice, 1000e6);
        // whale sends more than needed; excess coin comes back as word coin
        vm.prank(whale);
        uint256 got = router.buyWithUsdg(token, 20_000e6, 0, whale, DL);
        Launchpad.Market memory m = pad.getMarket(token);
        assertTrue(m.migrated);
        assertEq(m.curveSupply, 0);
        assertGt(got, 0);
        uint256 refund = IERC20(coin).balanceOf(whale);
        assertGt(refund, 0, "refund of excess coin");
        // raised = vQ0·(√7−1) = cap0 · 0.8·√7 ≈ 2.1166 × cap0 in coin (≈ $10.58k)
        uint256 cap0Coin = 5000e18 * 1e18 / PRICE;
        assertApproxEqRel(m.raised, cap0Coin * 21166 / 10000, 1e14);
        assertTrue(m.hasCoinPosition);

        // pool initialised at the curve's final price
        PoolId id = m.poolKey.toId();
        (uint160 sqrtP,,,) = IPoolManager(address(pm)).getSlot0(id);
        assertGt(sqrtP, 0);
        uint128 liq = IPoolManager(address(pm)).getLiquidity(id);
        assertGt(liq, 0);
        // launchpad keeps ~nothing of the reserve supply beyond dust
        assertLt(IERC20(token).balanceOf(address(pad)), 1e15);

        // buys and sells now go through the pool
        uint256 q = router.quoteBuy(token, Router.Cur.USDG, 200e6);
        vm.prank(bob);
        uint256 out = router.buyWithUsdg(token, 200e6, 0, bob, DL);
        assertEq(out, q);
        // price continuity: $200 of coin at ~7x price0 buys roughly 200/0.3/p1 tokens
        uint256 p1 = m.k / m.vBase * 1e18 / m.vBase; // coin per token
        uint256 coinIn = 200e18 * 995 / 1000 * 1e18 / PRICE;
        uint256 expected = coinIn * 1e18 / p1;
        assertApproxEqRel(out, expected, 5e16); // within 5% (fee + slippage)

        uint256 qs = router.quoteSell(token, Router.Cur.ETH, out);
        vm.prank(bob);
        uint256 e = router.sellForEth(token, out, 0, bob, DL);
        assertEq(e, qs);
        assertGt(e, 0);

        // big sell absorbed by the coin-only position, no revert
        uint256 whaleTokens = IERC20(token).balanceOf(whale);
        vm.prank(whale);
        uint256 coinOut = router.sellForCoin(token, whaleTokens / 2, 0, whale, DL);
        assertGt(coinOut, 0);
    }

    function test_collectPoolFeesAndSweep() public {
        address token = _create(alice, 1000e6);
        vm.prank(whale);
        router.buyWithUsdg(token, 20_000e6, 0, whale, DL);
        // curve fees swept first
        (uint256 h0, uint256 b0, uint256 p0) = pad.sweep(token);
        assertEq(IERC20(coin).balanceOf(treasury), h0 + b0 + p0);
        // generate pool volume both ways
        for (uint256 i; i < 3; ++i) {
            vm.prank(bob);
            uint256 got = router.buyWithUsdg(token, 500e6, 0, bob, DL);
            vm.prank(bob);
            router.sellForUsdg(token, got / 2, 0, bob, DL);
        }
        uint256 fees = pad.collectPoolFees(token);
        assertGt(fees, 0);
        Launchpad.Market memory m = pad.getMarket(token);
        assertEq(m.feeHolders + m.feeBuyback + m.feeProtocol, fees);
        uint256 tBefore = IERC20(coin).balanceOf(treasury);
        pad.sweep(token);
        assertEq(IERC20(coin).balanceOf(treasury) - tBefore, fees);
        // treasury turns holder share into USDG at the feed price
        vm.startPrank(treasury);
        uint256 usdgOut = vault.sell(WORD, fees, 0, treasury);
        assertGt(usdgOut, 0);
        vm.stopPrank();
        // selling the token share paid a fee into our own positions: a second
        // collect only finds that sliver
        uint256 again = pad.collectPoolFees(token);
        assertLt(again, fees / 20);
        assertEq(pad.collectPoolFees(token) < again, true);
    }

    function test_buybackBurns() public {
        MockTrend trend = new MockTrend();
        PoolKey memory key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(trend)), 10000, 200, IHooks(address(0)));
        // 1 ETH = 1e6 TREND
        uint160 sqrtP = uint160(Math.sqrt(FullMath.mulDiv(1e6 * 1e18, 1 << 192, 1e18)));
        pm.initialize(key, sqrtP);
        trend.approve(address(lp), type(uint256).max);
        int24 minT = TickMath.minUsableTick(200);
        int24 maxT = TickMath.maxUsableTick(200);
        uint128 liq = LiquidityAmounts.getLiquidityForAmounts(
            sqrtP, TickMath.getSqrtPriceAtTick(minT), TickMath.getSqrtPriceAtTick(maxT), 10 ether, 10e6 ether
        );
        vm.deal(address(this), 20 ether);
        lp.modifyLiquidity{value: 10 ether}(key, ModifyLiquidityParams(minT, maxT, int256(uint256(liq)), 0), "");

        buyback.setPool(address(trend), 10000, 200);
        buyback.setKeeper(keeper, true);
        vm.deal(address(buyback), 1 ether);
        vm.prank(keeper);
        uint256 burned = buyback.execute(0.5 ether, 0);
        assertGt(burned, 0);
        assertEq(trend.balanceOf(buyback.DEAD()), burned);
        assertEq(buyback.totalEthSpent(), 0.5 ether);
    }

    function test_launchTokenTrustsRouterOnly() public {
        address token = _create(alice, 100e6);
        uint256 bal = IERC20(token).balanceOf(alice);
        vm.prank(bob);
        vm.expectRevert();
        IERC20(token).transferFrom(alice, bob, bal);
        // creator can still transfer normally
        vm.prank(alice);
        IERC20(token).transfer(bob, bal / 2);
        assertEq(IERC20(token).balanceOf(bob), bal / 2);
        assertEq(LaunchToken(token).tokenURI(), "ipfs://meta");
    }

    function test_plainSwaps() public {
        vm.prank(bob);
        uint256 u = router.swapEthForUsdg{value: 1 ether}(0, bob, DL);
        assertApproxEqRel(u, 2500e6, 2e16);
        vm.prank(bob);
        uint256 e = router.swapUsdgForEth(u, 0, bob, DL);
        assertApproxEqRel(e, 1 ether, 2e16);
    }

    function test_createWithEth() public {
        vm.prank(bob);
        (address token, uint256 out) = router.createWithEth{value: 0.2 ether}("E", "E", "u", WORD, 100, 0, DL);
        assertGt(out, 0);
        assertEq(IERC20(token).balanceOf(bob), out);
        assertEq(pad.getMarket(token).feeBps, 100);
    }

    function _push(uint256 price) internal {
        bytes32[] memory w = new bytes32[](1);
        uint128[] memory p = new uint128[](1);
        w[0] = WORD;
        p[0] = uint128(price);
        vm.prank(keeper);
        feed.push(w, p);
    }
}
