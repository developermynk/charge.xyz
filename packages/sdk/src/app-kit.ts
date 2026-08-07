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
 */

import { AppKit } from "@circle-fin/app-kit";
import { createPublicClient, http } from "viem";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

import { ARC_CHAIN_ID, ARC_SWAP_CHAIN } from "@charge/chains";

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
 * Arc Testnet RPC override.
 *
 * App Kit bundles a default public RPC per chain, but Arc Testnet's default is
 * rate-limited / frequently unavailable — which is exactly what produced the
 * email-login errors `{"code":-32005,"message":"rate limit exceeded"}` and
 * `Network connection failed for Arc Testnet`. We therefore override
 * `getPublicClient` to pin ONLY Arc to our reliable `rpc.testnet.arc.network/`
 * (overridable via NEXT_PUBLIC_ARC_RPC_URL). Every other chain (Base Sepolia,
 * Arbitrum Sepolia, OP Sepolia, …) is left to the SDK, which selects the correct
 * RPC for that chain — this is what keeps the destination mint step's
 * `receiveMessage` simulation on the right chain (fixing "Invalid destination
 * domain"). The earlier bug pinned `chain: arcTestnet` for ALL chains, which
 * broke the mint; here we only override the *transport URL for Arc*, while
 * passing the SDK's own per-chain `chain` definition through untouched.
 */
const ARC_RPC =
  process.env["NEXT_PUBLIC_ARC_RPC_URL"] || "https://rpc.testnet.arc.network/";

/**
 * Build a user-controlled adapter from the connected wallet.
 *
 * `addressContext: 'user-controlled'` is deliberate: it makes passing an
 * explicit address a type error, so the SDK can only sign for whichever
 * account the wallet currently exposes.
 *
 * Override `getPublicClient` so Arc reads hit our reliable RPC endpoint (the
 * SDK default for Arc is rate-limited and fails for email/logic-sign-in users
 * who have no wallet-supplied Arc RPC). For every other chain we return the SDK
 * default client (correct per-chain RPC) — leaving the chain definition exactly
 * as the SDK built it so the destination mint targets the right chain.
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
        "id" in chain && Number(chain.id) === ARC_CHAIN_ID;
      return createPublicClient(
        isArc
          ? { chain, transport: http(ARC_RPC) }
          : { chain, transport: http() },
      );
    },
  });
}

export { ARC_SWAP_CHAIN };
