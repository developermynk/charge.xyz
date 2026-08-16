// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20 } from "@openzeppelin/token/ERC20/IERC20.sol";

import { Router } from "../src/Router.sol";
import { Launchpad } from "../src/Launchpad.sol";

/// @notice End-to-end smoke test on Arc Testnet (Arc-native push model):
///         create token, push USDC, buy, check state, sell.
contract SmokeArcTestnet is Script {
    address constant ROUTER = 0xE6027493cBe753212555b1719edb611fB6A6C001;
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("ARC_DEPLOYER_KEY");
        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        Router router = Router(ROUTER);
        Launchpad lp = Launchpad(address(router.launchpad()));

        // 1) create a token
        address token = router.createToken("Smoke", "SMK", 1_000_000_000e18, 0, "ipfs://smoke");
        console2.log("Created token", token);
        console2.log("Creator", lp.creatorOf(token));

        // 2) Arc-native push: send USDC via the ERC-20 interface (6dp units) to the
        //    Launchpad. On Arc the ERC-20 and native balances are the same asset, so the
        //    Launchpad's native balance increases by usdIn*1e12 (18dp).
        uint256 usdIn = 5e6; // 5 USDC (6dp) — keep within funded balance
        IERC20(USDC).transfer(address(lp), usdIn);
        uint256 out = router.buy(token, usdIn, 0);
        console2.log("Bought tokens (18dp)", out);

        // 3) read state
        console2.log("Price (6dp)", lp.getPrice(token));
        console2.log("MarketCap (6dp)", lp.getMarketCap(token));
        console2.log("Volume/RealUsd (6dp)", lp.getVolume(token));
        console2.log("Graduated?", lp.isGraduated(token));
        console2.log("Launchpad native USDC (18dp)", address(lp).balance);
        console2.log("Treasury native USDC (18dp)", address(lp.treasury()).balance);

        // 4) sell half back
        IERC20(token).approve(address(lp), out / 2);
        uint256 usdOut = router.sell(token, out / 2, 0);
        console2.log("Sold half, got USDC (6dp)", usdOut);

        vm.stopBroadcast();
    }
}
