import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { syncFromChain, store, candles, type Candle } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

/**
 * GET /api/launchpad/trades/[address]?bucketMs=60000
 * Trade history + OHLC candles for charts.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const bucketMs = Number(new URL(req.url).searchParams.get("bucketMs") ?? "60000");
  try {
    await syncFromChain();
  } catch {
    /* serve cached */
  }
  const trades = store()
    .tradesFor(address as `0x${string}`)
    .sort((a, b) => b.timestamp - a.timestamp);
  const candlesData: Candle[] = candles(address as `0x${string}`, bucketMs);
  return NextResponse.json({ trades, candles: candlesData });
}
