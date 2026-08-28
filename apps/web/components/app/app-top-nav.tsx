"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@charge/ui";
import { useWallet } from "@charge/web3";
import { ARC_CHAIN_ID, ALL_CHAIN_IDS, EVM_CHAIN_BY_ID } from "@charge/chains";

import { APP_NAV, NAV_GROUPS, type NavGroup } from "@/lib/nav";
import { ChargeLogo } from "@/components/logo";
import { WalletButton } from "@/components/app/wallet-button";
import { ChainIcon } from "@/components/app/token-icon";
import { GlobalSearch } from "@/components/app/global-search";
import { LaunchAppButton } from "@/components/connect-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavPill } from "@/components/motion";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

function NavLink({ href, label, exact }: { href: string; label: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, href, exact);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-fg" : "text-fg-secondary hover:text-fg",
      )}
    >
      {active && <NavPill active={active} />}
      {label}
    </Link>
  );
}

/**
 * Compact network pill for the top bar. Reads the active chain from the global
 * wallet context and switches via switchChain() — no new state, no new deps.
 * Desktop only; mobile keeps its per-page selector.
 */
function ChainPill() {
  const { chainId, switchChain, isConnected } = useWallet();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const ordered = React.useMemo(
    () => [ARC_CHAIN_ID, ...ALL_CHAIN_IDS.filter((id) => id !== ARC_CHAIN_ID)],
    [],
  );

  if (!isConnected) return null;

  const def = EVM_CHAIN_BY_ID.get(chainId ?? ARC_CHAIN_ID);
  const label = def?.name ?? "Arc Testnet";

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-fg/[0.08] bg-fg/[0.04] px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-fg/[0.08]"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/70 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        <ChainIcon chainId={chainId ?? ARC_CHAIN_ID} size={16} />
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 max-h-80 w-60 overflow-y-auto rounded-2xl border border-fg/10 bg-panel p-1.5 shadow-2xl shadow-black/30"
        >
          {ordered.map((id) => {
            const d = EVM_CHAIN_BY_ID.get(id);
            if (!d) return null;
            const active = id === chainId;
            return (
              <button
                key={id}
                role="menuitem"
                type="button"
                onClick={() => {
                  switchChain(id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-charge/15 text-charge"
                    : "text-fg-secondary hover:bg-fg/[0.06] hover:text-fg",
                )}
              >
                <span className="flex items-center gap-2">
                  {active && <span className="size-1.5 rounded-full bg-charge" aria-hidden />}
                  <ChainIcon chainId={id} size={18} />
                  {d.name}
                  {id === ARC_CHAIN_ID && (
                    <span className="text-[10px] uppercase tracking-wide text-charge/70">
                      gas: USDC
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppTopNav() {
  const pathname = usePathname();
  const { isConnected } = useWallet();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-fg/[0.08] bg-base/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charge/60"
        >
          <ChargeLogo className="size-8" />
          <span className="text-xl font-semibold tracking-tight">Chargefi</span>
        </Link>

        {/* Primary nav — grouped Trade / Earn / Explore with dividers.
            Active item gets a sliding pill (NavPill, shared layoutId). */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_GROUPS.map((group: NavGroup, gi) => (
            <React.Fragment key={group}>
              {gi > 0 && (
                <span
                  className="mx-1 h-5 w-px bg-fg/[0.10]"
                  aria-hidden
                />
              )}
              <div className="flex items-center gap-1">
                {APP_NAV.filter((n) => n.group === group).map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </React.Fragment>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <ChainPill />
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true }),
              );
            }}
            className="hidden size-9 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-fg/[0.06] hover:text-fg lg:flex"
            aria-label="Search"
          >
            <Search className="size-4" />
          </button>
          <ThemeToggle />
          {isConnected ? (
            <WalletButton />
          ) : (
            <LaunchAppButton size="sm">Launch app</LaunchAppButton>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-fg-secondary transition-colors hover:bg-fg/[0.06] hover:text-fg lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet — grouped by section header. */}
      {mobileOpen && (
        <div className="border-t border-fg/[0.08] bg-base/95 px-4 py-4 backdrop-blur-xl lg:hidden">
          <div className="mb-3">
            <GlobalSearch inline />
          </div>
          <nav className="grid gap-4" aria-label="Primary mobile">
            {NAV_GROUPS.map((group: NavGroup) => (
              <div key={group}>
                <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
                  {group}
                </p>
                <div className="grid gap-1">
                  {APP_NAV.filter((n) => n.group === group).map((item) => {
                    const active = isActive(pathname, item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-fg/[0.06] text-fg"
                            : "text-fg-secondary hover:bg-fg/[0.04] hover:text-fg",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
