"use client";

import { Check, ChevronDown, Network } from "lucide-react";
import * as React from "react";

import { cn } from "@charge/ui";
import { ALL_CHAIN_IDS, ARC_CHAIN_ID, EVM_CHAIN_BY_ID } from "@charge/chains";

/**
 * Network picker used on the Portfolio page. Active selection shows in the
 * trigger; opening it reveals every chain with `All networks` pinned to the
 * top and `Arc Testnet` second, so the two most-used entries are always first.
 */
export function ChainSelect({
  value,
  onChange,
}: {
  value: number | "all";
  onChange: (next: number | "all") => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const ordered = React.useMemo(() => {
    const others = ALL_CHAIN_IDS.filter((id) => id !== ARC_CHAIN_ID);
    return [ARC_CHAIN_ID, ...others];
  }, []);

  const label =
    value === "all"
      ? "All networks"
      : (EVM_CHAIN_BY_ID.get(value)?.name ?? `Chain ${value}`);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full bg-fg/[0.06] px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-fg/[0.1]"
      >
        <Network className="size-4 text-fg-secondary" aria-hidden />
        {label}
        <ChevronDown className="size-4 text-fg-tertiary" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-2xl border border-fg/10 bg-panel p-1.5 shadow-2xl shadow-black/20">
          <button
            type="button"
            onClick={() => {
              onChange("all");
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors",
              value === "all"
                ? "bg-charge/15 text-charge"
                : "text-fg-secondary hover:bg-fg/[0.06] hover:text-fg",
            )}
          >
            <span className="flex items-center gap-2">
              <Network className="size-4" aria-hidden />
              All networks
            </span>
            {value === "all" && <Check className="size-4" aria-hidden />}
          </button>

          <div className="my-1 h-px bg-fg/[0.06]" />

          {ordered.map((id) => {
            const def = EVM_CHAIN_BY_ID.get(id);
            if (!def) return null;
            const active = value === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onChange(id);
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
                  {active && (
                    <span className="size-1.5 rounded-full bg-charge" aria-hidden />
                  )}
                  {def.name}
                  {id === ARC_CHAIN_ID && (
                    <span className="text-[10px] uppercase tracking-wide text-charge/70">
                      gas: USDC
                    </span>
                  )}
                </span>
                {active && <Check className="size-4" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
