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

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSwap } from "../useSwap";
import { getTokenLogo, getChainLogo } from "../icons";
import type { Chain } from "../data";
import type { SwapChain } from "@/lib/swap/chains";

/* ─── Helpers ───────────────────────────────────────────────────── */

const toChainShape = (c: SwapChain): Chain => ({
  code: c.id,
  name: c.name,
  icon: "",
  color: "#8A8A95",
  testnet: c.testnet,
  group: c.testnet ? "Testnet" : "Mainnet",
});

/* ─── Sub-components ────────────────────────────────────────────── */

function TokenRow({
  label,
  symbol,
  tokens,
  onChange,
  amount,
  onAmountChange,
  readOnly,
  estimatedOutput,
}: {
  label: string;
  symbol: string;
  tokens: readonly string[];
  onChange: (s: string) => void;
  amount?: string;
  onAmountChange?: (v: string) => void;
  readOnly?: boolean;
  estimatedOutput?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative rounded-2xl border border-line bg-surface-1/60 p-4 backdrop-blur-sm transition-colors hover:border-line-strong">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {label}
        </span>
        {readOnly && estimatedOutput && (
          <span className="rounded-full bg-lime-dim px-2 py-0.5 text-[10px] font-bold text-lime">
            ESTIMATED
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={readOnly ? (estimatedOutput ?? "—") : (amount ?? "")}
          onChange={(e) => onAmountChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder="0.00"
          className="min-w-0 flex-1 border-none bg-transparent font-mono text-[28px] font-semibold text-ink outline-none placeholder:text-ink-3/40"
          style={readOnly ? { color: "var(--lime)", opacity: estimatedOutput ? 1 : 0.4 } : {}}
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-[14px] font-bold text-ink transition-all hover:border-lime/30 hover:bg-surface-2"
          >
            {getTokenLogo(symbol, 22)}
            <span>{symbol}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-1 text-ink-3">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+8px)] z-[200] min-w-[160px] overflow-hidden rounded-xl border border-line-strong bg-surface-3 shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
              >
                {tokens.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { onChange(t); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold transition-colors ${t === symbol ? "bg-lime-dim text-lime" : "text-ink hover:bg-surface-2"}`}
                  >
                    {getTokenLogo(t, 18)}
                    {t}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FlipButton({ onClick }: { onClick: () => void }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="relative z-10 -my-3 flex justify-center">
      <motion.button
        type="button"
        onClick={() => { setFlipped((f) => !f); onClick(); }}
        animate={{ rotate: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-surface-1 bg-surface-3 text-lime shadow-[0_0_20px_rgba(196,255,0,0.15)] transition-all hover:bg-lime hover:text-charge-bg hover:shadow-[0_0_30px_rgba(196,255,0,0.35)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3L7 21M7 21L3 17M7 21L11 17" />
          <path d="M17 21L17 3M17 3L13 7M17 3L21 7" />
        </svg>
      </motion.button>
    </div>
  );
}

function SlippageSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const presets = ["0.1", "0.5", "1.0"];
  const [custom, setCustom] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      {presets.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => { onChange(s); setCustom(false); }}
          className="rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-bold transition-all"
          style={{
            border: value === s && !custom ? "1px solid var(--lime)" : "1px solid var(--line)",
            background: value === s && !custom ? "var(--lime-dim)" : "transparent",
            color: value === s && !custom ? "var(--lime)" : "var(--ink-3)",
          }}
        >
          {s}%
        </button>
      ))}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Custom"
          value={custom ? value : ""}
          onFocus={() => setCustom(true)}
          onChange={(e) => { setCustom(true); onChange(e.target.value); }}
          className="w-[72px] rounded-lg border border-line bg-transparent px-2 py-1.5 text-center font-mono text-[11px] font-bold text-ink outline-none transition-colors focus:border-lime placeholder:text-ink-3/50"
        />
      </div>
    </div>
  );
}

function QuoteDetails({
  quote,
  tokenIn,
  tokenOut,
  chain,
  slippage,
}: {
  quote: Record<string, unknown>;
  tokenIn: string;
  tokenOut: string;
  chain: string;
  slippage: string;
}) {
  const rows: [string, string][] = [
    ["Rate", quote.rate ? `1 ${tokenIn} ≈ ${quote.rate} ${tokenOut}` : "—"],
    ["Min. Received", quote.minReceived ? `${quote.minReceived} ${tokenOut}` : "—"],
    ["Price Impact", quote.priceImpactBps != null ? `${(Number(quote.priceImpactBps) / 100).toFixed(2)}%` : "< 0.01%"],
    ["Slippage Tolerance", `${slippage}%`],
    ["Network", chain],
  ];
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-xl border border-line bg-surface-1/40 backdrop-blur-sm"
    >
      <div className="space-y-0 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[11px] font-medium text-ink-3">{k}</span>
            <span className="font-mono text-[11px] font-medium text-ink-2">{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function StatusBanner({ status, error: err, result }: {
  status: string;
  error: string | null;
  result: { txHash?: string; explorerUrl?: string; [key: string]: unknown } | null;
}) {
  if (status === "success" && result) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-lime/20 bg-lime/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime text-charge-bg text-[12px] font-bold">✓</div>
          <span className="text-[13px] font-semibold text-lime">Swap Successful</span>
        </div>
        {result.txHash && (
          <div className="mt-2 break-all font-mono text-[11px] text-ink-3">{result.txHash as string}</div>
        )}
        {result.explorerUrl && (
          <a href={result.explorerUrl as string} target="_blank" rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-lime transition-opacity hover:opacity-80">
            View on Explorer
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 1H11V8M11 1L1 11" /></svg>
          </a>
        )}
      </motion.div>
    );
  }

  if (status === "error" && err) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-400/20 text-red-400 text-[12px] font-bold">✕</div>
          <span className="text-[13px] font-semibold text-red-400">Swap Failed</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-red-300/80">{err}</p>
      </motion.div>
    );
  }

  return null;
}

/* ─── History list ──────────────────────────────────────────────── */
function SwapHistory({ history }: { history: Array<{ id: string; tokenIn: string; tokenOut: string; amountIn: string; amountOut?: string; status: string; timestamp: number; explorerUrl?: string }> }) {
  if (history.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Recent Swaps</h3>
      <div className="space-y-2">
        {history.slice(0, 5).map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-1/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${tx.status === "success" ? "bg-lime" : "bg-red-400"}`} />
              <span className="font-mono text-[12px] text-ink-2">
                {tx.amountIn} {tx.tokenIn} → {tx.amountOut ?? "?"} {tx.tokenOut}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-ink-3">
                {new Date(tx.timestamp).toLocaleTimeString()}
              </span>
              {tx.explorerUrl && (
                <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-lime hover:opacity-80">↗</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Chain picker (inline dropdown) ────────────────────────────── */
function ChainPicker({ chain, chains, onChange }: {
  chain: SwapChain;
  chains: SwapChain[];
  onChange: (c: SwapChain) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"Mainnet" | "Testnet">(chain.testnet ? "Testnet" : "Mainnet");
  const filtered = chains.filter((c) => (tab === "Testnet" ? c.testnet : !c.testnet));
  const shape = toChainShape(chain);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface-1/60 px-3 py-2 text-[13px] font-semibold text-ink transition-all hover:border-line-strong">
        {getChainLogo(shape.code, 18)}
        <span>{chain.name}</span>
        {chain.testnet && <span className="rounded bg-lime-dim px-1.5 py-0.5 text-[9px] font-bold text-lime">TEST</span>}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-ink-3"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 top-[calc(100%+6px)] z-[300] max-h-72 w-[260px] overflow-hidden rounded-xl border border-line-strong bg-surface-3 shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
            <div className="flex border-b border-line">
              {(["Mainnet", "Testnet"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className="flex-1 py-2.5 text-[11px] font-bold transition-all"
                  style={{ color: tab === t ? "var(--lime)" : "var(--ink-3)", borderBottom: tab === t ? "2px solid var(--lime)" : "2px solid transparent" }}>
                  {t}
                </button>
              ))}
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map((c) => (
                <button key={c.id} type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12px] font-semibold transition-colors ${c.id === chain.id ? "bg-lime-dim text-lime" : "text-ink hover:bg-surface-2"}`}>
                  {getChainLogo(toChainShape(c).code, 16)}
                  {c.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main SwapPanel
   ═══════════════════════════════════════════════════════════════════ */

export function SwapPanel() {
  const swap = useSwap();
  const [showSettings, setShowSettings] = useState(false);

  /* Config not loaded yet */
  if (swap.config === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-lime" />
        <p className="text-[12px] text-ink-3">Checking swap configuration…</p>
      </div>
    );
  }

  /* Keys not configured */
  if (!swap.config.configured) {
    return (
      <div className="space-y-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-400/10 text-red-400 text-lg">⚠</div>
          <div>
            <h3 className="text-[14px] font-bold text-ink">Swap Not Configured</h3>
            <p className="text-[12px] text-ink-3">Server-side environment variables are missing.</p>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface-1/40 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Missing keys</p>
          <div className="space-y-1">
            {swap.config.missing.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                <code className="font-mono text-[12px] text-red-300">{k}</code>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">
          Fill in <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">.env.local</code> with your Circle Developer Console credentials, then restart the dev server.
        </p>
      </div>
    );
  }

  const isLoading = swap.status === "quoting" || swap.status === "swapping";

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <ChainPicker chain={swap.chain} chains={swap.chains} onChange={swap.changeChain} />
        <button type="button" onClick={() => setShowSettings((s) => !s)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-1/60 text-ink-3 transition-all hover:border-line-strong hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>

      {/* Mainnet warning */}
      {swap.isMainnet && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3.5 py-2.5 text-[11px] font-medium text-amber-300">
          ⚠ Mainnet selected — swaps move <b>REAL funds</b>. Start with a small amount.
        </motion.div>
      )}

      {/* Slippage settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-line bg-surface-1/40 px-4 py-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Slippage Tolerance</div>
            <SlippageSelector value={swap.slippage} onChange={swap.setSlippage} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token In */}
      <TokenRow
        label="You Pay"
        symbol={swap.tokenIn}
        tokens={swap.tokens}
        onChange={swap.changeTokenIn}
        amount={swap.amount}
        onAmountChange={swap.changeAmount}
      />

      {/* Flip */}
      <FlipButton onClick={swap.flipTokens} />

      {/* Token Out */}
      <TokenRow
        label="You Receive"
        symbol={swap.tokenOut}
        tokens={swap.tokens}
        onChange={swap.changeTokenOut}
        readOnly
        estimatedOutput={swap.quote?.estimatedOutput}
      />

      {/* Validation errors */}
      {swap.invalidPair && (
        <p className="text-[11px] font-medium text-red-400">
          On Arc, USDC and NATIVE are the same asset — this pair can&apos;t be swapped.
        </p>
      )}
      {swap.samePair && !swap.invalidPair && (
        <p className="text-[11px] font-medium text-red-400">
          Select different tokens to swap.
        </p>
      )}

      {/* Quote details */}
      <AnimatePresence>
        {swap.quote && (
          <QuoteDetails
            quote={swap.quote as unknown as Record<string, unknown>}
            tokenIn={swap.tokenIn}
            tokenOut={swap.tokenOut}
            chain={swap.chain.name}
            slippage={swap.slippage}
          />
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={swap.getQuote}
          disabled={!swap.canAct || isLoading}
          className="flex-1 rounded-xl border border-line bg-surface-1/60 py-3 text-[13px] font-bold text-ink transition-all hover:border-lime/30 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {swap.status === "quoting" ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-lime border-t-transparent" />
              Quoting…
            </span>
          ) : "Get Quote"}
        </button>
        <button
          type="button"
          onClick={swap.executeSwap}
          disabled={!swap.canAct || swap.status === "swapping"}
          className="flex-[2] rounded-xl py-3 text-[14px] font-bold tracking-[0.01em] transition-all active:translate-y-px disabled:cursor-not-allowed"
          style={{
            background: !swap.canAct || swap.status === "swapping" ? "var(--surface-3)" : "var(--lime)",
            color: !swap.canAct || swap.status === "swapping" ? "var(--ink-3)" : "#080808",
            boxShadow: !swap.canAct || swap.status === "swapping" ? "none" : "0 0 28px rgba(196,255,0,0.25)",
          }}
        >
          {swap.status === "swapping" ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />
              Executing…
            </span>
          ) : "⚡ Swap Now"}
        </button>
      </div>

      {/* Status banners */}
      <StatusBanner status={swap.status} error={swap.error} result={swap.result as Record<string, unknown> | null} />

      {/* History */}
      <SwapHistory history={swap.history} />

      {/* Disclaimer */}
      <p className="text-[10px] leading-relaxed text-ink-3/60">
        Swaps execute directly from your connected wallet via Circle Swap Kit. Quotes go through decentralized aggregator routes and are subject to market conditions.
      </p>
    </div>
  );
}
