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

import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

/** Frosted surface panel — the design's `GlassCard`. */
export function GlassCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`border border-line bg-surface-2 rounded-2xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

type AccentSize = "sm" | "md" | "lg";

const ACCENT_PAD: Record<AccentSize, string> = {
  lg: "14px 36px",
  sm: "8px 16px",
  md: "11px 24px",
};
const ACCENT_FONT: Record<AccentSize, number> = { lg: 16, sm: 13, md: 14 };

/** Primary lime call-to-action button. */
export function AccentButton({
  children,
  onClick,
  full = false,
  size = "md",
  disabled = false,
  className = "",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  full?: boolean;
  size?: AccentSize;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold tracking-[0.01em] transition-all duration-150 hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:hover:brightness-100 ${full ? "w-full" : ""} ${className}`}
      style={{
        background: disabled ? "var(--surface-3)" : "var(--lime)",
        color: disabled ? "var(--ink-3)" : "#080808",
        padding: ACCENT_PAD[size],
        fontSize: ACCENT_FONT[size],
        boxShadow: disabled ? "none" : "0 0 24px var(--lime-glow)",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Quiet text button with an optional active/lime state. */
export function GhostButton({
  children,
  onClick,
  active = false,
  full = false,
  className = "",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  full?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-[9px] font-medium tracking-[0.01em] whitespace-nowrap transition-all duration-150 ${full ? "w-full" : ""} ${className}`}
      style={{
        background: active ? "var(--lime-dim)" : "transparent",
        color: active ? "var(--lime)" : "var(--ink-2)",
        padding: "9px 14px",
        border: active ? "1px solid rgba(196,255,0,0.2)" : "1px solid transparent",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
