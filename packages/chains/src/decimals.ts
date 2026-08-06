/**
 * Decimal safety for Arc.
 *
 * THE HAZARD: on Arc, the native gas asset and the ERC-20 are BOTH called
 * "USDC", but native gas uses 18 decimals while the ERC-20 uses 6. A raw
 * `bigint` carries no evidence of which scale it is in, so mixing them is
 * silent and catastrophic — a 1 USDC transfer becomes 1,000,000,000,000 USDC
 * (or 0.000000000001) depending on direction.
 *
 * THE FIX: branded types. A `NativeAmount` and an `Erc20Amount` are both
 * bigints at runtime with zero overhead, but the compiler refuses to let one
 * be passed where the other is expected. The ONLY way to obtain either is
 * through the parse helpers below, which apply the correct scale.
 */

import { formatUnits, parseUnits } from "viem";

import { ARC_ERC20_DECIMALS, ARC_NATIVE_DECIMALS } from "./arc.ts";

declare const brand: unique symbol;

/** A bigint denominated in Arc native gas units (18 decimals). */
export type NativeAmount = bigint & { readonly [brand]: "native-18" };

/** A bigint denominated in Arc ERC-20 units (6 decimals for USDC/EURC). */
export type Erc20Amount = bigint & { readonly [brand]: "erc20-6" };

/** Thrown when user input cannot be parsed into a token amount. */
export class AmountParseError extends Error {
  constructor(input: string, reason: string) {
    super(`Invalid amount "${input}": ${reason}`);
    this.name = "AmountParseError";
  }
}

const DECIMAL_INPUT = /^\d*\.?\d*$/;

function assertParseable(input: string, maxDecimals: number): void {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed === ".") {
    throw new AmountParseError(input, "empty");
  }
  if (!DECIMAL_INPUT.test(trimmed)) {
    throw new AmountParseError(input, "must be a positive decimal number");
  }
  const fraction = trimmed.split(".")[1];
  if (fraction !== undefined && fraction.length > maxDecimals) {
    throw new AmountParseError(
      input,
      `at most ${maxDecimals} decimal places are supported`,
    );
  }
}

/** Parse a human string ("1.5") into native gas units (18dp). */
export function parseNative(input: string): NativeAmount {
  assertParseable(input, ARC_NATIVE_DECIMALS);
  return parseUnits(input.trim(), ARC_NATIVE_DECIMALS) as NativeAmount;
}

/** Parse a human string ("1.5") into ERC-20 units (6dp). */
export function parseErc20(input: string): Erc20Amount {
  assertParseable(input, ARC_ERC20_DECIMALS);
  return parseUnits(input.trim(), ARC_ERC20_DECIMALS) as Erc20Amount;
}

/** Format native gas units back to a human string. */
export function formatNative(amount: NativeAmount): string {
  return formatUnits(amount, ARC_NATIVE_DECIMALS);
}

/** Format ERC-20 units back to a human string. */
export function formatErc20(amount: Erc20Amount): string {
  return formatUnits(amount, ARC_ERC20_DECIMALS);
}

/**
 * Format any amount for display with grouped thousands and a fixed number of
 * fraction digits. Always used with `tabular-nums` in the UI so columns align.
 */
export function formatDisplay(
  value: string | number,
  maximumFractionDigits = 6,
): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

/** Compact display for large figures: 1.2M, 45.3K. */
export function formatCompact(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

/** Shorten an address for display: 0x27Ed…a0A2 */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
