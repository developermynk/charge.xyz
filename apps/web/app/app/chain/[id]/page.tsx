"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Layers,
  Network,
  QrCode,
  Send,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { formatUnits } from "viem";

import { Badge, Button, Card, Skeleton, StatusLine } from "@charge/ui";
import { useWallet, useChainBalance, useChainActivity } from "@charge/web3";
import {
  ALL_CHAIN_IDS,
  ARC_CHAIN_ID,
  EVM_CHAIN_BY_ID,
} from "@charge/chains";

import { BackButton } from "@/components/app/back-button";

function chainParamToId(params: { id: string }): number | null {
  const n = Number(params.id);
  return ALL_CHAIN_IDS.includes(n) ? n : null;
}

export default function ChainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const chainId = chainParamToId({ id });

  if (chainId == null) {
    return (
      <StatusLine tone="warning">
        Unknown chain. <Link href="/app" className="underline">Back to Portfolio</Link>
      </StatusLine>
    );
  }

  return <ChainDetail chainId={chainId} />;
}

function ChainDetail({ chainId }: { chainId: number }) {
  const { address } = useWallet();
  const def = EVM_CHAIN_BY_ID.get(chainId);
  const isArc = chainId === ARC_CHAIN_ID;

  const usdcAddress = isArc
    ? ("0x3600000000000000000000000000000000000000" as `0x${string}`)
    : undefined;

  const bal = useChainBalance({ chainId, address, usdcAddress });
  const activity = useChainActivity({ chainId, address });

  const explorer = def?.explorerUrl;
  const q = (path: string) => (explorer ? `${explorer}${path}` : "#");

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {def?.name ?? `Chain ${chainId}`}
            </h1>
            {isArc && <Badge tone="charge" className="text-[11px]">USDC gas</Badge>}
          </div>
        </div>
        <Badge tone="neutral" className="gap-1.5">
          <Network className="size-3" aria-hidden />
          {def?.nativeSymbol} native
        </Badge>
      </div>

      {/* Balance card */}
      <Card className="p-5">
        {bal.isLoading ? (
          <Skeleton className="h-9 w-48" />
        ) : bal.rpcError ? (
          <p className="text-sm text-fg-tertiary">Balance unavailable — RPC unreachable.</p>
        ) : (
          <div>
            <p className="text-3xl font-semibold tabular-nums text-fg">
              {formatAmount(bal.nativeFormatted)} {bal.nativeSymbol}
            </p>
            {isArc && bal.usdcFormatted && (
              <p className="mt-1 text-sm text-fg-secondary tabular-nums">
                {formatUnits(bal.usdcRaw ?? 0n, 6)} USDC (ERC-20)
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Action bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionButton href={`/app/send?chain=${chainId}`} icon={<Send className="size-4" />} label="Send" />
        <ActionButton href={`/app/receive?chain=${chainId}`} icon={<QrCode className="size-4" />} label="Receive" />
        <ActionButton href={`/app/swap?chain=${chainId}`} icon={<Waypoints className="size-4" />} label="Swap" />
        <ActionButton href={`/app/bridge?chain=${chainId}`} icon={<Layers className="size-4" />} label="Bridge" />
      </div>

      {/* Activity */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-tertiary">
          Recent activity
        </h2>
        <Card className="divide-y divide-fg/[0.06] overflow-hidden">
          {activity.isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activity.rpcError ? (
            <p className="p-4 text-sm text-fg-tertiary">
              Activity unavailable — this chain&apos;s RPC is unreachable from here.
            </p>
          ) : activity.items.length === 0 ? (
            <p className="p-4 text-sm text-fg-tertiary">
              No recent transfers on this chain for your address.
            </p>
          ) : (
            activity.items.map((it) => (
              <a
                key={it.hash}
                href={q(`/tx/${it.hash}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fg/[0.03]"
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                    it.direction === "send"
                      ? "bg-danger/15 text-danger"
                      : "bg-success/15 text-success"
                  }`}
                >
                  {it.direction === "send" ? (
                    <ArrowUpRight className="size-4" aria-hidden />
                  ) : (
                    <ArrowDownLeft className="size-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize text-fg">
                    {it.direction}
                  </p>
                  <p className="truncate font-mono text-xs text-fg-tertiary">
                    {it.counterparty}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-fg">
                    {formatUnits(it.valueRaw, it.decimals)} {it.symbol}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs text-fg-tertiary">
                    <ExternalLink className="size-3" aria-hidden />
                    explorer
                  </span>
                </div>
              </a>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}

function ActionButton({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link href={href}>
      <Button variant="secondary" block className="gap-2">
        {icon}
        {label}
      </Button>
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
