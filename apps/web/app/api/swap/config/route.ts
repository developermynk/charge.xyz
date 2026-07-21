import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/swap/config
 * Returns whether the swap backend is properly configured (all required env
 * vars present). The frontend uses this to show a helpful setup prompt instead
 * of cryptic 500 errors when the operator hasn't filled in their keys.
 */
export async function GET() {
  const missing: string[] = [];
  if (!process.env.KIT_KEY) missing.push("KIT_KEY");
  if (!process.env.CIRCLE_API_KEY) missing.push("CIRCLE_API_KEY");
  if (!process.env.CIRCLE_ENTITY_SECRET) missing.push("CIRCLE_ENTITY_SECRET");
  if (!process.env.WALLET_ADDRESS) missing.push("WALLET_ADDRESS");

  return NextResponse.json({
    configured: missing.length === 0,
    missing,
    feesEnabled: !!process.env.SWAP_FEE_RECIPIENT,
  });
}
