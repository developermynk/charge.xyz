/**
 * Single source of truth for the app's primary navigation.
 * Both the desktop top bar and the mobile sheet render from this.
 *
 * Items are grouped by function (Trade / Earn / Explore) so the bar reads as
 * logical clusters instead of nine flat links. The `group` field drives the
 * dividers + mobile section headers in AppTopNav.
 */
export type NavGroup = "Trade" | "Earn" | "Explore";

export interface NavItem {
  href: string;
  label: string;
  group: NavGroup;
  /** When true, the item is the active route only on an exact match. */
  exact?: boolean;
}

/** Group display order (left → right). */
export const NAV_GROUPS: NavGroup[] = ["Trade", "Earn", "Explore"];

export const APP_NAV: NavItem[] = [
  { href: "/app/swap", label: "Swap", group: "Trade" },
  { href: "/app/bridge", label: "Bridge", group: "Trade" },
  { href: "/app/send", label: "Send", group: "Trade" },
  { href: "/app/receive", label: "Receive", group: "Trade" },
  { href: "/app/pools", label: "Pool", group: "Earn" },
  { href: "/app/create", label: "Launch", group: "Earn" },
  { href: "/app/market", label: "Market", group: "Explore" },
  { href: "/app", label: "Portfolio", exact: true, group: "Explore" },
  { href: "/app/history", label: "History", group: "Explore" },
];
