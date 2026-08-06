/**
 * Bridge — CCTP, client-side, signed by the user's wallet.
 *
 * Bridge needs NO kit key (confirmed in Circle's bridge-stablecoin skill), so
 * the whole flow runs in the browser with zero server involvement.
 *
 * CCTP is a burn-and-mint protocol, not a lock-and-wrap one: USDC is destroyed
 * on the source chain and freshly minted on the destination after Circle's
 * attestation service signs off. That attestation wait is why the UI must show
 * named stages instead of one spinner.
 */

import { getAppKit, getUserAdapter, type Eip1193Provider } from "./app-kit.ts";
import { ChargeError } from "./errors.ts";

export interface BridgeRequest {
  provider: Eip1193Provider;
  fromChain: string;
  toChain: string;
  /** Human-readable USDC amount, e.g. "10.5". */
  amount: string;
}

export interface BridgeResult {
  txHash?: string;
  destinationTxHash?: string;
  status: "completed" | "pending";
}

export class BridgeError extends ChargeError {}

/** The stages a CCTP transfer moves through, in order. */
export const BRIDGE_STAGES = [
  { id: "approve", label: "Approve USDC" },
  { id: "burn", label: "Burn on source chain" },
  { id: "attest", label: "Wait for Circle attestation" },
  { id: "mint", label: "Mint on destination chain" },
] as const;

export type BridgeStageId = (typeof BRIDGE_STAGES)[number]["id"];

export async function estimateBridge(req: BridgeRequest) {
  const adapter = await getUserAdapter(req.provider);
  return getAppKit().estimateBridge({
    from: { adapter: adapter as never, chain: req.fromChain as never },
    to: { adapter: adapter as never, chain: req.toChain as never },
    amount: req.amount,
    token: "USDC",
  } as never);
}

/**
 * Execute a CCTP bridge.
 *
 * `onStage` is called as the SDK advances so the UI can light up each step;
 * without it a multi-minute attestation looks like a hang.
 */
export async function executeBridge(
  req: BridgeRequest,
  onStage?: (stage: BridgeStageId) => void,
): Promise<BridgeResult> {
  const amount = Number(req.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BridgeError("Enter an amount greater than zero.");
  }
  if (req.fromChain === req.toChain) {
    throw new BridgeError("Source and destination chains must be different.");
  }

  const adapter = await getUserAdapter(req.provider);

  // User-controlled adapter: the SDK resolves the recipient from the connected
  // wallet and rejects an explicit `address`. A self-bridge (to your own wallet
  // on the destination) is the only supported shape here — by design, so the
  // app can never move funds to an address the connected wallet didn't intend.
  // Passing `address` (even the sender's own) throws
  // "Address should not be provided for user-controlled adapters".
  try {
    onStage?.("approve");
    const result = await getAppKit().bridge({
      from: { adapter: adapter as never, chain: req.fromChain as never },
      to: { adapter: adapter as never, chain: req.toChain as never },
      amount: req.amount,
      token: "USDC",
    } as never);

    onStage?.("mint");

    const r = result as {
      txHash?: string;
      sourceTxHash?: string;
      destinationTxHash?: string;
    };
    return {
      txHash: r.txHash ?? r.sourceTxHash,
      destinationTxHash: r.destinationTxHash,
      status: r.destinationTxHash ? "completed" : "pending",
    };
  } catch (err) {
    throw new BridgeError(humanizeBridgeError(err), { cause: err });
  }
}

export function humanizeBridgeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();

  if (msg.includes("user rejected") || msg.includes("user denied")) {
    return "You rejected the transaction in your wallet.";
  }
  if (msg.includes("insufficient")) {
    return "Not enough USDC to cover the bridge amount and gas.";
  }
  if (msg.includes("attestation")) {
    return "Circle's attestation is taking longer than expected. Your USDC is safe — the mint will complete once attested.";
  }
  if (msg.includes("unsupported") || msg.includes("route")) {
    return "That bridge route is not supported yet.";
  }
  if (raw) return `Bridge failed: ${raw}`;
  return "The bridge could not be completed. Please try again.";
}
