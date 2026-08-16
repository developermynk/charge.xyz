"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import {
  arcTestnet,
  isPrivyConfigured,
  PRIVY_APP_ID,
  PrivyBridgeProvider,
  PrivyProvider,
  wagmiConfig,
  WagmiProvider,
  WalletProvider,
} from "@charge/web3";

import { ConnectModalProvider } from "@/components/connect-modal";

/** Provider tree ... */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Single source of truth: Privy hooks may only run when the provider below
  // is actually mounted, which requires both a valid app id AND hydration.
  const privyActive = mounted && isPrivyConfigured();

  const walletTree = (
    <PrivyBridgeProvider enabled={privyActive}>
      <WalletProvider>
        {/* ConnectModalProvider mounts the single global connect modal; it must
            sit inside WalletProvider so useWallet() works during prerender. */}
        <ConnectModalProvider>{children}</ConnectModalProvider>
      </WalletProvider>
    </PrivyBridgeProvider>
  );

  const body = privyActive ? (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        supportedChains: [arcTestnet],
        defaultChain: arcTestnet,
        // Email first: the pitch is that you do not need a wallet.
        loginMethods: ["email", "google", "passkey"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
          accentColor: "#6e54ff",
          walletChainType: "ethereum-only",
        },
      }}
    >
      {walletTree}
    </PrivyProvider>
  ) : (
    walletTree
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{body}</QueryClientProvider>
    </WagmiProvider>
  );
}
