/**
 * Decimals + validation tests.
 *
 * The decimals cases are the important ones: they encode the single most
 * dangerous property of Arc — that "1 USDC" means two different bigints
 * depending on whether it is gas or an ERC-20 balance.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AmountParseError,
  formatErc20,
  formatNative,
  parseErc20,
  parseNative,
  shortenAddress,
} from "./decimals.ts";
import {
  isArcSameAssetPair,
  tokensForChain,
  validateSwap,
} from "./circle.ts";
import { ARC_CHAIN_ID, isArcChain } from "./arc.ts";

test("native and erc20 scales differ by 10^12 for the same input", () => {
  const native = parseNative("1");
  const erc20 = parseErc20("1");
  assert.equal(native, 1_000_000_000_000_000_000n);
  assert.equal(erc20, 1_000_000n);
  assert.equal(native / erc20, 1_000_000_000_000n);
});

test("round-trips preserve the value at each scale", () => {
  assert.equal(formatNative(parseNative("12.345678901234567")), "12.345678901234567");
  assert.equal(formatErc20(parseErc20("12.345678")), "12.345678");
});

test("rejects more precision than the scale supports", () => {
  // 7dp is invalid for a 6dp ERC-20 and must not be silently truncated.
  assert.throws(() => parseErc20("1.1234567"), AmountParseError);
  // The same string is fine at 18dp.
  assert.doesNotThrow(() => parseNative("1.1234567"));
});

test("rejects junk input instead of coercing to zero", () => {
  for (const bad of ["", " ", ".", "abc", "-1", "1e6", "1,5"]) {
    assert.throws(() => parseErc20(bad), AmountParseError, `should reject ${bad}`);
  }
});

test("arc chain id is the live-verified value", () => {
  assert.equal(ARC_CHAIN_ID, 5042002);
  assert.equal(isArcChain(5042002), true);
  assert.equal(isArcChain(1), false);
  assert.equal(isArcChain(undefined), false);
});

test("arc swap tokens are restricted to what the SDK supports", () => {
  assert.deepEqual([...tokensForChain("Arc_Testnet")], ["USDC", "EURC", "cirBTC"]);
  assert.ok(tokensForChain("Base").includes("WETH"));
});

test("USDC<->NATIVE is blocked on Arc but valid elsewhere", () => {
  assert.equal(isArcSameAssetPair("Arc_Testnet", "USDC", "NATIVE"), true);
  assert.equal(isArcSameAssetPair("Arc_Testnet", "NATIVE", "USDC"), true);
  assert.equal(isArcSameAssetPair("Base", "USDC", "NATIVE"), false);
});

test("validateSwap catches the realistic bad requests", () => {
  assert.equal(validateSwap({ chain: "Arc_Testnet", tokenIn: "USDC", tokenOut: "EURC", amountIn: "1" }).ok, true);
  assert.equal(validateSwap({ chain: "Nope", tokenIn: "USDC", tokenOut: "EURC", amountIn: "1" }).ok, false);
  assert.equal(validateSwap({ chain: "Arc_Testnet", tokenIn: "USDC", tokenOut: "USDC", amountIn: "1" }).ok, false);
  assert.equal(validateSwap({ chain: "Arc_Testnet", tokenIn: "USDC", tokenOut: "NATIVE", amountIn: "1" }).ok, false);
  assert.equal(validateSwap({ chain: "Arc_Testnet", tokenIn: "USDC", tokenOut: "WETH", amountIn: "1" }).ok, false);
  assert.equal(validateSwap({ chain: "Arc_Testnet", tokenIn: "USDC", tokenOut: "EURC", amountIn: "0" }).ok, false);
  assert.equal(validateSwap({ chain: "Arc_Testnet", tokenIn: "USDC", tokenOut: "EURC", amountIn: "-5" }).ok, false);
});

test("shortenAddress keeps head and tail", () => {
  assert.equal(
    shortenAddress("0x27Edf81F6ae1d7BAe44859CEE62e08E280a4a0A2"),
    "0x27Ed…a0A2",
  );
});
