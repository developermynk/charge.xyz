"use client";

import * as React from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { APP_NAV } from "@/lib/nav";
import { SEED_TOKENS } from "@/lib/market-data";

interface Result {
  label: string;
  hint: string;
  href: string;
  kind: "page" | "token";
}

/**
 * Global command palette — ⌘K / Ctrl+K, Jupiter/Linear style.
 *
 * On desktop the top nav shows only a search icon that opens this; on mobile
 * the input renders inline. Filters app routes + seeded Market tokens.
 */
export function GlobalSearch({ inline = false }: { inline?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Result[] = APP_NAV.filter(
      (n) => !q || n.label.toLowerCase().includes(q),
    ).map((n) => ({ label: n.label, hint: "Page", href: n.href, kind: "page" }));

    if (!q) return pages.slice(0, 6);

    const tokens: Result[] = SEED_TOKENS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q),
    ).map((t) => ({
      label: `${t.name} (${t.symbol})`,
      hint: "Token",
      href: `/app/market/${t.id}`,
      kind: "token",
    }));

    return [...pages, ...tokens].slice(0, 8);
  }, [query]);

  // ⌘K / Ctrl+K opens the palette (desktop icon mode only).
  React.useEffect(() => {
    if (inline) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inline]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  React.useEffect(() => setActive(0), [query]);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  function go(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  /* Inline mode — mobile only: a full-width search field. */
  if (inline) {
    return (
      <div ref={ref} className="relative w-full">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search tokens, pages, actions…"
            className="h-10 w-full rounded-xl border border-fg/[0.08] bg-fg/[0.03] pl-9 pr-3 text-sm text-fg placeholder:text-fg-tertiary focus:border-charge/40 focus:outline-none focus:ring-2 focus:ring-charge/30"
            aria-label="Search"
          />
        </div>
        {open && results.length > 0 && <ResultsList results={results} active={active} onHover={setActive} onPick={go} />}
      </div>
    );
  }

  /* Icon mode — desktop: a search trigger that opens the palette. */
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 text-sm text-fg-tertiary transition-colors hover:bg-fg/[0.06] hover:text-fg-secondary"
        aria-label="Search (⌘K)"
      >
        <Search className="size-4" />
        <span className="hidden xl:inline">Search</span>
        <kbd className="hidden rounded border border-fg/10 bg-fg/[0.06] px-1.5 text-[11px] text-fg-tertiary xl:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-fg/[0.08] bg-panel/95 shadow-panel backdrop-blur-xl">
          <div className="border-b border-fg/[0.06] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search tokens, pages, actions…"
                className="h-10 w-full rounded-lg bg-transparent pl-9 pr-3 text-sm text-fg placeholder:text-fg-tertiary focus:outline-none"
                aria-label="Search"
              />
            </div>
          </div>
          {results.length > 0 && (
            <ResultsList results={results} active={active} onHover={setActive} onPick={go} />
          )}
        </div>
      )}
    </div>
  );
}

function ResultsList({
  results,
  active,
  onHover,
  onPick,
}: {
  results: Result[];
  active: number;
  onHover: (i: number) => void;
  onPick: (href: string) => void;
}) {
  return (
    <div className="max-h-80 overflow-y-auto p-1.5">
      {results.map((r, i) => (
        <button
          key={r.href}
          type="button"
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(r.href)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            i === active ? "bg-fg/[0.06]" : "hover:bg-fg/[0.04]"
          }`}
        >
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
              r.kind === "token"
                ? "bg-charge/15 text-charge"
                : "bg-fg/[0.06] text-fg-secondary"
            }`}
          >
            {r.kind === "token" ? "◎" : "→"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-fg">{r.label}</span>
            <span className="block text-xs text-fg-tertiary">{r.hint}</span>
          </span>
          {i === active && <CornerDownLeft className="size-3.5 text-fg-tertiary" />}
        </button>
      ))}
    </div>
  );
}
