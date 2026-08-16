"use client";

import { ArrowLeft, ExternalLink, Star, TrendingUp } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button, Card } from "@charge/ui";
import { EVM_CHAIN_BY_ID } from "@charge/chains";

import { SEED_TOKENS, type MarketToken } from "@/lib/market-data";

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

export default function TokenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const token: MarketToken | undefined = React.useMemo(
    () => SEED_TOKENS.find((t) => t.id === id),
    [id],
  );

  if (!token) {
    return (
      <div className="space-y-4">
        <Link href="/app/market" className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg">
          <ArrowLeft className="size-4" /> Back to Market
        </Link>
        <Card className="p-8 text-center">
          <p className="text-fg-secondary">Token not found.</p>
        </Card>
      </div>
    );
  }

  const def = EVM_CHAIN_BY_ID.get(token.chainId);
  const up = token.change24h >= 0;

  return (
    <div className="space-y-6">
      <Link href="/app/market" className="inline-flex items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg">
        <ArrowLeft className="size-4" /> Back to Market
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-charge/15 text-xl font-semibold text-charge">
            {token.symbol.slice(0, 2)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{token.name}</h1>
            <p className="text-sm text-fg-tertiary">
              {token.symbol} · {def?.name ?? token.chainId}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm">
          <Star className="size-4" /> Watch
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Price" value={`$${token.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`} />
        <Stat label="Market cap" value={`$${compact(token.marketCap)}`} />
        <Stat
          label="24h change"
          value={`${up ? "+" : ""}${(token.change24h * 100).toFixed(1)}%`}
          tone={up ? "success" : "danger"}
        />
      </div>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium text-fg-secondary">
          <TrendingUp className="size-4" /> About
        </h2>
        <p className="mt-2 text-fg">
          {token.name} ({token.symbol}) is a fixed-supply launch paired with{" "}
          {token.paired} on {def?.name ?? "its chain"}. Swaps route through the
          launch pool; creator fees are frozen per-trade and claimed on a pull
          basis.
        </p>

        {token.links && (
          <div className="mt-4 flex flex-wrap gap-2">
            {token.links.website && (
              <LinkChip href={token.links.website} label="Website" />
            )}
            {token.links.x && <LinkChip href={token.links.x} label="X" />}
            {token.links.telegram && (
              <LinkChip href={token.links.telegram} label="Telegram" />
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/app/swap">Trade {token.symbol}</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/create">Launch your own</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wider text-fg-tertiary">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${
          tone === "success"
            ? "text-success"
            : tone === "danger"
              ? "text-danger"
              : "text-fg"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 rounded-full border border-fg/[0.08] bg-fg/[0.03] px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:border-fg/20 hover:text-fg"
    >
      {label}
      <ExternalLink className="size-3.5" />
    </a>
  );
}
