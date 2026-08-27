"use client";

/**
 * Real on-chain history via each chain's Blockscout-style explorer REST API.
 *
 * Why this exists: viem getLogs over a 5k-block window only catches ERC-20
 * Transfer logs, and on Arc USDC is the NATIVE gas token so Sends emit NO log
 * at all — the page was structurally empty. Explorer APIs (keyless Blockscout
 * for Arc/Base-Sepolia/Arbitrum-Sepolia/OP-Sepolia/Eth-Sepolia) return the
 * real tx list for an address, including native-value transfers.
 *
 * Falls back silently: if an API is down or a chain has no explorer, we just
 * return [] and the page leans on the in-app record store instead.
 */

import { getAddress, isAddressEqual, type Hash } from "viem";

import { ALL_CHAIN_IDS, EVM_CHAIN_BY_ID } from "@charge/chains";

export interface ExplorerTx {
  hash: Hash;
  chainId: number;
  direction: "send" | "receive";
  counterparty: `0x${string}`;
  symbol: string;
  valueRaw: bigint;
  decimals: number;
  timestamp: string;
}

// Blockscout v2 REST base per chain. Avalanche Fuji uses a different host.
const EXPLORER_BASE: Record<number, string | undefined> = {
  5042002: "https://testnet.arcscan.app/api/v2",
  84532: "https://base-sepolia.blockscout.com/api/v2",
  421614: "https://arbitrum-sepolia.blockscout.com/api/v2",
  11155420: "https://optimism-sepolia.blockscout.com/api/v2",
  11155111: "https://eth-sepolia.blockscout.com/api/v2",
  // 43113 (Fuji) Blockscout public path differs; left undefined -> skip.
};

async function fetchOne(
  base: string,
  chainId: number,
  address: `0x${string}`,
): Promise<ExplorerTx[]> {
  const norm = address.toLowerCase();
  const url = `${base}/addresses/${norm}/transactions`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`explorer ${chainId} ${res.status}`);
  const json = (await res.json()) as { items?: RawTx[] };
  const def = EVM_CHAIN_BY_ID.get(chainId);
  const symbol = def?.nativeSymbol ?? "ETH";
  const decimals = chainId === 5042002 ? 6 : 18;
  const me = getAddress(address);

  return (json.items ?? []).map((tx) => {
    const from = getAddress(tx.from?.hash ?? address);
    const to = getAddress(tx.to?.hash ?? address);
    const isOut = isAddressEqual(from, me);
    return {
      hash: tx.hash as Hash,
      chainId,
      direction: isOut ? "send" : "receive",
      counterparty: isOut ? to : from,
      symbol,
      valueRaw: BigInt(tx.value ?? "0"),
      decimals,
      timestamp: tx.timestamp ?? tx.created_at ?? new Date().toISOString(),
    };
  });
}

interface RawTx {
  hash: string;
  value?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  timestamp?: string;
  created_at?: string;
}

/**
 * Fetch real transactions for `address` across every listed chain that has a
 * keyless explorer. Returns a flat, deduped list. Never throws — network/RPC
 * failures per chain are swallowed so one bad explorer can't blank the page.
 */
export async function fetchChainHistory(
  address: `0x${string}` | undefined,
): Promise<ExplorerTx[]> {
  if (!address) return [];
  const out: ExplorerTx[] = [];
  await Promise.all(
    ALL_CHAIN_IDS.map(async (chainId) => {
      const base = EXPLORER_BASE[chainId];
      if (!base) return;
      try {
        const txs = await fetchOne(base, chainId, address);
        out.push(...txs);
      } catch {
        // explorer unavailable — skip this chain.
      }
    }),
  );
  return out;
}
