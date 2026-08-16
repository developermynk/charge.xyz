// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/token/ERC20/extensions/ERC20Permit.sol";
import { Ownable } from "@openzeppelin/access/Ownable.sol";

/// @title Token — Charge launchpad ERC-20.
/// @notice OpenZeppelin ERC20 with EIP-712 Permit support. The deployer
///         (the Launchpad) mints the full fixed supply at construction and
///         owns the contract so it can release tokens to buyers. No mint
///         function exists after construction → supply is fixed forever.
/// @dev Built with OpenZeppelin v5 contracts per the launchpad spec.
contract Token is ERC20, ERC20Permit, Ownable {
    uint8 private immutable _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        address owner_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) {
        _decimals = decimals_;
        _mint(owner_, totalSupply_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
