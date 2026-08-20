import { NextResponse } from "next/server";
import { getAllPoolAnalytics } from "@/lib/lp-indexer";
import { LP_POOLS, getPoolById } from "@charge/chains";

/**
 * GET /api/pools
 * Lists every enabled Chargefi LP pool with REAL on-chain TVL + indexed volume/APR.
 * Returns `null` for volume/APR windows with no swap activity (UI shows "—").
 */
export async function GET() {
  try {
    const analytics = await getAllPoolAnalytics();
    const pools = analytics.map((a) => {
      const def = getPoolById(a.poolId)!;
      return {
        id: a.poolId,
        tokenA: def.tokenA,
        tokenB: def.tokenB,
        label: def.label,
        pairAddress: a.pair,
        feeBps: a.feeBps,
        category: def.category,
        available: def.available,
        tvl: a.tvlA,
        reserveA: a.reserveA,
        reserveB: a.reserveB,
        totalLPSupply: a.totalSupply,
        volume24h: a.volume24hA,
        volume7d: a.volume7dA,
        volume30d: a.volume30dA,
        fees24h: a.fees24hA,
        fees7d: a.fees7dA,
        fees30d: a.fees30dA,
        feeApr24h: a.feeApr24h,
        feeApr7d: a.feeApr7d,
        feeApr30d: a.feeApr30d,
        history: a.history,
        updatedAt: a.updatedAt,
      };
    });
    return NextResponse.json({ pools, count: pools.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load pools" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
