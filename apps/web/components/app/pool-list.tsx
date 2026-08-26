"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@charge/ui";
import { Sparkline } from "@/components/app/sparkline";
import { TokenIcon } from "@/components/app/token-icon";
import { fmtUsdCompact, fmtPct } from "@/lib/format";
import { useWallet } from "@charge/web3";

interface PoolRow {
  id: string;
  tokenA: string;
  tokenB: string;
  label: string;
  pairAddress: string;
  feeBps: number;
  tvl: number;
  volume24h: number | null;
  volume7d: number | null;
  volume30d: number | null;
  feeApr24h: number | null;
  feeApr7d: number | null;
  feeApr30d: number | null;
  available: boolean;
  history: { date: string; volumeA: number }[];
}

async function fetchPools(): Promise<PoolRow[]> {
  const res = await fetch("/api/pools");
  if (!res.ok) throw new Error("Failed to load pools");
  const json = (await res.json()) as { pools: PoolRow[] };
  return json.pools;
}

async function fetchPosition(
  id: string,
  wallet: string,
): Promise<{ poolShare: number; lpBalance: string } | null> {
  const res = await fetch(`/api/pools/${id}/position/${wallet}`);
  if (!res.ok) return null;
  return (await res.json()) as { poolShare: number; lpBalance: string };
}

export function PoolList() {
  const { address, isConnected } = useWallet();
  const [tab, setTab] = React.useState<"all" | "mine">("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["pools"],
    queryFn: fetchPools,
    refetchInterval: 60_000,
  });

  const rows = data ?? [];

  // For "My Positions": fetch each pool's position for the connected wallet.
  const { data: mine } = useQuery({
    queryKey: ["my-positions", address, rows.map((r) => r.id).join(",")],
    enabled: isConnected && Boolean(address) && rows.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        rows.map(async (r) => {
          const pos = await fetchPosition(r.id, address!);
          return pos && Number(pos.lpBalance) > 0 ? r : null;
        }),
      );
      return entries.filter(Boolean) as PoolRow[];
    },
  });

  const visible = tab === "mine" ? mine ?? [] : rows;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          All
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          My Positions
        </TabButton>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-fg-tertiary">Loading pools…</p>
          ) : error ? (
            <p className="p-6 text-destructive">
              Could not load pools. Check your connection and try again.
            </p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-fg-tertiary">
              {tab === "mine"
                ? "You don't have a position in any pool yet."
                : "No pools available."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fg/10 text-fg-tertiary">
                    <th className="px-4 py-3 text-left font-medium">Pool</th>
                    <th className="px-4 py-3 text-right font-medium">TVL</th>
                    <th className="px-4 py-3 text-right font-medium">24h Volume</th>
                    <th className="px-4 py-3 text-right font-medium">Fee APR</th>
                    <th className="px-4 py-3 text-right font-medium">7d Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-fg/5 transition-colors hover:bg-fg/[0.03]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/pools/${p.id}`}
                          className={
                            "font-medium " +
                            (p.available ? "text-fg hover:text-charge" : "text-fg-tertiary")
                          }
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {p.label
                              .split("/")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((sym) => (
                                <TokenIcon key={sym} symbol={sym} size={16} />
                              ))}
                            <span>{p.label}</span>
                          </span>
                        </Link>
                        <span className="ml-2 text-xs text-fg-tertiary">
                          {p.feeBps / 100}%
                        </span>
                        {!p.available && (
                          <span className="ml-2 rounded-full bg-fg/10 px-2 py-0.5 text-[10px] font-medium text-fg-tertiary">
                            Unavailable
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtUsdCompact(p.tvl)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtUsdCompact(p.volume24h)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-charge">
                        {fmtPct(p.feeApr7d ?? p.feeApr30d)}
                      </td>
                      <td className="px-4 py-3 text-right text-fg-tertiary">
                        <Sparkline
                          className="ml-auto text-charge/60"
                          data={(p.history ?? []).map((h) => h.volumeA)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
      className={
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-charge/15 text-charge"
          : "text-fg-secondary hover:text-fg")
      }
    >
      {children}
    </button>
  );
}
