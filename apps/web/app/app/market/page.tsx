"use client";

import * as React from "react";
import { Star, Clock, Flame } from "lucide-react";
import Link from "next/link";

import { Card } from "@charge/ui";
import { EVM_CHAIN_BY_ID, ARC_CHAIN_ID } from "@charge/chains";
import { ChainSelect } from "@/components/app/chain-select";

import { SEED_TOKENS, type MarketToken } from "@/lib/market-data";

type Tab = "trending" | "recents" | "watchlist";

const WATCH_KEY = "charge.market.watchlist";

export default function MarketPage() {
  const [tab, setTab] = React.useState<Tab>("trending");
  const [chain, setChain] = React.useState<number | "all">(ARC_CHAIN_ID);
  const [watch, setWatch] = React.useState<string[]>([]);
  const [launches, setLaunches] = React.useState<
    {
      id: string;
      name: string;
      symbol: string;
      chainId: number;
      price: number;
      marketCap: number;
      change24h: number;
      paired: string;
      launchedAt: number;
      href: string;
      links?: { website?: string; x?: string; telegram?: string };
    }[]
  >([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCH_KEY);
      if (raw) setWatch(JSON.parse(raw));
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  React.useEffect(() => {
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.tokens ?? []) as Array<{
          address: string;
          name: string;
          symbol: string;
          totalSupply: string;
          createdAt: number;
          socials?: { twitter?: string; telegram?: string; website?: string };
        }>;
        setLaunches(
          rows.map((t) => ({
            id: t.address,
            name: t.name,
            symbol: t.symbol,
            chainId: 5042002,
            price: 0,
            marketCap: 0,
            change24h: 0,
            paired: "USDC",
            launchedAt: t.createdAt,
            href: `/app/token/${t.address}`,
            links: {
              website: t.socials?.website,
              x: t.socials?.twitter,
              telegram: t.socials?.telegram,
            },
          })),
        );
      })
      .catch(() => {
        /* indexer optional */
      });
  }, []);

  function toggleWatch(id: string) {
    setWatch((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const seed = SEED_TOKENS.map((t) => ({ ...t, href: `/app/market/${t.id}` }));
  const all = [...launches, ...seed];

  const tokens =
    tab === "trending"
      ? all
      : tab === "recents"
        ? [...all].sort((a, b) => b.launchedAt - a.launchedAt)
        : all.filter((t) => watch.includes(t.id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <p className="mt-1 text-fg-secondary">
          Trending launches across every supported chain.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabButton active={tab === "trending"} onClick={() => setTab("trending")}>
          <Flame className="size-4" /> Trending
        </TabButton>
        <TabButton active={tab === "recents"} onClick={() => setTab("recents")}>
          <Clock className="size-4" /> Recents
        </TabButton>
        <TabButton active={tab === "watchlist"} onClick={() => setTab("watchlist")}>
          <Star className="size-4" /> Watchlist
        </TabButton>
      </div>

      {/* Network filter — same Portfolio-style picker, default Arc Testnet */}
      <div className="flex flex-wrap items-center gap-2">
        <ChainSelect value={chain} onChange={setChain} />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_0.6fr] gap-3 border-b border-fg/[0.08] px-4 py-3 text-xs uppercase tracking-wide text-fg-tertiary">
          <span>Token</span>
          <span className="text-right">Price</span>
          <span className="text-right">Market cap</span>
          <span className="text-right">24h</span>
        </div>
        {tokens.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-tertiary">
            {tab === "watchlist"
              ? "No watched tokens yet. Tap the star on any token."
              : "No tokens on this chain yet."}
          </p>
        ) : (
          tokens.map((t) => (
            <TokenRow
              key={t.id}
              token={t}
              watched={watch.includes(t.id)}
              onToggleWatch={() => toggleWatch(t.id)}
            />
          ))
        )}
      </Card>
    </div>
  );
}

function TokenRow({
  token,
  watched,
  onToggleWatch,
}: {
  token: MarketToken & { href?: string };
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const def = EVM_CHAIN_BY_ID.get(token.chainId);
  const up = token.change24h >= 0;
  const href = token.href ?? `/app/market/${token.id}`;
  return (
    <Link
      href={href}
      className="grid grid-cols-[2fr_1.2fr_1fr_0.6fr] items-center gap-3 border-b border-fg/[0.04] px-4 py-3 text-sm transition-colors last:border-0 hover:bg-fg/[0.04]"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onToggleWatch();
          }}
          className={watched ? "text-charge" : "text-fg-tertiary hover:text-fg"}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Star className="size-4" fill={watched ? "currentColor" : "none"} />
        </button>
        <div className="min-w-0">
          <p className="font-medium text-fg">{token.name}</p>
          <p className="text-xs text-fg-tertiary">
            {token.symbol} · {def?.name ?? token.chainId}
          </p>
        </div>
      </div>
      <span className="text-right tabular-nums text-fg">
        ${token.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}
      </span>
      <span className="text-right tabular-nums text-fg-secondary">
        ${compact(token.marketCap)}
      </span>
      <span
        className={`text-right tabular-nums ${up ? "text-success" : "text-danger"}`}
      >
        {up ? "+" : ""}
        {(token.change24h * 100).toFixed(1)}%
      </span>
    </Link>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition-colors ${
        active
          ? "bg-charge text-white"
          : "bg-fg/[0.04] text-fg-secondary hover:bg-fg/[0.08] hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}
