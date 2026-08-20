import { NextResponse } from "next/server";
import { getPoolAnalytics } from "@/lib/lp-indexer";
import { getPoolById } from "@charge/chains";

/**
 * GET /api/pools/:pair
 *   ?view=stats   → single-pool snapshot (default)
 *   ?view=history → 30d day-bucketed volume/fees for charts
 *
 * All values are REAL (on-chain reserves + indexed Swap events). Windows with no
 * activity return null — never a fabricated number.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pair: string }> },
) {
  const { pair } = await params;
  const poolId = pair.toUpperCase();
  const def = getPoolById(poolId);
  if (!def || !def.enabled) {
    return NextResponse.json({ error: "Unknown or disabled pool" }, { status: 404 });
  }
  const force = new URL(_req.url).searchParams.get("force") === "1";
  const view = new URL(_req.url).searchParams.get("view") ?? "stats";

  try {
    const a = await getPoolAnalytics(poolId, force);
    if (!a) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    if (view === "history") {
      return NextResponse.json({
        poolId,
        history: a.history,
        feeBps: a.feeBps,
      });
    }
    return NextResponse.json({
      poolId,
      pair: a.pair,
      feeBps: a.feeBps,
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
      updatedAt: a.updatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load pool" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
