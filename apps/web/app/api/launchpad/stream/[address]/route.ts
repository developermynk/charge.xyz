import { NextRequest } from "next/server";
import { isAddress } from "viem";
import { syncFromChain, store } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

/**
 * GET /api/launchpad/stream/[address]  (Server-Sent Events)
 * Live price + recent trades for a token. Polls the synced store every 2s and
 * pushes `price` and `trade` events. Re-syncs from chain periodically so new
 * on-chain trades appear within ~one block.
 *
 * NOTE (Decision D4): SSE over a Next route handler keeps the stack single-process
 * and local-only. A raw WebSocket gateway (IRealtime) can replace this for prod.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isAddress(address)) {
    return new Response("Invalid address", { status: 400 });
  }
  const token = address as `0x${string}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastTradeCount = 0;
      let lastPrice = 0;
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("hello", { token });

      const tick = setInterval(async () => {
        try {
          // periodic re-sync keeps fresh on-chain trades flowing
          await syncFromChain();
          const t = store().getToken(token);
          if (t && t.priceUsd !== lastPrice) {
            lastPrice = t.priceUsd;
            send("price", { priceUsd: t.priceUsd, marketCapUsd: t.marketCapUsd, volumeUsd: t.volumeUsd, graduated: t.graduated });
          }
          const trades = store().tradesFor(token);
          if (trades.length > lastTradeCount) {
            const news = trades.slice(lastTradeCount);
            for (const tr of news) send("trade", tr);
            lastTradeCount = trades.length;
          }
        } catch {
          /* ignore sync errors in stream */
        }
      }, 2000);

      // stop on client disconnect
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(tick);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
