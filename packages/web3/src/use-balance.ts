"use client";

/**
 * Per-chain balances.
 *
 * Returns the native balance for any supported EVM chain, plus the USDC
 * ERC-20 where a known contract address exists (Arc today; more chains as the
 * token registry grows). Arc is special-cased to ALSO surface the USDC-as-gas
 * split (native 18dp vs ERC-20 6dp) because on Arc those are the same economic
 * asset exposed two ways — the most confusing state in the app, so it stays
 * explicit.
 */

import * as React from "react";
import { erc20Abi } from "viem";
import { useBalance, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useQuery } from "@tanstack/react-query";

import {
  ARC_CHAIN_ID,
  ARC_ERC20_DECIMALS,
  ARC_NATIVE_DECIMALS,
  ARC_TOKENS,
  isArcChain,
  publicClientForChain,
  type TokenMeta,
} from "@charge/chains";

export interface ChainBalance {
  /** Native gas token balance, formatted. */
  nativeFormatted: string;
  nativeRaw: bigint;
  nativeSymbol: string;
  /** USDC ERC-20 balance (6dp on Arc, chain-default elsewhere), formatted. */
  usdcFormatted: string | null;
  usdcRaw: bigint | null;
  /** True on Arc — the gas asset IS USDC, so we expose it as a second view. */
  isArc: boolean;
  isLoading: boolean;
  rpcError: boolean;
  refetch: () => void;
}

/**
 * @param chainId  numeric EVM chain id
 * @param address  account to read
 * @param usdcAddress  known USDC contract on this chain, if any
 */
export function useChainBalance({
  chainId,
  address,
  usdcAddress,
  sdkId,
}: {
  chainId: number;
  address: `0x${string}` | undefined;
  usdcAddress?: `0x${string}`;
  sdkId?: string;
}): ChainBalance {
  const isArc = isArcChain(chainId);
  const nativeDecimals = isArc ? ARC_NATIVE_DECIMALS : 18;

  const native = useBalance({
    address,
    chainId,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  // Read USDC via a viem public client built from the chain's own RPC, so the
  // balance shows even when the wallet is connected to a different chain.
  const publicClient = React.useMemo(
    () => (sdkId ? publicClientForChain(sdkId) : undefined),
    [sdkId],
  );
  const usdc = useQuery({
    queryKey: ["usdc-balance", chainId, address, usdcAddress],
    enabled: Boolean(address && usdcAddress && publicClient),
    queryFn: async () => {
      if (!address || !usdcAddress || !publicClient) return null;
      return (await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
    },
    refetchInterval: 15_000,
  });

  const refetch = React.useCallback(() => {
    void native.refetch();
    void usdc.refetch();
  }, [native, usdc]);

  const nativeRaw = native.data?.value ?? 0n;

  return {
    nativeRaw,
    nativeFormatted: formatUnits(nativeRaw, nativeDecimals),
    nativeSymbol: native.data?.symbol ?? (isArc ? "USDC" : "ETH"),
    usdcRaw: usdc.data != null ? (usdc.data as bigint) : null,
    usdcFormatted:
      usdc.data != null
        ? formatUnits(usdc.data as bigint, isArc ? ARC_ERC20_DECIMALS : 6)
        : null,
    isArc,
    isLoading: native.isLoading || usdc.isLoading,
    rpcError:
      (native.isError || usdc.isError) && !native.isLoading && !usdc.isLoading,
    refetch,
  };
}

/**
 * ERC-20 balance for an arbitrary token on an arbitrary chain.
 *
 * @param chainId   numeric EVM chain id
 * @param address   account to read
 * @param token     token contract + decimals (from `TOKEN_REGISTRY`)
 * @returns formatted balance string, or null when no contract is known
 */
export function useTokenBalance({
  chainId,
  address,
  token,
}: {
  chainId: number;
  address: `0x${string}` | undefined;
  token?: TokenMeta;
}): { balance: string | null; isLoading: boolean; refetch: () => void } {
  const erc = useReadContract({
    address: token?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: Boolean(address && token),
      refetchInterval: 15_000,
    },
  });

  return {
    balance:
      erc.data != null && token
        ? formatUnits(erc.data as bigint, token.decimals)
        : null,
    isLoading: erc.isLoading,
    refetch: erc.refetch,
  };
}

export { ARC_CHAIN_ID };

/**
 * Backward-compatible Arc-only helper. Existing panels (send/bridge/create)
 * that have not yet been upgraded to multi-chain keep calling this; it is a
 * thin wrapper over `useChainBalance` pinned to Arc. Arc always resolves USDC,
 * so we expose `usdcFormatted` as a plain `string` (defaulting to "0") to keep
 * the old panels' `string`-typed call sites compiling unchanged. v2 rewrites
 * these panels to fan out across chains and drops this shim.
 */
export function useArcBalance(address: `0x${string}` | undefined): Omit<ChainBalance, "usdcFormatted"> & { usdcFormatted: string } {
  const bal = useChainBalance({
    chainId: ARC_CHAIN_ID,
    address,
    usdcAddress: ARC_TOKENS.USDC,
  });
  return {
    ...bal,
    usdcFormatted: bal.usdcFormatted ?? "0",
  };
}

