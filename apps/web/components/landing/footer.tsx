import Link from "next/link";

import { ChargeLogo } from "@/components/logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-fg/[0.08] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <ChargeLogo className="size-8" />
              <span className="text-xl font-semibold tracking-tight">
                Charge
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
              The USDC-native control panel for Arc, Circle&apos;s Layer 1
              blockchain.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterColumn
              title="Product"
              links={[
                { href: "/app/swap", label: "Swap" },
                { href: "/app/bridge", label: "Bridge" },
                { href: "/app/create", label: "Launch token" },
                { href: "/app/send", label: "Send" },
              ]}
            />
            <FooterColumn
              title="Arc"
              links={[
                { href: "https://docs.arc.io", label: "Arc docs", external: true },
                {
                  href: "https://faucet.circle.com",
                  label: "Testnet faucet",
                  external: true,
                },
                {
                  href: "https://explorer.testnet.arc.network",
                  label: "Explorer",
                  external: true,
                },
              ]}
            />
            <FooterColumn
              title="Circle"
              links={[
                {
                  href: "https://developers.circle.com",
                  label: "Developer docs",
                  external: true,
                },
                {
                  href: "https://developers.circle.com/cctp",
                  label: "CCTP",
                  external: true,
                },
                { href: "https://www.circle.com/usdc", label: "USDC", external: true },
              ]}
            />
          </div>

          <div className="mt-10 flex items-center gap-4 border-t border-fg/[0.08] pt-6">
            <a
              href="https://x.com/Charge01_"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-fg/10 px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:text-fg"
            >
              X
            </a>
            <a
              href="https://chargexyz.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-fg/10 px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:text-fg"
            >
              Website
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-fg/[0.08] pt-8 text-sm text-fg-tertiary sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Chargefi</p>
          <p>
            Running on Arc Testnet. Testnet tokens hold no monetary value.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-fg-secondary transition-colors hover:text-fg"
              >
                {l.label}
              </a>
            ) : (
              <Link
                href={l.href}
                className="text-sm text-fg-secondary transition-colors hover:text-fg"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
