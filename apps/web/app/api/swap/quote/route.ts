import { NextResponse } from "next/server";
import { validateSwapParams } from "@/lib/swap/chains";
import { getSwapEnv, getSwapKit, getSwapAdapter, getSwapCustomFee } from "@/lib/swap/server";

export const runtime = "nodejs";

/**
 * POST /api/swap/quote
 * Body: { chain, tokenIn, tokenOut, amountIn, slippageBps? }
 * Returns an estimated swap output (no on-chain execution). Estimates do not
 * guarantee final amounts — rates move between quote and execution.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = body as Record<string, unknown>;
  const validation = validateSwapParams({
    chain: typeof parsed.chain === "string" ? parsed.chain : undefined,
    tokenIn: typeof parsed.tokenIn === "string" ? parsed.tokenIn : undefined,
    tokenOut:
      typeof parsed.tokenOut === "string" ? parsed.tokenOut : undefined,
    amountIn:
      typeof parsed.amountIn === "string" ? parsed.amountIn : undefined,
    slippageBps:
      typeof parsed.slippageBps === "number" ? parsed.slippageBps : undefined,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { chain, tokenIn, tokenOut, amountIn, slippageBps } = validation.value;

  // Debug log: quote request
  console.log(`[SWAP QUOTE] chain=${chain} tokenIn=${tokenIn} tokenOut=${tokenOut} amountIn=${amountIn} slippageBps=${slippageBps}`);

  try {
    const env = getSwapEnv();
    const kit = getSwapKit();
    const adapter = getSwapAdapter(env);
    const customFee = getSwapCustomFee(env);

    const estimate = (await kit.estimate({
      from: { adapter, chain: chain as never, address: env.walletAddress },
      tokenIn,
      tokenOut,
      amountIn,
      config: {
        kitKey: env.kitKey,
        allowanceStrategy: "approve",
        ...(slippageBps !== undefined ? { slippageBps } : {}),
        ...(customFee ? { customFee } : {}),
      },
    })) as unknown as Record<string, unknown>;

    // Pass through the known estimate fields; omit anything non-serializable.
    const out: Record<string, unknown> = {
      developerFee: customFee
        ? {
            percentageBps: customFee.percentageBps,
            recipientAddress: customFee.recipientAddress,
          }
        : null,
    };
    for (const key of [
      "estimatedOutput",
      "fees",
      "minReceived",
      "rate",
      "priceImpactBps",
      "slippageBps",
      "route",
    ]) {
      if (estimate[key] !== undefined) {
        let val = estimate[key];
        // If it's an object (e.g. { amount: "1.23" }), extract a readable string
        if (key === "estimatedOutput" && typeof val === "object" && val !== null) {
          val = (val as any).amount || (val as any).value || (val as any).formattedAmount || JSON.stringify(val);
        }
        out[key] = val;
      }
    }

    // Debug log: quote response
    console.log(`[SWAP QUOTE] success estimatedOutput=${out.estimatedOutput}`);

    return NextResponse.json(out);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Swap estimate failed";
    console.error("[SWAP QUOTE] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
