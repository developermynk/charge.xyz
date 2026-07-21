/**
 * Official Circle / Arc swap chains and tokens.
 *
 * Source of truth: Circle Swap Kit supported blockchains + Arc docs
 * (https://docs.arc.io/app-kit/references/supported-blockchains). Only these
 * identifiers are allowed in the swap section — the fabricated chains in
 * `components/charge/data.ts` are NOT used here.
 *
 * This module is CLIENT-SAFE: it contains no secrets and may be imported from
 * the browser (the swap panel uses it to render the allowed chain/token lists).
 * All secret-bearing logic lives in `@/lib/swap/server`.
 */

export interface SwapChain {
  /** Circle SDK string identifier, e.g. "Arc_Testnet" — NOT a numeric chain id. */
  id: string;
  name: string;
  testnet: boolean;
}

// Exact string identifiers expected by the Circle SDK. Do not rename.
export const OFFICIAL_SWAP_CHAINS: SwapChain[] = [
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
  // The only testnet with swap support — and what this app runs on.
  { id: "Arc_Testnet", name: "Arc Testnet", testnet: true },
];

// Global token aliases accepted by the SDK (shortcuts for common tokens).
export const OFFICIAL_SWAP_TOKENS = [
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

// Arc Testnet supports only these tokens for swap (per Arc docs).
export const ARC_TESTNET_TOKENS = ["USDC", "EURC", "cirBTC"] as const;

// On Arc the native gas asset IS USDC, so the USDC contract and NATIVE are the
// same asset. A USDC <-> NATIVE swap is a same-asset no-op and must be rejected.
export const ARC_USDC_CONTRACT =
  "0x3600000000000000000000000000000000000000";

export function tokensForChain(chainId: string): readonly string[] {
  if (chainId === "Arc_Testnet") return ARC_TESTNET_TOKENS;
  return OFFICIAL_SWAP_TOKENS;
}

export function isOfficialChain(chainId: string): boolean {
  return OFFICIAL_SWAP_CHAINS.some((c) => c.id === chainId);
}

/** True when tokenIn/tokenOut form the Arc USDC<->NATIVE same-asset pair.
 *  Scoped to Arc_Testnet only — on every other chain USDC and the native gas
 *  token are DIFFERENT assets and a USDC<->NATIVE swap is valid. */
export function isArcUsdcNativePair(
  chain: string,
  tokenIn: string,
  tokenOut: string,
): boolean {
  if (chain !== "Arc_Testnet") return false;
  const a = tokenIn.trim().toUpperCase();
  const b = tokenOut.trim().toUpperCase();
  if (a === b) return false;
  const hasNative = a === "NATIVE" || b === "NATIVE";
  const hasUsdc =
    a === "USDC" ||
    b === "USDC" ||
    a === ARC_USDC_CONTRACT.toUpperCase() ||
    b === ARC_USDC_CONTRACT.toUpperCase();
  return hasNative && hasUsdc;
}

export interface SwapParams {
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps?: number;
}

export type SwapValidation =
  | { ok: true; value: SwapParams }
  | { ok: false; error: string };

/**
 * Pure validation shared by the API routes and the UI. Rejects unsupported
 * chains/tokens, same-token pairs, the Arc USDC<->NATIVE no-op, and bad amounts
 * BEFORE any SDK call (so we never route or quote an invalid swap).
 */
export function validateSwapParams(
  p: Partial<SwapParams>,
): SwapValidation {
  if (!p.chain || !isOfficialChain(p.chain)) {
    return { ok: false, error: `Unsupported chain: ${p.chain ?? "(none)"}` };
  }

  const allowed = tokensForChain(p.chain).map((t) => t.toUpperCase());
  if (!p.tokenIn || !allowed.includes(p.tokenIn.toUpperCase())) {
    return {
      ok: false,
      error: `Unsupported tokenIn for ${p.chain}: ${p.tokenIn ?? "(none)"}`,
    };
  }
  if (!p.tokenOut || !allowed.includes(p.tokenOut.toUpperCase())) {
    return {
      ok: false,
      error: `Unsupported tokenOut for ${p.chain}: ${p.tokenOut ?? "(none)"}`,
    };
  }
  if (p.tokenIn.toUpperCase() === p.tokenOut.toUpperCase()) {
    return { ok: false, error: "tokenIn and tokenOut must differ" };
  }
  if (isArcUsdcNativePair(p.chain, p.tokenIn, p.tokenOut)) {
    return {
      ok: false,
      error:
        "On Arc, USDC and NATIVE are the same asset — this pair cannot be swapped.",
    };
  }

  const amount = Number(p.amountIn);
  if (!p.amountIn || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "amountIn must be a positive number" };
  }

  let slippageBps = p.slippageBps;
  if (slippageBps !== undefined) {
    if (
      !Number.isFinite(slippageBps) ||
      slippageBps < 0 ||
      slippageBps > 5000
    ) {
      return { ok: false, error: "slippageBps must be between 0 and 5000" };
    }
  }

  return {
    ok: true,
    value: {
      chain: p.chain,
      tokenIn: p.tokenIn,
      tokenOut: p.tokenOut,
      amountIn: p.amountIn,
      slippageBps,
    },
  };
}
