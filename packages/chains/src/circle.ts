/**
 * Circle Swap Kit / Bridge chain + token registry.
 *
 * These are Circle SDK STRING identifiers, not numeric chain ids. Source:
 * Arc docs (app-kit/references/supported-blockchains) bundled via
 * `arc-canteen context`.
 *
 * CLIENT-SAFE: contains no secrets.
 */

import { ARC_SWAP_CHAIN, ARC_SWAP_TOKENS, type ArcSwapToken } from "./arc.ts";

export interface SwapChain {
  /** Circle SDK identifier, e.g. "Arc_Testnet". */
  id: string;
  name: string;
  testnet: boolean;
}

export const SWAP_CHAINS: readonly SwapChain[] = [
  { id: "Arc_Testnet", name: "Arc Testnet", testnet: true },
  { id: "Arbitrum", name: "Arbitrum", testnet: false },
  { id: "Avalanche", name: "Avalanche", testnet: false },
  { id: "Base", name: "Base", testnet: false },
  { id: "Ethereum", name: "Ethereum", testnet: false },
  { id: "HyperEVM", name: "HyperEVM", testnet: false },
  { id: "Ink", name: "Ink", testnet: false },
  { id: "Linea", name: "Linea", testnet: false },
  { id: "Monad", name: "Monad", testnet: false },
  { id: "Optimism", name: "Optimism", testnet: false },
  { id: "Plume", name: "Plume", testnet: false },
  { id: "Polygon", name: "Polygon", testnet: false },
  { id: "Sei", name: "Sei", testnet: false },
  { id: "Solana", name: "Solana", testnet: false },
  { id: "Sonic", name: "Sonic", testnet: false },
  { id: "Unichain", name: "Unichain", testnet: false },
  { id: "World_Chain", name: "World Chain", testnet: false },
  { id: "XDC", name: "XDC", testnet: false },
] as const;

/** Global token aliases the Swap SDK accepts. */
export const SWAP_TOKENS = [
  "USDC",
  "EURC",
  "USDT",
  "PYUSD",
  "DAI",
  "USDE",
  "WBTC",
  "WETH",
  "WSOL",
  "WAVAX",
  "WPOL",
  "NATIVE",
] as const;

/**
 * CCTP bridge destinations reachable from Arc Testnet.
 * Bridging is USDC-only by protocol definition.
 */
export const BRIDGE_DESTINATIONS: readonly SwapChain[] = [
  { id: "Base_Sepolia", name: "Base Sepolia", testnet: true },
  { id: "Arbitrum_Sepolia", name: "Arbitrum Sepolia", testnet: true },
  { id: "Optimism_Sepolia", name: "OP Sepolia", testnet: true },
  { id: "Ethereum_Sepolia", name: "Ethereum Sepolia", testnet: true },
  { id: "Avalanche_Fuji", name: "Avalanche Fuji", testnet: true },
] as const;

/**
 * EVM network params for each bridge destination, used to (a) open the correct
 * block explorer for destination transactions and (b) pre-add the chain to the
 * user's wallet so the mint step's `wallet_switchEthereumChain` doesn't fail
 * with "Unrecognized chain ID".
 *
 * Without `addParams`, OP Sepolia / Arbitrum Sepolia etc. are not in MetaMask by
 * default, so the destination mint would throw
 * `Failed to switch to chain ... Unrecognized chain ID`. Base Sepolia ships
 * pre-added, which is why it "just worked". We add every destination on select.
 */
export interface BridgeChainMeta {
  /** Hex chain id, e.g. "0xaa37dc". */
  chainId: string;
  /** Decimal chain id, e.g. 11155420. */
  chainIdNum: number;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  /** Base URL for building /tx/ links. */
  explorerBase: string;
  /** Params for `wallet_addEthereumChain`. */
  addParams: {
    chainId: string;
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  };
}

