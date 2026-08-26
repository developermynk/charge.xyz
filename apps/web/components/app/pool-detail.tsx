"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Label,
  Button,
} from "@charge/ui";
import { Sparkline } from "@/components/app/sparkline";
import { PoolPanel } from "@/components/app/pool-panel";
import { fmtUsdCompact, fmtPct, aprLabel } from "@/lib/format";
import { getPoolById } from "@charge/chains";
import { tokenMeta } from "@charge/sdk";
import { TokenIcon } from "@/components/app/token-icon";

interface Stats {
  poolId: string;
  pair: string;
  feeBps: number;
  tvl: number;
  reserveA: number;
  reserveB: number;
  totalLPSupply: number;
  volume24h: number | null;
  volume7d: number | null;
  volume30d: number | null;
  fees24h: number | null;
  fees7d: number | null;
  fees30d: number | null;
  feeApr24h: number | null;
  feeApr7d: number | null;
  feeApr30d: number | null;
}

interface HistoryPoint {
  date: string;
  volumeA: number;
  volumeB: number;
  feesA: number;
}

const WINDOWS = [
  { key: "24H", days: 1 },
  { key: "7D", days: 7 },
  { key: "30D", days: 30 },
  { key: "90D", days: 90 },
] as const;

async function fetchStats(id: string): Promise<Stats> {
  const res = await fetch(`/api/pools/${id}`);
  if (!res.ok) throw new Error("Failed to load pool");
  return (await res.json()) as Stats;
}

async function fetchHistory(id: string): Promise<HistoryPoint[]> {
  const res = await fetch(`/api/pools/${id}?view=history`);
  if (!res.ok) return [];
  const json = (await res.json()) as { history: HistoryPoint[] };
  return json.history;
}

export function PoolDetail({ poolId }: { poolId: string }) {
  const [window, setWindow] = React.useState<(typeof WINDOWS)[number]["key"]>("7D");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["pool-stats", poolId],
    queryFn: () => fetchStats(poolId),
    refetchInterval: 60_000,
  });
  const { data: history } = useQuery({
    queryKey: ["pool-history", poolId],
    queryFn: () => fetchHistory(poolId),
    refetchInterval: 60_000,
  });

  const days = WINDOWS.find((w) => w.key === window)!.days;
  const series = React.useMemo(() => {
    if (!history || history.length === 0) return [];
    const last = new Date(history[history.length - 1]!.date).getTime();
    return history
      .filter((h) => last - new Date(h.date).getTime() <= days * 86_400_000)
      .map((h) => h.volumeA);
  }, [history, days]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: stats + chart */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Pool stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="TVL" value={fmtUsdCompact(stats?.tvl)} />
            <Stat label="24h Volume" value={fmtUsdCompact(stats?.volume24h)} />
            <Stat
              label="Swap Fee"
              value={stats ? `${stats.feeBps / 100}%` : "—"}
            />
            <Stat
              label="Est. Fee APR (7d)"
              value={fmtPct(stats?.feeApr7d ?? stats?.feeApr30d)}
              accent
            />
            <Stat label="Reserve A" value={fmtUsdCompact(stats?.reserveA)} />
            <Stat label="Reserve B" value={fmtUsdCompact(stats?.reserveB)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Volume</CardTitle>
            <div className="flex gap-1">
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWindow(w.key)}
                  className={
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                    (window === w.key
                      ? "bg-charge/15 text-charge"
                      : "text-fg-secondary hover:text-fg")
                  }
                >
                  {w.key}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-fg-tertiary">Loading…</p>
            ) : series.length < 2 ? (
              <p className="text-sm text-fg-tertiary">
                No swap volume recorded in this window yet. APR shows “—” until
                real trades flow through the pool.
              </p>
            ) : (
              <Sparkline
                className="text-charge"
                data={series}
                width={520}
                height={120}
              />
            )}
            <p className="mt-3 text-xs text-fg-tertiary">{aprLabel()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Right: actions */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <PoolPanel poolId={poolId} />
          </CardContent>
        </Card>

        {(() => {
          const def = getPoolById(poolId);
          if (!def) return null;
          const a = tokenMeta("Arc_Testnet", def.tokenA);
          const b = tokenMeta("Arc_Testnet", def.tokenB);
          return (
            <Link href={`/app/swap?from=${a.address}&to=${b.address}`}>
              <Button block size="lg" variant="secondary">
                <span className="inline-flex items-center gap-1.5">
                  <TokenIcon symbol={def.tokenA} size={18} />
                  Swap {def.tokenA}
                  <span aria-hidden>→</span>
                  <TokenIcon symbol={def.tokenB} size={18} />
                  {def.tokenB}
                </span>
              </Button>
            </Link>
          );
        })()}

        <p className="text-center text-xs text-fg-tertiary">
          Swaps route through this same pool — its liquidity is what makes
          trading possible. LPs earn the 0.3% swap fee.
        </p>

        <Badge className="block bg-fg/[0.04] px-3 py-2 text-center text-xs text-fg-tertiary">
          Permissionless LP · fees stay in the pool · no custody
        </Badge>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null | undefined;
  accent?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-fg-tertiary">{label}</Label>
      <div
        className={
          "mt-1 text-lg font-semibold tabular-nums " +
          (accent ? "text-charge" : "text-fg")
        }
      >
        {value ?? "—"}
      </div>
    </div>
  );
}
