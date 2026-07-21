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

import { type Token } from "./data";
import { getTokenLogo } from "./icons";
import { useWallet } from "@repo/hooks/WalletContext";
import { useWalletBalance } from "./useWalletBalance";
import { arcTestnet } from "@repo/hooks/wagmi";

const NATIVE_SYMBOL = arcTestnet.nativeCurrency.symbol; // "USDC" on Arc Testnet

export function AmountInput({
  value,
  onChange,
  label,
  token,
  usdValue,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  token: Token;
  usdValue?: number;
}) {
  const { isConnected } = useWallet();
  const { amount: nativeAmount } = useWalletBalance();

  // Only the native token (USDC on Arc Testnet) has a real on-chain balance in
  // this app; other tokens aren't deployed on the testnet, so their balance is 0.
  const isNative = token.symbol === NATIVE_SYMBOL;
  const balance = isNative ? (nativeAmount ?? 0) : 0;
  const canMax = isConnected && balance > 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
          {label}
        </div>
        {usdValue !== undefined && (
          <div className="font-mono text-[12px] text-ink-2">
            ≈ $
            {usdValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        )}
      </div>
      <div className="flex items-center overflow-hidden rounded-[10px] border border-line-strong bg-surface-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 border-none bg-transparent px-3.5 py-3 font-mono text-[20px] font-medium text-ink outline-none placeholder:text-ink-3"
        />
        <div className="flex items-center gap-1.5 border-l border-line px-3.5 py-3">
          {getTokenLogo(token.symbol, 18)}
          <span className="text-[14px] font-semibold text-ink-2">{token.symbol}</span>
        </div>
      </div>
      {isConnected && (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-mono text-[11px] text-ink-3">
            Balance:{" "}
            {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
            {token.symbol}
          </span>
          {canMax && (
            <button
              type="button"
              onClick={() => onChange(String(balance))}
              className="text-[11px] font-semibold text-lime transition-colors hover:opacity-80"
            >
              MAX
            </button>
          )}
        </div>
      )}
    </div>
  );
}
