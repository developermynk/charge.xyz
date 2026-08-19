/**
 * Swap — client-side signing, SERVER-SIDE quoting.
 *
 * SECURITY MODEL (verified against @circle-fin/app-kit@1.11.0 source):
 * the SDK HARD-THROWS if `config.kitKey` is present in a browser
 * ("kitKey must not be provided in a browser environment — it is a
 * server-only secret"). Swaps on Arc Testnet are key-gated, so the keyless
 * client path returns "No route". The ONLY supported path is:
 *   - a server route (`/api/swap/quote`) holds KIT_KEY (server-only) and calls
 *     `kit.estimateSwap({ config:{ kitKey })` to get the unsigned transactions;
 *   - the browser fetches that quote (no key ever leaves the server) and the
 *     user's own wallet signs + submits the transactions.
 * The user still signs every transaction; the kit key is only an API/routing
 * key used by the server to reach Circle's Stablecoin Service.
 */

import { validateSwap } from "@charge/chains";

import { getAppKit, getUserAdapter, type Eip1193Provider } from "./app-kit.ts";
import { ChargeError } from "./errors.ts";

export interface SwapRequest {
  provider: Eip1193Provider;
  address: `0x${string}`;
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

/** Price a swap without committing to it.
 *
 * Runs client-side with the user's wallet adapter. Circle's App Kit forbids
 * the kit key in the browser, and Estimate requires a live wallet adapter, so
 * this is keyless (the doc-approved path). It returns a real quote on any
 * network Circle has swap liquidity for; on Arc Testnet some pairs have no
 * seeded route yet and Circle returns "No route available". */
export async function estimateSwap(req: SwapRequest): Promise<SwapEstimate> {
  assertValid(req);

  const adapter = await getUserAdapter(req.provider);
  const result = (await getAppKit().estimateSwap({
    from: { adapter: adapter as never, chain: req.chain as never },
    tokenIn: req.tokenIn as never,
    tokenOut: req.tokenOut as never,
    amountIn: req.amountIn,
  })) as {
    estimatedOutput?: { amount?: string; token?: string } | string;
    fees?: unknown;
  };

  const out =
    typeof result.estimatedOutput === "string"
      ? result.estimatedOutput
      : (result.estimatedOutput?.amount ?? "0");

  const inNum = Number(req.amountIn);
  const outNum = Number(out);
  const rate = inNum > 0 ? (outNum / inNum).toFixed(6) : "0";

  return {
    estimatedOutput: out,
    tokenOut: req.tokenOut,
    fees: result.fees,
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
  if (msg.includes("invalid credentials") || msg.includes("unauthorized") || msg.includes("401")) {
    return "Swap quotes are unavailable: the server's Circle kit key isn't authorized for the Stablecoin Service. Add a kit key with swap permissions (Circle Console → Keys → Kit Key) to .env.local as KIT_KEY.";
  }
  if (
    msg.includes("no route") ||
    msg.includes("route not found") ||
    msg.includes("route or resource not found")
  ) {
    return "Circle's swap aggregator has no route for this pair on the selected network yet. Arc Testnet swap is supported but liquidity for this pair may not be seeded — try USDC ↔ EURC, or switch the network to a mainnet (e.g. Base/Ethereum) where routes are live.";
  }
  if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
    return "Not enough balance to cover the swap and its gas.";
  }
  if (msg.includes("slippage")) {
    return "Price moved beyond your slippage tolerance. Re-quote and try again.";
  }
  if (
    msg.includes("eth_gettransactionbyhash") ||
    (msg.includes("invalid params") && msg.includes("getTransactionByHash"))
  ) {
    return "Arc's RPC returned a malformed transaction hash while confirming the swap. The swap was likely submitted — check it on ArcScan (the latest tx from your wallet). If it failed, retry with a smaller amount.";
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
