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

import { useEffect, useState } from "react";
import { GhostButton, AccentButton } from "../ui";
import { useWalletModal } from "../WalletModalContext";

const LINKS = ["Products", "Developers", "Community", "Analytics"];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { open } = useWalletModal();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between px-6 md:px-12"
      style={{
        background: scrolled ? "rgba(5,5,6,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--line)" : "transparent"}`,
        transition: "all 0.3s ease",
      }}
    >
      <div className="flex items-center gap-1">
        <span className="font-display text-2xl font-bold text-lime">⚡</span>
        <span className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
          Charge
        </span>
        <span className="font-display text-[22px] font-normal text-ink-3">.xyz</span>
      </div>

      <div className="hidden items-center gap-1.5 md:flex">
        {LINKS.map((l) => (
          <GhostButton key={l}>{l}</GhostButton>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <AccentButton onClick={open}>Launch App →</AccentButton>
      </div>
    </nav>
  );
}
