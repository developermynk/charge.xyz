/**
 * Transfer — native USDC gas and ERC-20 USDC, as two explicit paths.
 *
 * These MUST stay separate. On Arc the native asset and the ERC-20 are both
 * called "USDC" but use 18 and 6 decimals respectively. A single "smart"
 * transfer helper that guesses which one the user meant is precisely how a
 * 1 USDC send becomes a 1,000,000,000,000 USDC send. The caller picks.
 */

import {
  createWalletClient,
  createPublicClient,
  custom,
  erc20Abi,
  http,
  isAddress,
  type Hash,
} from "viem";

import {
  ARC_ERC20_DECIMALS,
  ARC_TOKENS,
  arcTestnet,
  parseErc20,
  parseNative,
} from "@charge/chains";

import { ChargeError } from "./errors.ts";
import type { Eip1193Provider } from "./app-kit.ts";

export class TransferError extends ChargeError {}

export type TransferAsset = "native" | "usdc" | "eurc";

export interface TransferRequest {
  provider: Eip1193Provider;
  from: `0x${string}`;
  to: string;
  /** Human-readable amount, e.g. "25.5". */
  amount: string;
  asset: TransferAsset;
}

function assertRecipient(to: string): asserts to is `0x${string}` {
  if (!isAddress(to)) {
    throw new TransferError("That is not a valid Arc address.");
  }
}

export function publicClient() {
  return createPublicClient({ chain: arcTestnet, transport: http() });
}

function walletClient(provider: Eip1193Provider, account: `0x${string}`) {
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: custom(provider as never),
  });
}

/**
 * Send USDC as the native gas asset (18 decimals).
 * This is a plain value transfer — no token contract involved.
 */
export async function transferNative(req: TransferRequest): Promise<Hash> {
  assertRecipient(req.to);
  const value = parseNative(req.amount); // 18dp — enforced by the branded type
  try {
    return await walletClient(req.provider, req.from).sendTransaction({
      to: req.to,
      value,
    });
  } catch (err) {
    throw new TransferError(humanizeTransferError(err), { cause: err });
  }
}

/**
 * Send an ERC-20 (6 decimals on Arc for both USDC and EURC).
 */
export async function transferErc20(req: TransferRequest): Promise<Hash> {
  assertRecipient(req.to);

  const token = req.asset === "eurc" ? ARC_TOKENS.EURC : ARC_TOKENS.USDC;
  const amount = parseErc20(req.amount); // 6dp — enforced by the branded type

  try {
    return await walletClient(req.provider, req.from).writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [req.to, amount],
    });
  } catch (err) {
    throw new TransferError(humanizeTransferError(err), { cause: err });
  }
}

/** Dispatch on the asset the user explicitly selected. */
export async function transfer(req: TransferRequest): Promise<Hash> {
  return req.asset === "native" ? transferNative(req) : transferErc20(req);
}

/** Wait for inclusion and report success/failure honestly. */
export async function waitForTransfer(hash: Hash) {
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new TransferError("The transaction was included but reverted on chain.");
  }
  return receipt;
}

export { ARC_ERC20_DECIMALS };

export function humanizeTransferError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  if (msg.includes("user rejected") || msg.includes("user denied")) {
    return "You rejected the transaction in your wallet.";
  }
  if (msg.includes("insufficient funds")) {
    return "Not enough USDC to cover the amount plus gas. Remember gas is paid in USDC on Arc.";
  }
  if (msg.includes("transfer amount exceeds balance")) {
    return "The amount is larger than your token balance.";
  }
  if (msg.includes("nonce")) {
    return "Transaction nonce conflict — wait for your pending transaction to confirm.";
  }
  if (msg.includes("chain") && msg.includes("mismatch")) {
    return "Your wallet is on the wrong network. Switch to Arc Testnet.";
  }
  return "The transfer could not be completed. Please try again.";
}
