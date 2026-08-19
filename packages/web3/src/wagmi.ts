/**
 * wagmi configuration — multi-chain EVM.
 *
 * Per the v1 plan, the app is no longer Arc-singular. Every EVM chain in the
 * Arc/Circle supported set (see `@charge/chains` EVM_CHAINS) is registered here
 * so a user connected with an injected wallet sees all their chains, and Privy
 * provisions an embedded wallet per chain. Non-EVM (Solana) is a separate
 * adapter in v2.
 *
 * Chain definitions are built self-contained via `defineChain` from the registry
 * metadata — we deliberately do NOT import named exports from `viem/chains`
 * (e.g. `base`, `arbitrum`) because that surface differs across viem versions
 * and missing exports would break the build. The registry is the single source
 * of truth.
 */

import { createConfig, http, type Config } from "wagmi";
import type { Chain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";

import {
  ARC_CHAIN_ID,
  EVM_CHAINS,
  arcTestnet,
} from "@charge/chains";

const wcProjectId = process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"];

/** RPC override lets us point Arc at the arc-canteen node when one is provided. */
const arcRpcUrl = process.env["NEXT_PUBLIC_ARC_RPC_URL"];

/**
 * Build a wagmi/viem Chain from registry metadata. All listed chains use 18dp
 * native currency (standard EVM). Arc is special-cased to the viem-shipped
 * `arcTestnet` so its USDC-native-gas quirk is preserved exactly.
 */
function toChain(def: (typeof EVM_CHAINS)[number]): Chain {
  if (def.chainId === ARC_CHAIN_ID) return arcTestnet;

  return defineChain({
    id: def.chainId,
    name: def.name,
    nativeCurrency: {
      name: def.nativeSymbol,
      symbol: def.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [def.rpcUrl] },
    },
    blockExplorers: {
      default: { name: `${def.name} Explorer`, url: def.explorerUrl },
    },
    testnet: def.testnet,
  });
}

const chains = EVM_CHAINS.map(toChain) as [Chain, ...Chain[]];

/**
 * Transports: every chain gets its public RPC from the registry. Arc honors the
 * `NEXT_PUBLIC_ARC_RPC_URL` override when present.
 */
/** Static backup RPCs for chains whose primary may rate-limit or go down. */
const RPC_FALLBACKS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  10: "https://optimism-rpc.publicnode.com",
  130: "https://unichain-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
  42161: "https://arbitrum-rpc.publicnode.com",
  421614: "https://arbitrum-sepolia-rpc.publicnode.com",
  1329: "https://sei-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
};

/**
 * Build a transport with a primary + one fallback URL. viem's `http()` with a
 * string array will fall through to the next URL if the previous one errors,
 * so a single dead endpoint degrades to the backup instead of hanging the
 * chain's balance/activity read. Both URLs get the same sane timeout/retry.
 */
function transportFor(chainId: number, primary: string | undefined): ReturnType<typeof http> {
  const urls: string[] = [];
  if (primary) urls.push(primary);
  const fb = RPC_FALLBACKS[chainId];
  if (fb && fb !== primary) urls.push(fb);
  // viem's http() accepts `string | string[]` (failover URLs) at runtime, but
  // this project's resolved viem typings narrow the first arg to `string`.
  // Cast through unknown to keep the multi-URL failover we depend on.
  const url = (urls.length ? urls : primary ?? "") as unknown as string;
  return http(url, {
    retryCount: 2,
    timeout: 10_000,
  });
}

const transports: Record<number, ReturnType<typeof http>> = {};
for (const def of EVM_CHAINS) {
  transports[def.chainId] =
    def.chainId === ARC_CHAIN_ID
      ? transportFor(def.chainId, arcRpcUrl || undefined)
      : transportFor(def.chainId, def.rpcUrl);
}

/**
 * Explicitly annotated as `Config`.
 *
 * Without the annotation, TypeScript tries to name the inferred connector types
 * and reaches into pnpm's content-addressed store path for
 * @walletconnect/ethereum-provider (TS2742 — "cannot be named without a
 * reference to .pnpm/..."). Widening to the public `Config` type keeps the
 * declaration portable; `declare module "wagmi"` below preserves full type
 * inference for every useAccount/useReadContract call site.
 */
export const wagmiConfig: Config = createConfig({
  chains,
  connectors: [
    injected({ shimDisconnect: true }),
    ...(wcProjectId
      ? [
          walletConnect({
            projectId: wcProjectId,
            showQrModal: true,
            metadata: {
              name: "Chargefi",
              description: "The USDC-native control panel for Arc.",
              url: "https://chargefi.xyz",
              icons: ["https://chargefi.xyz/icon.png"],
            },
          }),
        ]
      : []),
  ],
  transports,
  ssr: true,
});

export { arcTestnet, ARC_CHAIN_ID };

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
