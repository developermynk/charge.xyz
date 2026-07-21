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
import { AmountInput, GlassCard, AccentButton } from "..";
import { TOKENS, type Token } from "../data";
import { useWallet } from "@repo/hooks/WalletContext";
import { useBridge, BRIDGE_DESTINATIONS } from "../useBridge";
import { getTokenLogo } from "../icons";

const NATIVE_TOKEN: Token = TOKENS.find((t) => t.symbol === "USDC") ?? TOKENS[0];

export function BridgePanel() {
  const token = NATIVE_TOKEN;
  const [amount, setAmount] = useState("0.5");
  const [destination, setDestination] = useState(BRIDGE_DESTINATIONS[0]);

  const { isConnected, walletType } = useWallet();
  const { bridge, reset, status, error, links, isConnected: bridgeConnected, sourceChain, sourceRpc, arcTestnetFaucet } = useBridge();

  const usdValue = parseFloat(amount || "0") * token.price;
  const supportedWallet = walletType === "metamask";
  const canSubmit =
    supportedWallet && parseFloat(amount || "0") > 0 && status !== "pending";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-3">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
          From · {sourceChain}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTokenLogo(token.symbol, 18)}
            <span className="text-[14px] font-semibold text-ink">{token.symbol}</span>
          </div>
          {arcTestnetFaucet && (
            <a
              href={arcTestnetFaucet}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-lime hover:underline"
            >
              Get USDC ↗
            </a>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
          To Chain
        </div>
        <select
          value={destination.id}
          onChange={(e) =>
            setDestination(BRIDGE_DESTINATIONS.find((d) => d.id === e.target.value) ?? BRIDGE_DESTINATIONS[0])
          }
          className="w-full rounded-[10px] border border-line bg-surface-1 px-3.5 py-3 text-[14px] font-semibold text-ink outline-none"
        >
          {BRIDGE_DESTINATIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {destination.faucetUrl && (
          <a
            href={destination.faucetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-1 text-[11px] font-medium text-lime hover:underline"
          >
            Get testnet tokens for {destination.name} ↗
          </a>
        )}
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

      <GlassCard style={{ padding: 14, borderRadius: 12 }}>
        {[
          ["Route", `${sourceChain} → ${destination.name}`],
          ["You Send", `${amount || "0"} ${token.symbol}`],
          ["Speed", "Fast Transfer (~20s)"],
          ["Fee", "Circle network fee (fast)"],
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

      {!supportedWallet && isConnected && (
        <p className="text-[12px] text-amber-400">
          Bridging is available for injected wallets (MetaMask, etc.) via "Continue with
          wallet". Circle smart accounts aren't supported by Circle's Bridge Kit yet.
        </p>
      )}
      {status === "error" && error && (
        <p className="text-[12px] text-red-400">{error}</p>
      )}
      {status === "success" && (
        <div className="text-[12px] text-lime">
          ✓ Bridged.{" "}
          {links.map((l, i) => (
            <span key={i}>
              {l.url && (
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {l.label} ↗
                </a>
              )}{" "}
            </span>
          ))}
        </div>
      )}

      <AccentButton
        onClick={() => bridge(amount, destination)}
        full
        size="lg"
        disabled={!canSubmit}
      >
        {status === "pending"
          ? "⟳ Bridging…"
          : !isConnected
          ? "Connect a wallet"
          : !supportedWallet
          ? "Use an injected wallet to bridge"
          : "⚡ Bridge Assets"}
      </AccentButton>
    </div>
  );
}
