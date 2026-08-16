// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/access/Ownable.sol";

/// @title FeeManager — configurable protocol fee percentages.
/// @notice Holds the platform fee (bps) charged on every trade and the
///         creator fee. Only the owner (protocol admin) can update them.
///         Fees are read by the Launchpad at trade time.
contract FeeManager is Ownable {
    /// @dev fee in basis points (10000 = 100%).
    uint16 public platformFeeBps;
    uint16 public creatorFeeBps;
    uint16 public constant MAX_FEE_BPS = 1000; // 10% hard cap

    event FeeUpdated(uint16 platformFeeBps, uint16 creatorFeeBps);

    constructor(uint16 platformFeeBps_, uint16 creatorFeeBps_) Ownable(msg.sender) {
        _setFees(platformFeeBps_, creatorFeeBps_);
    }

    function setFees(uint16 platformFeeBps_, uint16 creatorFeeBps_) external onlyOwner {
        _setFees(platformFeeBps_, creatorFeeBps_);
    }

    function _setFees(uint16 platformFeeBps_, uint16 creatorFeeBps_) private {
        if (platformFeeBps_ > MAX_FEE_BPS || creatorFeeBps_ > MAX_FEE_BPS) {
            revert("FeeManager: fee too high");
        }
        platformFeeBps = platformFeeBps_;
        creatorFeeBps = creatorFeeBps_;
        emit FeeUpdated(platformFeeBps_, creatorFeeBps_);
    }
}
