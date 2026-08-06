"use client";

/**
 * Unified wallet state.
 *
 * The app has two independent login paths that must present ONE interface to
 * every feature panel:
 *
 *   1. "Continue with email"  -> Privy -> embedded wallet
 *   2. "Continue with wallet" -> wagmi -> injected / WalletConnect
 *
 * Feature code must never branch on which path was used. It asks this hook for
 * an address, a chain, and an EIP-1193 provider, and gets the same shape either
 * way. That is what lets swap/bridge/transfer/create each have exactly one code
 * path instead of two.
 */

import * as React from "react";
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";

import { ARC_CHAIN_ID } from "@charge/chains";

import { usePrivyBridge, type Eip1193Provider } from "./privy-bridge.tsx";

export type AuthMethod = "email" | "wallet" | null;

export type { Eip1193Provider };

export interface WalletState {
  /** Active address, or undefined when signed out. */
  address: `0x${string}` | undefined;
  /** How the user signed in. */
  method: AuthMethod;
  isConnected: boolean;
  /** True while either provider is still resolving its session. */
  isLoading: boolean;
  /** Numeric chain id of the active connection. */
  chainId: number | undefined;
  /** True when connected to Arc Testnet. */
  isOnArc: boolean;
  /** Prompt the wallet to switch to Arc. */
  switchToArc: () => Promise<void>;
  /** Sign out of whichever path is active. */
  disconnect: () => Promise<void>;
  /** EIP-1193 provider for the active account — feeds the Circle adapters. */
  getProvider: () => Promise<Eip1193Provider | undefined>;
}

const WalletContext = React.createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } =
    useAccount();
  const wagmiChainId = useChainId();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const privy = usePrivyBridge();

  // A wagmi connection is an explicit user action, so it wins when both exist.
  const method: AuthMethod = wagmiConnected
    ? "wallet"
    : privy.address
      ? "email"
      : null;

  const address = (wagmiConnected ? wagmiAddress : privy.address) as
    | `0x${string}`
    | undefined;

  const chainId = method === "email" ? privy.chainId : wagmiChainId;

  const getProvider = React.useCallback(async () => {
    if (method === "wallet") {
      const provider = await connector?.getProvider?.();
      return provider as Eip1193Provider | undefined;
    }
    if (method === "email") return privy.getProvider();
    return undefined;
  }, [method, connector, privy]);

  const switchToArc = React.useCallback(async () => {
    if (method === "wallet") {
      await switchChainAsync({ chainId: ARC_CHAIN_ID });
      return;
    }
    if (method === "email") await privy.switchToArc();
  }, [method, switchChainAsync, privy]);

  const disconnect = React.useCallback(async () => {
    if (wagmiConnected) await disconnectAsync();
    if (privy.address) await privy.logout();
  }, [wagmiConnected, disconnectAsync, privy]);

  const value = React.useMemo<WalletState>(
    () => ({
      address,
      method,
      isConnected: Boolean(address),
      isLoading: privy.isLoading,
      chainId,
      isOnArc: chainId === ARC_CHAIN_ID,
      switchToArc,
      disconnect,
      getProvider,
    }),
    [address, method, privy.isLoading, chainId, switchToArc, disconnect, getProvider],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = React.useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside <WalletProvider>.");
  }
  return ctx;
}
