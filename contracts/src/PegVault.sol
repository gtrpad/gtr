// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AttentionFeed} from "./AttentionFeed.sol";
import {WordCoin} from "./WordCoin.sol";

/// @notice Mint-and-redeem peg for every word coin against USDG at the feed
/// price. Buying mints; selling burns and pays out of what that word has
/// collected, never more. A word whose feed is stale cannot be traded.
contract PegVault is Ownable {
    using SafeERC20 for IERC20;

    struct Word {
        address coin;
        uint256 reserve; // USDG (6 dec) held for this word
        bool enabled;
    }

    event WordAdded(bytes32 indexed word, address coin, string name, string symbol);
    event WordEnabled(bytes32 indexed word, bool enabled);
    event Bought(bytes32 indexed word, address indexed buyer, address indexed to, uint256 usdgIn, uint256 coinOut, uint256 fee);
    event Sold(bytes32 indexed word, address indexed seller, address indexed to, uint256 coinIn, uint256 usdgOut, uint256 fee);
    event ConfigSet(address treasury, uint16 pegFeeBps);

    error WordExists();
    error WordDisabled();
    error UnknownWord();
    error Slippage();
    error InsufficientReserve(uint256 maxUsdg);
    error FeeTooHigh();

    uint256 private constant USDG_TO_18 = 1e12;

    IERC20 public immutable usdg;
    AttentionFeed public immutable feed;
    address public immutable wordCoinImpl;
    address public treasury;
    uint16 public pegFeeBps;

    mapping(bytes32 => Word) public words;
    bytes32[] public wordList;

    constructor(address owner_, IERC20 usdg_, AttentionFeed feed_, address treasury_, uint16 pegFeeBps_)
        Ownable(owner_)
    {
        usdg = usdg_;
        feed = feed_;
        wordCoinImpl = address(new WordCoin());
        treasury = treasury_;
        pegFeeBps = pegFeeBps_;
    }

    // ───────────── admin ─────────────

    function setConfig(address treasury_, uint16 pegFeeBps_) external onlyOwner {
        if (pegFeeBps_ > 500) revert FeeTooHigh();
        treasury = treasury_;
        pegFeeBps = pegFeeBps_;
        emit ConfigSet(treasury_, pegFeeBps_);
    }

    function addWord(bytes32 word, string calldata name, string calldata symbol) external onlyOwner returns (address coin) {
        if (words[word].coin != address(0)) revert WordExists();
        coin = Clones.cloneDeterministic(wordCoinImpl, word);
        WordCoin(coin).initialize(name, symbol, word, address(this));
        words[word] = Word({coin: coin, reserve: 0, enabled: true});
        wordList.push(word);
        emit WordAdded(word, coin, name, symbol);
    }

    function setEnabled(bytes32 word, bool enabled) external onlyOwner {
        if (words[word].coin == address(0)) revert UnknownWord();
        words[word].enabled = enabled;
        emit WordEnabled(word, enabled);
    }

    // ───────────── views ─────────────

    function wordCount() external view returns (uint256) {
        return wordList.length;
    }

    function coinOf(bytes32 word) external view returns (address) {
        return words[word].coin;
    }

    function price(bytes32 word) public view returns (uint256) {
        return feed.getPrice(word);
    }

    /// @return coinOut coins (18 dec) for `usdgIn` USDG (6 dec) after the peg fee.
    function quoteBuy(bytes32 word, uint256 usdgIn) public view returns (uint256 coinOut, uint256 fee) {
        fee = usdgIn * pegFeeBps / 10_000;
        uint256 net = usdgIn - fee;
        coinOut = net * USDG_TO_18 * 1e18 / price(word);
    }

    /// @return usdgOut USDG (6 dec) for `coinIn` coins after the peg fee; `gross` is what leaves the reserve.
    function quoteSell(bytes32 word, uint256 coinIn) public view returns (uint256 usdgOut, uint256 fee, uint256 gross) {
        gross = coinIn * price(word) / 1e18 / USDG_TO_18;
        fee = gross * pegFeeBps / 10_000;
        usdgOut = gross - fee;
    }

    /// @return coins that can currently be sold back for this word (reserve-bound).
    function maxSellable(bytes32 word) external view returns (uint256) {
        return words[word].reserve * USDG_TO_18 * 1e18 / price(word);
    }

    // ───────────── trading ─────────────

    function buy(bytes32 word, uint256 usdgIn, uint256 minCoinOut, address to) external returns (uint256 coinOut) {
        Word storage w = _live(word);
        uint256 fee;
        (coinOut, fee) = quoteBuy(word, usdgIn);
        if (coinOut < minCoinOut) revert Slippage();
        usdg.safeTransferFrom(msg.sender, address(this), usdgIn);
        if (fee != 0) usdg.safeTransfer(treasury, fee);
        w.reserve += usdgIn - fee;
        WordCoin(w.coin).mint(to, coinOut);
        emit Bought(word, msg.sender, to, usdgIn, coinOut, fee);
    }

    function sell(bytes32 word, uint256 coinIn, uint256 minUsdgOut, address to) external returns (uint256 usdgOut) {
        Word storage w = _live(word);
        uint256 fee;
        uint256 gross;
        (usdgOut, fee, gross) = quoteSell(word, coinIn);
        if (usdgOut < minUsdgOut) revert Slippage();
        if (gross > w.reserve) revert InsufficientReserve(w.reserve);
        WordCoin(w.coin).burn(msg.sender, coinIn);
        w.reserve -= gross;
        if (fee != 0) usdg.safeTransfer(treasury, fee);
        usdg.safeTransfer(to, usdgOut);
        emit Sold(word, msg.sender, to, coinIn, usdgOut, fee);
    }

    function _live(bytes32 word) internal view returns (Word storage w) {
        w = words[word];
        if (w.coin == address(0)) revert UnknownWord();
        if (!w.enabled) revert WordDisabled();
    }
}
