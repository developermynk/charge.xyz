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

import { useEffect, useRef, useState } from "react";
import { ALL_CHAINS, type Chain } from "./data";
import { getChainLogo } from "./icons";
import { cn } from "@repo/utils";

export function ChainSelect({
  value,
  onChange,
  label,
  exclude,
  chains = ALL_CHAINS,
}: {
  value: Chain;
  onChange: (c: Chain) => void;
  label: string;
  exclude?: string;
  chains?: Chain[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"Mainnet" | "Testnet">("Testnet");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = chains.filter(
    (c) =>
      c.group === tab &&
      c.code !== exclude &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div ref={ref} className="relative">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-[10px] border bg-surface-1 px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors"
        style={{ borderColor: open ? "var(--line-strong)" : "var(--line)" }}
      >
        <span className="flex items-center gap-2">
          {getChainLogo(value.code, 20)}
          <span>{value.name}</span>
          {value.testnet && (
            <span className="rounded bg-lime-dim px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-lime">
              TESTNET
            </span>
          )}
        </span>
        <span
          className="inline-block text-xs text-ink-3 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[200] overflow-hidden rounded-[14px] border border-line-strong bg-surface-3 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
          style={{ minWidth: 280 }}
        >
          <div className="flex border-b border-line px-2.5 pt-2.5">
            {(["Mainnet", "Testnet"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex-1 border-b-2 bg-transparent pb-1.5 text-xs font-semibold transition-all"
                style={{
                  color: tab === t ? "var(--lime)" : "var(--ink-3)",
                  borderColor: tab === t ? "var(--lime)" : "transparent",
                  marginBottom: -1,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="px-2.5 pb-1.5 pt-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chains..."
              autoFocus
              className="w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3.5 py-4 text-center text-[13px] text-ink-3">
                No chains found
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors",
                    c.code === value.code
                      ? "bg-lime-dim text-lime"
                      : "bg-transparent text-ink hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    {getChainLogo(c.code, 18)}
                    <span>{c.name}</span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-3">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
