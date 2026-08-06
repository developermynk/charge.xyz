// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChargeToken} from "../src/ChargeToken.sol";

/**
 * These tests exist to prove the security claims made in the contract's
 * NatSpec, not just assert happy-path behaviour. Each one corresponds to a
 * line item from the CSO review.
 */
contract ChargeTokenTest is Test {
    ChargeToken internal token;
    address internal deployer = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant SUPPLY = 1_000_000e18;

    function setUp() public {
        token = new ChargeToken("Charge Test", "CTST", 18, SUPPLY);
    }

    /* ── Supply ownership: the deployer gets everything, the app gets nothing ── */

    function test_deployerReceivesEntireSupply() public view {
        assertEq(token.balanceOf(deployer), SUPPLY);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_metadataIsStored() public view {
        assertEq(token.name(), "Charge Test");
        assertEq(token.symbol(), "CTST");
        assertEq(token.decimals(), 18);
    }

    /* ── No inflation is possible ── */

    function test_totalSupplyIsImmutableAcrossTransfers() public {
        token.transfer(alice, 500e18);
        vm.prank(alice);
        token.transfer(bob, 250e18);
        assertEq(token.totalSupply(), SUPPLY, "supply must never change");
    }

    function test_zeroSupplyDeploymentReverts() public {
        vm.expectRevert(ChargeToken.EmptySupply.selector);
        new ChargeToken("Zero", "ZERO", 18, 0);
    }

    /* ── Transfers ── */

    function test_transferMovesBalance() public {
        token.transfer(alice, 100e18);
        assertEq(token.balanceOf(alice), 100e18);
        assertEq(token.balanceOf(deployer), SUPPLY - 100e18);
    }

    function test_transferBeyondBalanceReverts() public {
        vm.prank(alice);
        vm.expectRevert(ChargeToken.InsufficientBalance.selector);
        token.transfer(bob, 1);
    }

    function test_transferToZeroAddressReverts() public {
        vm.expectRevert(ChargeToken.ZeroAddress.selector);
        token.transfer(address(0), 1e18);
    }

    /* ── Allowances ── */

    function test_transferFromRespectsAllowance() public {
        token.approve(alice, 100e18);
        vm.prank(alice);
        token.transferFrom(deployer, bob, 60e18);

        assertEq(token.balanceOf(bob), 60e18);
        assertEq(token.allowance(deployer, alice), 40e18);
    }

    function test_transferFromWithoutAllowanceReverts() public {
        vm.prank(alice);
        vm.expectRevert(ChargeToken.InsufficientAllowance.selector);
        token.transferFrom(deployer, bob, 1);
    }

    function test_infiniteAllowanceIsNotDecremented() public {
        token.approve(alice, type(uint256).max);
        vm.prank(alice);
        token.transferFrom(deployer, bob, 1_000e18);
        assertEq(token.allowance(deployer, alice), type(uint256).max);
    }

    function test_approveZeroAddressReverts() public {
        vm.expectRevert(ChargeToken.ZeroAddress.selector);
        token.approve(address(0), 1e18);
    }

    /* ── Invariant-style fuzzing ── */

    function testFuzz_transferPreservesTotalSupply(uint256 amount) public {
        amount = bound(amount, 0, SUPPLY);
        token.transfer(alice, amount);
        assertEq(
            token.balanceOf(deployer) + token.balanceOf(alice),
            SUPPLY,
            "no value may be created or destroyed"
        );
    }

    function testFuzz_cannotOverdraw(uint256 amount) public {
        amount = bound(amount, SUPPLY + 1, type(uint256).max);
        vm.expectRevert(ChargeToken.InsufficientBalance.selector);
        token.transfer(alice, amount);
    }
}
