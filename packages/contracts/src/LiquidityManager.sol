// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/token/ERC20/utils/SafeERC20.sol";

/// @title LiquidityManager — graduates a bonding-curve token to the Arc AMM.
/// @notice On graduation the Launchpad forwards its remaining tokens + all
///         collected native USDC here, and this contract seeds a real
///         Uniswap-V2 pool on the Arc AMM via `addLiquidity`. On Arc, native
///         USDC and the ERC-20 USDC interface share the same balance, so the
///         router pulls the ERC-20 USDC it needs. LP tokens are sent to the
///         Treasury and (by policy) burned/locked. Only the Launchpad may trigger.
contract LiquidityManager is Ownable {
    using SafeERC20 for IERC20;

    address public immutable launchpad;
    address public immutable ammRouter;
    address public immutable usdc;
    address public immutable treasury;

    event Graduated(
        address indexed token,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256 liquidity
    );
    event MigrationFailed(address indexed token, string reason);

    constructor(
        address launchpad_,
        address ammRouter_,
        address usdc_,
        address treasury_
    ) Ownable(msg.sender) {
        launchpad = launchpad_;
        ammRouter = ammRouter_;
        usdc = usdc_;
        treasury = treasury_;
    }

    /// @notice Accept the native USDC forwarded by the Launchpad on graduation.
    receive() external payable {}

    /// @notice Migrate a token's collected USDC + remaining supply into a live
    ///         AMM pool. Called by the Launchpad on graduation (forwards native USDC).
    /// @param token the launch token (already approved to this contract)
    /// @param tokenAmount amount of token to pair
    /// @param usdcAmount amount of USDC to pair (18dp native forwarded as msg.value)
    /// @param amountTokenMin / amountUsdcMin slippage bounds
    /// @param deadline AMM deadline
    function migrate(
        address token,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256 amountTokenMin,
        uint256 amountUsdcMin,
        uint256 deadline
    ) external payable returns (uint256 liquidity) {
        if (msg.sender != launchpad) revert("LiquidityManager: not launchpad");

        // USDC arrives as native value; the ERC-20 interface shares the balance,
        // so the router can pull it via transferFrom (router is a known contract).
        require(msg.value == usdcAmount, "LiquidityManager: usdc mismatch");

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        IERC20(usdc).forceApprove(ammRouter, usdcAmount);
        IERC20(token).forceApprove(ammRouter, tokenAmount);

        // addLiquidity(token, usdc, ..., to=treasury)
        try IAMMRouter(ammRouter).addLiquidity(
            token,
            usdc,
            tokenAmount,
            usdcAmount,
            amountTokenMin,
            amountUsdcMin,
            treasury,
            deadline
        ) returns (uint256, uint256, uint256 liq) {
            liquidity = liq;
            emit Graduated(token, tokenAmount, usdcAmount, liquidity);
        } catch (bytes memory reason) {
            // On Arc testnet the ERC-20 transferFrom into a fresh contract can
            // be blocked; surface the failure instead of reverting the whole graduation.
            emit MigrationFailed(token, string(reason));
        }
    }

    /// @notice Burn/lock LP by sending it to the zero address (Pump.fun style).
    function burnLP(address lpToken, uint256 amount) external onlyOwner {
        IERC20(lpToken).safeTransfer(address(0), amount);
    }
}

/// @dev Minimal Arc AMM router interface (Uniswap V2 style).
interface IAMMRouter {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
}
