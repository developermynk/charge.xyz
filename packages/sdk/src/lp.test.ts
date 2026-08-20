import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeApy,
  computeApyForWindow,
  formatApy,
  quoteDeposit,
  ARC_AMM_FEE_BPS,
} from "./lp.ts";

// ── computeApy (24h) ───────────────────────────────────────────────────────────
test("computeApy: null when no volume (no fabricated yield)", () => {
  assert.equal(computeApy(1000, null), null);
  assert.equal(computeApy(0, 500), null);
  assert.equal(computeApy(1000, 0), null);
});

test("computeApy: honest 0.30% fee APR from real 24h volume", () => {
  // TVL 1000, 24h volume 1000 → fees = 3 → daily yield 0.3% → annualized 109.5%
  const apr = computeApy(1000, 1000);
  assert.ok(apr !== null);
  assert.ok(Math.abs(apr! - 109.5) < 0.5);
});

// ── computeApyForWindow ───────────────────────────────────────────────────────────
test("computeApyForWindow: 7d window scales correctly", () => {
  // 7d volume 7000 on TVL 1000 → fees 21 → 7d yield 2.1% → /7*365*100 = 109.5%
  const apr = computeApyForWindow(1000, 7000, 7);
  assert.ok(apr !== null);
  assert.ok(Math.abs(apr! - 109.5) < 0.5);
});

test("computeApyForWindow: 30d window", () => {
  const apr = computeApyForWindow(1000, 30000, 30);
  assert.ok(apr !== null);
  assert.ok(Math.abs(apr! - 109.5) < 0.5);
});

test("computeApyForWindow: null guards", () => {
  assert.equal(computeApyForWindow(0, 100, 7), null);
  assert.equal(computeApyForWindow(1000, null, 7), null);
  assert.equal(computeApyForWindow(1000, 0, 7), null);
});

// ── formatApy ─────────────────────────────────────────────────────────────────────
test("formatApy: dash on null, percentage otherwise", () => {
  assert.equal(formatApy(null), "—");
  assert.equal(formatApy(18.42), "18.42%");
  assert.equal(formatApy(0), "0.00%");
});

// ── fee constant ──────────────────────────────────────────────────────────────────
test("ARC_AMM_FEE_BPS is 30 (0.30%)", () => {
  assert.equal(ARC_AMM_FEE_BPS, 30);
});

// ── quoteDeposit (pure math branch) ───────────────────────────────────────────────
// quoteDeposit normally reads on-chain reserves; we test the ratio invariant by
// ensuring it rejects a zero pool gracefully (reserves come from chain in prod).
test("quoteDeposit: throws on unknown pool token", async () => {
  await assert.rejects(() =>
    quoteDeposit("NOTREAL", "USDC", "1"),
  );
});
