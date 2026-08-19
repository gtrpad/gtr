// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

/// @notice Buys the exchange coin with ETH on its v4 pool and burns it.
/// ETH is sent here by the keeper (the buyback share of fees, swept to ETH).
contract Buyback is Ownable, IUnlockCallback {
    event PoolSet(address token, uint24 fee, int24 tickSpacing);
    event KeeperSet(address keeper, bool allowed);
    event Burned(uint256 ethIn, uint256 tokensBurned);

    error NotKeeper();
    error NotPoolManager();
    error NoPool();
    error Slippage();

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IPoolManager public immutable poolManager;
    address public token;
    PoolKey public key;
    mapping(address => bool) public keepers;
    uint256 public totalEthSpent;
    uint256 public totalBurned;

    constructor(address owner_, IPoolManager pm_) Ownable(owner_) {
        poolManager = pm_;
    }

    receive() external payable {}

    function setPool(address token_, uint24 fee, int24 tickSpacing) external onlyOwner {
        token = token_;
        key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token_),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
        emit PoolSet(token_, fee, tickSpacing);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function execute(uint256 ethIn, uint256 minOut) external returns (uint256 burned) {
        if (!keepers[msg.sender] && msg.sender != owner()) revert NotKeeper();
        if (token == address(0)) revert NoPool();
        bytes memory r = poolManager.unlock(abi.encode(ethIn));
        burned = abi.decode(r, (uint256));
        if (burned < minOut) revert Slippage();
        totalEthSpent += ethIn;
        totalBurned += burned;
        emit Burned(ethIn, burned);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        uint256 ethIn = abi.decode(data, (uint256));
        BalanceDelta d = poolManager.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            ""
        );
        uint256 out = uint256(int256(d.amount1()));
        poolManager.settle{value: ethIn}();
        poolManager.take(Currency.wrap(token), DEAD, out);
        return abi.encode(out);
    }

    /// @notice Owner escape hatch for ETH parked here before a pool exists.
    function withdrawEth(address to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "eth");
    }
}
