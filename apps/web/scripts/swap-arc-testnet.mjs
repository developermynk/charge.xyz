// Swap USDC -> USDT on Arc_Testnet using Circle App Kit + Circle Wallets adapter.
//
// SECURITY NOTES:
// - This is server-side only. Never expose KIT_KEY / API keys / entity secret to a browser.
// - Mainnet swaps move REAL funds. This script targets Arc_Testnet (testnet); start small.
// - Swaps are routed through a third-party DEX aggregator (currently LiFi). The aggregator
//   may vary by route and is subject to change; you are subject to its terms of service.
// - Nothing in this script prints secret values. Required env vars are validated, not logged.
//
// Run from apps/web:
//   node scripts/swap-arc-testnet.mjs
//
// Requires in apps/web/.env.local:
//   CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, KIT_KEY, WALLET_ADDRESS,
//   SWAP_FEE_RECIPIENT, SWAP_FEE_BPS

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/ -> apps/web/ ; load .env.local from the apps/web package root.
config({ path: resolve(__dirname, "../.env.local") });

// ---- Swap configuration (edit here if you want different values) ----
const CHAIN = "Arc_Testnet";
const TOKEN_IN = "USDC";
const TOKEN_OUT = "EURC";
const AMOUNT_IN = "0.10";
const SLIPPAGE_BPS = 50; // 0.5%
// -------------------------------------------------------------------

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const kitKey = process.env.KIT_KEY;
const walletAddress = process.env.WALLET_ADDRESS;
const feeRecipient = process.env.SWAP_FEE_RECIPIENT;
const feeBpsRaw = process.env.SWAP_FEE_BPS;

if (!apiKey || !entitySecret) fail("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set in .env.local");
if (!kitKey) fail("KIT_KEY must be set in .env.local");
if (!walletAddress) fail("WALLET_ADDRESS must be set in .env.local");
if (!feeRecipient) fail("SWAP_FEE_RECIPIENT must be set in .env.local");
if (!feeBpsRaw || Number.isNaN(Number(feeBpsRaw))) {
  fail("SWAP_FEE_BPS must be set in .env.local and be a numeric value");
}

const feeBps = Number(feeBpsRaw);

// Arc-specific guard: on Arc, NATIVE and USDC are the same asset. Reject no-op pairs.
if (
  (TOKEN_IN === "NATIVE" && (TOKEN_OUT === "USDC" || TOKEN_OUT === "0x3600000000000000000000000000000000000000")) ||
  (TOKEN_OUT === "NATIVE" && (TOKEN_IN === "USDC" || TOKEN_IN === "0x3600000000000000000000000000000000000000"))
) {
  fail(`On ${CHAIN}, NATIVE and USDC are the same asset — USDC<->NATIVE is a no-op and not a valid swap.`);
}

const { AppKit } = await import("@circle-fin/app-kit");
const { createCircleWalletsAdapter } = await import("@circle-fin/adapter-circle-wallets");

const kit = new AppKit();

const adapter = createCircleWalletsAdapter({ apiKey, entitySecret });

console.log("=== Swap plan ===");
console.log(`Chain:        ${CHAIN}`);
console.log(`Pair:         ${TOKEN_IN} -> ${TOKEN_OUT}`);
console.log(`Amount in:    ${AMOUNT_IN}`);
console.log(`Slippage:     ${SLIPPAGE_BPS} bps (${SLIPPAGE_BPS / 100}%)`);
console.log(`Custom fee:   ${feeBps} bps -> ${feeRecipient}`);
console.log(`From wallet:  ${walletAddress}`);
console.log("Router:       third-party aggregator (currently LiFi)\n");

try {
  const estimate = await kit.estimateSwap({
    from: { adapter, chain: CHAIN, address: walletAddress },
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: AMOUNT_IN,
    config: { kitKey },
  });

  console.log("=== Estimate ===");
  console.log("Estimated output:", estimate.estimatedOutput);
  if (estimate.fees?.length) {
    console.log("Estimated fees:", JSON.stringify(estimate.fees));
  }
  console.log("");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Type "SWAP" to execute, or anything else to abort: ')).trim();
  rl.close();

  if (answer !== "SWAP") {
    console.log("Aborted. No transaction was sent.");
    process.exit(0);
  }

  const result = await kit.swap({
    from: { adapter, chain: CHAIN, address: walletAddress },
    tokenIn: TOKEN_IN,
    tokenOut: TOKEN_OUT,
    amountIn: AMOUNT_IN,
    config: {
      kitKey,
      slippageBps: SLIPPAGE_BPS,
      customFee: {
        percentageBps: feeBps,
        recipientAddress: feeRecipient,
      },
    },
  });

  console.log("\n=== Swap result ===");
  console.log("txHash:     ", result.txHash);
  console.log("amountIn:   ", result.amountIn);
  console.log("amountOut:  ", result.amountOut);
  console.log("tokenIn:    ", result.tokenIn);
  console.log("tokenOut:   ", result.tokenOut);
  console.log("fees:       ", JSON.stringify(result.fees));
  console.log("explorerUrl:", result.explorerUrl);
} catch (err) {
  console.error("\nSwap failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
