"use client";

import {
  ArrowLeftRight,
  Coins,
  LayoutDashboard,
  LogOut,
  QrCode,
  Send,
  TrendingUp,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge, Button, cn } from "@charge/ui";
import { useWallet } from "@charge/web3";

import { ChargeLogo } from "@/components/logo";

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/app/bridge", label: "Bridge", icon: Waypoints },
  { href: "/app/send", label: "Send", icon: Send },
  { href: "/app/receive", label: "Receive", icon: QrCode },
  { href: "/app/market", label: "Market", icon: TrendingUp },
  { href: "/app/create", label: "Launch token", icon: Coins },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { address, method, disconnect } = useWallet();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-fg/[0.08] bg-elevated/40 px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <ChargeLogo className="size-8" />
        <span className="text-xl font-semibold tracking-tight">
          Charge
        </span>
      </Link>

      <nav className="flex-1 space-y-1" aria-label="Application">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200",
                active
                  ? "bg-charge/10 font-medium text-charge"
                  : "text-fg-secondary hover:bg-fg/[0.05] hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-fg/[0.08] pt-4">
        <div className="px-2">
          {address ? (
            <>
              <p className="text-xs text-fg-tertiary">
                {method === "email" ? "Signed in with email" : "Connected wallet"}
              </p>
              <p className="mt-0.5 font-mono text-sm text-fg">
                {`${address.slice(0, 6)}…${address.slice(-4)}`}
              </p>
            </>
          ) : (
            /*
              An em-dash reads as "empty", not as "disconnected". Say the state
              in words and pair it with a status dot so it is legible at a
              glance and to a screen reader.
            */
            <>
              <p className="text-xs text-fg-tertiary">Wallet</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fg-secondary">
                <span
                  className="size-1.5 shrink-0 rounded-full bg-fg-tertiary"
                  aria-hidden
                />
                Not connected
              </p>
            </>
          )}
        </div>
        {/* Only offer sign-out when there is a session to end. */}
        {address && (
          <Button
            variant="ghost"
            size="sm"
            block
            onClick={() => void disconnect()}
            className="justify-start"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        )}
      </div>
    </aside>
  );
}

/** Mobile bottom bar — the sidebar is hidden below lg. */
export function AppMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-fg/[0.08] bg-base/95 backdrop-blur-xl lg:hidden"
      aria-label="Application"
    >
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] transition-colors",
              active ? "text-charge" : "text-fg-tertiary hover:text-fg",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Warns when the wallet is connected to something other than Arc. */
export function WrongNetworkBanner() {
  const { isConnected, isOnArc, switchToArc } = useWallet();

  if (!isConnected || isOnArc) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Badge tone="warning">Wrong network</Badge>
        <p className="text-sm text-fg-secondary">
          Charge only works on Arc Testnet.
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => void switchToArc()}>
        Switch to Arc
      </Button>
    </div>
  );
}
