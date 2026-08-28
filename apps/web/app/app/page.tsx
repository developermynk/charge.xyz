"use client";

import { Coins, Fuel, History, Network, Send, Waypoints, Layers, TrendingUp } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Badge, Card, Skeleton } from "@charge/ui";
import { useWallet, useChainBalance } from "@charge/web3";
import { ALL_CHAIN_IDS, EVM_CHAIN_BY_ID, ARC_CHAIN_ID } from "@charge/chains";

import { ChainSelect } from "@/components/app/chain-select";
import { Stagger, StaggerItem, MotionCard, HoverDepth } from "@/components/motion";

export default function OverviewPage() {
  const { address } = useWallet();
  const [filter, setFilter] = React.useState<number | "all">(ARC_CHAIN_ID);

  const chainIds = filter === "all" ? ALL_CHAIN_IDS : [filter];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1.5 text-fg-secondary">
            Your balances across every supported chain, in one view.
          </p>
        </div>
        <Badge tone="neutral" className="gap-1.5">
          <Network className="size-3" aria-hidden />
          {ALL_CHAIN_IDS.length} networks
        </Badge>
      </header>

      <ChainSelect value={filter} onChange={setFilter} />

      <Card className="divide-y divide-fg/[0.06] overflow-hidden">
        {chainIds.map((chainId) => (
          <ChainRow key={chainId} chainId={chainId} address={address} />
        ))}
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-tertiary">
          Quick actions
        </h2>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StaggerItem>
            <ActionTile href="/app/swap" icon={<Waypoints className="size-5" />} title="Swap" body="Trade across chains" />
          </StaggerItem>
          <StaggerItem>
            <ActionTile href="/app/bridge" icon={<Layers className="size-5" />} title="Bridge" body="Move USDC via CCTP" />
          </StaggerItem>
          <StaggerItem>
            <ActionTile href="/app/send" icon={<Send className="size-5" />} title="Send" body="Transfer to any address" />
          </StaggerItem>
          <StaggerItem>
            <ActionTile href="/app/receive" icon={<Network className="size-5" />} title="Receive" body="Your address as QR" />
          </StaggerItem>
          <StaggerItem>
            <ActionTile href="/app/history" icon={<History className="size-5" />} title="History" body="All swaps, bridges & sends" />
          </StaggerItem>
          <StaggerItem>
            <ActionTile href="/app/market" icon={<TrendingUp className="size-5" />} title="Market" body="Trending & launches" />
          </StaggerItem>
          <StaggerItem>
            <ActionTile href="/app/create" icon={<Coins className="size-5" />} title="Launch token" body="Deploy a fixed supply" />
          </StaggerItem>
        </Stagger>
      </section>
    </div>
  );
}

function ChainRow({
  chainId,
  address,
}: {
  chainId: number;
  address: `0x${string}` | undefined;
}) {
  const def = EVM_CHAIN_BY_ID.get(chainId);
  const isArc = chainId === ARC_CHAIN_ID;

  const usdcAddress = isArc
    ? ("0x3600000000000000000000000000000000000000" as `0x${string}`)
    : undefined;

  const bal = useChainBalance({ chainId, address, usdcAddress });

  return (
    <HoverDepth className="rounded-xl">
      <Link
        href={`/app/chain/${chainId}`}
        className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-fg/[0.03]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-fg/[0.06] text-fg-secondary">
          <Fuel className="size-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-fg">
              {def?.name ?? `Chain ${chainId}`}
            </p>
            {isArc && <Badge tone="charge" className="text-[11px]">USDC gas</Badge>}
          </div>
          <p className="text-xs text-fg-tertiary">{def?.nativeSymbol} native</p>
        </div>

        {bal.isLoading ? (
          <Skeleton className="h-5 w-28" />
        ) : bal.rpcError ? (
          <span className="text-sm tabular-nums text-fg-tertiary">—</span>
        ) : (
          <span className="text-sm font-medium tabular-nums text-fg">
            {formatAmount(bal.nativeFormatted)} {bal.nativeSymbol}
          </span>
        )}
      </Link>
    </HoverDepth>
  );
}

function ActionTile({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="group block">
      <MotionCard className="h-full">
        <Card className="flex h-full items-center gap-4 bg-transparent p-4 transition-colors duration-200 group-hover:border-fg/20 group-hover:bg-fg/[0.05]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fg/[0.06] text-fg-secondary transition-colors group-hover:text-fg">
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-fg">{title}</span>
            <span className="block text-sm text-fg-secondary">{body}</span>
          </span>
        </Card>
      </MotionCard>
    </Link>
  );
}

function formatAmount(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}
