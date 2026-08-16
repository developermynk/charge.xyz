// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICurve — pluggable pricing curve interface.
/// @notice A curve maps virtual reserves to a price and computes buy/sell
///         amounts. New curve types (linear, exponential, CPMM) can be added
///         without touching the Launchpad — they only implement this surface.
interface ICurve {
    /// @notice Quote token output for a buy of `usdIn` (6dp) against reserves.
    function quoteBuy(
        uint256 virtualUsd,
        uint256 virtualTokens,
        uint256 usdIn
    ) external pure returns (uint256 tokensOut);

    /// @notice Quote USDC output (6dp) for a sell of `tokenIn` (18dp) against reserves.
    function quoteSell(
        uint256 virtualUsd,
        uint256 virtualTokens,
        uint256 tokenIn
    ) external pure returns (uint256 usdOut);
}

/// @title BondingCurve — constant-product virtual-reserves curve (Pump.fun style).
/// @notice Reserves are "virtual": they include phantom liquidity so the first
///         buyers get a real but gently-rising price. All math is pure and
///         overflow-safe (Solidity 0.8.24 checked arithmetic).
library BondingCurve {
    error CurveUnderflow();

    /// @notice Constant-product buy: tokensOut = netUsd * vT / (vU + netUsd)
    /// @dev `netUsd` is the post-fee USDC amount.
    function buyOut(
        uint256 virtualUsd,
        uint256 virtualTokens,
        uint256 netUsd
    ) internal pure returns (uint256 tokensOut) {
        // vT * netUsd can be large; operate in 256-bit.
        tokensOut = (virtualTokens * netUsd) / (virtualUsd + netUsd);
    }

    /// @notice Constant-product sell: usdOut = tokenIn * vU / (vT + tokenIn)
    function sellOut(
        uint256 virtualUsd,
        uint256 virtualTokens,
        uint256 tokenIn
    ) internal pure returns (uint256 usdOut) {
        usdOut = (virtualUsd * tokenIn) / (virtualTokens + tokenIn);
    }

    /// @notice Spot price in USDC (6dp) per token (18dp).
    ///         price = virtualUsd(6dp) / virtualTokens(18dp) * 1e18 → 6dp units.
    function price(
        uint256 virtualUsd,
        uint256 virtualTokens
    ) internal pure returns (uint256 usdPerToken) {
        if (virtualTokens == 0) revert CurveUnderflow();
        usdPerToken = (virtualUsd * 1e18) / virtualTokens;
    }

    /// @notice Market cap (6dp USDC) = price * total supply (18dp).
    function marketCap(
        uint256 virtualUsd,
        uint256 virtualTokens,
        uint256 totalSupply
    ) internal pure returns (uint256) {
        // price(6dp) * totalSupply(18dp) / 1e18 -> 6dp
        return (price(virtualUsd, virtualTokens) * totalSupply) / 1e18;
    }
}

/// @title LinearCurve — linear pricing, also pluggable.
/// @notice price increases linearly with tokens sold. Kept as a reference
///         alternative curve; selected per-token at create time.
library LinearCurve {
    function buyOut(
        uint256 /*virtualUsd*/,
        uint256 /*virtualTokens*/,
        uint256 /*netUsd*/
    ) internal pure returns (uint256) {
        // Linear placeholder; real launchpad uses BondingCurve by default.
        return 0;
    }

    function sellOut(
        uint256 /*virtualUsd*/,
        uint256 /*virtualTokens*/,
        uint256 /*tokenIn*/
    ) internal pure returns (uint256) {
        return 0;
    }
}
