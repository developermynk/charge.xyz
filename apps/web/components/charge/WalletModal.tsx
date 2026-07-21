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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, OR ALL WARRANTIES OR
 * CONDITIONS OF ANY KIND, OR ALL WARRANTIES OR CONDITION OF ANY KIND, see the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useState } from "react";
import { useWallet } from "@repo/hooks/WalletContext";
import { WALLETS } from "./data";

type Step = "methods" | "wallet-select";

export function WalletModal({
  onClose,
  onBeginLogin,
}: {
  onClose: () => void;
  onBeginLogin: () => void;
}) {
  const [step, setStep] = useState<Step>("methods");
  const [pending, setPending] = useState<"privy" | "metamask" | null>(null);

  const {
    connectMetaMask,
    connectPrivy,
    privyConfigured,
    isConnecting,
    circleError,
    walletError,
  } = useWallet();

  const handlePrivy = () => {
    setPending("privy");
    onBeginLogin();
    // Close our modal so Privy's own login/create-account popup is unobstructed
    // (our full-screen backdrop would otherwise sit on top of it). The provider
    // redirects to the dashboard once the wallet connects.
    connectPrivy();
    onClose();
  };

  const handleWallet = (walletId: string) => {
    setPending("metamask");
    onBeginLogin();
    connectMetaMask(walletId);
    setPending(null);
  };

  const busy = pending !== null || isConnecting;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5 backdrop-blur-[14px]"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[20px] border border-line-strong"
        style={{
          background: "var(--surface-1)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(196,255,0,0.06)",
        }}
      >
        {/* Glow top */}
        <div
          className="pointer-events-none absolute left-1/2 top-[-60px] h-[120px] w-[300px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(ellipse, rgba(196,255,0,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Header */}
        <div className="relative px-7 pt-7">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-3 text-ink-3 transition-colors hover:bg-surface-2"
          >
            ×
          </button>

          <div className="mb-5 flex items-center gap-1.5">
            <span className="font-display text-[22px] font-bold text-lime">⚡</span>
            <span className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
              Charge.xyz
            </span>
          </div>

          {step === "methods" && (
            <>
              <h2 className="font-display text-[26px] font-bold tracking-[-0.02em] text-ink">
                Connect to Charge
              </h2>
              <p className="mb-6 mt-1.5 text-[13px] leading-relaxed text-ink-2">
                Sign in to access your wallet, portfolio, and all DeFi features.
              </p>
            </>
          )}
          {step === "wallet-select" && (
            <>
              <button
                type="button"
                onClick={() => setStep("methods")}
                className="mb-3.5 flex items-center gap-1 bg-none p-0 text-[13px] text-ink-3"
              >
                ← Back
              </button>
              <h2 className="font-display text-[26px] font-bold tracking-[-0.02em] text-ink">
                Choose Wallet
              </h2>
              <p className="mb-6 mt-1.5 text-[13px] leading-relaxed text-ink-2">
                Connect with your preferred Web3 wallet.
              </p>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-7 pb-7">
          {step === "methods" && (
            <div className="flex flex-col gap-2.5">
              {/* Option 1 — Privy (login + create account) → Circle smart account */}
              <button
                type="button"
                disabled={busy || !privyConfigured}
                onClick={handlePrivy}
                className="flex w-full items-center gap-3 rounded-xl border border-[rgba(196,255,0,0.22)] bg-lime-dim px-4 py-3.5 text-[14px] font-semibold text-lime transition-colors disabled:opacity-60"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-[rgba(196,255,0,0.15)] text-[14px]">
                  ⚡
                </span>
                <span className="flex-1 text-left">
                  {pending === "privy" ? "Opening login…" : "Continue with Privy"}
                </span>
                {pending !== "privy" && (
                  <span className="text-[12px]">→</span>
                )}
              </button>

              <p className="px-1 text-center text-[11px] leading-relaxed text-ink-3">
                {privyConfigured
                  ? "Create an account or sign in with email, Google & more. A gasless Circle smart wallet is created for you automatically."
                  : "Privy login is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable email / social sign-up."}
              </p>

              {/* Divider */}
              <div className="my-1 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[12px] font-medium text-ink-3">or connect wallet</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              {/* Option 2 — Continue with wallet */}
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep("wallet-select")}
                className="flex w-full items-center gap-3 rounded-xl border border-line-strong bg-surface-2 px-4 py-3.5 text-[14px] font-semibold text-ink transition-colors hover:border-line disabled:opacity-60"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-surface-3 text-[14px]">
                  👛
                </span>
                <span className="flex-1 text-left">Continue with wallet</span>
                <span className="text-[12px] text-ink-3">→</span>
              </button>

              {circleError && (
                <p className="text-[12px] text-red-400">{circleError}</p>
              )}
              {walletError && (
                <p className="text-[12px] text-red-400">{walletError}</p>
              )}

              <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-3">
                By connecting, you agree to our{" "}
                <span className="cursor-pointer text-lime">Terms of Service</span> and{" "}
                <span className="cursor-pointer text-lime">Privacy Policy</span>.
              </p>
            </div>
          )}

          {step === "wallet-select" && (
            <div className="flex flex-col gap-2">
              {WALLETS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleWallet(w.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-line disabled:opacity-60"
                >
                  <span className="w-8 flex-shrink-0 text-center text-[22px]">{w.icon}</span>
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-ink">{w.name}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">{w.desc}</div>
                  </div>
                  <span className="text-[12px] text-ink-3">
                    {pending === "metamask" ? "Connecting…" : "→"}
                  </span>
                </button>
              ))}
              {walletError && <p className="text-[12px] text-red-400">{walletError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
