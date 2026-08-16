"use client";

import { Check, Copy, LogOut } from "lucide-react";
import * as React from "react";

import { useWallet } from "@charge/web3";

/**
 * Wallet button → account popover.
 *
 * This is the ONLY place account identity lives now. The old sidebar footer
 * duplicated the address; that is gone. Clicking opens a popover with the
 * address, copy, network, and sign-out — the Zerion/Rabby pattern.
 */
export function WalletButton() {
  const { address, method, disconnect } = useWallet();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!address) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl border border-fg/[0.08] bg-fg/[0.04] py-1.5 pl-1.5 pr-3 transition-colors hover:bg-fg/[0.07]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-charge/20 text-xs font-semibold text-charge">
          {address.slice(2, 4).toUpperCase()}
        </span>
        <span className="font-mono text-sm text-fg">
          {`${address.slice(0, 6)}…${address.slice(-4)}`}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-fg/[0.08] bg-panel/95 p-2 shadow-panel backdrop-blur-xl"
        >
          <div className="rounded-xl bg-fg/[0.03] p-3">
            <p className="text-xs text-fg-tertiary">
              {method === "email" ? "Email account" : "Connected wallet"}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-fg">{address}</p>
          </div>
          <button
            type="button"
            onClick={() => void copy()}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-fg-secondary transition-colors hover:bg-fg/[0.05] hover:text-fg"
          >
            {copied ? (
              <Check className="size-4 text-success" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy address"}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
