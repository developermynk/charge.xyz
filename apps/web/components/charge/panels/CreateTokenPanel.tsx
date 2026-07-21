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

import { useState } from "react";
import { ChainSelect, GlassCard, AccentButton } from "..";
import { DEFAULT_CHAIN, type Chain } from "../data";

type FormKey = "name" | "symbol" | "supply" | "decimals";
type ToggleKey = "mintable" | "burnable" | "pausable";

export function CreateTokenPanel() {
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    supply: "1000000",
    decimals: "18",
    mintable: false,
    burnable: false,
    pausable: false,
  });
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState<Chain>(DEFAULT_CHAIN);
  const set = (k: FormKey | ToggleKey) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const textField = (
    label: string,
    key: FormKey,
    placeholder: string,
    mono = false,
  ) => (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <input
        value={form[key]}
        onChange={(e) => set(key)(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-[10px] border border-line-strong px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none placeholder:text-ink-3 ${
          mono ? "font-mono" : ""
        }`}
        style={{ background: "var(--surface-1)" }}
      />
    </div>
  );

  const toggle = (label: string, key: ToggleKey, desc: string) => (
    <div
      onClick={() => set(key)(!form[key])}
      className="flex cursor-pointer items-center justify-between rounded-[10px] border px-3.5 py-2.5 transition-colors"
      style={{
        background: form[key] ? "var(--lime-dim)" : "var(--surface-1)",
        borderColor: form[key] ? "rgba(196,255,0,0.2)" : "var(--line)",
      }}
    >
      <div>
        <div
          className="text-[14px] font-semibold"
          style={{ color: form[key] ? "var(--lime)" : "var(--ink)" }}
        >
          {label}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-3">{desc}</div>
      </div>
      <div
        className="relative h-6 w-11 flex-shrink-0 rounded-xl transition-colors"
        style={{ background: form[key] ? "var(--lime)" : "var(--surface-3)" }}
      >
        <div
          className="absolute h-[18px] w-[18px] rounded-full transition-all"
          style={{
            top: 3,
            left: form[key] ? 23 : 3,
            background: form[key] ? "#080808" : "var(--ink-3)",
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3.5">
      <ChainSelect value={chain} onChange={setChain} label="Deploy on" />
      <div className="grid grid-cols-2 gap-3">
        {textField("Token Name", "name", "My Token")}
        {textField("Symbol", "symbol", "MTK")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {textField("Total Supply", "supply", "1,000,000", true)}
        {textField("Decimals", "decimals", "18", true)}
      </div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
        Features
      </div>
      {toggle("Mintable", "mintable", "Allow minting new tokens after deployment")}
      {toggle("Burnable", "burnable", "Allow token holders to burn their tokens")}
      {toggle("Pausable", "pausable", "Owner can pause all token transfers")}
      <GlassCard style={{ padding: "12px 14px", borderRadius: 10 }}>
        {[
          ["Deployment Cost", "~$12.40"],
          ["Network", chain.name],
          ["Standard", "ERC-20"],
          ["Compiler", "Solidity 0.8.24"],
        ].map(([k, v], i, arr) => (
          <div
            key={k}
            className="flex items-center justify-between"
            style={{
              paddingBottom: 6,
              marginBottom: 6,
              borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <span className="text-[12px] text-ink-3">{k}</span>
            <span className="font-mono text-[12px] text-ink-2">{v}</span>
          </div>
        ))}
      </GlassCard>
      <AccentButton
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 2500);
        }}
        full
        size="lg"
      >
        {loading ? "⟳ Deploying..." : "⚡ Deploy Token"}
      </AccentButton>
    </div>
  );
}
