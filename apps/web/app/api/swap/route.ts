import { NextResponse } from "next/server";
import { validateSwapParams } from "@/lib/swap/chains";
import { getSwapEnv, getSwapKit, getSwapAdapter, getSwapCustomFee } from "@/lib/swap/server";

export const runtime = "nodejs";

/**
 * POST /api/swap
 * Body: { chain, tokenIn, tokenOut, amountIn, slippageBps? }
 * Executes a real on-chain swap via Circle's Swap Kit using the backend
 * developer-controlled wallet. This MOVES FUNDS — only call it after the user
 * has confirmed the parameters.
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

  try {
    const env = getSwapEnv();
    const kit = getSwapKit();
    const adapter = getSwapAdapter(env);
    const customFee = getSwapCustomFee(env);

    const result = (await kit.swap({
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

    // Normalize the SDK response to a serializable shape.
    const pick = (...keys: string[]) => {
      const o: Record<string, unknown> = {};
      for (const k of keys) if (result[k] !== undefined) o[k] = result[k];
      return o;
    };

    return NextResponse.json({
      ...pick(
        "txHash",
        "amountIn",
        "amountOut",
        "tokenIn",
        "tokenOut",
        "chain",
        "explorerUrl",
        "fees",
        "fromAddress",
        "toAddress",
      ),
      ...(customFee
        ? {
            developerFee: {
              percentageBps: customFee.percentageBps,
              recipientAddress: customFee.recipientAddress,
            },
          }
        : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Swap failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
