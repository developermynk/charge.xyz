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
import { useWalletModal } from "../WalletModalContext";

export function LandingCTA() {
  const { open } = useWalletModal();

  return (
    <section className="relative overflow-hidden px-6 pb-28 pt-20 text-center md:px-12">
      <div
        className="pointer-events-none absolute bottom-[-100px] left-1/2 h-[300px] w-[700px] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse, rgba(196,255,0,0.08) 0%, transparent 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: easeOut }}
        className="relative mx-auto max-w-[600px]"
      >
        <h2 className="font-display text-[56px] font-bold leading-none tracking-[-0.03em] text-ink">
          Ready to plug in?
        </h2>
        <p className="mx-auto mb-9 mt-5 text-[16px] font-light leading-relaxed text-ink-2">
          Join traders who use Charge.xyz for every on-chain move. No sign-up
          required. Just connect and go.
        </p>
        <AccentButton onClick={open} size="lg">
          ⚡ Launch Charge App
        </AccentButton>
      </motion.div>
    </section>
  );
}
