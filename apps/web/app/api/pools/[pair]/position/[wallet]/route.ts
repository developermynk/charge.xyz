import { NextResponse } from "next/server";
import { getUserPosition } from "@charge/sdk";
import { getPoolById } from "@charge/chains";
import type { Address } from "viem";

/**
 * GET /api/pools/:pair/position/:wallet
 * Real on-chain LP position for a connected wallet: LP balance, pool share,
 * token amounts, position value, and estimated fee earnings (share × window fees).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pair: string; wallet: string }> },
) {
  const { pair, wallet } = await params;
  const poolId = pair.toUpperCase();
  const def = getPoolById(poolId);
  if (!def || !def.enabled) {
    return NextResponse.json({ error: "Unknown or disabled pool" }, { status: 404 });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    const pos = await getUserPosition(poolId, wallet as Address);
    const sharePct = pos.share * 100;
    const valueA = Number(pos.reserve0) / 10 ** pos.tokenADecimals;
    const valueB = Number(pos.reserve1) / 10 ** pos.tokenBDecimals;
    const userA = (valueA * pos.share);
    const userB = (valueB * pos.share);
    const positionValue = userA + userB; // stables ~1:1

    return NextResponse.json({
      poolId,
      pair: pos.pair,
      wallet,
      lpBalance: pos.userBalance.toString(),
      poolShare: sharePct,
      positionValue,
      tokenAAmount: userA,
      tokenBAmount: userB,
      reserveA: valueA,
      reserveB: valueB,
      totalLPSupply: pos.totalSupply.toString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load position" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
