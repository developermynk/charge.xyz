"use client";

/**
 * Privy bridge.
 *
 * PROBLEM: Privy's hooks (`usePrivy`, `useWallets`) throw when `PrivyProvider`
 * is not mounted, and the provider only mounts when an app id is configured.
 * Calling them conditionally would break the rules of hooks.
 *
 * SOLUTION: two sibling components with fixed hook order — one that reads real
 * Privy state, one that returns an inert value — chosen once at mount. Both
 * publish the same context shape, so `useWallet` consumes a single interface
 * and never learns whether Privy exists.
 */

import { usePrivy, useWallets } from "@privy-io/react-auth";
import * as React from "react";

import { ARC_CHAIN_ID } from "@charge/chains";

import { isPrivyConfigured } from "./privy.ts";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

export interface PrivyBridgeState {
  available: boolean;
  address: `0x${string}` | undefined;
  chainId: number | undefined;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  switchToArc: () => Promise<void>;
  getProvider: () => Promise<Eip1193Provider | undefined>;
}

const INERT: PrivyBridgeState = {
  available: false,
  address: undefined,
  chainId: undefined,
  isLoading: false,
  login: () => {
    throw new Error(
      "Email login is unavailable: NEXT_PUBLIC_PRIVY_APP_ID is not configured.",
    );
  },
  logout: async () => {},
  switchToArc: async () => {},
  getProvider: async () => undefined,
};

const PrivyBridgeContext = React.createContext<PrivyBridgeState>(INERT);

/** Reads live Privy state. Only ever mounted inside <PrivyProvider>. */
function PrivyEnabled({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // The embedded wallet is the one Privy provisions for email/social users.
  const wallet = React.useMemo(
    () =>
      wallets.find((w) => w.walletClientType === "privy") ?? wallets[0],
    [wallets],
  );

  const address = (authenticated ? wallet?.address : undefined) as
    | `0x${string}`
    | undefined;

  const chainId = React.useMemo(() => {
    // Privy reports CAIP-2 ("eip155:5042002"); callers want the number.
    const raw = wallet?.chainId;
    if (!raw) return undefined;
    const numeric = Number(String(raw).split(":").pop());
    return Number.isFinite(numeric) ? numeric : undefined;
  }, [wallet?.chainId]);

  const getProvider = React.useCallback(async () => {
    if (!wallet) return undefined;
    return (await wallet.getEthereumProvider()) as Eip1193Provider;
  }, [wallet]);

  const switchToArc = React.useCallback(async () => {
    await wallet?.switchChain(ARC_CHAIN_ID);
  }, [wallet]);

  const value = React.useMemo<PrivyBridgeState>(
    () => ({
      available: true,
      address,
      chainId,
      isLoading: !ready,
      login,
      logout,
      switchToArc,
      getProvider,
    }),
    [address, chainId, ready, login, logout, switchToArc, getProvider],
  );

  return (
    <PrivyBridgeContext.Provider value={value}>
      {children}
    </PrivyBridgeContext.Provider>
  );
}

function PrivyDisabled({ children }: { children: React.ReactNode }) {
  return (
    <PrivyBridgeContext.Provider value={INERT}>
      {children}
    </PrivyBridgeContext.Provider>
  );
}

/**
 * Chooses the implementation once. `isPrivyConfigured()` reads a build-time
 * env var, so the branch is stable for the lifetime of the app and hook order
 * can never change between renders.
 */
export function PrivyBridgeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return isPrivyConfigured() ? (
    <PrivyEnabled>{children}</PrivyEnabled>
  ) : (
    <PrivyDisabled>{children}</PrivyDisabled>
  );
}

export function usePrivyBridge(): PrivyBridgeState {
  return React.useContext(PrivyBridgeContext);
}
