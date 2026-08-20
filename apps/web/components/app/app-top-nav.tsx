"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@charge/ui";
import { useWallet } from "@charge/web3";

import { APP_NAV } from "@/lib/nav";
import { ChargeLogo } from "@/components/logo";
import { WalletButton } from "@/components/app/wallet-button";
import { GlobalSearch } from "@/components/app/global-search";
import { LaunchAppButton } from "@/components/connect-modal";
import { ThemeToggle } from "@/components/theme-toggle";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function AppTopNav() {
  const pathname = usePathname();
  const { isConnected } = useWallet();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-fg/[0.08] bg-base/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charge/60"
        >
          <ChargeLogo className="size-8" />
          <span className="text-xl font-semibold tracking-tight">
            Chargefi
          </span>
        </Link>

        {/* Primary functions — text-only, Linear-style. Icons removed: they
            cram the bar. Active state is a subtle pill, not color noise. */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {APP_NAV.map(({ href, label, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-fg/[0.06] text-fg"
                    : "text-fg-secondary hover:text-fg",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden lg:block">
            <GlobalSearch />
          </div>
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

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="border-t border-fg/[0.08] bg-base/95 px-4 py-4 backdrop-blur-xl lg:hidden">
          <div className="mb-3">
            <GlobalSearch inline />
          </div>
          <nav className="grid gap-1" aria-label="Primary mobile">
            {APP_NAV.map(({ href, label, exact }) => {
              const active = isActive(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-fg/[0.06] text-fg"
                      : "text-fg-secondary hover:bg-fg/[0.04] hover:text-fg",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
