/**
 * Single source of truth for the app's primary navigation.
 * Both the desktop top bar and the mobile sheet render from this. Links are
 * text-only by design — icons cram the bar (Linear/Kraken pattern).
 */
export interface NavItem {
  href: string;
  label: string;
  /** When true, the item is the active route only on an exact match. */
  exact?: boolean;
}

export const APP_NAV: NavItem[] = [
  { href: "/app", label: "Portfolio", exact: true },
  { href: "/app/swap", label: "Swap" },
  { href: "/app/pools", label: "Pool" },
  { href: "/app/bridge", label: "Bridge" },
  { href: "/app/send", label: "Send" },
  { href: "/app/receive", label: "Receive" },
  { href: "/app/history", label: "History" },
  { href: "/app/market", label: "Market" },
  { href: "/app/create", label: "Launch" },
];
