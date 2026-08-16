// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/access/Ownable.sol";

/// @title Treasury — holds protocol fees on Arc.
/// @notice On Arc, USDC is the native gas token, so fees arrive as native value.
///         The Treasury accepts native USDC and lets the owner withdraw it.
///         (Contract-pulled ERC-20 transferFrom is blocked for fresh contracts on
///         Arc testnet, so the Launchpad forwards fees as native value instead.)
contract Treasury is Ownable {
    event Withdrawn(address indexed to, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /// @notice Accept native USDC fees.
    receive() external payable {}

    /// @notice Owner withdraws collected native USDC.
    function withdraw(address to, uint256 amount) external onlyOwner {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Treasury: withdraw failed");
        emit Withdrawn(to, amount);
    }

    /// @notice Current native USDC balance.
    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}
