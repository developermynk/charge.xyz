import { NextResponse } from "next/server";
import { trackBridge, getBridgeStatus, listActiveBridges } from "../events";

/**
 * POST /api/bridge/status
 * Register a CCTP burn so the server can watch it to completion.
 * Body: { hash, fromChain, toChain, amount }
 *   - hash: source-chain burn tx hash
 *   - fromChain / toChain: Circle Swap SDK ids (e.g. "Arc_Testnet", "Base_Sepolia")
 *   - amount: human USDC amount (string, optional — for display only)
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { hash, fromChain, toChain, amount } = (body ?? {}) as Record<string, unknown>;

  if (typeof hash !== "string" || !/^0x[a-f0-9]{64}$/i.test(hash)) {
    return NextResponse.json({ error: "Invalid burn tx hash" }, { status: 400 });
  }
  if (typeof fromChain !== "string" || typeof toChain !== "string") {
    return NextResponse.json({ error: "fromChain and toChain are required" }, { status: 400 });
  }
  if (fromChain === toChain) {
    return NextResponse.json({ error: "fromChain and toChain must differ" }, { status: 400 });
  }

  const entry = await trackBridge({
    hash: hash as `0x${string}`,
    fromChain,
    toChain,
    amount: typeof amount === "string" ? amount : undefined,
  });

  return NextResponse.json(entry, { headers: { "cache-control": "no-store" } });
}

/**
 * GET /api/bridge/status?hash=0x…  — poll a single transfer's live status.
 * GET /api/bridge/status            — list all in-flight tracked transfers.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash");

  if (hash) {
    if (!/^0x[a-f0-9]{64}$/i.test(hash)) {
      return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
    }
    const entry = await getBridgeStatus(hash as `0x${string}`);
    if (!entry) return NextResponse.json({ error: "Unknown transfer" }, { status: 404 });
    return NextResponse.json(entry, { headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json(
    { items: await listActiveBridges() },
    { headers: { "cache-control": "no-store" } },
  );
}
