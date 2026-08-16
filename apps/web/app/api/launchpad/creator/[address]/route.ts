import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { syncFromChain, store } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

/**
 * GET /api/launchpad/creator/[address]
 * Tokens created by `address` + the tokens `address` has traded (portfolio).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const who = address.toLowerCase();
  try {
    await syncFromChain();
  } catch {
    /* serve cached */
  }
  const s = store();
  const created = s.listTokens().filter((t) => t.creator.toLowerCase() === who);
  const traded = new Set(
    s
      .allTrades()
      .filter((t) => t.trader.toLowerCase() === who)
      .map((t) => t.token.toLowerCase()),
  );
  const holdings = [...traded].map((a) => s.getToken(a as `0x${string}`)!).filter(Boolean);
  return NextResponse.json({ created, holdings });
}
