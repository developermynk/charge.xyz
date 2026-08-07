"use client";

import { ArrowRight } from "lucide-react";

import { LaunchAppButton } from "@/components/connect-modal";

export function LandingCta() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="glass-strong relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16">
          <div
            className="absolute inset-0 -z-10 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(0,229,138,0.16) 0%, transparent 62%)",
            }}
            aria-hidden
          />
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Start with an email.
            <br />
            <span className="text-gradient-charge">Finish onchain.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-lg text-fg-secondary">
            No extension, no seed phrase, no gas token. Just USDC on Arc.
          </p>
          <div className="mt-9 flex justify-center">
            <LaunchAppButton size="lg">
              Launch Charge
              <ArrowRight className="size-4" aria-hidden />
            </LaunchAppButton>
          </div>
        </div>
      </div>
    </section>
  );
}
