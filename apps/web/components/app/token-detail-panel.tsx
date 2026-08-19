"use client";

import * as React from "react";
import {
  ExternalLink,
  Globe,
  Send,
  ShieldAlert,
  ShieldCheck,
  Twitter,
} from "lucide-react";
import Link from "next/link";

import { Badge, Button, Card, Label } from "@charge/ui";
import { arcAddressUrl } from "@charge/chains";
import {
  readTokenMeta,
  readTokenPriceUsdc,
} from "@charge/sdk";
import { LaunchedTradePanel, TokenOwnerControls } from "@/components/app/launched-trade-panel";
import { getAddress } from "viem";

interface LaunchMeta {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string | null;
  decimals: number;
  totalSupply: string;
  mintable: boolean;
  burnable: boolean;
  owner: string;
  socials?: { twitter?: string; telegram?: string; website?: string };
  poolSeeded?: boolean;
}

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(n < 1 && n > 0 ? 6 : 2);
}

function safeAddress(addr: string): string {
  if (!addr) return "";
  try {
    return getAddress(addr as `0x${string}`);
  } catch {
    return addr;
  }
}

function shortAddr(addr: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TokenDetailPanel({ address }: { address: `0x${string}` }) {
  const [meta, setMeta] = React.useState<LaunchMeta | null>(null);
  const [onchain, setOnchain] = React.useState<{
    name: string;
    symbol: string;
    mintable: boolean;
    burnable: boolean;
    owner: string;
    totalSupply: bigint;
    decimals: number;
  } | null>(null);
  const [price, setPrice] = React.useState<{
    priceUsdc: number;
    poolExists: boolean;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);

    // Metadata from the indexer is the source of truth for user-entered
    // fields (name, symbol, supply, socials, flags). Load it FIRST and
    // independently — a failing on-chain read must never blank the page.
    fetch(`/api/tokens`)
      .then((r) => r.json())
      .then((mRes: { tokens?: LaunchMeta[] }) => {
        if (!alive) return;
        const found = (mRes.tokens ?? []).find(
          (t) => t.address === address.toLowerCase(),
        );
        setMeta(found ?? null);
      })
      .catch(() => {
        if (alive) setMeta(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // On-chain reads are best-effort and isolated: if the token is brand new
    // (or the read reverts) we keep showing the indexer metadata.
    readTokenMeta(address)
      .then((o) => alive && setOnchain(o))
      .catch(() => {});
    readTokenPriceUsdc(address)
      .then((p) => alive && setPrice(p))
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [address]);

  if (loading) {
    return <p className="text-sm text-fg-tertiary">Loading token…</p>;
  }

  const decimals = onchain?.decimals ?? meta?.decimals ?? 18;
  const supplyRaw = onchain?.totalSupply ?? 0n;
  const supplyNum =
    Number(supplyRaw) / 10 ** decimals || Number(meta?.totalSupply ?? 0);
  const priceUsdc = price?.priceUsdc ?? 0;
  const mcap = priceUsdc * supplyNum;
  const mintable = onchain?.mintable ?? meta?.mintable ?? false;
  const burnable = onchain?.burnable ?? meta?.burnable ?? false;
  const owner = onchain?.owner ?? meta?.owner ?? "";
  // Display name/symbol: prefer indexed metadata, then on-chain, then a
  // checksummed address — never a bare "Unknown ???".
  const displayName = meta?.name ?? onchain?.name ?? safeAddress(address);
  const displaySymbol = meta?.symbol ?? onchain?.symbol ?? shortAddr(address);
  const notIndexed = !meta && !onchain;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {meta?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.image}
            alt={meta.name}
            className="size-16 rounded-2xl border border-fg/10 object-cover"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-2xl bg-charge/15 text-2xl font-semibold text-charge">
            {displaySymbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <span className="text-fg-tertiary">
              {displaySymbol}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-xs text-fg-tertiary">
            {address}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {mintable ? (
              <span className="group relative inline-flex">
                <Badge tone="danger">
                  <ShieldAlert className="size-3.5" /> MINT ENABLED
                </Badge>
                <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-60 -translate-x-1/2 rounded-lg border border-fg/10 bg-surface px-3 py-2 text-xs text-fg-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  The deployer still controls minting. They can create new
                  supply at any time, which can dilute your holdings. Only trade
                  tokens where you trust the creator. Owner-only actions show in
                  the Creator controls panel.
                </span>
              </span>
            ) : (
              <Badge tone="charge">
                <ShieldCheck className="size-3.5" /> Fixed supply
              </Badge>
            )}
            {burnable && <Badge tone="neutral">Burnable</Badge>}
            {price?.poolExists ? (
              <Badge tone="neutral">Pool live</Badge>
            ) : (
              <Badge tone="warning">No pool yet</Badge>
            )}
          </div>
        </div>
      </div>

      {notIndexed && (
        <p className="rounded-xl border border-fg/10 bg-fg/[0.02] p-3 text-sm text-fg-secondary">
          This contract isn&apos;t in the Charge launch indexer yet. Showing
          on-chain data where available — launch it through{" "}
          <Link href="/app/create" className="text-charge hover:underline">
            Charge Launch
          </Link>{" "}
          to attach a name, image, and socials.
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Price" value={priceUsdc > 0 ? `$${priceUsdc.toFixed(6)}` : "—"} />
        <Stat label="Market cap" value={mcap > 0 ? `$${fmt(mcap)}` : "—"} />
        <Stat label="Total supply" value={fmt(supplyNum)} />
        <Stat label="Owner" value={owner ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : "—"} />
      </div>

      {/* Description */}
      {meta?.description && (
        <Card className="p-4">
          <Label>About</Label>
          <p className="mt-2 text-sm text-fg-secondary">{meta.description}</p>
        </Card>
      )}

      {/* Socials */}
      {meta?.socials && (
        <div className="flex flex-wrap gap-3">
          {meta.socials.twitter && (
            <Social href={meta.socials.twitter} icon={<Twitter className="size-4" />} label="Twitter" />
          )}
          {meta.socials.telegram && (
            <Social href={meta.socials.telegram} icon={<Send className="size-4" />} label="Telegram" />
          )}
          {meta.socials.website && (
            <Social href={meta.socials.website} icon={<Globe className="size-4" />} label="Website" />
          )}
        </div>
      )}

      {/* Trade */}
      <LaunchedTradePanel
        token={address}
        symbol={displaySymbol}
        decimals={onchain?.decimals ?? meta?.decimals ?? 18}
      />

      {/* Creator mint / burn (owner only) */}
      <TokenOwnerControls
        token={address}
        owner={owner}
        mintable={mintable}
        burnable={burnable}
        decimals={onchain?.decimals ?? meta?.decimals ?? 18}
      />

      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" asChild>
          <a
            href={arcAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            View contract
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-fg/[0.08] bg-fg/[0.02] p-3">
      <p className="text-xs text-fg-tertiary">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}

function Social({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-fg/10 bg-fg/[0.03] px-3 py-2 text-sm text-fg-secondary transition-colors hover:text-fg"
    >
      {icon}
      {label}
    </a>
  );
}
