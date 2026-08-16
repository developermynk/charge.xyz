// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";

import { Launchpad } from "../src/Launchpad.sol";
import { Factory } from "../src/Factory.sol";
import { FeeManager } from "../src/FeeManager.sol";
import { Treasury } from "../src/Treasury.sol";
import { LiquidityManager } from "../src/LiquidityManager.sol";
import { Router } from "../src/Router.sol";

/// @notice Deploys the full Charge launchpad protocol to Arc Testnet.
/// @dev Arc Testnet constants (verified against packages/chains/src/circle.ts):
///      USDC   = 0x3600000000000000000000000000000000000000 (ARC_TESTNET_USDC)
///      AMM    = 0xe27d5d256b370604f1ff060fb489c6a8e3f8a6d9 (ARC_AMM_ROUTER)
///      RPC    = https://rpc.testnet.arc.network/  (chainId 5042002)
contract DeployArcTestnet is Script {
    // Arc Testnet addresses.
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant AMM_ROUTER = 0xE27d5D256B370604F1Ff060fB489c6A8E3F8A6D9;

    function run() external {
        uint256 pk = vm.envUint("ARC_DEPLOYER_KEY");
        vm.startBroadcast(pk);

        // 1% platform fee, 0% creator fee at launch.
        FeeManager feeMgr = new FeeManager(100, 0);
        Treasury treasury = new Treasury();
        Factory factory = new Factory();

        // LiquidityManager needs the Launchpad address; deploy a placeholder
        // first, then point it at the real Launchpad after deployment.
        LiquidityManager liq = new LiquidityManager(address(0), AMM_ROUTER, USDC, address(treasury));
        Launchpad launchpad = new Launchpad(USDC, address(factory), address(feeMgr), address(treasury), address(liq));

        // Re-point LiquidityManager to the real Launchpad.
        liq = new LiquidityManager(address(launchpad), AMM_ROUTER, USDC, address(treasury));
        launchpad.setLiquidityManager(address(liq));

        Router router = new Router(address(launchpad));

        vm.stopBroadcast();

        console2.log("FeeManager", address(feeMgr));
        console2.log("Treasury", address(treasury));
        console2.log("Factory", address(factory));
        console2.log("LiquidityManager", address(liq));
        console2.log("Launchpad", address(launchpad));
        console2.log("Router", address(router));
    }
}
