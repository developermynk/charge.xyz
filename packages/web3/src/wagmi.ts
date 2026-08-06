/**
 * wagmi configuration — Arc Testnet only.
 *
 * Arc is a testnet-only chain today, so exposing any other network here would
 * let a user connect to a chain where none of the app's contracts or tokens
 * exist. One chain in, one chain out.
 */

import { createConfig, http, type Config } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

import { ARC_CHAIN_ID, arcTestnet } from "@charge/chains";

const wcProjectId = process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"];

/** RPC override lets us point at the arc-canteen node when one is provided. */
const arcRpcUrl = process.env["NEXT_PUBLIC_ARC_RPC_URL"];

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
  chains: [arcTestnet],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(wcProjectId
      ? [
          walletConnect({
            projectId: wcProjectId,
            showQrModal: true,
            metadata: {
              name: "Charge.xyz",
              description: "The USDC-native control panel for Arc.",
              url: "https://charge.xyz",
              icons: ["https://charge.xyz/icon.png"],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [arcTestnet.id]: http(arcRpcUrl || undefined),
  },
  ssr: true,
});

export { arcTestnet, ARC_CHAIN_ID };

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
