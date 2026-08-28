"use client";

// History is fully client-side (Privy auth, live explorer polling, search
// params). Opt out of static prerender so useSearchParams() doesn't trip the
// Next 16 CSR-bailout during `next build`.
export const dynamic = "force-dynamic";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Clock,
  ExternalLink,
  History as HistoryIcon,
  RefreshCw,
  Search,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { formatUnits, isAddress, type Hash } from "viem";

import { Badge, Button, Card, Input, Skeleton, StatusLine } from "@charge/ui";
import {
  ALL_CHAIN_IDS,
  EVM_CHAIN_BY_ID,
} from "@charge/chains";
import { getTxHistory, type TxType } from "@charge/sdk";
import { useWallet, fetchChainHistory, type ExplorerTx } from "@charge/web3";
import { PageEnter } from "@/components/motion";

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

const POLL_MS = 20_000;

export default function HistoryPage() {
  const { address } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [type, setType] = React.useState<FilterType>("all");
  const [chain, setChain] = React.useState<FilterChain>("all");

  // Address being viewed: URL ?addr= wins, else the connected wallet.
  const [addrInput, setAddrInput] = React.useState<string>(
    searchParams.get("addr") ?? "",
  );
  const viewAddress = (addrInput || address || "") as `0x${string}` | "";
  const isOwn = !!address && viewAddress.toLowerCase() === address.toLowerCase();

  // Real-time: poll on an interval + a manual refresh key + window focus.
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  React.useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), POLL_MS);
    return () => clearInterval(id);
  }, []);

  // In-app records (only meaningful for the connected wallet).
  const [local, setLocal] = React.useState<ReturnType<typeof getTxHistory>>([]);
  React.useEffect(() => {
    if (!isOwn) {
      setLocal([]);
      return;
    }
    setLocal(getTxHistory(address));
    const onFocus = () => setLocal(getTxHistory(address));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [address, isOwn]);

  // Real on-chain history from each chain's explorer (keyless Blockscout).
  const [explorer, setExplorer] = React.useState<ExplorerTx[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [explorerDown, setExplorerDown] = React.useState(false);
  const [addrError, setAddrError] = React.useState(false);

  const chainsToScan = chain === "all" ? ALL_CHAIN_IDS : [chain];

  React.useEffect(() => {
    if (!viewAddress || !isAddress(viewAddress)) {
      setExplorer([]);
      setAddrError(!!viewAddress);
      return;
    }
    setAddrError(false);
    let cancelled = false;
    setIsLoading(true);
    fetchChainHistory(viewAddress)
      .then((txs) => {
        if (cancelled) return;
        setExplorer(txs);
        setExplorerDown(txs.length === 0);
        setLastUpdated(Date.now());
      })
      .catch(() => {
        if (!cancelled) setExplorerDown(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewAddress, chainsToScan.join(","), refreshKey]);

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

    for (const tx of explorer) {
      if (!chainsToScan.includes(tx.chainId)) continue;
      const def = EVM_CHAIN_BY_ID.get(tx.chainId);
      const amount = formatUnits(tx.valueRaw, tx.decimals);
      out.push({
        id: `${tx.hash}:${tx.direction}`,
        type: tx.direction,
        chainId: tx.chainId,
        hash: tx.hash,
        ts: tx.timestamp,
        summary: `${tx.direction} ${amount} ${tx.symbol}${def ? ` on ${def.name}` : ""}`,
      });
    }

    return out
      .filter((r) => (type === "all" ? true : r.type === type))
      .filter((r) => (chain === "all" ? true : r.chainId === chain))
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  }, [local, explorer, type, chain, chainsToScan]);

  const anyDown = explorerDown;
  const short = viewAddress.slice(0, 6) + "…" + viewAddress.slice(-4);

  return (
    <PageEnter className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="mt-1.5 text-fg-secondary">
            Every transaction across {ALL_CHAIN_IDS.length} chains — swaps,
            bridges, sends and receives.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="charge" className="gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-charge" />
            Live
          </Badge>
          <Badge tone="neutral" className="gap-1.5">
            <HistoryIcon className="size-3" aria-hidden />
            {rows.length} shown
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
        </div>
      </header>

      {/* Address bar — view any address, or your connected wallet. */}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams(searchParams.toString());
          if (addrInput.trim()) params.set("addr", addrInput.trim());
          else params.delete("addr");
          router.replace(`/app/history?${params.toString()}`, { scroll: false });
        }}
      >
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
          <Input
            value={addrInput}
            onChange={(e) => setAddrInput(e.target.value)}
            placeholder={address ?? "Paste any 0x address"}
            className="pl-9 font-mono text-xs"
            aria-label="Address to view"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          View
        </Button>
        {address && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setAddrInput("");
              router.replace("/app/history", { scroll: false });
            }}
          >
            My wallet
          </Button>
        )}
        {addrError && (
          <span className="text-xs text-danger">Invalid address</span>
        )}
      </form>
      {viewAddress && !addrError && (
        <p className="text-xs text-fg-tertiary">
          Viewing{" "}
          <span className="font-mono text-fg-secondary">{short}</span>
          {isOwn ? " (your wallet)" : ""}
          {lastUpdated && (
            <>
              {" · updated "}
              {Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s ago
            </>
          )}
        </p>
      )}

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

      {!viewAddress ? (
        <StatusLine tone="info">
          Connect a wallet or paste an address to see transaction history.
        </StatusLine>
      ) : (
        <Card className="divide-y divide-fg/[0.06] overflow-hidden">
          {isLoading && rows.length === 0 ? (
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

      {anyDown && (
        <p className="text-xs text-fg-tertiary">
          Some chains&apos; on-chain history is unavailable (explorer API
          unreachable). In-app swap/bridge/send records are always shown.
        </p>
      )}
    </PageEnter>
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
