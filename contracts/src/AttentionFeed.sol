// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Reference price of every word coin, in USD with 18 decimals, written
/// by the keeper. A stale word (no push within `staleAfter`) cannot be traded.
contract AttentionFeed is Ownable {
    struct Entry {
        uint128 price;
        uint64 updatedAt;
    }

    event Pushed(bytes32 indexed word, uint128 price, uint64 at);
    event UpdaterSet(address indexed updater, bool allowed);
    event StaleAfterSet(uint256 seconds_);

    error NotUpdater();
    error LengthMismatch();
    error ZeroPrice();
    error StalePrice(bytes32 word);
    error UnknownWord(bytes32 word);

    mapping(bytes32 => Entry) public entries;
    mapping(address => bool) public updaters;
    uint256 public staleAfter = 36 hours;

    constructor(address owner_) Ownable(owner_) {}

    function setUpdater(address updater, bool allowed) external onlyOwner {
        updaters[updater] = allowed;
        emit UpdaterSet(updater, allowed);
    }

    function setStaleAfter(uint256 seconds_) external onlyOwner {
        staleAfter = seconds_;
        emit StaleAfterSet(seconds_);
    }

    function push(bytes32[] calldata words, uint128[] calldata prices) external {
        if (!updaters[msg.sender] && msg.sender != owner()) revert NotUpdater();
        if (words.length != prices.length) revert LengthMismatch();
        uint64 now_ = uint64(block.timestamp);
        for (uint256 i; i < words.length; ++i) {
            if (prices[i] == 0) revert ZeroPrice();
            entries[words[i]] = Entry(prices[i], now_);
            emit Pushed(words[i], prices[i], now_);
        }
    }

    /// @return price USD per coin, 18 decimals. Reverts when unknown or stale.
    function getPrice(bytes32 word) external view returns (uint256 price) {
        Entry memory e = entries[word];
        if (e.price == 0) revert UnknownWord(word);
        if (block.timestamp - e.updatedAt > staleAfter) revert StalePrice(word);
        return e.price;
    }

    function peek(bytes32 word) external view returns (uint256 price, uint256 updatedAt, bool fresh) {
        Entry memory e = entries[word];
        return (e.price, e.updatedAt, e.price != 0 && block.timestamp - e.updatedAt <= staleAfter);
    }
}
