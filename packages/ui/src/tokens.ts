/**
 * Charge.xyz design tokens.
 *
 * Direction from `ui-ux-pro-max/scripts/search.py` for
 * "defi swap bridge dapp dark professional fintech":
 *   primary style  : Glassmorphism + Dark Mode (OLED)
 *   secondary      : Motion-Driven
 *   dashboard      : Real-Time Monitoring + Data-Dense
 *   palette focus  : dark tech base + trust + vibrant accent
 *
 * Charge's own reading of that: the product's one idea is that your money is
 * also your gas. So the accent is an electric "charged" green used ONLY for
 * live/positive/actionable state, and USDC's own blue carries trust.
 */

export const colors = {
  /* Base — true OLED black so the glass panels read as lit surfaces. */
  bg: "#08090C",
  bgElevated: "#0E1015",
  bgPanel: "#12141B",
  bgHover: "#181B24",

  /* Charge green — the accent. Reserved for action + positive state. */
  primary: "#00E58A",
  primaryHover: "#22F5A0",
  primaryMuted: "rgba(0, 229, 138, 0.12)",
  primaryGlow: "rgba(0, 229, 138, 0.35)",

  /* USDC blue — trust, links, secondary emphasis. */
  accent: "#2775CA",
  accentHover: "#3B8AE0",
  accentMuted: "rgba(39, 117, 202, 0.14)",

  /* Semantic. */
  success: "#00E58A",
  warning: "#FFB020",
  danger: "#FF4D4D",
  dangerMuted: "rgba(255, 77, 77, 0.12)",

  /* Text ramp — AA contrast on bg at every step. */
  text: "#F2F4F8",
  textSecondary: "#9BA3B4",
  textTertiary: "#5F6878",
  textDisabled: "#3A4150",

  /* Lines + glass. */
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  glass: "rgba(255, 255, 255, 0.03)",
  glassStrong: "rgba(255, 255, 255, 0.06)",
} as const;

export const radius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "28px",
  full: "9999px",
} as const;

export const space = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
  "3xl": "64px",
} as const;

/** Motion: fast enough to feel instant, slow enough to be readable. */
export const motion = {
  fast: "150ms",
  base: "200ms",
  slow: "320ms",
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const font = {
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

export type Colors = typeof colors;
