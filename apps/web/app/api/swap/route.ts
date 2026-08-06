import { NextResponse } from "next/server";
import { validateSwapParams } from "@/lib/swap/chains";
import { getSwapEnv, getSwapKit, getSwapAdapter, getSwapCustomFee } from "@/lib/swap/server";

export const runtime = "nodejs";

/**
 * POST /api/swap
 * 
 * DISABLED: Server-side swap execution using developer wallet.
 * 
 * The swap MUST be executed client-side using the connected user's wallet.
 * This endpoint is kept only for reference/legacy purposes.
 * 
 * To execute a swap, use the client-side SwapKit with the user's EIP-1193 provider
 * (via createViemAdapterFromProvider) so the transaction is signed by the user's wallet.
 */
export async function POST(req: Request) {
  return NextResponse.json(
    { 
      error: "Server-side swap execution is disabled. " +
        "Swaps must be executed client-side using the connected user's wallet. " +
        "Use /api/swap/quote for estimates only.",
    },
    { status: 400 }
  );
}

/**
 * Quote endpoint — estimates only, no on-chain execution.
 * This uses the developer wallet for liquidity estimation but does NOT execute any transaction.
 */
export async function GET(req: Request) {
  // Not implemented - use POST /api/swap/quote for quotes
  return NextResponse.json({ error: "Use POST /api/swap/quote for estimates" }, { status: 405 });
}