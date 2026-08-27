"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Clock,
  ExternalLink,
  History as HistoryIcon,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { formatUnits } from "viem";

import { Badge, Card, Skeleton, StatusLine } from "@charge/ui";
import {
  ALL_CHAIN_IDS,
  ARC_CHAIN_ID,
  EVM_CHAIN_BY_ID,
} from "@charge/chains";
import { getTxHistory, type TxType } from "@charge/sdk";
import { useWallet, useChainActivity } from "@charge/web3";

import { ChainIcon } from "@/components/app/token-icon";

type FilterType = "all" | TxType;
type FilterChain = number | "all";

interface Row {
  id: string;
  type: TxType;
  chainId: number;
  hash: string;
  ts: string;
  summary: string;
}

export default function HistoryPage() {
  const { address } = useWallet();
  const [type, setType] = React.useState<FilterType>("all");
  const [chain, setChain] = React.useState<FilterChain>("all");

  // In-app records (instant, includes swaps/bridges the user submitted here).
  const [local, setLocal] = React.useState<ReturnType<typeof getTxHistory>>([]);
  React.useEffect(() => {
    setLocal(getTxHistory(address));
    // Refresh when the tab regains focus (a tx may have completed elsewhere).
    const onFocus = () => setLocal(getTxHistory(address));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [address]);

  // On-chain activity across every listed chain (send/receive via Transfer).
  const chainsToScan = chain === "all" ? ALL_CHAIN_IDS : [chain];
  const chainActivity = useChainActivityAggregator(address, chainsToScan);

  const rows = React.useMemo<Row[]>(() => {
    const out: Row[] = [];

    for (const r of local) {
      out.push({
        id: r.id,
        type: r.type,
        chainId: r.chainId,
        hash: r.hash,
        ts: r.ts,
        summary: r.summary,
      });
    }

    for (const ca of chainActivity.items) {
      const def = EVM_CHAIN_BY_ID.get(ca.chainId);
      out.push({
        id: `${ca.hash}:${ca.direction}`,
        type: ca.direction,
        chainId: ca.chainId,
        hash: ca.hash,
        ts: new Date().toISOString(),
        summary: `${ca.direction} ${formatUnits(ca.valueRaw, ca.decimals)} ${ca.symbol}${def ? ` on ${def.name}` : ""}`,
      });
    }

    return out
      .filter((r) => (type === "all" ? true : r.type === type))
      .filter((r) => (chain === "all" ? true : r.chainId === chain))
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  }, [local, chainActivity.items, type, chain]);

  const anyRpcDown = chainActivity.rpcErrors.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="mt-1.5 text-fg-secondary">
            Every transaction across {ALL_CHAIN_IDS.length} chains — swaps,
            bridges, sends and receives.
          </p>
        </div>
        <Badge tone="neutral" className="gap-1.5">
          <HistoryIcon className="size-3" aria-hidden />
          {rows.length} shown
        </Badge>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={type === "all"} onClick={() => setType("all")}>
          All
        </FilterChip>
        <FilterChip
          active={type === "send"}
          onClick={() => setType("send")}
          icon={<ArrowUpRight className="size-3.5" />}
        >
          Send
        </FilterChip>
        <FilterChip
          active={type === "receive"}
          onClick={() => setType("receive")}
          icon={<ArrowDownLeft className="size-3.5" />}
        >
          Receive
        </FilterChip>
        <FilterChip
          active={type === "swap"}
          onClick={() => setType("swap")}
          icon={<ArrowLeftRight className="size-3.5" />}
        >
          Swap
        </FilterChip>
        <FilterChip
          active={type === "bridge"}
          onClick={() => setType("bridge")}
          icon={<Waypoints className="size-3.5" />}
        >
          Bridge
        </FilterChip>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={chain === "all"} onClick={() => setChain("all")}>
          All chains
        </FilterChip>
        {ALL_CHAIN_IDS.map((id) => (
          <FilterChip
            key={id}
            active={chain === id}
            onClick={() => setChain(id)}
            icon={<ChainIcon chainId={id} size={14} />}
          >
            {EVM_CHAIN_BY_ID.get(id)?.name ?? `Chain ${id}`}
          </FilterChip>
        ))}
      </div>

      {!address ? (
        <StatusLine tone="info">
          Connect a wallet to see your transaction history.
        </StatusLine>
      ) : (
        <Card className="divide-y divide-fg/[0.06] overflow-hidden">
          {chainActivity.sources}
          {chainActivity.isLoading && local.length === 0 ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-fg-tertiary">
              No transactions found for this filter.
            </p>
          ) : (
            rows.map((r) => <HistoryRow key={r.id} row={r} />)
          )}
        </Card>
      )}

      {anyRpcDown && (
        <p className="text-xs text-fg-tertiary">
          Some chains&apos; on-chain history is unavailable (RPC unreachable
          from here). In-app swap/bridge/send records are always shown.
        </p>
      )}
    </div>
  );
}

