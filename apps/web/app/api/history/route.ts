import { NextResponse } from "next/server";

/**
 * Server-side proxy for per-chain on-chain transaction history.
 *
 * Why this exists: the History page used to call each chain's Blockscout
 * explorer REST API *directly from the browser*. Blockscout does not send
 * `Access-Control-Allow-Origin` for arbitrary web origins, so those fetches
 * were blocked by the browser's CORS policy and the page silently rendered
 * "0 shown" even for wallets with hundreds of real transactions.
 *
 * A server route has no CORS restriction, so we fetch here (server -> explorer)
 * and return a clean, normalized list to the client. `cache: "no-store"` keeps
 * the 20s real-time poll honest.
 */

// Blockscout v2 REST base per chain. Avalanche Fuji has no keyless public
// path, so it is intentionally omitted and skipped.
const EXPLORER_BASE: Record<number, string | undefined> = {
  5042002: "https://testnet.arcscan.app/api/v2",
  84532: "https://base-sepolia.blockscout.com/api/v2",
  421614: "https://arbitrum-sepolia.blockscout.com/api/v2",
  11155420: "https://optimism-sepolia.blockscout.com/api/v2",
  11155111: "https://eth-sepolia.blockscout.com/api/v2",
};

interface RawTx {
  hash: string;
  value?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  timestamp?: string;
  created_at?: string;
}

interface HistoryItem {
  hash: string;
  chainId: number;
  from: string;
  to: string;
  value: string;
  timestamp: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const addr = (searchParams.get("addr") ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const results: HistoryItem[] = [];
  const errors: number[] = [];

  await Promise.all(
    Object.entries(EXPLORER_BASE).map(async ([chainIdStr, base]) => {
      if (!base) return;
      const chainId = Number(chainIdStr);
      try {
        const res = await fetch(`${base}/addresses/${addr}/transactions`, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          errors.push(chainId);
          return;
        }
        const json = (await res.json()) as { items?: RawTx[] };
        for (const tx of json.items ?? []) {
          results.push({
            hash: tx.hash,
            chainId,
            from: (tx.from?.hash ?? addr).toLowerCase(),
            to: (tx.to?.hash ?? addr).toLowerCase(),
            value: tx.value ?? "0",
            timestamp: tx.timestamp ?? tx.created_at ?? new Date().toISOString(),
          });
        }
      } catch {
        errors.push(chainId);
      }
    }),
  );

  results.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  return NextResponse.json({ items: results, errors }, { headers: { "cache-control": "no-store" } });
}
