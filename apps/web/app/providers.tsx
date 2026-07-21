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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { config, arcTestnet } from "@repo/hooks/wagmi";
import { WalletProvider } from "@repo/hooks/WalletContext";
import { PRIVY_APP_ID, isPrivyConfigured } from "@repo/hooks/privy";

export function Providers({ children }: { children: ReactNode }) {
  // Per-render client so the server cache is not shared across requests/users.
  const [queryClient] = useState(() => new QueryClient());

  const tree = (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>{children}</WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );

  // Privy owns login + the embedded wallet (which becomes the Circle smart
  // account owner). Only mounted when an app id is configured; otherwise only
  // the "Continue with wallet" (wagmi) path is usable and WalletContext skips
  // the Privy hooks entirely.
  if (!isPrivyConfigured()) return tree;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        supportedChains: [arcTestnet],
        defaultChain: arcTestnet,
        loginMethods: ["wallet", "email", "google", "passkey"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
          walletChainType: "ethereum-only",
        },
      }}
    >
      {tree}
    </PrivyProvider>
  );
}
