/**
 * Circle App Kit — client-side, user-signed operations.
 *
 * ARCHITECTURAL RULE (from the security review): the developer wallet must
 * NEVER sign a user's transaction. The previous build wired swaps to a
 * developer-controlled `WALLET_ADDRESS`, which meant the app moved its own
 * funds on the user's behalf — the user's connected wallet was decorative.
 *
 * Everything here therefore runs in the browser against the user's own
 * EIP-1193 provider via `createViemAdapterFromProvider`, using the
 * `user-controlled` capability so the SDK refuses an explicit address and can
 * only ever act for the connected account.
 *
 * Signatures verified against the installed packages:
 *   @circle-fin/adapter-viem-v2@1.14.0 — createViemAdapterFromProvider({ provider, capabilities })
 *   @circle-fin/app-kit@1.10.0        — kit.swap/estimateSwap/bridge/estimateBridge
 */

import { AppKit } from "@circle-fin/app-kit";
import { createPublicClient, http } from "viem";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

import { arcTestnet, ARC_SWAP_CHAIN } from "@charge/chains";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

let kitSingleton: AppKit | null = null;

/** App Kit holds no secrets for bridge, and takes the kit key per-call for swap. */
export function getAppKit(): AppKit {
  if (!kitSingleton) kitSingleton = new AppKit();
  return kitSingleton;
}

/**
 * The adapter instance handed to App Kit.
 *
 * Typed as `unknown` at the package boundary on purpose: the concrete
 * ViemAdapter generic references internal chain-definition types that TypeScript
 * cannot name without pointing into pnpm's content-addressed store (TS4058),
 * which would make the emitted declarations non-portable. Callers only ever
 * forward this value straight back into App Kit, so the opaque type costs
 * nothing and keeps the build reproducible.
 */
export type UserAdapter = unknown;

/**
 * The Arc RPC endpoint used for read operations.
 *
 * IMPORTANT: App Kit ships with built-in shared public RPC URLs. Those are
 * rate-limited and frequently unavailable for Arc Testnet, which made swap
 * quotes and bridge calls silently fail with a generic error. We pin our own
 * node so reads are reliable. Override via NEXT_PUBLIC_ARC_RPC_URL if you
 * self-host.
 */
const ARC_RPC =
  process.env["NEXT_PUBLIC_ARC_RPC_URL"] || "https://arc-node.thecanteenapp.com";

/**
 * Build a user-controlled adapter from the connected wallet.
 *
 * `addressContext: 'user-controlled'` is deliberate: it makes passing an
 * explicit address a type error, so the SDK can only sign for whichever
 * account the wallet currently exposes. We also supply a custom public client
 * pinned to our Arc RPC so balance/quote reads don't hit Circle's flaky shared
 * endpoint.
 */
export async function getUserAdapter(
  provider: Eip1193Provider,
): Promise<UserAdapter> {
  return createViemAdapterFromProvider({
    // The SDK's EIP1193Provider type is structurally identical to ours.
    provider: provider as never,
    capabilities: { addressContext: "user-controlled" },
    getPublicClient: ({ chain }) => {
      const isArc =
        "chainId" in chain &&
        Number((chain as { chainId?: number }).chainId) === arcTestnet.id;
      return createPublicClient({
        chain: arcTestnet,
        transport: http(isArc ? ARC_RPC : undefined),
      });
    },
  });
}

export { ARC_SWAP_CHAIN };
