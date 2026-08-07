"use client";

import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

import { Badge, Button } from "@charge/ui";

import { LaunchAppButton } from "@/components/connect-modal";

/**
 * Hero.
 *
 * The headline sells Arc's one genuinely novel property — USDC is the gas —
 * rather than generic "fast, secure, decentralized" filler that says nothing.
 */
export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      {/* Ambient field */}
      <div className="grid-bg absolute inset-0 -z-20 opacity-60" aria-hidden />
      <div
        className="absolute left-1/2 top-0 -z-10 h-[620px] w-[1100px] -translate-x-1/2 rounded-full opacity-70 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,229,138,0.16) 0%, rgba(39,117,202,0.10) 42%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-base to-transparent"
        aria-hidden
      />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="charge" className="mb-7 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-charge opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-charge" />
            </span>
            Live on Arc Testnet
          </Badge>

          <h1 className="animate-in fade-in slide-in-from-bottom-3 text-balance text-5xl font-semibold leading-[1.05] tracking-tight duration-700 sm:text-7xl">
            <span className="text-gradient">Your money is</span>
            <br />
            <span className="text-gradient-charge">also your gas.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-pretty text-lg leading-relaxed text-fg-secondary animate-in fade-in slide-in-from-bottom-4 duration-700">
            Charge is the control panel for Arc — Circle&apos;s Layer 1 where USDC
            pays for transactions. Swap, bridge, launch tokens and send funds
            without ever buying a separate gas token.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-in fade-in slide-in-from-bottom-5 duration-700">
            <LaunchAppButton size="xl">
              <Zap className="size-4" aria-hidden />
              Launch app
            </LaunchAppButton>
            <Button size="xl" variant="secondary" asChild>
              <Link href="#features" className="inline-flex items-center gap-2">
                See how it works
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-fg-tertiary animate-in fade-in duration-1000">
            Sign in with email — no wallet, no seed phrase, no browser extension.
          </p>
        </div>

        {/* Product preview */}
        <div className="relative mx-auto mt-20 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="glass-strong rounded-3xl p-2 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95)]">
            <div className="rounded-[20px] border border-white/[0.06] bg-elevated/80 p-6 sm:p-8">
              <HeroPreview />
            </div>
          </div>
          {/* Reflected glow under the panel */}
          <div
            className="absolute -bottom-8 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-charge/20 blur-[60px]"
            aria-hidden
          />
        </div>
      </div>

      {/* Product preview */}
      <div className="relative mx-auto mt-20 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="glass-strong rounded-3xl p-2 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95)]">
          <div className="rounded-[20px] border border-white/[0.06] bg-elevated/80 p-6 sm:p-8">
            <HeroPreview />
          </div>
        </div>
        {/* Reflected glow under the panel */}
        <div
          className="absolute -bottom-8 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-charge/20 blur-[60px]"
          aria-hidden
        />
      </div>
      </section>
  );
}

/** A static, honest representation of the swap panel — not a fake screenshot. */
function HeroPreview() {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
          You pay
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-3xl font-medium tabular-nums text-fg">
            1,000.00
          </span>
          <span className="rounded-lg bg-accent/15 px-2.5 py-1 text-sm font-semibold text-accent">
            USDC
          </span>
        </div>
        <p className="mt-2 text-xs text-fg-tertiary">Balance 12,480.55</p>
      </div>

      <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-charge/25 bg-charge/10 text-charge sm:rotate-0">
        <ArrowRight className="size-4" aria-hidden />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
          You receive
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-3xl font-medium tabular-nums text-fg">
            921.44
          </span>
          <span className="rounded-lg bg-charge/15 px-2.5 py-1 text-sm font-semibold text-charge">
            EURC
          </span>
        </div>
        <p className="mt-2 text-xs text-fg-tertiary">
          Gas paid in USDC · ~$0.001
        </p>
      </div>
    </div>
  );
}
