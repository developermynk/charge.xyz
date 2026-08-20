import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LP_POOLS,
  getPoolById,
  ARC_TESTNET_USDC,
} from "./circle.ts";

test("getPoolById resolves a known pool", () => {
  const p = getPoolById("USDC-EURC");
  assert.ok(p);
  assert.equal(p!.tokenA, "USDC");
  assert.equal(p!.tokenB, "EURC");
  assert.equal(p!.enabled, true);
  assert.equal(p!.available, true);
  // Single source of truth fields are populated.
  assert.match(p!.pairAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.match(p!.routerAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.match(p!.factoryAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(p!.feeBps, 30);
});

test("getPoolById returns undefined for unknown", () => {
  assert.equal(getPoolById("DOES-NOT-EXIST"), undefined);
});

test("cirBTC pool is disabled with an honest reason (no fabricated liquidity)", () => {
  const p = getPoolById("USDC-cirBTC");
  assert.ok(p);
  assert.equal(p!.enabled, false);
  assert.equal(p!.available, false);
  assert.ok(p!.unavailableReason && p!.unavailableReason.length > 0);
});

test("every enabled pool has a real pair address", () => {
  for (const p of LP_POOLS.filter((x) => x.enabled)) {
    assert.match(
      p.pairAddress,
      /^0x[0-9a-fA-F]{40}$/,
      `pool ${p.id} missing pairAddress`,
    );
    assert.ok(p.feeBps > 0, `pool ${p.id} missing feeBps`);
  }
});

test("ARC_TESTNET_USDC is the canonical 6dp USDC", () => {
  assert.equal(ARC_TESTNET_USDC, "0x3600000000000000000000000000000000000000");
});
