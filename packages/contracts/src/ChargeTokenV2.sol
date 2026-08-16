// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ChargeTokenV2
 * @notice ERC-20 token launcher contract for Charge.xyz on Arc.
 *
 * SECURITY POSTURE (Arc + Circle launcher guidelines):
 *  - Deployed from the USER's own wallet, so the deployer (not Charge.xyz) is
 *    the initial holder and, when mintable, the only privileged address.
 *  - `mintable` and `burnable` are FIXED at construction from the launcher's
 *    flags. They cannot be flipped later.
 *  - If BOTH flags are false, this contract is identical in guarantees to
 *    ChargeToken V1: no owner key, no mint, no burn — supply is fixed forever
 *    and Charge holds nothing.
 *  - `mint` only exists when `mintable` is true, and is guarded by `onlyOwner`.
 *    When `mintable` is false there is no privileged function at all.
 *  - `burn` only exists when `burnable` is true; it only burns the caller's
 *    own balance (self-service burn, not a privilege).
 *  - Solidity 0.8.24 has checked arithmetic, so no overflow/underflow paths.
 *  - transfer/transferFrom reject the zero address.
 *
 * This is intentionally small and dependency-free so the deployed bytecode is
 * fully readable on the Arc explorer.
 */
contract ChargeTokenV2 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    bool public immutable mintable;
    bool public immutable burnable;
    address public immutable owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    error ZeroAddress();
    error InsufficientBalance();
    error InsufficientAllowance();
    error EmptySupply();
    error NotMintable();
    error NotOwner();
    error NotBurnable();

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        bool mintable_,
        bool burnable_
    ) {
        if (totalSupply_ == 0) revert EmptySupply();

        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        totalSupply = totalSupply_;
        mintable = mintable_;
        burnable = burnable_;
        // When not mintable, `owner` is the zero address — there is no
        // privileged key in the contract at all.
        owner = mintable_ ? msg.sender : address(0);

        balanceOf[msg.sender] = totalSupply_;
        emit Transfer(address(0), msg.sender, totalSupply_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
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

    /// @notice Mint new supply. Only exists when `mintable` was set at deploy.
    function mint(address to, uint256 amount) external onlyOwner returns (bool) {
        if (!mintable) revert NotMintable();
        if (to == address(0)) revert ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
        return true;
    }

    /// @notice Burn your own tokens. Only exists when `burnable` was set.
    function burn(uint256 amount) external returns (bool) {
        if (!burnable) revert NotBurnable();
        return _burn(msg.sender, amount);
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

    function _burn(address from, uint256 amount) private returns (bool) {
        uint256 balance = balanceOf[from];
        if (balance < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = balance - amount;
            totalSupply -= amount;
        }
        emit Burn(from, amount);
        emit Transfer(from, address(0), amount);
        return true;
    }
}
