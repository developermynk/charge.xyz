export { wagmiConfig, arcTestnet, ARC_CHAIN_ID } from "./wagmi.ts";

/**
 * wagmi re-exports.
 *
 * `@charge/web3` is the ONLY package in the monorepo that depends on wagmi.
 * When both this package and apps/web declared it, pnpm resolved two physically
 * distinct copies, so `WagmiProvider` (mounted from the app's copy) was
 * invisible to `useAccount` (called from this package's copy) and the
 * production build died with "`useConfig` must be used within `WagmiProvider`".
 *
 * A single owner makes a second copy structurally impossible rather than merely
 * unlikely, so app code imports these from here — never from "wagmi" directly.
 */
export {
  WagmiProvider,
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  type Connector,
} from "wagmi";

export { PRIVY_APP_ID, isPrivyConfigured } from "./privy.ts";
export {
  PrivyBridgeProvider,
  PrivyProvider,
  usePrivyBridge,
  type PrivyBridgeState,
  type Eip1193Provider,
} from "./privy-bridge.tsx";
export {
  WalletProvider,
  useWallet,
  type AuthMethod,
  type WalletState,
} from "./wallet-context.tsx";
export { useArcBalance } from "./use-arc-balance.ts";
