"use client";

import { Mail, PenLine, Wallet } from "lucide-react";

const STEPS = [
  {
    icon: Mail,
    step: "01",
    title: "Sign in with email",
    body: "Enter an email address and Privy provisions a secure account for you. No extension to install, no seed phrase to write down, no separate app.",
  },
  {
    icon: Wallet,
    step: "02",
    title: "Fund it with USDC",
    body: "Send USDC to your address, or grab testnet funds from Circle's faucet. That same balance pays for gas — there is no second token to acquire.",
  },
  {
    icon: PenLine,
    step: "03",
    title: "Sign and go",
    body: "Swap, bridge, send or launch a token. Every action is signed by your own account, and the exact amounts and fees are shown before you approve.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how" className="relative py-24 sm:py-32">
      <div
        className="absolute inset-x-0 top-1/3 -z-10 h-64 opacity-40 blur-[100px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(39,117,202,0.16) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">
            From nothing to onchain
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Three steps. No crypto knowledge required.
          </h2>
        </div>

        <ol className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, step, title, body }) => (
            <li key={step} className="relative">
              <div className="glass h-full rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white/[0.06] text-fg-secondary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-3xl font-semibold tabular-nums text-white/25">
                    {step}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-2 leading-relaxed text-fg-secondary">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "Do I need a crypto wallet to use Charge?",
    a: "No. Signing in with email creates a secure account for you automatically. If you already have a wallet like MetaMask, you can connect that instead — both paths give you the same features.",
  },
  {
    q: "What is Arc?",
    a: "Arc is a Layer 1 blockchain built by Circle, the issuer of USDC. Its defining property is that USDC is the native gas token, so transaction fees are paid in dollars rather than a volatile asset you have to buy first.",
  },
  {
    q: "Does Charge hold my funds?",
    a: "Never. Charge is entirely non-custodial. It holds no private keys and cannot move your funds. Every transaction is signed by your own account, and you approve each one.",
  },
  {
    q: "How does bridging work?",
    a: "Charge uses Circle's CCTP. Your USDC is burned on the source chain and an equal amount is minted natively on the destination after Circle attests to the burn. You always end up with real USDC, never a wrapped derivative.",
  },
  {
    q: "Can the tokens I launch be inflated later?",
    a: "No. The contract has no mint function and no admin role. The full supply is created once at deployment and sent to you. Nobody, including Charge, can create more.",
  },
  {
    q: "Is this real money?",
    a: "Not right now. Charge runs on Arc Testnet, where tokens are free from Circle's faucet and hold no monetary value. It is for testing and exploration.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-charge">
            Questions
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Straight answers
          </h2>
        </div>

        <div className="mt-14 space-y-3">
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group glass rounded-2xl px-6 py-5 transition-colors hover:border-white/[0.14]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  className="shrink-0 text-fg-tertiary transition-transform duration-200 group-open:rotate-45"
                  aria-hidden
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 3v10M3 8h10"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-fg-secondary">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
