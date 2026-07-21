/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useState } from "react";
import { parseUnits, type Hex } from "viem";
import { useWalletClient, useAccount } from "wagmi";
import { custom, http, type Chain } from "viem";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

export type BridgeStatus = "idle" | "pending" | "success" | "error";

// CCTP bridges native USDC. Source is always Arc Testnet; destinations are
// other testnets we have a public RPC for.
export interface BridgeDestination {
  id: string; // e.g. "Base_Sepolia"
  name: string;
  rpcEnv: string; // env var name holding the public RPC URL
  explorer: string;
  faucetUrl?: string; // optional faucet for the destination testnet
}

// Static RPC map - Next.js replaces process.env.NEXT_PUBLIC_* at build time
// but dynamic access process.env[variable] doesn't work. Use static map.
const RPC_MAP: Record<string, string | undefined> = {
  Base_Sepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC,
  Arbitrum_Sepolia: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC,
  Optimism_Sepolia: process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC,
  Ethereum_Sepolia: process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC,
  Polygon_Amoy: process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC,
  Avalanche_Fuji: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC,
  Solana_Devnet: process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC,
};

export const BRIDGE_DESTINATIONS: BridgeDestination[] = [
  { id: "Base_Sepolia", name: "Base Sepolia", rpcEnv: "NEXT_PUBLIC_BASE_SEPOLIA_RPC", explorer: "https://sepolia.basescan.org", faucetUrl: "https://faucet.quicknode.com/base-sepolia" },
  { id: "Arbitrum_Sepolia", name: "Arbitrum Sepolia", rpcEnv: "NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC", explorer: "https://sepolia.arbiscan.io", faucetUrl: "https://faucet.quicknode.com/arbitrum-sepolia" },
  { id: "Optimism_Sepolia", name: "Optimism Sepolia", rpcEnv: "NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC", explorer: "https://sepolia-optimism.etherscan.io", faucetUrl: "https://faucet.quicknode.com/optimism-sepolia" },
  { id: "Ethereum_Sepolia", name: "Ethereum Sepolia", rpcEnv: "NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC", explorer: "https://sepolia.etherscan.io", faucetUrl: "https://sepoliafaucet.com" },
  { id: "Polygon_Amoy", name: "Polygon Amoy", rpcEnv: "NEXT_PUBLIC_POLYGON_AMOY_RPC", explorer: "https://amoy.polygonscan.com", faucetUrl: "https://faucet.polygon.technology" },
  { id: "Avalanche_Fuji", name: "Avalanche Fuji", rpcEnv: "NEXT_PUBLIC_AVALANCHE_FUJI_RPC", explorer: "https://testnet.snowtrace.io", faucetUrl: "https://faucet.avax.network" },
];

const SOURCE_CHAIN_NAME = "Arc_Testnet" as const;
const SOURCE_RPC = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || "https://rpc.testnet.arc.network";
const ARC_TESTNET_FAUCET = "https://faucet.arc.network";

/**
 * Real CCTP V2 bridge via Circle Bridge Kit.
 *
 * NOTE: Bridge Kit does NOT support Circle Modular Wallets (our Privy login
 * path). This only works for the "Continue with wallet" (injected) path, which
 * provides a standard viem EIP-1193 provider.
 */
export function useBridge() {
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useAccount();
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);

  const reset = () => {
    setStatus("idle");
    setError(null);
    setLinks([]);
  };

  const bridge = async (amount: string, destination: BridgeDestination) => {
    setError(null);
    setLinks([]);

    if (!walletClient) {
      setError("Connect an injected wallet (MetaMask etc.) via 'Continue with wallet' to bridge.");
      setStatus("error");
      return;
    }
    let value: bigint;
    try {
      value = parseUnits(amount || "0", 18); // Arc Testnet native USDC = 18 decimals
    } catch {
      setError("Enter a valid amount.");
      setStatus("error");
      return;
    }
    if (value <= 0n) {
      setError("Amount must be greater than 0.");
      setStatus("error");
      return;
    }

    const destRpc = RPC_MAP[destination.id];
    if (!destRpc) {
      setError(`No RPC configured for ${destination.name}. Set ${destination.rpcEnv} in .env.local.`);
      setStatus("error");
      return;
    }

    setStatus("pending");
    try {
      const provider = walletClient.transport as unknown as { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
      const adapter = await createViemAdapterFromProvider({
        provider: provider as never,
      });

      const kit = new BridgeKit();
      const result = await kit.bridge({
        from: { adapter, chain: SOURCE_CHAIN_NAME },
        to: { adapter, chain: destination.id as never },
        amount,
        config: { transferSpeed: "FAST" },
      });

      const txLinks = (result.steps ?? [])
        .filter((s) => (s as { txHash?: string }).txHash)
        .map((s) => ({
          label: (s as { name?: string }).name ?? "tx",
          url: `${(s as { explorerUrl?: string }).explorerUrl ?? ""}`,
        }));
      setLinks(txLinks);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge failed.");
      setStatus("error");
    }
  };

  return { bridge, reset, status, error, links, isConnected, sourceChain: SOURCE_CHAIN_NAME, sourceRpc: SOURCE_RPC, arcTestnetFaucet: ARC_TESTNET_FAUCET };
}
