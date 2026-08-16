// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/token/ERC20/IERC20.sol";

import { Launchpad } from "../src/Launchpad.sol";
import { Factory } from "../src/Factory.sol";
import { FeeManager } from "../src/FeeManager.sol";
import { Treasury } from "../src/Treasury.sol";
import { LiquidityManager } from "../src/LiquidityManager.sol";
import { Router } from "../src/Router.sol";
import { MockUSDC } from "./Mocks.t.sol";
import { MockAMMRouter } from "./Mocks.t.sol";

contract LaunchpadTest is Test {
    Launchpad launchpad;
    Factory factory;
    FeeManager feeMgr;
    Treasury treasury;
    LiquidityManager liq;
    Router router;
    MockUSDC usdc;
    MockAMMRouter amm;

    address owner = address(0x0A);
    address creator = address(0x0B);
    address trader = address(0x0C);

    uint256 constant SUPPLY = 1_000_000_000e18; // 1B, realistic

    event Bought(address indexed token, address indexed trader, uint256 usdIn, uint256 tokenOut, uint256 priceUsd);
    event Sold(address indexed token, address indexed trader, uint256 tokenIn, uint256 usdOut, uint256 priceUsd);
    event Graduated(address indexed token, uint256 usdcToPool, uint256 tokensToPool);
    event TokenCreated(address indexed token, address indexed creator, string name_, string symbol_, uint256 totalSupply, uint8 curveType, string metaHash);

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC();
        feeMgr = new FeeManager(100, 0); // 1% platform, 0 creator
        treasury = new Treasury();
        factory = new Factory();
        amm = new MockAMMRouter();
        // placeholder liq so Launchpad can be constructed; re-point after.
        liq = new LiquidityManager(address(0), address(amm), address(usdc), address(treasury));
        launchpad = new Launchpad(address(usdc), address(factory), address(feeMgr), address(treasury), address(liq));
        // now build the real LiquidityManager bound to this launchpad
        liq = new LiquidityManager(address(launchpad), address(amm), address(usdc), address(treasury));
        launchpad.setLiquidityManager(address(liq));
        router = new Router(address(launchpad));
        vm.stopPrank();

        // fund users (trader needs enough to push the curve to graduation)
        usdc.mint(creator, 1_000_000e18);
        usdc.mint(trader, 10_000_000e18);
    }

    function _create() internal returns (address token) {
        vm.prank(creator);
        token = router.createToken("Test", "TST", SUPPLY, 0, "ipfs://meta");
    }

    /// @notice Arc-native push: deal native USDC to the Launchpad (on Arc, native USDC
    ///         is the gas token; in tests we vm.deal native ETH to mirror it). Arc blocks
    ///         contract-pulled ERC-20 transferFrom for fresh contracts, so the trader
    ///         pushes USDC and the Launchpad credits it.
    function _fundLaunchpad(address who, uint256 amt6) internal {
        vm.deal(address(launchpad), launchpad.usdcBalance() + amt6 * 1e12);
    }

    function _approveToken(address who, address token, uint256 amt) internal {
        vm.prank(who);
        IERC20(token).approve(address(launchpad), amt);
    }

    // ── Create ────────────────────────────────────────────────────────────
    function test_CreateEmitsAndRegisters() public {
        address token = _create();
        assertTrue(token != address(0));
        assertEq(launchpad.creatorOf(token), creator);
        assertFalse(launchpad.isGraduated(token));
        assertGt(launchpad.getPrice(token), 0);
    }

    function test_CreateRevertsZeroSupply() public {
        vm.prank(creator);
        vm.expectRevert();
        router.createToken("X", "X", 0, 0, "");
    }

    // ── Buy ───────────────────────────────────────────────────────────────
    function test_BuySendsTokensAndEmits() public {
        address token = _create();
        _fundLaunchpad(trader, 100e6);
        vm.prank(trader);
        uint256 out = router.buy(token, 100e6, 0);
        assertGt(out, 0);
        assertEq(IERC20(token).balanceOf(trader), out);
        assertGt(launchpad.getPrice(token), 0);
        assertGt(launchpad.getMarketCap(token), 0);
    }

    function test_BuyMinOutReverts() public {
        address token = _create();
        _fundLaunchpad(trader, 100e6);
        vm.prank(trader);
        vm.expectRevert();
        router.buy(token, 100e6, type(uint256).max); // impossible min
    }

    function test_SellReturnsUsdc() public {
        address token = _create();
        _fundLaunchpad(trader, 100e6);
        vm.prank(trader);
        uint256 out = router.buy(token, 100e6, 0);
        vm.prank(trader);
        IERC20(token).approve(address(launchpad), out);
        uint256 usdcBefore = usdc.balanceOf(trader);
        vm.prank(trader);
        uint256 usdOut = router.sell(token, out, 0);
        assertGt(usdOut, 0);
        // Round-trip through a constant-product curve + 1% fee is not symmetric:
        // seller receives slightly less than paid. Assert no negative value and
        // that the fee/slippage stayed within reason (< 5% of input).
        assertLe(usdOut, 100e6);
        assertGe(usdOut, 95e6);
    }

    function test_PriceRisesAfterBuy() public {
        address token = _create();
        uint256 p0 = launchpad.getPrice(token);
        _fundLaunchpad(trader, 5000e6);
        vm.prank(trader);
        router.buy(token, 5000e6, 0);
        uint256 p1 = launchpad.getPrice(token);
        assertGt(p1, p0); // constant-product: buying raises price
    }

    // ── Graduation ────────────────────────────────────────────────────────
    function test_GraduateOnSellout() public {
        address token = _create();
        uint256 forSale = (SUPPLY * 8000) / 10000; // 80%
        // buy enough USDC to sell out the curve. Approximate: keep buying.
        _fundLaunchpad(trader, 10_000_000e6);
        // Buy ~1000 USDC chunks until the curve sells out and graduates.
        bool graduated = false;
        for (uint i = 0; i < 50 && !graduated; i++) {
            vm.prank(trader);
            try router.buy(token, 1000e6, 0) { graduated = launchpad.isGraduated(token); } catch { break; }
            graduated = launchpad.isGraduated(token);
        }
        assertTrue(graduated, "should graduate after curve sells out");
        // after graduation, buying should revert
        vm.prank(trader);
        vm.expectRevert();
        router.buy(token, 10e6, 0);
    }

    // ── Access / pause ─────────────────────────────────────────────────────
    function test_PauseBlocksTrading() public {
        address token = _create();
        vm.prank(owner);
        launchpad.pause();
        _fundLaunchpad(trader, 100e6);
        vm.prank(trader);
        vm.expectRevert();
        router.buy(token, 100e6, 0);
    }

    function test_OnlyOwnerPause() public {
        vm.prank(trader);
        vm.expectRevert();
        launchpad.pause();
    }

    function test_FeeCollectedToTreasury() public {
        address token = _create();
        _fundLaunchpad(trader, 100e6);
        vm.prank(trader);
        router.buy(token, 100e6, 0);
        // 1% fee of 100 USDC = 1 USDC to treasury (native USDC on Arc)
        assertEq(address(treasury).balance, 1e18);
    }

    // ── Fuzz ────────────────────────────────────────────────────────────────
    function testFuzz_BuyOutputPositive(uint256 usdIn) public {
        usdIn = bound(usdIn, 1e6, 1000e6); // 1-1000 USDC, well under graduation raise
        address token = _create();
        _fundLaunchpad(trader, usdIn);
        vm.prank(trader);
        uint256 out = router.buy(token, usdIn, 0);
        assertGt(out, 0);
        assertLe(out, (SUPPLY * 8000) / 10000);
    }

    function testFuzz_PriceMonotonic(uint256 a, uint256 b) public {
        a = bound(a, 1e6, 1000e6); // 1-1000 USDC each
        b = bound(b, 1e6, 1000e6);
        address token = _create();
        _fundLaunchpad(trader, a + b);
        uint256 p0 = launchpad.getPrice(token);
        vm.prank(trader); router.buy(token, a, 0);
        uint256 p1 = launchpad.getPrice(token);
        // second buy may graduate the curve; if so, price is final and still >= p1
        vm.prank(trader);
        try router.buy(token, b, 0) {} catch { assertTrue(launchpad.isGraduated(token)); }
        uint256 p2 = launchpad.getPrice(token);
        assertGe(p1, p0);
        assertGe(p2, p1);
    }
}
