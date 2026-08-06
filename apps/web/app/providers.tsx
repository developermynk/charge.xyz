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

/**
 * Provider tree.
 *
 * SSR NOTE (this bit is load-bearing):
 * `PrivyProvider` does not establish its React context during a server render,
 * so any component calling a Privy hook while Next prerenders the page throws
 * and the whole build fails. wagmi, by contrast, is SSR-safe (`ssr: true`) and
 * MUST stay in the server-rendered tree because the connect modal calls
 * `useConnect` on every render, open or not.
 *
 * So: wagmi + react-query render on the server, and Privy is mounted only after
 * hydration. Until then the bridge serves its inert value, which means the
 * landing page still server-renders as real HTML instead of an empty shell.
 */
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
      <WalletProvider>{children}</WalletProvider>
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
          accentColor: "#00E58A",
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
