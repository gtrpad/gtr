// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {FullMath} from "v4-core/libraries/FullMath.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {LiquidityAmounts} from "v4-periphery/libraries/LiquidityAmounts.sol";

import {PegVault} from "./PegVault.sol";
import {LaunchToken} from "./LaunchToken.sol";

/// @notice Markets: a meme token on a virtual constant-product curve denominated
/// in a word coin. Caps are fixed in the coin at creation. When the curve sells
/// out the market migrates into a Uniswap v4 pool owned by this contract.
/// Trading fees (curve and pool) are split holders / buyback / protocol.
contract Launchpad is Ownable, IUnlockCallback {
    using SafeERC20 for IERC20;
    using TransientStateLibrary for IPoolManager;

    // ───────────── constants ─────────────
    uint256 public constant SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;
    uint256 public constant RESERVE_SUPPLY = 200_000_000 ether;
    int24 public constant TICK_SPACING = 200;
    int24 internal constant COIN_RANGE_TICKS = 7000; // ≈ price × 0.5
    uint256 internal constant DUST = 1e9;

    // ───────────── types ─────────────
    struct Market {
        address token;
        bytes32 word;
        address coin;
        address creator;
        uint24 feeBps;
        uint64 createdAt;
        bool migrated;
        uint256 vBase;
        uint256 vQuote;
        uint256 k;
        uint256 curveSupply;
        uint256 raised;
        uint256 feeHolders;
        uint256 feeBuyback;
        uint256 feeProtocol;
        uint256 totalFees;
        PoolKey poolKey;
        int24 coinTickLower;
        int24 coinTickUpper;
        bool hasCoinPosition;
    }

    struct Config {
        uint256 openCapUsd; // 18 dec
        uint256 migCapUsd; // 18 dec
        uint16 holdersBps;
        uint16 buybackBps;
        address treasury;
    }

    enum Action {
        Migrate,
        Collect
    }

    // ───────────── events ─────────────
    event MarketCreated(
        address indexed token,
        bytes32 indexed word,
        address coin,
        address indexed creator,
        uint24 feeBps,
        string name,
        string symbol,
        string uri,
        uint256 vBase,
        uint256 vQuote
    );
    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 quoteAmount,
        uint256 tokenAmount,
        uint256 fee,
        uint256 vBase,
        uint256 vQuote
    );
    event Migrated(address indexed token, bytes32 poolId, uint160 sqrtPriceX96, uint256 tokenLp, uint256 coinLp, uint256 coinOnly);
    event PoolFeesCollected(address indexed token, uint256 coinFees, uint256 tokenFeesSold);
    event Swept(address indexed token, uint256 holders, uint256 buyback, uint256 protocol);
    event ConfigSet(uint256 openCapUsd, uint256 migCapUsd, uint16 holdersBps, uint16 buybackBps, address treasury);
    event RouterSet(address indexed router, bool allowed);

    // ───────────── errors ─────────────
    error UnknownMarket();
    error AlreadyMigrated();
    error NotMigrated();
    error BadFee();
    error BadWord();
    error Slippage();
    error NotPoolManager();
    error BadConfig();

    // ───────────── storage ─────────────
    IPoolManager public immutable poolManager;
    PegVault public immutable vault;
    address public immutable tokenImpl;
    Config public config;
    mapping(address => Market) internal _markets;
    address[] public marketList;
    mapping(address => bool) public isRouter;

    constructor(address owner_, IPoolManager pm_, PegVault vault_, Config memory cfg) Ownable(owner_) {
        poolManager = pm_;
        vault = vault_;
        tokenImpl = address(new LaunchToken());
        _setConfig(cfg);
    }

    // ───────────── admin ─────────────
    function setConfig(Config calldata cfg) external onlyOwner {
        _setConfig(cfg);
    }

    function _setConfig(Config memory cfg) internal {
        if (cfg.migCapUsd <= cfg.openCapUsd || cfg.holdersBps + cfg.buybackBps > 10_000 || cfg.treasury == address(0)) {
            revert BadConfig();
        }
        config = cfg;
        emit ConfigSet(cfg.openCapUsd, cfg.migCapUsd, cfg.holdersBps, cfg.buybackBps, cfg.treasury);
    }

    function setRouter(address router, bool allowed) external onlyOwner {
        isRouter[router] = allowed;
        emit RouterSet(router, allowed);
    }

    // ───────────── views ─────────────
    function marketCount() external view returns (uint256) {
        return marketList.length;
    }

    function getMarket(address token) external view returns (Market memory) {
        return _markets[token];
    }

    function marketInfo(address token) external view returns (bytes32 word, address coin, bool migrated, PoolKey memory key) {
        Market storage m = _markets[token];
        if (m.token == address(0)) revert UnknownMarket();
        return (m.word, m.coin, m.migrated, m.poolKey);
    }

    /// @return price coin per token, 18 dec (curve price; meaningless after migration)
    function curvePrice(address token) external view returns (uint256 price) {
        Market storage m = _markets[token];
        return m.vQuote * 1e18 / m.vBase;
    }

    function quoteBuy(address token, uint256 quoteIn)
        public
        view
        returns (uint256 tokensOut, uint256 fee, uint256 refund)
    {
        Market storage m = _markets[token];
        if (m.token == address(0)) revert UnknownMarket();
        if (m.migrated) revert AlreadyMigrated();
        (tokensOut, fee, refund) = _buyMath(m, quoteIn);
    }

    function quoteSell(address token, uint256 tokensIn) public view returns (uint256 quoteOut, uint256 fee) {
        Market storage m = _markets[token];
        if (m.token == address(0)) revert UnknownMarket();
        if (m.migrated) revert AlreadyMigrated();
        uint256 gross = m.vQuote - Math.ceilDiv(m.k, m.vBase + tokensIn);
        fee = gross * m.feeBps / 10_000;
        quoteOut = gross - fee;
    }

    // ───────────── create ─────────────
    /// @param quoteIn first buy, in the word coin, pulled from msg.sender (may be 0)
    function createMarket(
        string calldata name,
        string calldata symbol,
        string calldata uri,
        bytes32 word,
        uint24 feeBps,
        uint256 quoteIn,
        uint256 minTokensOut,
        address creator
    ) external returns (address token, uint256 tokensOut) {
        if (feeBps < 100 || feeBps > 300) revert BadFee();
        address coin = vault.coinOf(word);
        if (coin == address(0)) revert BadWord();
        if (!isRouter[msg.sender]) creator = msg.sender;

        token = Clones.clone(tokenImpl);
        LaunchToken(token).initialize(name, symbol, uri, address(this), SUPPLY);

        Market storage m = _markets[token];
        m.token = token;
        m.word = word;
        m.coin = coin;
        m.creator = creator;
        m.feeBps = feeBps;
        m.createdAt = uint64(block.timestamp);
        m.curveSupply = CURVE_SUPPLY;

        // caps fixed in the coin at creation
        uint256 coinPrice = vault.price(word); // USD per coin, 18 dec
        uint256 cap0Coin = config.openCapUsd * 1e18 / coinPrice; // coin, 18 dec
        uint256 ratio = config.migCapUsd * 1e18 / config.openCapUsd; // 18 dec
        uint256 s = Math.sqrt(ratio * 1e18); // sqrt(ratio), 18 dec
        uint256 vBase = CURVE_SUPPLY * s / (s - 1e18);
        uint256 vQuote = cap0Coin * vBase / SUPPLY;
        m.vBase = vBase;
        m.vQuote = vQuote;
        m.k = vBase * vQuote;
        marketList.push(token);

        emit MarketCreated(token, word, coin, creator, feeBps, name, symbol, uri, vBase, vQuote);

        if (quoteIn != 0) tokensOut = _buy(m, quoteIn, minTokensOut, creator);
    }

    // ───────────── curve trading ─────────────
    function buy(address token, uint256 quoteIn, uint256 minTokensOut, address to) external returns (uint256 tokensOut) {
        Market storage m = _markets[token];
        if (m.token == address(0)) revert UnknownMarket();
        return _buy(m, quoteIn, minTokensOut, to);
    }

    function sell(address token, uint256 tokensIn, uint256 minQuoteOut, address to) external returns (uint256 quoteOut) {
        Market storage m = _markets[token];
        if (m.token == address(0)) revert UnknownMarket();
        if (m.migrated) revert AlreadyMigrated();
        IERC20(m.token).safeTransferFrom(msg.sender, address(this), tokensIn);
        uint256 gross = m.vQuote - Math.ceilDiv(m.k, m.vBase + tokensIn);
        uint256 fee = gross * m.feeBps / 10_000;
        quoteOut = gross - fee;
        if (quoteOut < minQuoteOut) revert Slippage();
        m.vBase += tokensIn;
        m.vQuote -= gross;
        m.curveSupply += tokensIn;
        m.raised -= gross;
        _accrueFee(m, fee);
        IERC20(m.coin).safeTransfer(to, quoteOut);
        emit Trade(m.token, to, false, quoteOut, tokensIn, fee, m.vBase, m.vQuote);
    }

    function _buyMath(Market storage m, uint256 quoteIn)
        internal
        view
        returns (uint256 tokensOut, uint256 fee, uint256 refund)
    {
        fee = quoteIn * m.feeBps / 10_000;
        uint256 net = quoteIn - fee;
        tokensOut = m.vBase - Math.ceilDiv(m.k, m.vQuote + net);
        if (tokensOut >= m.curveSupply) {
            tokensOut = m.curveSupply;
            uint256 needNet = Math.ceilDiv(m.k, m.vBase - tokensOut) - m.vQuote;
            uint256 needGross = Math.ceilDiv(needNet * 10_000, 10_000 - m.feeBps);
            if (needGross > quoteIn) needGross = quoteIn;
            refund = quoteIn - needGross;
            fee = needGross - needNet;
        }
    }

    function _buy(Market storage m, uint256 quoteIn, uint256 minTokensOut, address to) internal returns (uint256 tokensOut) {
        if (m.migrated) revert AlreadyMigrated();
        IERC20(m.coin).safeTransferFrom(msg.sender, address(this), quoteIn);
        (uint256 out, uint256 fee, uint256 refund) = _buyMath(m, quoteIn);
        tokensOut = out;
        if (tokensOut < minTokensOut) revert Slippage();
        uint256 net = quoteIn - refund - fee;
        m.vBase -= tokensOut;
        m.vQuote += net;
        m.curveSupply -= tokensOut;
        m.raised += net;
        _accrueFee(m, fee);
        IERC20(m.token).safeTransfer(to, tokensOut);
        if (refund != 0) IERC20(m.coin).safeTransfer(msg.sender, refund);
        emit Trade(m.token, to, true, quoteIn - refund, tokensOut, fee, m.vBase, m.vQuote);
        if (m.curveSupply == 0) _migrate(m);
    }

    function _accrueFee(Market storage m, uint256 fee) internal {
        if (fee == 0) return;
        uint256 h = fee * config.holdersBps / 10_000;
        uint256 b = fee * config.buybackBps / 10_000;
        m.feeHolders += h;
        m.feeBuyback += b;
        m.feeProtocol += fee - h - b;
        m.totalFees += fee;
    }

    // ───────────── migration ─────────────
    function _migrate(Market storage m) internal {
        m.migrated = true;
        bool tokenIs0 = m.token < m.coin;
        uint256 p1 = m.vQuote * 1e18 / m.vBase; // coin per token
        uint256 price1per0 = tokenIs0 ? p1 : 1e36 / p1;
        uint160 sqrtP = uint160(Math.sqrt(FullMath.mulDiv(price1per0, 1 << 192, 1e18)));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(tokenIs0 ? m.token : m.coin),
            currency1: Currency.wrap(tokenIs0 ? m.coin : m.token),
            fee: uint24(m.feeBps) * 100,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
        m.poolKey = key;
        int24 tick = poolManager.initialize(key, sqrtP);
        // A router may already hold the unlock (buy routed through it): then
        // operate directly, settling our own deltas before returning.
        if (poolManager.isUnlocked()) _doMigrate(m, tick, sqrtP);
        else poolManager.unlock(abi.encode(Action.Migrate, m.token, tick, sqrtP));
    }

    function _doMigrate(Market storage m, int24 tick, uint160 sqrtP) internal {
        bool tokenIs0 = m.token < m.coin;
        PoolKey memory key = m.poolKey;
        int24 minT = TickMath.minUsableTick(TICK_SPACING);
        int24 maxT = TickMath.maxUsableTick(TICK_SPACING);
        uint256 tokenAmt = RESERVE_SUPPLY - DUST;
        uint256 coinAmt = m.raised - DUST;
        uint128 liq = LiquidityAmounts.getLiquidityForAmounts(
            sqrtP,
            TickMath.getSqrtPriceAtTick(minT),
            TickMath.getSqrtPriceAtTick(maxT),
            tokenIs0 ? tokenAmt : coinAmt,
            tokenIs0 ? coinAmt : tokenAmt
        );
        (BalanceDelta d,) = poolManager.modifyLiquidity(
            key, ModifyLiquidityParams({tickLower: minT, tickUpper: maxT, liquidityDelta: int256(uint256(liq)), salt: 0}), ""
        );
        uint256 coinUsed = uint256(-int256(tokenIs0 ? d.amount1() : d.amount0()));
        uint256 tokenUsed = uint256(-int256(tokenIs0 ? d.amount0() : d.amount1()));

        uint256 coinOnly;
        if (m.raised > coinUsed + 2 * DUST) {
            coinOnly = m.raised - coinUsed - DUST;
            int24 lower;
            int24 upper;
            int24 base = _floorTick(tick);
            uint128 liq2;
            if (tokenIs0) {
                // coin is currency1: a range entirely below the price holds only coin
                upper = base;
                lower = upper - COIN_RANGE_TICKS;
                liq2 = LiquidityAmounts.getLiquidityForAmount1(
                    TickMath.getSqrtPriceAtTick(lower), TickMath.getSqrtPriceAtTick(upper), coinOnly
                );
            } else {
                // coin is currency0: a range entirely above the price holds only coin
                lower = base + TICK_SPACING;
                upper = lower + COIN_RANGE_TICKS;
                liq2 = LiquidityAmounts.getLiquidityForAmount0(
                    TickMath.getSqrtPriceAtTick(lower), TickMath.getSqrtPriceAtTick(upper), coinOnly
                );
            }
            if (liq2 != 0) {
                poolManager.modifyLiquidity(
                    key,
                    ModifyLiquidityParams({tickLower: lower, tickUpper: upper, liquidityDelta: int256(uint256(liq2)), salt: 0}),
                    ""
                );
                m.coinTickLower = lower;
                m.coinTickUpper = upper;
                m.hasCoinPosition = true;
            }
        }
        _settleOwed(key.currency0);
        _settleOwed(key.currency1);
        emit Migrated(m.token, _poolId(key), sqrtP, tokenUsed, coinUsed, coinOnly);
    }

    function _floorTick(int24 tick) internal pure returns (int24) {
        int24 q = tick / TICK_SPACING;
        if (tick < 0 && tick % TICK_SPACING != 0) q -= 1;
        return q * TICK_SPACING;
    }

    function _poolId(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }

    // ───────────── pool fees ─────────────
    /// @notice Collect LP fees of a migrated market; the token share is sold for
    /// the coin in the same pool so the whole fee is booked in the word coin.
    function collectPoolFees(address token) external returns (uint256 coinFees) {
        Market storage m = _markets[token];
        if (m.token == address(0)) revert UnknownMarket();
        if (!m.migrated) revert NotMigrated();
        if (poolManager.isUnlocked()) return _doCollect(m);
        bytes memory res = poolManager.unlock(abi.encode(Action.Collect, token, int24(0), uint160(0)));
        coinFees = abi.decode(res, (uint256));
    }

    function _doCollect(Market storage m) internal returns (uint256 coinFees) {
        PoolKey memory key = m.poolKey;
        bool tokenIs0 = m.token < m.coin;
        poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: TickMath.minUsableTick(TICK_SPACING),
                tickUpper: TickMath.maxUsableTick(TICK_SPACING),
                liquidityDelta: 0,
                salt: 0
            }),
            ""
        );
        if (m.hasCoinPosition) {
            poolManager.modifyLiquidity(
                key,
                ModifyLiquidityParams({tickLower: m.coinTickLower, tickUpper: m.coinTickUpper, liquidityDelta: 0, salt: 0}),
                ""
            );
        }
        Currency tokenC = Currency.wrap(m.token);
        Currency coinC = Currency.wrap(m.coin);
        int256 dTok = poolManager.currencyDelta(address(this), tokenC);
        uint256 tokenSold;
        if (dTok > 0) {
            tokenSold = uint256(dTok);
            poolManager.swap(
                key,
                SwapParams({
                    zeroForOne: tokenIs0,
                    amountSpecified: -dTok,
                    sqrtPriceLimitX96: tokenIs0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
                }),
                ""
            );
        }
        int256 dCoin = poolManager.currencyDelta(address(this), coinC);
        if (dCoin > 0) {
            coinFees = uint256(dCoin);
            poolManager.take(coinC, address(this), coinFees);
        }
        _accrueFee(m, coinFees);
        emit PoolFeesCollected(m.token, coinFees, tokenSold);
    }

    /// @notice Move accrued fee shares of a market to the treasury.
    function sweep(address token) external returns (uint256 holders, uint256 buyback, uint256 protocol) {
        Market storage m = _markets[token];
        if (m.token == address(0)) revert UnknownMarket();
        holders = m.feeHolders;
        buyback = m.feeBuyback;
        protocol = m.feeProtocol;
        m.feeHolders = 0;
        m.feeBuyback = 0;
        m.feeProtocol = 0;
        uint256 total = holders + buyback + protocol;
        if (total != 0) IERC20(m.coin).safeTransfer(config.treasury, total);
        emit Swept(token, holders, buyback, protocol);
    }

    // ───────────── v4 plumbing ─────────────
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (Action action, address token, int24 tick, uint160 sqrtP) = abi.decode(data, (Action, address, int24, uint160));
        Market storage m = _markets[token];
        if (action == Action.Migrate) {
            _doMigrate(m, tick, sqrtP);
            return "";
        }
        uint256 fees = _doCollect(m);
        return abi.encode(fees);
    }

    function _settleOwed(Currency c) internal {
        int256 delta = poolManager.currencyDelta(address(this), c);
        if (delta >= 0) return;
        uint256 owed = uint256(-delta);
        poolManager.sync(c);
        IERC20(Currency.unwrap(c)).safeTransfer(address(poolManager), owed);
        poolManager.settle();
    }
}