export const BRIDGE_CHAIN_META: Record<string, BridgeChainMeta> = {
  Base_Sepolia: {
    chainId: "0x14a44",
    chainIdNum: 84532,
    chainName: "Base Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
    explorerBase: "https://sepolia.basescan.org",
    addParams: {
      chainId: "0x14a44",
      chainName: "Base Sepolia",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://sepolia.base.org"],
      blockExplorerUrls: ["https://sepolia.basescan.org"],
    },
  },
  Arbitrum_Sepolia: {
    chainId: "0x66eee",
    chainIdNum: 421614,
    chainName: "Arbitrum Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
    explorerBase: "https://sepolia.arbiscan.io",
    addParams: {
      chainId: "0x66eee",
      chainName: "Arbitrum Sepolia",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
      blockExplorerUrls: ["https://sepolia.arbiscan.io"],
    },
  },
  Optimism_Sepolia: {
    chainId: "0xaa37dc",
    chainIdNum: 11155420,
    chainName: "OP Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.optimism.io"],
    blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
    explorerBase: "https://sepolia-optimism.etherscan.io",
    addParams: {
      chainId: "0xaa37dc",
      chainName: "OP Sepolia",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://sepolia.optimism.io"],
      blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
    },
  },
  Ethereum_Sepolia: {
    chainId: "0xaa36a7",
    chainIdNum: 11155111,
    chainName: "Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    explorerBase: "https://sepolia.etherscan.io",
    addParams: {
      chainId: "0xaa36a7",
      chainName: "Sepolia",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://rpc.sepolia.org"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    },
  },
  Avalanche_Fuji: {
    chainId: "0xa869",
    chainIdNum: 43113,
    chainName: "Avalanche Fuji",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
    blockExplorerUrls: ["https://testnet.snowtrace.io"],
    explorerBase: "https://testnet.snowtrace.io",
    addParams: {
      chainId: "0xa869",
      chainName: "Avalanche Fuji",
      nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
      rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
      blockExplorerUrls: ["https://testnet.snowtrace.io"],
    },
  },
};

/** Tokens swappable on a given chain. Arc Testnet is restricted. */
export function tokensForChain(chainId: string): readonly string[] {
  if (chainId === ARC_SWAP_CHAIN) return ARC_SWAP_TOKENS;
  return SWAP_TOKENS;
}

export function isSupportedSwapChain(chainId: string): boolean {
  return SWAP_CHAINS.some((c) => c.id === chainId);
}

/**
 * On Arc the native gas asset IS USDC, so swapping USDC <-> NATIVE is a
 * same-asset no-op that the SDK will reject. Catch it in the UI first.
 */
export function isArcSameAssetPair(
  chainId: string,
  tokenIn: string,
  tokenOut: string,
): boolean {
  if (chainId !== ARC_SWAP_CHAIN) return false;
  const pair = new Set([tokenIn.toUpperCase(), tokenOut.toUpperCase()]);
  return pair.has("USDC") && pair.has("NATIVE");
}

export interface SwapValidation {
  ok: boolean;
  error?: string;
}

/** Validate a swap request before it costs the user a round-trip. */
export function validateSwap(params: {
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}): SwapValidation {
  const { chain, tokenIn, tokenOut, amountIn } = params;

  if (!isSupportedSwapChain(chain)) {
    return { ok: false, error: `Unsupported chain: ${chain}` };
  }
  if (tokenIn.toUpperCase() === tokenOut.toUpperCase()) {
    return { ok: false, error: "Choose two different tokens." };
  }
  if (isArcSameAssetPair(chain, tokenIn, tokenOut)) {
    return {
      ok: false,
      error:
        "On Arc, USDC is the native gas token — swapping USDC to NATIVE is the same asset.",
    };
  }
  const allowed = tokensForChain(chain);
  if (!allowed.includes(tokenIn)) {
    return { ok: false, error: `${tokenIn} is not available on ${chain}.` };
  }
  if (!allowed.includes(tokenOut)) {
    return { ok: false, error: `${tokenOut} is not available on ${chain}.` };
  }
  const n = Number(amountIn);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  return { ok: true };
}

export type { ArcSwapToken };
