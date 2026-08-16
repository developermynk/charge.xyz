import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { syncFromChain, store } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

/**
 * GET /api/launchpad/token/[address]
 * Token detail: metadata + live price/mcap/volume/holders/graduated from chain.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  try {
    await syncFromChain();
  } catch {
    /* serve cached */
  }
  const token = store().getToken(address as `0x${string}`);
  if (!token) {
    return NextResponse.json({ error: "Token not indexed", address }, { status: 404 });
  }
  return NextResponse.json({ token });
}
