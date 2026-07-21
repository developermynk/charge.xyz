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

import { motion, easeOut } from "framer-motion";
import { GlassCard } from "../ui";
import { useWalletModal } from "../WalletModalContext";

const FEATURES = [
  {
    icon: "⇌",
    title: "Instant Swaps",
    desc: "Route through 200+ liquidity sources for the best price, every time. Zero slippage on stablecoin pairs.",
    tag: "Most used",
  },
  {
    icon: "⬡",
    title: "Cross-Chain Bridge",
    desc: "Move assets between 12 chains in under 7 minutes. Powered by Charge Router with guaranteed finality.",
    tag: "12 chains",
  },
  {
    icon: "✦",
    title: "Token Creation",
    desc: "Deploy production-ready ERC-20 tokens without writing a single line of Solidity. Audited contracts only.",
    tag: "",
  },
  {
    icon: "→",
    title: "Secure Transfers",
    desc: "Send tokens to any address with real-time validation, gas estimation, and on-chain confirmation tracking.",
    tag: "Instant",
  },
];

export function LandingFeatures() {
  const { open } = useWalletModal();

  return (
    <section className="px-6 py-24 md:px-12">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-16 text-center">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-lime">
            What you can do
          </div>
          <h2 className="font-display text-[52px] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
            Everything DeFi.
            <br />
            One interface.
          </h2>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
              }}
            >
              <GlassCard className="cursor-pointer p-7 transition-colors hover:border-line-strong">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(196,255,0,0.15)] bg-lime-dim text-2xl text-lime">
                    {f.icon}
                  </div>
                  {f.tag && (
                    <span className="rounded-full border border-[rgba(196,255,0,0.15)] bg-lime-dim px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-lime">
                      {f.tag}
                    </span>
                  )}
                </div>
                <h3 className="mb-2.5 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
                  {f.title}
                </h3>
                <p className="mb-5 text-[14px] leading-relaxed text-ink-2">{f.desc}</p>
                <button
                  type="button"
                  onClick={open}
                  className="bg-none p-0 text-[13px] font-semibold text-lime"
                >
                  Get started →
                </button>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
