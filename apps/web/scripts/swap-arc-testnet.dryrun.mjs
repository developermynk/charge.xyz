// DRY RUN: estimate USDC -> EURC on Arc_Testnet using Circle Swap Kit + Circle Wallets adapter.
//
// This script ONLY estimates. It contains no swap() call and cannot move funds.
//
// Run from apps/web:
//   node scripts/swap-arc-testnet.dryrun.mjs
//
// Requires in apps/web/.env.local:
//   CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, KIT_KEY, WALLET_ADDRESS

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

// ---- Swap configuration (matches the execution scripts) ----
const CHAIN = "Arc_Testnet";
const TOKEN_IN = "USDC";
const TOKEN_OUT = "EURC";
const AMOUNT_IN = "0.10";
// ------------------------------------------------------------

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const kitKey = process.env.KIT_KEY;
const walletAddress = process.env.WALLET_ADDRESS;

if (!apiKey || !entitySecret) fail("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set in .env.local");
if (!kitKey) fail("KIT_KEY must be set in .env.local");
if (!walletAddress) fail("WALLET_ADDRESS must be set in .env.local");

// Arc-specific guard: on Arc, NATIVE and USDC are the same asset. Reject no-op pairs.
if (
  (TOKEN_IN === "NATIVE" && (TOKEN_OUT === "USDC" || TOKEN_OUT === "0x3600000000000000000000000000000000000000")) ||
  (TOKEN_OUT === "NATIVE" && (TOKEN_IN === "USDC" || TOKEN_IN === "0x3600000000000000000000000000000000000000"))
) {
  fail(`On ${CHAIN}, NATIVE and USDC are the same asset — USDC<->NATIVE is a no-op and not a valid swap.`);
}

const { SwapKit } = await import("@circle-fin/swap-kit");
const { createCircleWalletsAdapter } = await import("@circle-fin/adapter-circle-wallets");

const kit = new SwapKit();
const adapter = createCircleWalletsAdapter({ apiKey, entitySecret });

console.log("=== DRY RUN (estimate only — no funds move) ===");
console.log(`Chain:       ${CHAIN}`);
console.log(`Pair:        ${TOKEN_IN} -> ${TOKEN_OUT}`);
console.log(`Amount in:   ${AMOUNT_IN}`);
console.log(`From wallet: ${walletAddress}`);
console.log("Router:      third-party aggregator (currently LiFi)\n");

try {
  const estimate = await kit.estimate({
    from: { adapter, chain: CHAIN, address: walletAddress },
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: AMOUNT_IN,
    config: { kitKey },
  });

  console.log("=== Estimate ===");
  console.log("Estimated output:", estimate.estimatedOutput);
  if (estimate.fees?.length) {
    console.log("Estimated fees:  ", JSON.stringify(estimate.fees));
  }
  console.log("\nDry run complete. No transaction was sent.");
} catch (err) {
  console.error("\nEstimate failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
