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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, OR ALL WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied, see the License for
 * specific language governing permissions and limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { type Address, type Hex, encodeFunctionData, custom } from "viem";
import { createWalletClient, type WalletClient } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
} from "wagmi";
import {
  walletClientToLocalAccount,
  toCircleSmartAccount,
  toModularTransport,
} from "@circle-fin/modular-wallets-core";
import {
  getCirclePublicClient,
  isCircleConfigured,
  estimateUserOpFees,
} from "./circle";
import { arcTestnet } from "./wagmi";
import {
  usePrivy,
  useWallets,
  getEmbeddedConnectedWallet,
  type ConnectedWallet,
} from "@privy-io/react-auth";
import { isPrivyConfigured } from "./privy";

export type WalletType = "metamask" | "circle" | null;

interface CircleBundlerClient {
  sendUserOperation: (args: {
    calls: { to: Hex; data: Hex; value?: bigint }[];
    paymaster: true;
  }) => Promise<Hex>;
  waitForUserOperationReceipt: (args: { hash: Hex }) => Promise<{ receipt: { transactionHash: Hex } }>;
}

interface WalletContextValue {
  address: Address | undefined;
  isConnected: boolean;
  isInitializing: boolean;
  walletType: WalletType;
  bundlerClient: CircleBundlerClient | null;
  connectMetaMask: (connectorId?: string) => void;
  connectPrivy: () => void;
  privyConfigured: boolean;
  disconnect: () => void;
  isConnecting: boolean;
  circleError: string | null;
  walletError: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // Wagmi (injected wallet) state
  const {
    address: wagmiAddress,
    isConnected: wagmiConnected,
    status: wagmiStatus,
  } = useConnection();
  const { mutate: wagmiConnect, isPending: wagmiPending, error: wagmiError } = useConnect();
  const connectors = useConnectors();
  const { mutateAsync: wagmiDisconnect } = useDisconnect();

  // Privy (login + create account) state — only usable when the PrivyProvider
  // is mounted (i.e. an app id is configured). We keep the hooks behind that
  // gate so WalletContext never calls them outside the provider (which would
  // throw during prerender when no app id env var is present).
  const privyEnabled = isPrivyConfigured();
  const { authenticated, logout, login, ready: privyReady } = privyEnabled
    ? usePrivy()
    : { authenticated: false, logout: async () => {}, login: () => {}, ready: true };
  const { wallets } = privyEnabled
    ? useWallets()
    : { wallets: [] as ConnectedWallet[] };
  const embeddedWallet: ConnectedWallet | null = privyEnabled
    ? getEmbeddedConnectedWallet(wallets)
    : null;

  // Circle (modular smart account) state
  const [circleAddress, setCircleAddress] = useState<Address | undefined>();
  const [bundlerClient, setBundlerClient] = useState<CircleBundlerClient | null>(null);
  const [circleConnecting, setCircleConnecting] = useState(false);
  const [circleError, setCircleError] = useState<string | null>(null);
  // Errors from picking a wallet in the modal (e.g. a connector that isn't
  // registered), kept separate from wagmi's own connection error.
  const [connectError, setConnectError] = useState<string | null>(null);

  // Determine active wallet: injected wallet takes precedence, otherwise the
  // Circle smart account (if one has been provisioned from Privy login).
  const walletType: WalletType = wagmiConnected
    ? "metamask"
    : circleAddress
      ? "circle"
      : null;

  const address = walletType === "metamask" ? wagmiAddress : circleAddress;
  const isConnected = walletType !== null;

  // True while a persisted session is still being restored: wagmi is
  // auto-reconnecting an injected wallet, Privy is bootstrapping, or the Circle
  // smart account is being provisioned from the embedded wallet. The dashboard
  // guard waits on this so a returning user is never redirected out of the app
  // during the brief reconnect window on first mount.
  const isInitializing =
    !isConnected &&
    (wagmiStatus === "reconnecting" ||
      circleConnecting ||
      (privyEnabled && !privyReady));

  const buildCircleAccount = useCallback(
    async (ethereumProvider: unknown, ownerAddress: Address) => {
      const walletClient = createWalletClient({
        account: ownerAddress,
        chain: arcTestnet,
        transport: custom(ethereumProvider as Parameters<typeof custom>[0]),
      }) as unknown as WalletClient;

      const owner = walletClientToLocalAccount(walletClient);

      const smartAccount = await toCircleSmartAccount({
        client: getCirclePublicClient(),
        owner,
      });

      const client = createBundlerClient({
        account: smartAccount,
        chain: arcTestnet,
        transport: toModularTransport(`${process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL}/arcTestnet`, process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY ?? ""),
        paymaster: true,
        userOperation: {
          estimateFeesPerGas: estimateUserOpFees,
        },
      });

      setCircleAddress(smartAccount.address);
      setBundlerClient(client as unknown as CircleBundlerClient);
    },
    [],
  );

