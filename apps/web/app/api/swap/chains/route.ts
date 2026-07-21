import { NextResponse } from "next/server";
import {
  OFFICIAL_SWAP_CHAINS,
  tokensForChain,
} from "@/lib/swap/chains";

// Swap Kit uses Node APIs (no edge runtime).
export const runtime = "nodejs";

/**
 * GET /api/swap/chains
 * Returns the officially-allowed swap chains and the token list per chain, so
 * the frontend can render only supported options.
 */
export async function GET() {
  const tokensByChain = Object.fromEntries(
    OFFICIAL_SWAP_CHAINS.map((c) => [c.id, tokensForChain(c.id)]),
  );

  return NextResponse.json({
    chains: OFFICIAL_SWAP_CHAINS,
    tokensByChain,
  });
}