function HistoryRow({ row }: { row: Row }) {
  const def = EVM_CHAIN_BY_ID.get(row.chainId);
  const explorer = def?.explorerUrl;
  const href = explorer ? `${explorer}/tx/${row.hash}` : "#";

  const Icon =
    row.type === "send"
      ? ArrowUpRight
      : row.type === "receive"
        ? ArrowDownLeft
        : row.type === "swap"
          ? ArrowLeftRight
          : Waypoints;

  const tone =
    row.type === "send"
      ? "bg-danger/15 text-danger"
      : row.type === "receive"
        ? "bg-success/15 text-success"
        : "bg-charge/15 text-charge";

  const label =
    row.type === "send"
      ? "Sent"
      : row.type === "receive"
        ? "Received"
        : row.type === "swap"
          ? "Swap"
          : "Bridge";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fg/[0.03]"
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="truncate text-xs text-fg-tertiary">{row.summary}</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-fg-tertiary">
        <ChainIcon chainId={row.chainId} size={14} />
        {def?.name?.split(" ")[0] ?? `Chain ${row.chainId}`}
      </div>
      <span className="inline-flex items-center gap-1 text-xs text-fg-tertiary">
        <Clock className="size-3" aria-hidden />
        {shortTime(row.ts)}
        <ExternalLink className="size-3" aria-hidden />
      </span>
    </a>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-charge/45 bg-charge/10 text-charge"
          : "border-fg/10 bg-fg/[0.03] text-fg-secondary hover:border-fg/20"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/** Aggregate on-chain activity across chains. Each chain gets its OWN hook
 *  call via a dedicated child component — hooks must never be called inside a
 *  loop/map (react-hooks/rules-of-hooks). */
function useChainActivityAggregator(
  address: `0x${string}` | undefined,
  chainIds: readonly number[],
) {
  const [items, setItems] = React.useState<
    Array<{ hash: string; direction: "send" | "receive"; chainId: number; symbol: string; valueRaw: bigint; decimals: number }>
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [rpcErrors, setRpcErrors] = React.useState<number[]>([]);

  const sources = chainIds.map((id) => (
    <ChainActivitySource
      key={id}
      address={address}
      chainId={id}
      onData={(it) => setItems((prev) => merge(prev, it))}
      onLoading={setIsLoading}
      onRpcError={(cid) => setRpcErrors((prev) => prev.includes(cid) ? prev : [...prev, cid])}
    />
  ));

  return { items, isLoading, rpcErrors, sources };
}

/** Calls useChainActivity exactly once (rules-of-hooks safe) and reports up. */
function ChainActivitySource({
  address,
  chainId,
  onData,
  onLoading,
  onRpcError,
}: {
  address: `0x${string}` | undefined;
  chainId: number;
  onData: (items: Array<{ hash: string; direction: "send" | "receive"; chainId: number; symbol: string; valueRaw: bigint; decimals: number }>) => void;
  onLoading: (v: boolean) => void;
  onRpcError: (chainId: number) => void;
}) {
  const act = useChainActivity({ chainId, address });
  React.useEffect(() => {
    onData(act.items.map((it) => ({ ...it, chainId })));
  }, [act.items, chainId, onData]);
  React.useEffect(() => {
    onLoading(act.isLoading);
  }, [act.isLoading, onLoading]);
  React.useEffect(() => {
    if (act.rpcError) onRpcError(chainId);
  }, [act.rpcError, chainId, onRpcError]);
  return null;
}

function merge(
  prev: Array<{ hash: string; direction: "send" | "receive"; chainId: number; symbol: string; valueRaw: bigint; decimals: number }>,
  next: Array<{ hash: string; direction: "send" | "receive"; chainId: number; symbol: string; valueRaw: bigint; decimals: number }>,
) {
  const map = new Map(prev.map((i) => [i.hash + i.direction, i]));
  for (const i of next) map.set(i.hash + i.direction, i);
  return Array.from(map.values());
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