  // Provision the Circle smart account from the Privy embedded wallet once the
  // user is authenticated. Privy persists the embedded wallet across reloads,
  // so this effect also restores the session on mount.
  useEffect(() => {
    if (!authenticated || !embeddedWallet) return;
    // Only the embedded wallet acts as the smart-account owner; external
    // wallets connected through Privy use wagmi elsewhere.
    if (embeddedWallet.walletClientType !== "privy") return;
    if (!isCircleConfigured()) return;

    let cancelled = false;
    setCircleConnecting(true);
    setCircleError(null);
    (async () => {
      try {
        const provider = await embeddedWallet.getEthereumProvider();
        if (cancelled) return;
        await buildCircleAccount(provider, embeddedWallet.address as Address);
      } catch (err) {
        if (cancelled) return;
        console.error("Circle wallet provisioning failed:", err);
        setCircleError(
          err instanceof Error ? err.message : "Failed to provision Circle wallet",
        );
      } finally {
        if (!cancelled) setCircleConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, embeddedWallet, buildCircleAccount]);

  // Opens the Privy login / create-account modal. WalletContext then provisions
  // the Circle smart account from the embedded wallet (see the effect above).
  const connectPrivy = useCallback(() => {
    if (!privyEnabled) {
      setCircleError(
        "Privy login is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local.",
      );
      return;
    }
    setCircleError(null);
    login();
  }, [privyEnabled, login]);

  const connectMetaMask = useCallback(
    (walletId?: string) => {
      // Clear Circle smart-account state when switching to an injected wallet.
      if (circleAddress || bundlerClient) {
        setCircleAddress(undefined);
        setBundlerClient(null);
        setCircleError(null);
      }
      setConnectError(null);

      // The modal's wallet ids (see WALLETS in data.ts) are product names, not
      // wagmi connector ids. Coinbase and WalletConnect have dedicated
      // connectors; MetaMask / Phantom / Trust / Ledger all speak through the
      // shared injected (window.ethereum) provider. Without this mapping every
      // choice fell through to connectors[0] (injected), so the WalletConnect QR
      // and Coinbase flows never opened.
      const DEDICATED_CONNECTOR_ID: Record<string, string> = {
        coinbase: "coinbaseWalletSDK",
        walletconnect: "walletConnect",
      };
      const dedicatedId = walletId ? DEDICATED_CONNECTOR_ID[walletId] : undefined;

      if (dedicatedId) {
        const connector = connectors.find((c) => c.id === dedicatedId);
        if (!connector) {
          setConnectError(
            dedicatedId === "walletConnect"
              ? "WalletConnect is not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable it."
              : "Coinbase Wallet is not available in this browser.",
          );
          return;
        }
        wagmiConnect({ connector });
        return;
      }

      // Injected family (MetaMask/Phantom/Trust/Ledger) or no explicit choice.
      const injectedConnector =
        connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (!injectedConnector) {
        setConnectError(
          "No browser wallet detected. Install MetaMask or another wallet extension.",
        );
        return;
      }
      wagmiConnect({ connector: injectedConnector });
    },
    [circleAddress, bundlerClient, connectors, wagmiConnect],
  );

  const disconnect = useCallback(async () => {
    // Full reset: tear down BOTH the injected (wagmi) connection and the Privy
    // session + Circle smart account, regardless of which is currently active.
    // This guarantees a return to the login popup and prevents a lingering
    // session from silently auto-reconnecting on the next mount.
    setCircleAddress(undefined);
    setBundlerClient(null);
    setCircleError(null);
    setConnectError(null);
    try {
      if (wagmiConnected) await wagmiDisconnect();
    } catch (err) {
      console.error("wagmi disconnect failed:", err);
    }
    try {
      if (privyEnabled && authenticated) await logout();
    } catch (err) {
      console.error("Privy logout failed:", err);
    }
  }, [wagmiConnected, wagmiDisconnect, privyEnabled, authenticated, logout]);

  const wagmiErrorMessage = wagmiError
    ? wagmiError.message || "Failed to connect wallet"
    : null;

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      isConnected,
      isInitializing,
      walletType,
      bundlerClient,
      connectMetaMask,
      connectPrivy,
      privyConfigured: privyEnabled,
      disconnect,
      isConnecting: wagmiPending || circleConnecting,
      circleError,
      walletError: connectError ?? wagmiErrorMessage,
    }),
    [
      address,
      isConnected,
      isInitializing,
      walletType,
      bundlerClient,
      connectMetaMask,
      connectPrivy,
      privyEnabled,
      disconnect,
      wagmiPending,
      circleConnecting,
      circleError,
      connectError,
      wagmiErrorMessage,
    ],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Helper: encode a contract call as a UserOperation call object
export function encodeContractCall(params: {
  address: Address;
  abi: readonly Record<string, unknown>[];
  functionName: string;
  args?: readonly unknown[];
}): { to: Hex; data: Hex; value?: bigint } {
  return {
    to: params.address as Hex,
    data: encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args as unknown[],
    }),
  };
}
