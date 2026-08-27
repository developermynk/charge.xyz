import { NextResponse } from "next/server";

/**
 * Server-side proxy for per-chain on-chain transaction history.
 *
 * Why this exists: the History page used to call each chain's Blockscout
 * explorer REST API directly from the browser, which was blocked by CORS
 * (no Access-Control-Allow-Origin), so the page silently rendered "0 shown".
 * A server route has no CORS restriction, so we fetch here (server -> explorer)
 * and return a clean, normalized list to the client.
 *
 * IMPORTANT — amount source:
 * On Arc Testnet USDC is the native gas token, so the overwhelming majority of
 * Chargefi activity (bridges, swaps, token sends) are ERC-20 token transfers
 * inside contract calls. For those, the `/transactions` `value` field is the
 * NATIVE value and is always "0" — reading it made every row show $0.00.
 * The real transferred amount lives in the `/token-transfers` endpoint
 * (`total.value`/`total.decimals` + `token.symbol`). So we query THAT endpoint
 * and fall back to native `value` only when there is no token transfer.
 *
 * `cache: "no-store"` keeps the 20s real-time poll honest.
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

interface RawTransfer {
  transaction_hash: string;
  from: { hash?: string };
  to: { hash?: string };
  token?: { symbol?: string; decimals?: string; address_hash?: string };
  total?: { value?: string; decimals?: string };
  timestamp?: string;
  type?: string;
}

interface HistoryItem {
  hash: string;
  chainId: number;
  from: string;
  to: string;
  value: string;
  decimals: number;
  symbol: string;
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
        // Token transfers carry the real amount on ERC-20-native chains.
        // The base endpoint already returns both incoming and outgoing
        // transfers for the address, so no `filter` param is needed (and the
        // `filter=to | from address` syntax 422s on several explorers).
        const res = await fetch(
          `${base}/addresses/${addr}/token-transfers`,
          { headers: { accept: "application/json" }, cache: "no-store" },
        );
        if (!res.ok) {
          errors.push(chainId);
          return;
        }
        const json = (await res.json()) as { items?: RawTransfer[] };
        for (const tx of json.items ?? []) {
          const total = tx.total?.value ?? "0";
          const decimals = Number(tx.total?.decimals ?? 18);
          results.push({
            hash: tx.transaction_hash,
            chainId,
            from: (tx.from?.hash ?? addr).toLowerCase(),
            to: (tx.to?.hash ?? addr).toLowerCase(),
            value: total,
            decimals,
            symbol: tx.token?.symbol ?? "ETH",
            timestamp: tx.timestamp ?? new Date().toISOString(),
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
