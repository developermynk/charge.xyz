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
 * The actual network fetch is done by the server route /api/history (see
 * apps/web/app/api/history/route.ts). Calling Blockscout directly from the
 * browser is blocked by CORS (no Access-Control-Allow-Origin), which is why
 * this hook now proxies through our own API instead.
 *
 * Falls back silently: if the API errors or a chain is skipped, we return []
 * and the page leans on the in-app record store instead.
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

interface ApiItem {
  hash: string;
  chainId: number;
  from: string;
  to: string;
  value: string;
  decimals: number;
  symbol: string;
  timestamp: string;
}

/**
 * Fetch real transactions for `address` across every listed chain that has a
 * keyless explorer. Returns a flat, deduped list. Never throws — network
 * failures are swallowed so one bad explorer can't blank the page.
 */
export async function fetchChainHistory(
  address: `0x${string}` | undefined,
): Promise<ExplorerTx[]> {
  if (!address) return [];
  const norm = address.toLowerCase();

  let items: ApiItem[] = [];
  try {
    const res = await fetch(`/api/history?addr=${norm}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: ApiItem[] };
    items = json.items ?? [];
  } catch {
    return [];
  }

  const me = getAddress(address);
  return items.map((tx) => {
    const from = getAddress(tx.from || address);
    const to = getAddress(tx.to || address);
    const isOut = isAddressEqual(from, me);
    const decimals = Number(tx.decimals ?? 18);
    const symbol = tx.symbol || EVM_CHAIN_BY_ID.get(tx.chainId)?.nativeSymbol || "ETH";
    return {
      hash: tx.hash as Hash,
      chainId: tx.chainId,
      direction: isOut ? "send" : "receive",
      counterparty: (isOut ? to : from) as `0x${string}`,
      symbol,
      valueRaw: BigInt(tx.value ?? "0"),
      decimals,
      timestamp: tx.timestamp,
    };
  });
}
