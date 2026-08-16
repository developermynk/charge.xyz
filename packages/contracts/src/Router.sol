// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Launchpad } from "./Launchpad.sol";
import { BondingCurve } from "./BondingCurve.sol";

/// @title Router — public entry point for the launchpad.
/// @notice Users trade through this contract, never the token directly.
///         It proxies to the Launchpad and exposes read-only quotes so the
///         frontend can preview amounts before signing.
contract Router {
    Launchpad public immutable launchpad;

    constructor(address launchpad_) {
        launchpad = Launchpad(launchpad_);
    }

    function createToken(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply,
        uint8 curveType,
        string calldata metaHash
    ) external returns (address token) {
        return launchpad.createTokenFor(name_, symbol_, totalSupply, curveType, metaHash, msg.sender);
    }

    function buy(address token, uint256 usdIn, uint256 minTokensOut) external returns (uint256) {
        return launchpad.buyFor(token, usdIn, minTokensOut, msg.sender);
    }

    function sell(address token, uint256 tokenIn, uint256 minUsdOut) external returns (uint256) {
        return launchpad.sellFor(token, tokenIn, minUsdOut, msg.sender);
    }

    // ── Read-only quotes ──────────────────────────────────────────────────────
    function quoteBuy(address token, uint256 usdIn) external view returns (uint256 tokenOut) {
        // mirrors Launchpad math without state changes
        (uint256 vU, uint256 vT, uint256 feeBps, bool graduated) = launchpad.curveView(token);
        if (graduated) return 0;
        uint256 fee = (usdIn * feeBps) / 10000;
        return BondingCurve.buyOut(vU, vT, usdIn - fee);
    }

    function quoteSell(address token, uint256 tokenIn) external view returns (uint256 usdOut) {
        (uint256 vU, uint256 vT, uint256 feeBps, bool graduated) = launchpad.curveView(token);
        if (graduated) return 0;
        uint256 gross = BondingCurve.sellOut(vU, vT, tokenIn);
        return gross - (gross * feeBps) / 10000;
    }
}
