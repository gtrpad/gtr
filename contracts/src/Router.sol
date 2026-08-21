// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

import {PegVault} from "./PegVault.sol";
import {Launchpad} from "./Launchpad.sol";

/// @notice One-transaction routes: ETH or USDG or the word coin in, market
/// token out, and back. Curve markets trade on the launchpad, migrated markets
/// on their v4 pool; the word coin leg always goes through the PegVault.
/// Quotes are produced by running the route and reverting with the result.
contract Router is Ownable, IUnlockCallback {
    using SafeERC20 for IERC20;

    enum Cur {
        ETH,
        USDG,
        COIN
    }

    struct Op {
        bool isBuy;
        bool quote;
        Cur cur;
        address token;
        uint256 amountIn;
        uint256 minOut;
        address to;
        address from;
    }

    event Buy(address indexed token, address indexed from, address indexed to, Cur cur, uint256 amountIn, uint256 tokensOut);
    event Sell(address indexed token, address indexed from, address indexed to, Cur cur, uint256 tokensIn, uint256 amountOut);
    event EthUsdgPoolSet(uint24 fee, int24 tickSpacing);

    error Expired();
    error Slippage();
    error NotPoolManager();
    error QuoteResult(uint256 amountOut);
    error ZeroAmount();

    IPoolManager public immutable poolManager;
    PegVault public immutable vault;
    Launchpad public immutable launchpad;
    IERC20 public immutable usdg;
    PoolKey public ethUsdgKey;

    constructor(address owner_, IPoolManager pm_, PegVault vault_, Launchpad pad_, uint24 ethUsdgFee, int24 ethUsdgTickSpacing)
        Ownable(owner_)
    {
        poolManager = pm_;
        vault = vault_;
        launchpad = pad_;
        usdg = vault_.usdg();
        usdg.forceApprove(address(vault_), type(uint256).max);
        _setEthUsdgPool(ethUsdgFee, ethUsdgTickSpacing);
    }

    receive() external payable {}

    function setEthUsdgPool(uint24 fee, int24 tickSpacing) external onlyOwner {
        _setEthUsdgPool(fee, tickSpacing);
    }

    function _setEthUsdgPool(uint24 fee, int24 tickSpacing) internal {
        ethUsdgKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(usdg)),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
        emit EthUsdgPoolSet(fee, tickSpacing);
    }

    modifier live(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    // ───────────── create ─────────────
    function createWithUsdg(
        string calldata name,
        string calldata symbol,
        string calldata uri,
        bytes32 word,
        uint24 feeBps,
        uint256 usdgIn,
        uint256 minTokensOut,
        uint256 deadline
    ) external live(deadline) returns (address token, uint256 tokensOut) {
        if (usdgIn != 0) usdg.safeTransferFrom(msg.sender, address(this), usdgIn);
        return _create(name, symbol, uri, word, feeBps, usdgIn, minTokensOut);
    }

    function createWithEth(
        string calldata name,
        string calldata symbol,
        string calldata uri,
        bytes32 word,
        uint24 feeBps,
        uint256 minTokensOut,
        uint256 deadline
    ) external payable live(deadline) returns (address token, uint256 tokensOut) {
        uint256 usdgIn;
        if (msg.value != 0) {
            bytes memory r = poolManager.unlock(abi.encode(uint8(1), msg.value));
            usdgIn = abi.decode(r, (uint256));
        }
        return _create(name, symbol, uri, word, feeBps, usdgIn, minTokensOut);
    }

    function _create(
        string calldata name,
        string calldata symbol,
        string calldata uri,
        bytes32 word,
        uint24 feeBps,
        uint256 usdgIn,
        uint256 minTokensOut
    ) internal returns (address token, uint256 tokensOut) {
        uint256 coinIn;
        address coin = vault.coinOf(word);
        if (usdgIn != 0) {
            coinIn = vault.buy(word, usdgIn, 0, address(this));
            _approveOnce(coin, address(launchpad));
        }
        (token, tokensOut) = launchpad.createMarket(name, symbol, uri, word, feeBps, coinIn, minTokensOut, msg.sender);
        _flushCoin(coin, msg.sender);
    }

    // ───────────── buy ─────────────
    function buyWithEth(address token, uint256 minTokensOut, address to, uint256 deadline)
        external
        payable
        live(deadline)
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert ZeroAmount();
        tokensOut = _run(Op(true, false, Cur.ETH, token, msg.value, minTokensOut, to, msg.sender));
        emit Buy(token, msg.sender, to, Cur.ETH, msg.value, tokensOut);
    }

    function buyWithUsdg(address token, uint256 usdgIn, uint256 minTokensOut, address to, uint256 deadline)
        external
        live(deadline)
        returns (uint256 tokensOut)
    {
        usdg.safeTransferFrom(msg.sender, address(this), usdgIn);
        tokensOut = _run(Op(true, false, Cur.USDG, token, usdgIn, minTokensOut, to, msg.sender));
        emit Buy(token, msg.sender, to, Cur.USDG, usdgIn, tokensOut);
    }

    function buyWithCoin(address token, uint256 coinIn, uint256 minTokensOut, address to, uint256 deadline)
        external
        live(deadline)
        returns (uint256 tokensOut)
    {
        (, address coin,,) = launchpad.marketInfo(token);
        IERC20(coin).safeTransferFrom(msg.sender, address(this), coinIn);
        tokensOut = _run(Op(true, false, Cur.COIN, token, coinIn, minTokensOut, to, msg.sender));
        emit Buy(token, msg.sender, to, Cur.COIN, coinIn, tokensOut);
    }

    // ───────────── sell ─────────────
    function sellForEth(address token, uint256 tokensIn, uint256 minEthOut, address to, uint256 deadline)
        external
        live(deadline)
        returns (uint256 ethOut)
    {
        ethOut = _run(Op(false, false, Cur.ETH, token, tokensIn, minEthOut, to, msg.sender));
        emit Sell(token, msg.sender, to, Cur.ETH, tokensIn, ethOut);
    }

    function sellForUsdg(address token, uint256 tokensIn, uint256 minUsdgOut, address to, uint256 deadline)
        external
        live(deadline)
        returns (uint256 usdgOut)
    {
        usdgOut = _run(Op(false, false, Cur.USDG, token, tokensIn, minUsdgOut, to, msg.sender));
        emit Sell(token, msg.sender, to, Cur.USDG, tokensIn, usdgOut);
    }

    function sellForCoin(address token, uint256 tokensIn, uint256 minCoinOut, address to, uint256 deadline)
        external
        live(deadline)
        returns (uint256 coinOut)
    {
        coinOut = _run(Op(false, false, Cur.COIN, token, tokensIn, minCoinOut, to, msg.sender));
        emit Sell(token, msg.sender, to, Cur.COIN, tokensIn, coinOut);
    }

    // ───────────── plain ETH <-> USDG (treasury conversions, anyone may use) ─────────────
    function swapUsdgForEth(uint256 usdgIn, uint256 minEthOut, address to, uint256 deadline)
        external
        live(deadline)
        returns (uint256 ethOut)
    {
        usdg.safeTransferFrom(msg.sender, address(this), usdgIn);
        bytes memory r = poolManager.unlock(abi.encode(uint8(2), usdgIn, to));
        ethOut = abi.decode(r, (uint256));
        if (ethOut < minEthOut) revert Slippage();
    }

    function swapEthForUsdg(uint256 minUsdgOut, address to, uint256 deadline)
        external
        payable
        live(deadline)
        returns (uint256 usdgOut)
    {
        if (msg.value == 0) revert ZeroAmount();
        bytes memory r = poolManager.unlock(abi.encode(uint8(1), msg.value));
        usdgOut = abi.decode(r, (uint256));
        if (usdgOut < minUsdgOut) revert Slippage();
        usdg.safeTransfer(to, usdgOut);
    }

    // ───────────── quotes (call via eth_call) ─────────────
    function quoteBuy(address token, Cur cur, uint256 amountIn) external returns (uint256 tokensOut) {
        try poolManager.unlock(abi.encode(uint8(0), Op(true, true, cur, token, amountIn, 0, address(this), address(this)))) {}
        catch (bytes memory reason) {
            return _parseQuote(reason);
        }
    }

    function quoteSell(address token, Cur cur, uint256 tokensIn) external returns (uint256 amountOut) {
        try poolManager.unlock(abi.encode(uint8(0), Op(false, true, cur, token, tokensIn, 0, address(this), address(this)))) {}
        catch (bytes memory reason) {
            return _parseQuote(reason);
        }
    }

    function _parseQuote(bytes memory reason) internal pure returns (uint256) {
        if (reason.length != 36 || bytes4(reason) != QuoteResult.selector) {
            assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
        assembly {
            let out := mload(add(reason, 36))
            mstore(0, out)
            return(0, 32)
        }
    }

    // ───────────── core ─────────────
    function _run(Op memory op) internal returns (uint256 out) {
        bytes memory r = poolManager.unlock(abi.encode(uint8(0), op));
        out = abi.decode(r, (uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        uint8 kind = abi.decode(data, (uint8));
        if (kind == 1) {
            (, uint256 ethIn) = abi.decode(data, (uint8, uint256));
            return abi.encode(_ethToUsdg(ethIn, false));
        }
        if (kind == 2) {
            (, uint256 usdgIn, address to) = abi.decode(data, (uint8, uint256, address));
            return abi.encode(_usdgToEth(usdgIn, to, false));
        }
        (, Op memory op) = abi.decode(data, (uint8, Op));
        uint256 out = op.isBuy ? _buy(op) : _sell(op);
        if (op.quote) revert QuoteResult(out);
        if (out < op.minOut) revert Slippage();
        return abi.encode(out);
    }

    function _buy(Op memory op) internal returns (uint256 tokensOut) {
        (bytes32 word, address coin, bool migrated, PoolKey memory key) = launchpad.marketInfo(op.token);
        uint256 coinIn;
        if (op.cur == Cur.COIN) {
            coinIn = op.amountIn;
        } else {
            uint256 usdgIn = op.cur == Cur.ETH ? _ethToUsdg(op.amountIn, op.quote) : op.amountIn;
            if (op.quote) {
                (coinIn,) = vault.quoteBuy(word, usdgIn);
            } else {
                coinIn = vault.buy(word, usdgIn, 0, address(this));
            }
        }
        if (!migrated) {
            if (op.quote) {
                (tokensOut,,) = launchpad.quoteBuy(op.token, coinIn);
            } else {
                _approveOnce(coin, address(launchpad));
                tokensOut = launchpad.buy(op.token, coinIn, 0, op.to);
                _flushCoin(coin, op.to); // refund from a completing buy
            }
        } else {
            tokensOut = _poolSwap(key, coin, op.token, coinIn, op.to, op.quote);
        }
    }

    function _sell(Op memory op) internal returns (uint256 amountOut) {
        (bytes32 word, address coin, bool migrated, PoolKey memory key) = launchpad.marketInfo(op.token);
        uint256 coinOut;
        if (!migrated) {
            if (op.quote) {
                (coinOut,) = launchpad.quoteSell(op.token, op.amountIn);
            } else {
                IERC20(op.token).safeTransferFrom(op.from, address(this), op.amountIn);
                coinOut = launchpad.sell(op.token, op.amountIn, 0, address(this));
            }
        } else {
            if (!op.quote) IERC20(op.token).safeTransferFrom(op.from, address(this), op.amountIn);
            coinOut = _poolSwap(key, op.token, coin, op.amountIn, address(this), op.quote);
        }
        if (op.cur == Cur.COIN) {
            if (!op.quote) IERC20(coin).safeTransfer(op.to, coinOut);
            return coinOut;
        }
        uint256 usdgOut;
        if (op.quote) {
            (usdgOut,,) = vault.quoteSell(word, coinOut);
        } else {
            usdgOut = vault.sell(word, coinOut, 0, op.cur == Cur.USDG ? op.to : address(this));
        }
        if (op.cur == Cur.USDG) return usdgOut;
        return _usdgToEth(usdgOut, op.to, op.quote);
    }

    /// @dev Swap inside the current unlock. Input is settled from this contract's
    /// balance (skipped for quotes), output taken to `to` (skipped for quotes).
    function _poolSwap(PoolKey memory key, address tokenIn, address tokenOut, uint256 amountIn, address to, bool quote)
        internal
        returns (uint256 amountOut)
    {
        bool zeroForOne = tokenIn < tokenOut;
        BalanceDelta d = poolManager.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        amountOut = uint256(int256(zeroForOne ? d.amount1() : d.amount0()));
        if (quote) return amountOut;
        Currency cIn = Currency.wrap(tokenIn);
        poolManager.sync(cIn);
        IERC20(tokenIn).safeTransfer(address(poolManager), amountIn);
        poolManager.settle();
        poolManager.take(Currency.wrap(tokenOut), to, amountOut);
    }

    function _ethToUsdg(uint256 ethIn, bool quote) internal returns (uint256 usdgOut) {
        BalanceDelta d = poolManager.swap(
            ethUsdgKey,
            SwapParams({zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            ""
        );
        usdgOut = uint256(int256(d.amount1()));
        if (quote) return usdgOut;
        poolManager.settle{value: ethIn}();
        poolManager.take(Currency.wrap(address(usdg)), address(this), usdgOut);
    }

    function _usdgToEth(uint256 usdgIn, address to, bool quote) internal returns (uint256 ethOut) {
        BalanceDelta d = poolManager.swap(
            ethUsdgKey,
            SwapParams({zeroForOne: false, amountSpecified: -int256(usdgIn), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            ""
        );
        ethOut = uint256(int256(d.amount0()));
        if (quote) return ethOut;
        poolManager.sync(Currency.wrap(address(usdg)));
        usdg.safeTransfer(address(poolManager), usdgIn);
        poolManager.settle();
        poolManager.take(Currency.wrap(address(0)), to, ethOut);
    }

    function _approveOnce(address token, address spender) internal {
        if (IERC20(token).allowance(address(this), spender) < type(uint256).max / 2) {
            IERC20(token).forceApprove(spender, type(uint256).max);
        }
    }

    function _flushCoin(address coin, address to) internal {
        uint256 bal = IERC20(coin).balanceOf(address(this));
        if (bal != 0) IERC20(coin).safeTransfer(to, bal);
    }
}
