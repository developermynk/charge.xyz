"use client";

/**
 * Arc balances.
 *
 * Returns BOTH balances a user has on Arc, because they are genuinely
 * different things that happen to share a name:
 *   - native : the USDC-as-gas balance (18 decimals) that pays for transactions
 *   - erc20  : the USDC ERC-20 token balance (6 decimals) that gets swapped
 *
 * A user can hold plenty of one and none of the other, which is the most
 * confusing state in the whole app — so the UI always shows them separately.
 */

import * as React from "react";
import { erc20Abi } from "viem";
import { useBalance, useReadContract } from "wagmi";

import {
  ARC_CHAIN_ID,
  ARC_ERC20_DECIMALS,
  ARC_NATIVE_DECIMALS,
  ARC_TOKENS,
} from "@charge/chains";
import { formatUnits } from "viem";

export interface ArcBalance {
  /** USDC used as gas (18dp), formatted. */
  nativeFormatted: string;
  nativeRaw: bigint;
  /** USDC ERC-20 (6dp), formatted. */
  usdcFormatted: string;
  usdcRaw: bigint;
  isLoading: boolean;
  refetch: () => void;
}

export function useArcBalance(address: `0x${string}` | undefined): ArcBalance {
  const native = useBalance({
    address,
    chainId: ARC_CHAIN_ID,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const usdc = useReadContract({
    address: ARC_TOKENS.USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const refetch = React.useCallback(() => {
    void native.refetch();
    void usdc.refetch();
  }, [native, usdc]);

  const nativeRaw = native.data?.value ?? 0n;
  const usdcRaw = (usdc.data as bigint | undefined) ?? 0n;

  return {
    nativeRaw,
    nativeFormatted: formatUnits(nativeRaw, ARC_NATIVE_DECIMALS),
    usdcRaw,
    usdcFormatted: formatUnits(usdcRaw, ARC_ERC20_DECIMALS),
    isLoading: native.isLoading || usdc.isLoading,
    refetch,
  };
}
