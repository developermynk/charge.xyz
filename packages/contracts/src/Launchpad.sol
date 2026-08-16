// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/access/Ownable.sol";
import { Pausable } from "@openzeppelin/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/utils/math/Math.sol";

import { BondingCurve } from "./BondingCurve.sol";
import { Factory } from "./Factory.sol";
import { FeeManager } from "./FeeManager.sol";
import { Treasury } from "./Treasury.sol";
import { LiquidityManager } from "./LiquidityManager.sol";

/// @title Launchpad — Charge bonding-curve token launchpad (Pump.fun style).
/// @notice Users create a token, buy/sell against an internal bonding curve
///         priced in USDC, and the token graduates to the Arc AMM once the
///         curve allocation sells out. Every trade emits events; the off-chain
///         indexer updates price/mcap/volume/holders in real time.
/// @dev Users never call the token directly — all flows go through here.
contract Launchpad is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ──────────────────────────────────────────────────────────
    uint8 public constant CURVE_CONSTANT_PRODUCT = 0;
    uint256 public constant USDC_DECIMALS = 1e6;
    uint256 public constant TOKEN_DECIMALS = 1e18;
    /// @dev Fraction of supply sold on the curve; the rest seeds the AMM pool.
    uint256 public constant CURVE_ALLOCATION_BPS = 8000; // 80%
    /// @dev Virtual reserve ratio sets the initial price. Larger = lower start.
    uint256 public constant VIRTUAL_TOKEN_MULTIPLIER = 4; // vT = 4x real allocation
    /// @dev Target initial price in USDC (6dp). 9 = 9e-6 USDC per token (≈30k USDC virtual reserve).
    uint256 public constant INITIAL_PRICE_USD = 9;

    // ── Dependencies ────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    Factory public immutable factory;
    FeeManager public feeManager;
    Treasury public treasury;
    LiquidityManager public liquidityManager;

    // ── Per-token curve state (packed for gas) ───────────────────────────────
    struct CurveState {
        uint128 virtualUsd; // USDC 6dp (virtual)
        uint128 virtualTokens; // token 18dp (virtual)
        uint128 realUsd; // USDC collected (real)
        uint128 realTokensSold; // tokens bought by users (real)
        uint128 tokensForSale; // curve allocation (18dp)
        uint128 totalSupply; // 18dp
        uint16 feeBps; // total fee bps at launch
        bool graduated;
    }

    mapping(address => CurveState) public curves;
    mapping(address => address) public creatorOf;
    mapping(address => uint256) public createdAt;
    /// @notice Running USDC (18dp native) the Launchpad has received net of sends.
    ///        Used to validate that a buy's USDC was actually pushed before crediting.
    uint256 public usdcBalance;
    /// @notice Cumulative native USDC forwarded to the Treasury as fees.
    uint256 public feesForwarded;

    // ── Events (indexer surface) ──────────────────────────────────────────────
    event Bought(
        address indexed token,
        address indexed trader,
        uint256 usdIn,
        uint256 tokenOut,
        uint256 priceUsd
    );
    event Sold(
        address indexed token,
        address indexed trader,
        uint256 tokenIn,
        uint256 usdOut,
        uint256 priceUsd
    );
    event PriceUpdated(address indexed token, uint256 priceUsd, uint256 marketCapUsd);
    event LiquidityAdded(address indexed token, uint256 usd, uint256 tokens);
    event LiquidityRemoved(address indexed token, uint256 usd, uint256 tokens);
    event Graduated(address indexed token, uint256 usdcToPool, uint256 tokensToPool);
    event FeesCollected(address indexed token, address indexed to, uint256 usd);
    event FeesUpdated(uint16 feeBps);

    error NotLaunched();
    error AlreadyGraduated();
    error NotGraduated();
    error InsufficientOutput();
    error InvalidParams();
    error UsdcNotReceived();

    constructor(
        address usdc_,
        address factory_,
        address feeManager_,
        address treasury_,
        address liquidityManager_
    ) Ownable(msg.sender) {
        usdc = IERC20(usdc_);
        factory = Factory(factory_);
        feeManager = FeeManager(feeManager_);
        treasury = Treasury(payable(treasury_));
        liquidityManager = LiquidityManager(payable(liquidityManager_));
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function setFeeManager(address m) external onlyOwner { feeManager = FeeManager(m); emit FeesUpdated(0); }
    function setTreasury(address t) external onlyOwner { treasury = Treasury(payable(t)); }
    function setLiquidityManager(address l) external onlyOwner { liquidityManager = LiquidityManager(payable(l)); }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── Create ─────────────────────────────────────────────────────────────
    /// @notice Deploy + register a token (called directly by the user).
    function createToken(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply,
        uint8 curveType,
        string calldata metaHash
    ) external whenNotPaused returns (address token) {
        return createTokenFor(name_, symbol_, totalSupply, curveType, metaHash, msg.sender);
    }

    /// @notice Deploy + register a token on behalf of `creator` (Router entry).
    function createTokenFor(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply,
        uint8 curveType,
        string calldata metaHash,
        address creator
    ) public whenNotPaused returns (address token) {
        if (totalSupply == 0) revert InvalidParams();
        if (curveType != CURVE_CONSTANT_PRODUCT) revert InvalidParams();

        token = factory.deployToken(
            creator, name_, symbol_, 18, totalSupply, curveType, metaHash
        );

        uint256 tokensForSale = (totalSupply * CURVE_ALLOCATION_BPS) / 10000;
        // Virtual reserves back a real initial price (INITIAL_PRICE_USD, 6dp).
        uint256 virtualTokens = tokensForSale * VIRTUAL_TOKEN_MULTIPLIER;
        uint256 virtualUsd = (INITIAL_PRICE_USD * virtualTokens) / 1e18; // 6dp

        curves[token] = CurveState({
            virtualUsd: uint128(virtualUsd),
            virtualTokens: uint128(virtualTokens),
            realUsd: 0,
            realTokensSold: 0,
            tokensForSale: uint128(tokensForSale),
            totalSupply: uint128(totalSupply),
            feeBps: uint16(feeManager.platformFeeBps() + feeManager.creatorFeeBps()),
            graduated: false
        });
        creatorOf[token] = creator;
        createdAt[token] = block.timestamp;

        emit LiquidityAdded(token, 0, tokensForSale);
        _emitPrice(token);
    }

    // ── Buy ────────────────────────────────────────────────────────────────
    /// @notice Buy `token` with `usdIn` USDC (must be pre-approved to Launchpad).
    function buy(address token, uint256 usdIn, uint256 minTokensOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 tokenOut)
    {
        return buyFor(token, usdIn, minTokensOut, msg.sender);
    }

    /// @notice Buy on behalf of `trader` (Router entry point).
    /// @dev Arc-native push model: the trader must FIRST `usdc.transfer(launchpad, usdIn*1e12)`
    ///       (EOA-initiated transfer works on Arc; contract-pulled transferFrom is blocked for
    ///       fresh contracts). This function then credits the already-received USDC.
    function buyFor(address token, uint256 usdIn, uint256 minTokensOut, address trader)
        public
        nonReentrant
        whenNotPaused
        returns (uint256 tokenOut)
    {
        CurveState storage c = _curve(token);
        if (c.graduated) revert AlreadyGraduated();

        // USDC must already be in the Launchpad (pushed by the trader, native on Arc).
        uint256 usdIn18 = usdIn * 1e12; // 6dp -> 18dp native
        uint256 expected = usdcBalance + usdIn18;
        if (address(this).balance + feesForwarded < expected) revert UsdcNotReceived();

        uint256 fee = (usdIn * c.feeBps) / 10000;
        uint256 net = usdIn - fee;

        tokenOut = BondingCurve.buyOut(c.virtualUsd, c.virtualTokens, net);
        uint256 remaining = c.tokensForSale - c.realTokensSold;
        if (tokenOut >= remaining) {
            // Final partial buy that lands exactly on the allocation.
            tokenOut = remaining;
            // Invert x*y=k: net = vU * dx / (vT - dx)
            net = (c.virtualUsd * tokenOut) / (c.virtualTokens - tokenOut);
            // gross USDC needed = net + fee; recompute fee off the new gross.
            usdIn = net + (net * c.feeBps) / (10000 - c.feeBps);
            fee = usdIn - net;
            usdIn18 = usdIn * 1e12;
            expected = usdcBalance + usdIn18;
            if (address(this).balance + feesForwarded < expected) revert UsdcNotReceived();
        }
        if (tokenOut < minTokensOut) revert InsufficientOutput();

        c.virtualUsd = uint128(c.virtualUsd + net);
        c.virtualTokens = uint128(c.virtualTokens - tokenOut);
        c.realUsd = uint128(c.realUsd + net);
        c.realTokensSold = uint128(c.realTokensSold + tokenOut);
        usdcBalance = expected;
        feesForwarded += fee * 1e12;

        // fee -> treasury (native USDC; Arc shares native/ERC20 balance)
        payable(address(treasury)).transfer(fee * 1e12);
        IERC20(token).safeTransfer(trader, tokenOut);

        emit Bought(token, trader, usdIn, tokenOut, _price(c));
        _emitPrice(token);

        if (c.realTokensSold >= c.tokensForSale) {
            _graduate(token);
        }
    }

    // ── Sell ───────────────────────────────────────────────────────────────
    function sell(address token, uint256 tokenIn, uint256 minUsdOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 usdOut)
    {
        return sellFor(token, tokenIn, minUsdOut, msg.sender);
    }

    /// @notice Sell on behalf of `trader` (Router entry point).
    function sellFor(address token, uint256 tokenIn, uint256 minUsdOut, address trader)
        public
        nonReentrant
        whenNotPaused
        returns (uint256 usdOut)
    {
        CurveState storage c = _curve(token);
        if (c.graduated) revert AlreadyGraduated();

        usdOut = BondingCurve.sellOut(c.virtualUsd, c.virtualTokens, tokenIn);
        uint256 fee = (usdOut * c.feeBps) / 10000;
        uint256 net = usdOut - fee;
        if (net < minUsdOut) revert InsufficientOutput();

        c.virtualUsd = uint128(c.virtualUsd - net);
        c.virtualTokens = uint128(c.virtualTokens + tokenIn);
        c.realUsd = uint128(c.realUsd - net);
        c.realTokensSold = uint128(c.realTokensSold - tokenIn);
        usdcBalance -= usdOut * 1e12; // gross USDC leaving the Launchpad
        feesForwarded += fee * 1e12;

        IERC20(token).safeTransferFrom(trader, address(this), tokenIn);
        // pay seller in native USDC (Arc: native->EOA works; contract-pull transferFrom is blocked)
        payable(trader).transfer(net * 1e12);
        // fee -> treasury (native USDC)
        payable(address(treasury)).transfer(fee * 1e12);

        emit Sold(token, trader, tokenIn, usdOut, _price(c));
        _emitPrice(token);
    }

    // ── Graduate ─────────────────────────────────────────────────────────────
    function _graduate(address token) internal {
        CurveState storage c = curves[token];
        if (c.graduated) return;
        c.graduated = true;

        // remaining tokens (supply - sold) + all collected real USDC -> AMM.
        uint256 tokensRemaining = c.totalSupply - c.realTokensSold;
        uint256 usdcToPool = address(this).balance; // native USDC actually held

        IERC20(token).forceApprove(address(liquidityManager), tokensRemaining);
        // Forward native USDC to the LiquidityManager; it migrates to the Arc AMM.
        liquidityManager.migrate{value: usdcToPool}(
            token, tokensRemaining, usdcToPool,
            (tokensRemaining * 99) / 100,
            (usdcToPool * 99) / 100,
            block.timestamp + 1200
        );
        emit Graduated(token, usdcToPool, tokensRemaining);
    }

    // ── Reads ────────────────────────────────────────────────────────────────
    function getPrice(address token) external view returns (uint256) { return _price(_curve(token)); }
    function getMarketCap(address token) external view returns (uint256) {
        CurveState storage c = _curve(token);
        return BondingCurve.marketCap(c.virtualUsd, c.virtualTokens, c.totalSupply);
    }
    function getLiquidity(address token) external view returns (uint256) {
        return _curve(token).realUsd;
    }
    function getVolume(address token) external view returns (uint256) {
        return _curve(token).realUsd; // cumulative bought USD ~ proxy volume
    }
    function isGraduated(address token) external view returns (bool) {
        return _curve(token).graduated;
    }

    /// @notice Read-only view of curve reserves for the Router's quotes.
    function curveView(address token)
        external
        view
        returns (uint256 virtualUsd, uint256 virtualTokens, uint256 feeBps, bool graduated)
    {
        CurveState storage c = _curve(token);
        return (c.virtualUsd, c.virtualTokens, c.feeBps, c.graduated);
    }

    // ── Internals ─────────────────────────────────────────────────────────────
    function _curve(address token) internal view returns (CurveState storage c) {
        c = curves[token];
        if (c.totalSupply == 0) revert NotLaunched();
    }
    function _price(CurveState storage c) internal view returns (uint256) {
        return BondingCurve.price(c.virtualUsd, c.virtualTokens);
    }
    function _emitPrice(address token) internal {
        CurveState storage c = curves[token];
        emit PriceUpdated(token, _price(c), BondingCurve.marketCap(c.virtualUsd, c.virtualTokens, c.totalSupply));
    }
}
