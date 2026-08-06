/**
 * Swap — client-side, signed by the user's wallet.
 *
 * KEY SECURITY DECISION (verified against Arc docs, app-kit/swap):
 * the kit key is OPTIONAL — without one, requests simply run against a rate
 * limit. It is also a server-only credential. Since Charge signs with the
 * USER's browser wallet (`createViemAdapterFromProvider`, which the docs
 * explicitly support for browser flows), sending a kit key to the client would
 * leak a server secret to every visitor for nothing but a rate-limit bump.
 *
 * So: no kit key on the client, ever. If rate limits become a problem the fix
 * is a server-side quote proxy, NOT shipping the key to the browser.
 */

import { validateSwap } from "@charge/chains";

import { getAppKit, getUserAdapter, type Eip1193Provider } from "./app-kit.ts";
import { ChargeError } from "./errors.ts";

export interface SwapRequest {
  provider: Eip1193Provider;
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps?: number;
}

export interface SwapEstimate {
  estimatedOutput: string;
  tokenOut: string;
  fees?: unknown;
  rate: string;
}

export interface SwapExecution {
  txHash?: string;
  amountOut?: string;
}

export class SwapError extends ChargeError {}

function assertValid(req: Pick<SwapRequest, "chain" | "tokenIn" | "tokenOut" | "amountIn">) {
  const check = validateSwap(req);
  if (!check.ok) throw new SwapError(check.error ?? "Invalid swap request.");
}

/** Price a swap without committing to it. */
export async function estimateSwap(req: SwapRequest): Promise<SwapEstimate> {
  assertValid(req);

  const adapter = await getUserAdapter(req.provider);
  const result = (await getAppKit().estimateSwap({
    from: { adapter: adapter as never, chain: req.chain as never },
    tokenIn: req.tokenIn as never,
    tokenOut: req.tokenOut as never,
    amountIn: req.amountIn,
  } as never)) as {
    estimatedOutput?: { amount?: string; token?: string } | string;
    fees?: unknown;
  };

  // v1.x: estimatedOutput is { amount, token }; tolerate a bare string too.
  const out = result.estimatedOutput;
  const amountOut =
    typeof out === "string"
      ? out
      : (out?.amount ?? "0");

  const inNum = Number(req.amountIn);
  const outNum = Number(amountOut);
  const rate = inNum > 0 ? (outNum / inNum).toFixed(6) : "0";

  return {
    estimatedOutput: amountOut,
    tokenOut: req.tokenOut,
    fees: (result as { fees?: unknown }).fees,
    rate,
  };
}

/**
 * Execute the swap. The user's wallet raises its own confirmation prompt.
 *
 * Retries once with an on-chain approval when the wallet is a counterfactual
 * Circle smart account: such accounts cannot produce EIP-1271 signatures until
 * they exist on chain, and the first real transaction deploys them. This exact
 * fallback is used by Circle's own Arc sample app.
 */
export async function executeSwap(req: SwapRequest): Promise<SwapExecution> {
  assertValid(req);

  const adapter = await getUserAdapter(req.provider);
  const params = {
    from: { adapter: adapter as never, chain: req.chain as never },
    tokenIn: req.tokenIn as never,
    tokenOut: req.tokenOut as never,
    amountIn: req.amountIn,
  };
  const config = {
    ...(req.slippageBps !== undefined ? { slippageBps: req.slippageBps } : {}),
  };

  try {
    const result = await getAppKit().swap({ ...params, config } as never);
    return {
      txHash: (result as { txHash?: string }).txHash,
      amountOut: (result as { amountOut?: string }).amountOut,
    };
  } catch (err) {
    if (isUndeployedWalletError(err)) {
      const result = await getAppKit().swap({
        ...params,
        config: { ...config, allowanceStrategy: "approve" },
      } as never);
      return {
        txHash: (result as { txHash?: string }).txHash,
        amountOut: (result as { amountOut?: string }).amountOut,
      };
    }
    throw new SwapError(humanizeSwapError(err), { cause: err });
  }
}

function isUndeployedWalletError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /undeployed wallet/i.test(msg);
}

/** Turn SDK/RPC noise into something a user can act on. */
export function humanizeSwapError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();

  if (msg.includes("user rejected") || msg.includes("user denied")) {
    return "You rejected the transaction in your wallet.";
  }
  if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
    return "Not enough balance to cover the swap and its gas.";
  }
  if (msg.includes("slippage")) {
    return "Price moved beyond your slippage tolerance. Re-quote and try again.";
  }
  if (msg.includes("liquidity")) {
    return "Not enough liquidity for this pair right now. Try a smaller amount.";
  }
  if (msg.includes("chain") && msg.includes("mismatch")) {
    return "Your wallet is on the wrong network. Switch to Arc Testnet.";
  }
  // Surface the underlying message — it is the only way to tell a flaky RPC
  // (rate-limited, timeout) from a genuine swap failure.
  if (raw) return `Swap failed: ${raw}`;
  return "The swap could not be completed. Please try again.";
}
