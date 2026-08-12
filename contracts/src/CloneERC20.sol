// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal ERC-20 meant to live behind EIP-1167 clones: state is set in
/// `_initERC20`, never in a constructor. Hooks `_beforeSpend` lets children skip
/// allowance for trusted operators.
abstract contract CloneERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error AlreadyInitialized();
    error InsufficientBalance();
    error InsufficientAllowance();

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool internal _initialized;

    function _initERC20(string memory name_, string memory symbol_) internal {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;
        name = name_;
        symbol = symbol_;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (!_trustedSpender(msg.sender)) {
            uint256 allowed = allowance[from][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < amount) revert InsufficientAllowance();
                allowance[from][msg.sender] = allowed - amount;
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    /// @dev Operators that may move tokens without allowance. Default: none.
    function _trustedSpender(address) internal view virtual returns (bool) {
        return false;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 bal = balanceOf[from];
        if (bal < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 bal = balanceOf[from];
        if (bal < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - amount;
            totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }
}
