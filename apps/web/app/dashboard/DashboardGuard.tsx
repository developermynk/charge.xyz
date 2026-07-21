/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in the License at
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

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@repo/hooks/WalletContext";

/**
 * Client-side auth gate for the entire /dashboard tree. Without this the app
 * rendered for anyone who navigated to /dashboard/swap directly — there was no
 * login or check (the wallet modal only guarded the landing page button).
 *
 * The gate waits for `isInitializing` before deciding so a returning user whose
 * wagmi session is auto-reconnecting, whose Privy session is still bootstrapping,
 * or whose Circle smart account is still provisioning is NOT redirected back to
 * the landing page mid-reconnect. Once the connection state has settled, an
 * unauthenticated visitor is sent to "/" where the wallet modal lives.
 */
export function DashboardGuard({ children }: { children: ReactNode }) {
  const { isConnected, isInitializing } = useWallet();
  const router = useRouter();

  // Wallet connection state only exists on the client (wagmi/Privy read from
  // browser storage). Gating on `mounted` makes the first client render match
  // the server render exactly — both show the loader — so React can hydrate
  // without a mismatch. Only after mount do we branch on real wallet state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !isInitializing && !isConnected) {
      router.replace("/");
    }
  }, [mounted, isInitializing, isConnected, router]);

  if (!mounted || isInitializing || !isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-charge-bg">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-line-strong border-t-lime"
          aria-hidden
        />
        <p className="text-[13px] text-ink-2">Connecting wallet…</p>
      </div>
    );
  }

  return <>{children}</>;
}
