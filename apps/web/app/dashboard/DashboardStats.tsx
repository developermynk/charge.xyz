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

import { GlassCard } from "@/components/charge/ui";
import { useWallet } from "@repo/hooks/WalletContext";
import { useWalletBalance } from "@/components/charge/useWalletBalance";

export function DashboardStats() {
  const { isConnected } = useWallet();
  const { formatted, isLoading } = useWalletBalance();

  const balanceValue = !isConnected
    ? "—"
    : isLoading
      ? "…"
      : (formatted ?? "—");

  const stats = [
    { label: "24h Volume", value: "$0", sub: "Live from Charge protocol" },
    { label: "Transactions", value: "0", sub: "On-chain activity" },
    {
      label: "Wallet Balance",
      value: balanceValue,
      sub: isConnected ? "Native balance on Arc Testnet" : "Connect a wallet",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <GlassCard key={s.label} style={{ padding: "16px 20px" }}>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
            {s.label}
          </div>
          <div className="mb-1 font-mono text-[22px] font-semibold text-ink">
            {s.value}
          </div>
          {s.sub && <div className="text-[11px] text-ink-3">{s.sub}</div>}
        </GlassCard>
      ))}
    </div>
  );
}
