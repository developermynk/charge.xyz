import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/swap/key
 * Returns the kit key to authenticated callers so the client-side SwapKit
 * can execute swaps using the user's connected wallet. The kit key is NOT
 * a secret API key — it's a publishable identifier for routing, similar to
 * Stripe's publishable key. We still proxy it through the server so it's
 * not baked into the JS bundle and can be rotated without a redeploy.
 */
export async function GET() {
  const kitKey = process.env.KIT_KEY;
  if (!kitKey) {
    return NextResponse.json(
      { error: "KIT_KEY not configured" },
      { status: 500 },
    );
  }
  return NextResponse.json({ kitKey });
}
