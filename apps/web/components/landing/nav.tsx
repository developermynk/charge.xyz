"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@charge/ui";

import { LaunchAppButton } from "@/components/connect-modal";
import { ChargeLogo } from "@/components/logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "border-b border-white/[0.08] bg-base/80 backdrop-blur-xl"
            : "border-b border-transparent"
        }`}
      >
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
          aria-label="Main"
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charge/60"
          >
            <ChargeLogo className="size-7" />
            <span className="text-lg font-semibold tracking-tight">
              Charge
              <span className="text-fg-tertiary">.xyz</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-fg-secondary transition-colors hover:text-fg"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:block">
            <LaunchAppButton size="sm">
              Launch app
            </LaunchAppButton>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-fg-secondary transition-colors hover:bg-white/[0.06] hover:text-fg md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </nav>

        {mobileOpen && (
          <div className="border-t border-white/[0.08] bg-base/95 px-6 py-5 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-4">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-fg-secondary transition-colors hover:text-fg"
                >
                  {l.label}
                </a>
              ))}
              <LaunchAppButton
                size="sm"
                block
              >
                Launch app
              </LaunchAppButton>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
