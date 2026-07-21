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
import { TOKENS, type Token } from "./data";
import { getTokenLogo } from "./icons";

export function TokenSelect({
  value,
  onChange,
  label,
}: {
  value: Token;
  onChange: (t: Token) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-[10px] border border-line-strong bg-surface-1 px-3.5 py-2.5 text-[15px] font-semibold text-ink"
      >
        <span className="flex items-center gap-2">
          {getTokenLogo(value.symbol, 20)}
          {value.symbol}
        </span>
        <span className="text-xs text-ink-3">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] overflow-hidden rounded-xl border border-line-strong bg-surface-3 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          {TOKENS.map((t) => (
            <button
              key={t.symbol}
              type="button"
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors ${
                t.symbol === value.symbol
                  ? "bg-lime-dim text-lime"
                  : "bg-transparent text-ink hover:bg-surface-2"
              }`}
            >
              <span className="flex items-center gap-2">
                {getTokenLogo(t.symbol, 18)}
                {t.symbol}
                <span className="text-[12px] text-ink-3">{t.name}</span>
              </span>
              <span className="font-mono text-[12px] text-ink-2">
                ${t.price.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
