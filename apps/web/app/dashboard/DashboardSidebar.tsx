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

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/charge/data";
import { useWallet } from "@repo/hooks/WalletContext";
import { arcTestnet } from "@repo/hooks/wagmi";
import { useWalletBalance } from "@/components/charge/useWalletBalance";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { address, isConnected, disconnect } = useWallet();
  const { formatted, isLoading } = useWalletBalance();

  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] flex-shrink-0 flex-col border-r border-line bg-surface-1 px-0 py-6 md:flex">
      <div className="px-5 pb-7">
        <Link href="/" className="bg-none p-0">
          <span className="font-display text-2xl font-bold tracking-[-0.02em] text-lime">
            ⚡ Charge<span className="font-normal text-ink-3">.xyz</span>
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.id}
              href={item.path}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-all"
              style={{ background: active ? "var(--lime-dim)" : "transparent" }}
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-[15px]"
                style={{
                  background: active ? "var(--lime-glow)" : "var(--surface-3)",
                  borderColor: active ? "rgba(196,255,0,0.3)" : "var(--line)",
                  color: active ? "var(--lime)" : "var(--ink-2)",
                }}
              >
                {item.icon}
              </span>
              <div>
                <div
                  className="text-[13px] font-semibold tracking-[0.01em]"
                  style={{ color: active ? "var(--lime)" : "var(--ink)" }}
                >
                  {item.label}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-3">{item.desc}</div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mx-2.5 mt-0 border-t border-line px-0 pt-5">
        {isConnected ? (
          <div className="rounded-[10px] border border-line bg-surface-2 px-3 py-2.5">
            <div className="mb-1 text-[11px] text-ink-3">Connected · {arcTestnet.name}</div>
            <button
              type="button"
              onClick={() => {
                if (address) navigator.clipboard?.writeText(address);
              }}
              title="Copy address"
              className="font-mono text-[12px] font-medium text-lime transition-colors hover:opacity-80"
            >
              {short} ⧉
            </button>
            <div className="mt-0.5 font-mono text-[12px] text-ink-2">
              {isLoading ? "Loading…" : (formatted ?? "—")}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-lime transition-colors hover:opacity-80"
              >
                Fund wallet ↗
              </a>
              <button
                type="button"
                onClick={disconnect}
                className="text-[11px] font-medium text-ink-3 transition-colors hover:text-ink"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[10px] border border-line bg-surface-2 px-3 py-2.5">
            <div className="text-[12px] text-ink-3">Wallet not connected</div>
          </div>
        )}
      </div>
    </aside>
  );
}
