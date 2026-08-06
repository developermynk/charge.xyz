// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ChargeToken
 * @notice Fixed-supply ERC-20 deployed by Charge.xyz users on Arc.
 *
 * SECURITY POSTURE (from the CSO review):
 *  - No mint function. The entire supply is created in the constructor and sent
 *    to the deployer. A token that cannot mint cannot be inflated later, which
 *    removes the single most common rug vector in launcher-created tokens.
 *  - No owner, no admin, no pause, no blacklist. There are no privileged
 *    functions at all, so there is no access control to get wrong.
 *  - Solidity 0.8.24 has checked arithmetic by default, so there is no overflow
 *    or underflow path; balances revert rather than wrap.
 *  - transfer/transferFrom reject the zero address so supply cannot be burned
 *    by accident through a mistyped recipient.
 *
 * The contract is intentionally minimal and dependency-free: the bytecode a
 * user deploys is small, cheap on gas, and readable in full on the explorer.
 */
contract ChargeToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error ZeroAddress();
    error InsufficientBalance();
    error InsufficientAllowance();
    error EmptySupply();

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_
    ) {
        if (totalSupply_ == 0) revert EmptySupply();

        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        totalSupply = totalSupply_;

        // The deployer receives 100% of the supply. Charge.xyz never holds any.
        balanceOf[msg.sender] = totalSupply_;
        emit Transfer(address(0), msg.sender, totalSupply_);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            unchecked {
                allowance[from][msg.sender] = allowed - amount;
            }
        }
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) private returns (bool) {
        if (to == address(0)) revert ZeroAddress();

        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();

        unchecked {
            balanceOf[from] = balance - amount;
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
        return true;
    }
}
