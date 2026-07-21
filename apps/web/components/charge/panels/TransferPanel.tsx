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
import { AmountInput, GlassCard, AccentButton } from "..";
import { TOKENS, type Token } from "../data";
import { useWallet } from "@repo/hooks/WalletContext";
import { useTransfer } from "../useTransfer";
import { getTokenLogo } from "../icons";

// Only the native token (USDC on Arc Testnet) can be transferred on-chain here.
const NATIVE_TOKEN: Token = TOKENS.find((t) => t.symbol === "USDC") ?? TOKENS[0];

export function TransferPanel() {
  const token = NATIVE_TOKEN;
  const [amount, setAmount] = useState("0.1");
  const [recipient, setRecipient] = useState("");
  const [memo, setMemo] = useState("");

  const { isConnected, walletType } = useWallet();
  const { send, reset, status, explorerUrl, error } = useTransfer();

  const usdValue = parseFloat(amount || "0") * token.price;
  const isValidAddress = recipient.startsWith("0x") && recipient.length === 42;
  const gasless = walletType === "circle";
  const canSubmit =
    isConnected && isValidAddress && parseFloat(amount || "0") > 0 && status !== "pending";

  const borderColor = recipient
    ? !isValidAddress
      ? "rgba(255,80,80,0.4)"
      : "rgba(196,255,0,0.3)"
    : "var(--line-strong)";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
          Token
        </div>
        <div className="flex items-center gap-2 rounded-[10px] border border-line-strong bg-surface-1 px-3.5 py-3">
          {getTokenLogo(token.symbol, 18)}
          <span className="text-[14px] font-semibold text-ink">{token.symbol}</span>
          <span className="ml-auto text-[11px] text-ink-3">Native · Arc Testnet</span>
        </div>
      </div>

      <AmountInput
        value={amount}
        onChange={(v) => {
          setAmount(v);
          if (status !== "idle") reset();
        }}
        label="Amount"
        token={token}
        usdValue={usdValue}
      />
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
          Recipient Address
        </div>
        <div className="relative">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
            className="w-full rounded-[10px] bg-surface-1 px-3.5 py-2.5 pr-11 font-mono text-[13px] text-ink outline-none placeholder:text-ink-3"
            style={{ border: `1px solid ${borderColor}` }}
          />
          {isValidAddress && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base text-lime">✓</span>
          )}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
          Memo (optional, not stored on-chain)
        </div>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Add a note..."
          className="w-full rounded-[10px] border border-line bg-surface-1 px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <GlassCard style={{ padding: 14, borderRadius: 12 }}>
        {[
          ["Amount", `${amount || "0"} ${token.symbol}`],
          ["Network", "Arc Testnet"],
          ["Gas Fee", gasless ? "Sponsored (gasless)" : "Paid from wallet"],
        ].map(([k, v], i, arr) => (
          <div
            key={k}
            className="flex items-center justify-between"
            style={{
              paddingBottom: 8,
              marginBottom: 8,
              borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <span className="text-[12px] font-medium text-ink-3">{k}</span>
            <span className="font-mono text-[12px] text-ink-2">{v}</span>
          </div>
        ))}
      </GlassCard>

      {status === "error" && error && (
        <p className="text-[12px] text-red-400">{error}</p>
      )}
      {status === "success" && (
        <p className="text-[12px] text-lime">
          ✓ Transfer sent.{" "}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-opacity hover:opacity-80"
            >
              View on explorer ↗
            </a>
          )}
        </p>
      )}

      <AccentButton
        onClick={() => send(recipient, amount)}
        full
        size="lg"
        disabled={!canSubmit}
      >
        {status === "pending"
          ? "⟳ Sending…"
          : !isConnected
            ? "Connect a wallet"
            : `⚡ Transfer ${token.symbol}`}
      </AccentButton>
    </div>
  );
}
