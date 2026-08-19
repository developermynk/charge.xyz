/**
 * Circle Swap Kit / Bridge chain + token registry.
 *
 * These are Circle SDK STRING identifiers, not numeric chain ids. Source:
 * Arc docs (app-kit/references/supported-blockchains) bundled via
 * `arc-canteen context`.
 *
 * CLIENT-SAFE: contains no secrets.
 */

import {
  ARC_SWAP_CHAIN,
  ARC_SWAP_TOKENS,
  ARC_TOKENS,
  type ArcSwapToken,
} from "./arc.ts";

import { createPublicClient, http, type PublicClient } from "viem";

export interface SwapChain {
  /** Circle SDK identifier, e.g. "Arc_Testnet". */
  id: string;
  name: string;
  testnet: boolean;
}

export const SWAP_CHAINS: readonly SwapChain[] = [
  { id: "Arc_Testnet", name: "Arc Testnet", testnet: true },
  { id: "Base_Sepolia", name: "Base Sepolia", testnet: true },
  { id: "Arbitrum_Sepolia", name: "Arbitrum Sepolia", testnet: true },
  { id: "Optimism_Sepolia", name: "OP Sepolia", testnet: true },
  { id: "Ethereum_Sepolia", name: "Ethereum Sepolia", testnet: true },
  { id: "Avalanche_Fuji", name: "Avalanche Fuji", testnet: true },
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
    chainId: "0x14a34",
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

/**
 * Tokens swappable per chain.
 *
 * Arc Testnet is the only testnet Circle Swap supports and is intentionally
 * restricted to USDC/EURC/cirBTC. For every other chain we list the standard
 * stablecoins + majors that are reliably deployed and liquid on that network
 * (grounded in the canonical Circle / LiFi token deployments). Chains without
 * a curated set fall back to the global stablecoin + major list.
 *
 * NOTE: this is a static allow-list for the UI. Circle's Swap Kit quotes
 * against live liquidity, so a token absent here can still be routed; this
 * list only controls what the user can *pick* in the dropdown.
 */
export const TOKENS_BY_CHAIN: Record<string, readonly string[]> = {
  // Arc Testnet — restricted set (verified against Arc docs / Circle).
  Arc_Testnet: ARC_SWAP_TOKENS,

  // Testnets — follow Circle's testnet stablecoin deployments.
  Base_Sepolia: ["USDC", "USDT", "WETH", "cbBTC", "DAI"],
  Arbitrum_Sepolia: ["USDC", "USDT", "WETH", "WBTC"],
  Optimism_Sepolia: ["USDC", "USDT", "WETH", "WBTC"],
  Ethereum_Sepolia: ["USDC", "USDT", "WETH", "WBTC", "DAI"],
  Avalanche_Fuji: ["USDC", "USDT", "WAVAX", "WETH", "WBTC"],

  // Mainnets — stablecoins + majors natively deployed on each.
  Base: ["USDC", "EURC", "DAI", "PYUSD", "WETH", "WBTC", "cbBTC", "AERO"],
  Ethereum: ["USDC", "EURC", "USDT", "DAI", "PYUSD", "WETH", "WBTC", "USDE"],
  Arbitrum: ["USDC", "USDT", "DAI", "WETH", "WBTC", "ARB", "USDE"],
  Optimism: ["USDC", "USDT", "DAI", "WETH", "WBTC", "OP", "USDE"],
  Polygon: ["USDC", "USDT", "DAI", "WPOL", "WETH", "WBTC"],
  Avalanche: ["USDC", "USDT", "DAI", "WAVAX", "WETH", "WBTC"],
  Unichain: ["USDC", "USDT", "WETH", "WBTC"],
  Linea: ["USDC", "USDT", "DAI", "WETH", "WBTC"],
  World_Chain: ["USDC", "USDT", "WETH"],
  Ink: ["USDC", "USDT", "WETH", "WBTC"],
  Plume: ["USDC", "USDT", "WETH"],
  Sei: ["USDC", "USDT", "WETH"],
  Sonic: ["USDC", "USDT", "WETH"],
  HyperEVM: ["USDC", "USDT", "WETH", "WHYPE"],
  XDC: ["USDC", "USDT", "WXDC", "WETH"],
};

/** Tokens swappable on a given chain. Falls back to the global set. */
export function tokensForChain(chainId: string): readonly string[] {
  return TOKENS_BY_CHAIN[chainId] ?? SWAP_TOKENS;
}

/**
 * EVM chain definitions for the multi-chain wallet.
 *
 * Every entry maps a Circle Swap SDK identifier (used by Swap Kit / CCTP) to a
 * wagmi/viem chain id, so the wallet and the Circle adapters agree on "which
 * chain". Sourced from `circle blockchain list` + the Arc docs registry; this is
 * client-safe (no secrets). Non-EVM chains (Solana) are NOT here — they are
 * handled by a separate adapter in v2.
 */
export interface EvmChainDef {
  /** Circle SDK identifier, e.g. "Base". */
  sdkId: string;
  /** Human label. */
  name: string;
  /** Numeric EVM chain id. */
  chainId: number;
  /** RPC endpoint (public default; overridable per-env). */
  rpcUrl: string;
  /** Block explorer base URL for /tx/ and /address/ links. */
  explorerUrl: string;
  nativeSymbol: string;
  testnet: boolean;
}

export const EVM_CHAINS: readonly EvmChainDef[] = [
  // Arc Testnet is the home chain (native USDC gas; Charge vault swap).
  { sdkId: "Arc_Testnet", name: "Arc Testnet", chainId: 5042002, rpcUrl: "https://rpc.testnet.arc.network", explorerUrl: "https://testnet.arcscan.app", nativeSymbol: "USDC", testnet: true },
  // CCTP testnet bridge destinations (Circle testnet supports Arc <-> these).
  { sdkId: "Base_Sepolia", name: "Base Sepolia", chainId: 84532, rpcUrl: "https://sepolia.base.org", explorerUrl: "https://sepolia.basescan.org", nativeSymbol: "ETH", testnet: true },
  { sdkId: "Arbitrum_Sepolia", name: "Arbitrum Sepolia", chainId: 421614, rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc", explorerUrl: "https://sepolia.arbiscan.io", nativeSymbol: "ETH", testnet: true },
  { sdkId: "Optimism_Sepolia", name: "OP Sepolia", chainId: 11155420, rpcUrl: "https://sepolia.optimism.io", explorerUrl: "https://sepolia-optimism.etherscan.io", nativeSymbol: "ETH", testnet: true },
  { sdkId: "Ethereum_Sepolia", name: "Ethereum Sepolia", chainId: 11155111, rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com", explorerUrl: "https://sepolia.etherscan.io", nativeSymbol: "ETH", testnet: true },
  { sdkId: "Avalanche_Fuji", name: "Avalanche Fuji", chainId: 43113, rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc", explorerUrl: "https://testnet.snowtrace.io", nativeSymbol: "AVAX", testnet: true },
];

/**
 * Chains the in-app Swap actually works on today. On testnet the Charge vault
 * only serves Arc Testnet (USDC/EURC/cirBTC); other chains route through
 * Circle's Swap Kit (mainnet, needs KIT_KEY) and are intentionally hidden until
 * enabled. To add a swap chain later, append it here AND to `EVM_CHAINS`.
 */
export const SWAP_SUPPORTED_CHAINS: readonly SwapChain[] = [
  { id: "Arc_Testnet", name: "Arc Testnet", testnet: true },
];

/** Fast lookup by numeric chain id. */
export const EVM_CHAIN_BY_ID: ReadonlyMap<number, EvmChainDef> = new Map(
  EVM_CHAINS.map((c) => [c.chainId, c]),
);

/** Fast lookup by Circle SDK string id (e.g. "Base", "Arc_Testnet"). */
export const EVM_CHAIN_BY_SDK_ID: ReadonlyMap<string, EvmChainDef> = new Map(
  EVM_CHAINS.map((c) => [c.sdkId, c]),
);

/** Swap chains that have a live EVM definition (excludes Solana, Monad). */
export const SWAP_CHAINS_EVM: readonly SwapChain[] = SWAP_CHAINS.filter((c) =>
  EVM_CHAIN_BY_SDK_ID.has(c.id),
);

/** Numeric chain id for a Circle Swap SDK id, if it is an EVM chain. */
export function swapChainNumericId(sdkId: string): number | undefined {
  return EVM_CHAIN_BY_SDK_ID.get(sdkId)?.chainId;
}

/** Block explorer base URL for a Circle Swap SDK id, if known. */
export function swapChainExplorer(sdkId: string): string | undefined {
  return EVM_CHAIN_BY_SDK_ID.get(sdkId)?.explorerUrl;
}

/** Canonical Circle USDC contract per supported chain (EVM). */
export const USDC_CONTRACTS: Readonly<Record<string, `0x${string}`>> = {
  Arc_Testnet: ARC_TOKENS.USDC,
  Base_Sepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  Arbitrum_Sepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  Optimism_Sepolia: "0x5fd84259d66Cd8249aD14371367E891bbeD0f8C0",
  Ethereum_Sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a90297C2eAEe",
  Avalanche_Fuji: "0x5425890298aed601595a70AB815c96711a31Bc65",
  Ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  Base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  Arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  Optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  Polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  Avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  Unichain: "0x078D782b760474a361dDA0AF3170B0F3778b61D2",
  Linea: "0x176211869cA646E7d0C3548EcC4f8F6B2f2C9e8D",
  World_Chain: "0x79A02482A880b0F5cC7cF103F264D3c1eF81F19E",
};

/**
 * Token contract + decimals per chain, for balance display.
 *
 * Addresses are the canonical Circle / leading deployments for each token.
 * Only tokens with a KNOWN, verified address are listed — any token not
 * present here simply renders without a balance readout (the UI degrades
 * gracefully rather than guessing an address). USDC is the source of truth
 * via `USDC_CONTRACTS`; majors below are the standard public deployments.
 */
export interface TokenMeta {
  address: `0x${string}`;
  decimals: number;
}

export const TOKEN_REGISTRY: Readonly<
  Record<string, Record<string, TokenMeta>>
> = {
  Arc_Testnet: {
    USDC: { address: ARC_TOKENS.USDC, decimals: 6 },
    EURC: { address: ARC_TOKENS.EURC, decimals: 6 },
    // Circle Wrapped Bitcoin on Arc Testnet (viem token definition, chainId 5042002).
    // Note: Circle's app-kit has no seeded cirBTC route on Arc Testnet, so
    // cirBTC trades through the local Arc AMM (pools must be seeded there).
    cirBTC: {
      address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
      decimals: 8,
    },
  },
  Ethereum: {
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  },
  Base: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    USDbC: { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FfA6E2A0c3f", decimals: 6 },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    WBTC: { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8 },
    cbBTC: { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8 },
    DAI: { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  },
  Base_Sepolia: {
    USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  },
  Arbitrum: {
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD340D2E351bE3da0d1C8CaD6a181aF2", decimals: 6 },
    DAI: { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    WBTC: { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
  },
  Arbitrum_Sepolia: {
    USDC: { address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", decimals: 6 },
    WETH: { address: "0x980B62Da83Eff3D4577C839b1662c6aFcD6E623f", decimals: 18 },
  },
  Optimism: {
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    USDT: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    DAI: { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    WBTC: { address: "0x68f180fcCe6836888e9084f035309E29Bf0A2095", decimals: 8 },
  },
  Optimism_Sepolia: {
    USDC: { address: "0x5fd84259d66Cd8249aD14371367E891bbeD0f8C0", decimals: 6 },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  },
  Ethereum_Sepolia: {
    USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a90297C2eAEe", decimals: 6 },
    WETH: { address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", decimals: 18 },
  },
  Polygon: {
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    DAI: { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
    WETH: { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
    WPOL: { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d39E376b0", decimals: 18 },
  },
  Avalanche: {
    USDC: { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
    USDT: { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    DAI: { address: "0xd586E7F844cEa2F87f50152565f36F92a04F5a28", decimals: 18 },
    WAVAX: { address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", decimals: 18 },
    WETH: { address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", decimals: 18 },
    WBTC: { address: "0x50b7545627a5162F82A992c33b87aDc75187B218", decimals: 8 },
  },
  Avalanche_Fuji: {
    USDC: { address: "0x5425890298aed601595a70AB815c96711a31Bc65", decimals: 6 },
    WAVAX: { address: "0x1D3089aA6744c846bfc2897B6449c1c917b4F0c8", decimals: 18 },
  },
};

/**
 * `wallet_addEthereumChain` params for a supported chain, derived from the EVM
 * registry. Used to pre-add bridge destinations so the mint step's
 * `wallet_switchEthereumChain` doesn't fail with "Unrecognized chain ID".
 */
export function bridgeAddParams(
  sdkId: string,
): {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
} | undefined {
  const d = EVM_CHAIN_BY_SDK_ID.get(sdkId);
  if (!d) return undefined;
  return {
    chainId: `0x${d.chainId.toString(16)}`,
    chainName: d.name,
    nativeCurrency: { name: d.nativeSymbol, symbol: d.nativeSymbol, decimals: 18 },
    rpcUrls: [d.rpcUrl],
    blockExplorerUrls: [d.explorerUrl],
  };
}

/** Explorer base for a Circle Swap SDK id, for building /tx links. */
export function bridgeExplorer(sdkId: string): string | undefined {
  return EVM_CHAIN_BY_SDK_ID.get(sdkId)?.explorerUrl;
}

/**
 * A viem public client for a chain, built directly from its RPC URL so balance
 * reads work regardless of which chain the user's wallet is currently on.
 * (wagmi's chain-scoped client routes through the connected connector, which
 * can only serve the wallet's active chain — so a balance read for a different
 * source chain silently fails and shows 0.)
 */
export function publicClientForChain(sdkId: string): PublicClient | undefined {
  const d = EVM_CHAIN_BY_SDK_ID.get(sdkId);
  if (!d) return undefined;
  return createPublicClient({
    chain: {
      id: d.chainId,
      name: d.name,
      nativeCurrency: { name: d.nativeSymbol, symbol: d.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [d.rpcUrl] } },
    },
    transport: http(d.rpcUrl),
  }) as unknown as PublicClient;
}

/**
 * On-chain AMM router on Arc Testnet (Uniswap V2, deployed per Circle
 * arc-node#160). Circle's Stablecoin Service aggregator currently has no
 * seeded swap liquidity on Arc Testnet, so Charge routes Arc Testnet swaps
 * through this live DEX instead. The USDC/EURC pair holds real reserves.
 * Addresses are verified live against the Arc Testnet RPC.
 */
export const ARC_TESTNET_AMM = {
  router: "0xe27d5d256b370604f1ff060fb489c6a8e3f8a6d9" as const,
  factory: "0x7483847d46db2920dd64efa676cf72dcf765814f" as const,
  weth: "0x6be2c68117ca58086bd6a14e525835584d7f721e" as const,
  usdcEurcPair: "0xb3685D16AAa06361ED28377b1319136650Fa9A13" as const,
} as const;

/**
 * Charge's inventory-backed multi-token swap vault on Arc Testnet.
 * Routes USDC/EURC/cirBTC swaps that have no AMM pool (cirBTC especially) and
 * returns the destination token atomically. Quotes use owner-set USD prices
 * (live FX / BTC), not an AMM curve.
 */
export const ARC_SWAP_VAULT = "0x02dDD07C4a4BA280b713Ca990883b59F359C3a9c" as const;

/** Vault ABI subset used by Charge's swap integration. */
export const ARC_SWAP_VAULT_ABI = [
  {
    name: "swap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fromToken", type: "address" },
      { name: "toToken", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "quote",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "fromToken", type: "address" },
      { name: "toToken", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "vaultBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "feeBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Route an Arc swap pair through the inventory vault when BOTH sides are
 * vault-supported registry tokens (USDC/EURC/cirBTC) and the vault is
 * deployed. Custom launched tokens keep using the local AMM.
 */
export function usesVaultSwap(chainId: string, tokenIn?: string, tokenOut?: string): boolean {
  if (chainId !== ARC_SWAP_CHAIN) return false;
  const vaultTokens = new Set(["USDC", "EURC", "cirBTC"]);
  return vaultTokens.has(tokenIn ?? "") && vaultTokens.has(tokenOut ?? "");
}

/** Arc Testnet USDC — the ERC-20 form used by the AMM (paired asset for launches). */
export const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;

/**
 * Uniswap-V2-style router ABI subset used by Charge's Arc AMM integration:
 * swaps (existing) plus `addLiquidity` for seeding a launch token's pool.
 */
export const ARC_AMM_ROUTER_ABI = [
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "addLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
] as const;

/** Whether swaps on this chain should route through the on-chain AMM. */
export function usesAmmSwap(chainId: string, tokenIn?: string, tokenOut?: string): boolean {
  // The local Uniswap-V2 AMM on Arc seeds USDC/EURC/cirBTC pools, so all Arc
  // swaps route through it. Mainnets use Circle's app-kit (Swap Kit).
  if (chainId !== ARC_SWAP_CHAIN) return false;
  return true;
}

/** Native paired asset per chain — used by the Market launch flow. */
export const NATIVE_PAIRED_ASSET: ReadonlyMap<number, string> = new Map(
  EVM_CHAINS.map((c) => [c.chainId, c.nativeSymbol]),
);

/** All numeric chain ids, for wagmi config + balance fan-out. */
export const ALL_CHAIN_IDS: readonly number[] = EVM_CHAINS.map((c) => c.chainId);

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
  // Address-form tokens (launched/custom, e.g. 0x…) are valid — the SDK
  // resolves the real contract via an address override, and the swap panel
  // synthesizes the meta from on-chain data.
  const isAddr = (t: string) => /^0x[a-f0-9]{40}$/i.test(t);
  if (!allowed.includes(tokenIn) && !isAddr(tokenIn)) {
    return { ok: false, error: `${tokenIn} is not available on ${chain}.` };
  }
  if (!allowed.includes(tokenOut) && !isAddr(tokenOut)) {
    return { ok: false, error: `${tokenOut} is not available on ${chain}.` };
  }
  const n = Number(amountIn);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  return { ok: true };
}

export type { ArcSwapToken };

/**
 * Arc native AMM — Uniswap V2 compatible (verified on-chain as
 * `UniswapV2Router02` at the router address below; factory derived from
 * `router.factory()`). USDC/EURC/cirBTC LP pools are seeded here so users can
 * provide liquidity and earn the protocol's swap fees. No Chargefi contract is
 * needed for the core LP flow — the AMM handles LP mint/burn and fee accrual
 * natively (fee tier is the Uniswap V2 default of 30 bps).
 *
 * IMPORTANT: LP inventory is KEPT SEPARATE from the swap vault's inventory.
 * The vault backs instant quotes; the AMM pools are the yield program. Do not
 * fund one from the other or swaps will drain the pools and LP will drain the
 * vault (recreating the old "InsufficientInventory" reverts).
 */
export const ARC_AMM_ROUTER = "0xE27d5D256B370604F1Ff060fB489c6A8E3F8A6d9" as const;
export const ARC_AMM_FACTORY = "0x7483847d46db2920dd64efa676cf72dcf765814f" as const;
/** Uniswap V2 default swap fee (30 bps = 0.30%). */
export const ARC_AMM_FEE_BPS = 30;

/** Stable LP pools Chargefi surfaces (Arc Testnet). */
export interface LpPoolDef {
  id: string;
  tokenA: string; // Circle SDK id, e.g. "USDC"
  tokenB: string; // Circle SDK id, e.g. "EURC"
  /** human label for the pair */
  label: string;
  /**
   * Whether the pool can actually be funded/used right now. USDC/cirBTC is
   * blocked because Arc testnet's cirBTC token does not implement a working
   * `transferFrom` (Uniswap V2 `addLiquidity` needs it), so the pair can't be
   * seeded through the standard router. That is a token limitation, not a
   * Chargefi bug — surfaced honestly in the UI instead of offering a broken form.
   */
  available: boolean;
  unavailableReason?: string;
}
export const LP_POOLS: readonly LpPoolDef[] = [
  { id: "USDC-EURC", tokenA: "USDC", tokenB: "EURC", label: "USDC / EURC", available: true },
  {
    id: "USDC-cirBTC",
    tokenA: "USDC",
    tokenB: "cirBTC",
    label: "USDC / cirBTC",
    available: false,
    unavailableReason:
      "Arc testnet cirBTC does not support transferFrom, so this pool cannot be seeded yet.",
  },
];

/** Minimal Uniswap V2 Router02 ABI (add/remove liquidity + read-only quotes). */
export const UNISWAP_V2_ROUTER_ABI = [
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "addLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "removeLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "pure",
    inputs: [
      { name: "amountA", type: "uint256" },
      { name: "reserveA", type: "uint256" },
      { name: "reserveB", type: "uint256" },
    ],
    outputs: [{ name: "amountB", type: "uint256" }],
  },
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

/** Minimal Uniswap V2 Pair ABI (reserves + LP supply + user balance). */
export const UNISWAP_V2_PAIR_ABI = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint256" },
      { name: "reserve1", type: "uint256" },
      { name: "blockTimestampLast", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/** Minimal Uniswap V2 Factory ABI (pair lookup). */
export const UNISWAP_V2_FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;
