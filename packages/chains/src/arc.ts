/**
 * Arc Testnet — single source of truth.
 *
 * Every value here was verified live against the running chain and the Arc docs
 * bundled by `arc-canteen context`, NOT from memory:
 *   - chain id  : `arc-canteen rpc eth_chainId` -> 0x4cef52 (5042002)
 *   - chain def : viem ships `arcTestnet`; a custom definition is never needed
 *   - addresses : docs/circlefin-skills/use-arc.md
 */

import { arcTestnet } from "viem/chains";

export { arcTestnet };

/** Numeric EVM chain id for Arc Testnet. Verified: eth_chainId -> 0x4cef52. */
export const ARC_CHAIN_ID = 5042002 as const;

/** Circle SDK string identifier for Arc Testnet (NOT the numeric chain id). */
export const ARC_SWAP_CHAIN = "Arc_Testnet" as const;

/** Circle Smart Contract Platform blockchain id for Arc Testnet. */
export const ARC_SCP_CHAIN = "ARC-TESTNET" as const;

/** CCTP domain for Arc — required for every crosschain burn/mint. */
export const ARC_CCTP_DOMAIN = 26 as const;

export const ARC_EXPLORER_URL = "https://testnet.arcscan.app" as const;
export const ARC_FAUCET_URL = "https://faucet.circle.com" as const;

/**
 * ERC-20 token addresses on Arc Testnet.
 *
 * NOTE: `USDC` here is the ERC-20 contract (6 decimals). Arc *also* uses USDC as
 * its native gas asset with 18 decimals. They are the same economic asset but
 * NOT interchangeable in code — see `decimals.ts`.
 */
export const ARC_TOKENS = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
} as const satisfies Record<string, `0x${string}`>;

/** Decimals of the ERC-20 USDC contract on Arc. */
export const ARC_ERC20_DECIMALS = 6 as const;

/** Decimals of the native gas asset on Arc (USDC-as-gas behaves like ETH: 18dp). */
export const ARC_NATIVE_DECIMALS = 18 as const;

/**
 * Tokens Circle Swap supports on Arc Testnet.
 * Arc Testnet is the ONLY testnet with swap support, and only for these.
 */
export const ARC_SWAP_TOKENS = ["USDC", "EURC", "cirBTC"] as const;
export type ArcSwapToken = (typeof ARC_SWAP_TOKENS)[number];

/** Build an explorer link for a transaction hash. */
export function arcTxUrl(hash: string): string {
  return `${ARC_EXPLORER_URL}/tx/${hash}`;
}

/** Build an explorer link for an address. */
export function arcAddressUrl(address: string): string {
  return `${ARC_EXPLORER_URL}/address/${address}`;
}

/** True when the connected chain is Arc Testnet. */
export function isArcChain(chainId: number | undefined): boolean {
  return chainId === ARC_CHAIN_ID;
}
