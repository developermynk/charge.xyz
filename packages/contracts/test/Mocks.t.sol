// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/token/ERC20/ERC20.sol";

/// @notice Mock USDC (18 decimals) to mirror Arc's native USDC in local tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 18; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @notice Minimal mock Uniswap-V2 router so LiquidityManager.graduate works
///         on a local anvil (no real Arc AMM). It just records the pool.
contract MockAMMRouter {
    event AddLiquidity(address tokenA, address tokenB, uint256 a, uint256 b, uint256 liq);
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256, // amountAMin
        uint256, // amountBMin
        address to,
        uint256 // deadline
    ) external payable returns (uint256, uint256, uint256 liquidity) {
        // pull tokens (caller approved already)
        (bool ok1,) = tokenA.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amountADesired));
        (bool ok2,) = tokenB.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amountBDesired));
        require(ok1 && ok2, "mock addLiq pull failed");
        liquidity = amountADesired + amountBDesired;
        emit AddLiquidity(tokenA, tokenB, amountADesired, amountBDesired, liquidity);
    }
}
