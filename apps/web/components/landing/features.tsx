"use client";

import {
  ArrowLeftRight,
  Coins,
  Fuel,
  Send,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@charge/ui";

const FEATURES = [
  {
    icon: ArrowLeftRight,
    title: "Swap",
    body: "Trade USDC, EURC and any Arc token through Circle's routing. Quotes refresh live and every figure is shown before you sign.",
    href: "/app/swap",
    accent: "charge" as const,
  },
  {
    icon: Waypoints,
    title: "Bridge",
    body: "Move real USDC across chains with CCTP — burned on the source, minted on the destination. No wrapped IOUs, no third-party custody.",
    href: "/app/bridge",
    accent: "accent" as const,
  },
  {
    icon: Coins,
    title: "Launch a token",
    body: "Deploy a fixed-supply ERC-20 on Arc in one transaction. No mint function, no admin keys — you hold 100% of supply from block one.",
    href: "/app/create",
    accent: "charge" as const,
  },
  {
    icon: Send,
    title: "Send",
    body: "Transfer USDC to any address in seconds. Gas costs a fraction of a cent and is paid in the same USDC you are sending.",
    href: "/app/send",
    accent: "accent" as const,
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-charge">
            Everything on one chain
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Four tools. <span className="text-gradient">Zero gas tokens.</span>
          </h2>
          <p className="mt-4 text-pretty text-lg text-fg-secondary">
            On every other chain you need its native token before you can move a
            dollar. On Arc, the dollar is the token.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body, href, accent }) => (
            <Link key={title} href={href} className="group block">
              <Card className="h-full p-6 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]">
                <span
                  className={`inline-flex size-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${
                    accent === "charge"
                      ? "bg-charge/15 text-charge"
                      : "bg-accent/15 text-accent"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-2 text-pretty leading-relaxed text-fg-secondary">
                  {body}
                </p>
              </Card>
            </Link>
          ))}
        </div>

        {/* The two structural guarantees, stated plainly. */}
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Card className="p-6">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white/[0.06] text-fg-secondary">
              <Fuel className="size-5" aria-hidden />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              Gas is USDC
            </h3>
            <p className="mt-2 leading-relaxed text-fg-secondary">
              Arc uses USDC as its native gas asset. Fund an account with
              dollars and it is immediately ready to transact — no bridging in a
              gas token first.
            </p>
          </Card>

          <Card className="p-6">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white/[0.06] text-fg-secondary">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              Non-custodial by construction
            </h3>
            <p className="mt-2 leading-relaxed text-fg-secondary">
              Charge holds no keys and no funds. Every transaction is signed in
              your own wallet — including the ones made from an email account.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
