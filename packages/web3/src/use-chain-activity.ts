"use client";

/**
 * Per-chain transaction activity for a connected address.
 *
 * Strategy: read `Transfer` events (ERC-20 standard) via the chain's public
 * client `getLogs` over a recent block window, catching both outgoing
 * (from == address) and incoming (to == address) moves. This is the only
 * history source that works from this box (no Etherscan/Alchemy key, and the
 * network is IPv6-only so most public indexer APIs are unreachable).
 *
 * Degradation: if the RPC is unreachable (common for public L2/alt-L1 RPCs
 * from here), `rpcError` flips and the UI shows "Activity unavailable" instead
 * of error spam — matching the balance component's `—` treatment.
 *
 * Arc note: USDC on Arc is the native gas asset. A native-value transfer emits
 * NO ERC-20 Transfer log, so we ALSO scan all recent Transfer logs and treat
 * any that touch our address on a non-USDC-ERC-20 contract as a native USDC
 * move (best-effort within the lookback window).
 */

import * as React from "react";
import { getAddress, isAddressEqual, type Hash, type Log } from "viem";
import { usePublicClient } from "wagmi";

import { ARC_TOKENS, isArcChain } from "@charge/chains";

const LOOKBACK_BLOCKS = 5_000;

export interface ActivityItem {
  hash: Hash;
  /** "send" if the connected wallet is the sender, else "receive". */
  direction: "send" | "receive";
  /** Counterparty address. */
  counterparty: `0x${string}`;
  /** Human symbol — "USDC" on Arc (native gas), token symbol elsewhere. */
  symbol: string;
  /** Raw token amount (ERC-20) or native value, in token base units. */
  valueRaw: bigint;
  decimals: number;
}

export interface ChainActivity {
  items: ActivityItem[];
  isLoading: boolean;
  rpcError: boolean;
  refetch: () => void;
}

export function useChainActivity({
  chainId,
  address,
}: {
  chainId: number;
  address: `0x${string}` | undefined;
}): ChainActivity {
  const client = usePublicClient({ chainId });
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [rpcError, setRpcError] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!client || !address) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    setRpcError(false);
    try {
      const head = await client.getBlockNumber();
      const fromBlock =
        head > BigInt(LOOKBACK_BLOCKS) ? head - BigInt(LOOKBACK_BLOCKS) : 0n;
      const addr = getAddress(address);
      const isArc = isArcChain(chainId);
      const usdcContract = ARC_TOKENS.USDC;

      const collected = new Map<Hash, ActivityItem>();

      // 1) ERC-20 Transfer logs touching our address (token moves).
      const logs = await client.getLogs({
        fromBlock,
        toBlock: head,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
          ],
        },
        args: { from: addr, to: addr },
      });

      for (const log of logs as Log[]) {
        if (!log.transactionHash) continue;
        const args = (log as unknown as {
          args: { from: string; to: string; value: bigint };
        }).args;
        const fromA = getAddress(args.from as `0x${string}`);
        const toA = getAddress(args.to as `0x${string}`);
        const valueRaw = BigInt(args.value.toString());
        const isOut = isAddressEqual(fromA, addr);
        const direction: "send" | "receive" = isOut ? "send" : "receive";
        const counterparty = isOut ? toA : fromA;

        // On Arc, skip the USDC ERC-20 sentinel here — it is the native asset
        // and is handled as a value transfer below when present.
        const onUsdcContract = log.address
          ? isAddressEqual(log.address, usdcContract)
          : false;
        const symbol = isArc && onUsdcContract ? "USDC" : isArc ? "USDC" : "TOKEN";
        const decimals = isArc ? 6 : 18;

        collected.set(log.transactionHash, {
          hash: log.transactionHash,
          direction,
          counterparty,
          symbol,
          valueRaw,
          decimals,
        });

        void onUsdcContract;
      }

      // 2) Arc native-value transfers (no ERC-20 log). Scan all recent
      //    Transfer logs; any touching our address on a non-USDC contract with
      //    non-zero value is a native USDC move.
      if (isArc) {
        const nativeLogs = await client.getLogs({
          fromBlock,
          toBlock: head,
          event: {
            type: "event",
            name: "Transfer",
            inputs: [
              { name: "from", type: "address", indexed: true },
              { name: "to", type: "address", indexed: true },
              { name: "value", type: "uint256", indexed: false },
            ],
          },
        });
        for (const log of nativeLogs as Log[]) {
          if (!log.transactionHash) continue;
          if (collected.has(log.transactionHash)) continue;
          if (log.address && isAddressEqual(log.address, usdcContract)) continue;
          const args = (log as unknown as {
            args: { from: string; to: string; value: bigint };
          }).args;
          const fromA = getAddress(args.from as `0x${string}`);
          const toA = getAddress(args.to as `0x${string}`);
          if (!isAddressEqual(fromA, addr) && !isAddressEqual(toA, addr)) continue;
          const valueRaw = BigInt(args.value.toString());
          if (valueRaw === 0n) continue;
          collected.set(log.transactionHash, {
            hash: log.transactionHash,
            direction: isAddressEqual(fromA, addr) ? "send" : "receive",
            counterparty: isAddressEqual(fromA, addr) ? toA : fromA,
            symbol: "USDC",
            valueRaw,
            decimals: 6,
          });
        }
      }

      setItems(Array.from(collected.values()).slice(0, 25));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRpcError(/rpc|log|transport|network|fetch|timeout|exceeded/i.test(msg));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [client, address, chainId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { items, isLoading, rpcError, refetch: () => void load() };
}
