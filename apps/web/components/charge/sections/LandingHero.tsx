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
import { AccentButton } from "../ui";
import { ALL_CHAINS } from "../data";
import { getChainLogo } from "../icons";
import { useWalletModal } from "../WalletModalContext";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

// Chains featured directly in the hero (rest collapse into "and many more").
const FEATURED_CODES = ["ARB", "ETH", "BASE", "SOL"];
const FEATURED_CHAINS = FEATURED_CODES.map(
  (code) => ALL_CHAINS.find((c) => c.code === code)!,
);
const ARB = ALL_CHAINS.find((c) => c.code === "ARB")!;

export function LandingHero() {
  const { open } = useWalletModal();

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-40 md:px-12 md:pt-40">
      {/* top glow — no grid backdrop, glow only */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-120px] h-[500px] w-[700px] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse, rgba(196,255,0,0.10) 0%, transparent 70%)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto max-w-[900px] text-center"
      >
        <motion.div variants={item} className="mb-8 inline-flex items-center gap-2 rounded-full border border-[rgba(196,255,0,0.2)] bg-lime-dim px-3.5 py-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-lime"
            style={{ boxShadow: "0 0 6px var(--lime)" }}
          />
          <span className="flex items-center gap-1.5">
            {getChainLogo(ARB.code, 16)}
            <span className="text-[12px] font-semibold tracking-[0.04em] text-lime">
              Now live on ARC TESTNET
            </span>
          </span>
        </motion.div>

        <motion.h1
          variants={item}
          className="font-display font-bold leading-[0.92] tracking-[-0.04em] text-ink"
          style={{ fontSize: "clamp(64px, 8vw, 110px)" }}
        >
          <span className="block">DEFI AT</span>
          <span className="block text-lime">FULL CHARGE</span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mx-auto mt-6 max-w-[560px] text-[18px] font-light leading-relaxed text-ink-2"
        >
          Swap, bridge, and deploy tokens across every major chain with
          institutional-grade speed and zero compromise on security.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-wrap justify-center gap-3">
          <AccentButton onClick={open} size="lg">
            ⚡ Launch App
          </AccentButton>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-16 flex flex-wrap items-center justify-center gap-2.5"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Supported Chains
          </span>
          {FEATURED_CHAINS.map((c) => (
            <div
              key={c.code}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5"
            >
              {getChainLogo(c.code, 18)}
              <span className="text-[13px] font-semibold text-ink">{c.name}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5">
            <span className="text-[13px] font-medium text-ink-3">and many more →</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
