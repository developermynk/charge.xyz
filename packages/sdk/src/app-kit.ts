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
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

import { ARC_SWAP_CHAIN } from "@charge/chains";

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
 * App Kit already bundles the correct public RPC for every supported chain,
 * including `https://rpc.testnet.arc.network/` for Arc Testnet (verified:
 * returns chainId 5042002 and real balances). We only override it when an
 * operator wants to self-host via NEXT_PUBLIC_ARC_RPC_URL.
 *
 * We deliberately do NOT pass a custom `getPublicClient` to
 * `createViemAdapterFromProvider`. The official Arc / Circle bridge quickstart
 * calls it with just `{ provider }`, letting the SDK select the correct RPC
 * per chain. A previous build pinned `chain: arcTestnet` for every non-Arc
 * chain, which made the destination mint step simulate `receiveMessage`
 * against Arc's MessageTransmitterV2 (localDomain 26) instead of Base
 * Sepolia's (localDomain 6) — producing the "Invalid destination domain"
 * failure. Removing the override restores correct per-chain RPC selection.
 */
const ARC_RPC =
  process.env["NEXT_PUBLIC_ARC_RPC_URL"] || "https://rpc.testnet.arc.network/";

/**
 * Build a user-controlled adapter from the connected wallet.
 *
 * `addressContext: 'user-controlled'` is deliberate: it makes passing an
 * explicit address a type error, so the SDK can only sign for whichever
 * account the wallet currently exposes. No `getPublicClient` override — the SDK
 * picks the right RPC for each chain (Arc, Base Sepolia, …) on its own.
 */
export async function getUserAdapter(
  provider: Eip1193Provider,
): Promise<UserAdapter> {
  return createViemAdapterFromProvider({
    // The SDK's EIP1193Provider type is structurally identical to ours.
    provider: provider as never,
    capabilities: { addressContext: "user-controlled" },
  });
}

export { ARC_SWAP_CHAIN };
