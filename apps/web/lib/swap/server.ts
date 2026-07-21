/**
 * Server-only swap backend: Swap Kit + Circle developer-controlled wallets.
 *
 * This module reads secret env vars (KIT_KEY, CIRCLE_API_KEY,
 * CIRCLE_ENTITY_SECRET, WALLET_ADDRESS) and MUST only be imported from Next.js
 * route handlers (which run server-side). Never import it into a client
 * component — the kit key must never reach the browser.
 */

import { SwapKit } from "@circle-fin/swap-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";

export interface SwapEnv {
  kitKey: string;
  apiKey: string;
  entitySecret: string;
  walletAddress: string;
  /** Developer-fee recipient (on the swap's origin chain). Null when fees off. */
  feeRecipient: string | null;
  /** Developer fee in basis points (1–10000). 0 when fees are disabled. */
  feeBps: number;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Reads and validates the required swap environment. Throws a clear error (HTTP
 * 500 in the routes) when any variable is missing so misconfiguration is
 * obvious rather than failing deep inside the SDK.
 *
 * Optional developer fee: set SWAP_FEE_RECIPIENT to enable. SWAP_FEE_BPS then
 * becomes REQUIRED (1–10000). We fail loudly rather than default to a fee the
 * operator didn't consciously choose — a silent percentage on user funds is a
 * bug, not a feature.
 */
export function getSwapEnv(): SwapEnv {
  const kitKey = process.env.KIT_KEY;
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletAddress = process.env.WALLET_ADDRESS;

  const missing = [
    !kitKey && "KIT_KEY",
    !apiKey && "CIRCLE_API_KEY",
    !entitySecret && "CIRCLE_ENTITY_SECRET",
    !walletAddress && "WALLET_ADDRESS",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    throw new Error(
      `Missing required swap environment variables: ${missing.join(", ")}`,
    );
  }

  const feeRecipientRaw = process.env.SWAP_FEE_RECIPIENT?.trim() ?? "";
  const feeBpsRaw = process.env.SWAP_FEE_BPS?.trim();

  let feeRecipient: string | null = null;
  let feeBps = 0;

  if (feeRecipientRaw) {
    if (!ADDRESS_RE.test(feeRecipientRaw)) {
      throw new Error(
        "SWAP_FEE_RECIPIENT is not a valid 0x address (must be 0x + 40 hex chars).",
      );
    }
    if (
      feeBpsRaw === undefined ||
      !/^\d+$/.test(feeBpsRaw) ||
      Number(feeBpsRaw) < 1 ||
      Number(feeBpsRaw) > 10000
    ) {
      throw new Error(
        "SWAP_FEE_RECIPIENT is set but SWAP_FEE_BPS is missing or invalid (must be an integer 1–10000).",
      );
    }
    feeRecipient = feeRecipientRaw.toLowerCase();
    feeBps = Number(feeBpsRaw);
  }

  return {
    kitKey: kitKey!,
    apiKey: apiKey!,
    entitySecret: entitySecret!,
    walletAddress: walletAddress!,
    feeRecipient,
    feeBps,
  };
}

/**
 * Builds the transaction-level developer-fee config passed to the SDK, or
 * undefined when fees are disabled. Circle retains 10% of the fee; the
 * configured recipient receives the remaining 90%. The recipient MUST be valid
 * on the swap's origin chain (same-chain output-side fee) or source chain
 * (cross-chain / input-side fee).
 */
export function getSwapCustomFee(
  env: SwapEnv,
): { percentageBps: number; recipientAddress: string } | undefined {
  if (!env.feeRecipient) return undefined;
  return { percentageBps: env.feeBps, recipientAddress: env.feeRecipient };
}

export function getSwapKit(): SwapKit {
  return new SwapKit();
}

/**
 * Circle developer-controlled wallets adapter. It signs swaps with the
 * developer wallet identified by WALLET_ADDRESS, so swaps are custodial: the
 * backend wallet's own funds move — not the end user's connected wallet.
 */
export function getSwapAdapter(env: SwapEnv) {
  return createCircleWalletsAdapter({
    apiKey: env.apiKey,
    entitySecret: env.entitySecret,
  });
}
