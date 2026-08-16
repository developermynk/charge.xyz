/**
 * Transfer — native asset and ERC-20, as explicit paths.
 *
 * These MUST stay separate. On Arc the native asset and the ERC-20 are both
 * called "USDC" but use 18 and 6 decimals respectively. A single "smart"
 * transfer helper that guesses which one the user meant is precisely how a
 * 1 USDC send becomes a 1,000,000,000,000 USDC send. The caller picks.
 *
 * The transfer is chain-aware: pass `chainId` + `token` (ERC-20 address) +
 * `decimals` to send on any EVM chain. Arc stays the default for backwards
 * compatibility.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  http,
  isAddress,
  parseUnits,
  type Chain,
  type Hash,
} from "viem";

import {
  ARC_ERC20_DECIMALS,
  ARC_TOKENS,
  ARC_CHAIN_ID,
  EVM_CHAIN_BY_ID,
  arcTestnet,
  parseErc20,
  parseNative,
} from "@charge/chains";

import { ChargeError } from "./errors.ts";
import type { Eip1193Provider } from "./app-kit.ts";

export class TransferError extends ChargeError {}

export type TransferAsset = "native" | "usdc" | "eurc" | (string & {});

export interface TransferRequest {
  provider: Eip1193Provider;
  from: `0x${string}`;
  to: string;
  /** Human-readable amount, e.g. "25.5". */
  amount: string;
  /** Asset selector. For non-Arc chains this is the token symbol or "native". */
  asset: TransferAsset;
  /** EVM chain id. Defaults to Arc Testnet. */
  chainId?: number;
  /** ERC-20 token contract when sending a non-Arc token. */
  token?: `0x${string}`;
  /** Token decimals for the selected asset on this chain. */
  decimals?: number;
}

function assertRecipient(to: string): asserts to is `0x${string}` {
  if (!isAddress(to)) {
    throw new TransferError("That is not a valid address.");
  }
}

/** Resolve a viem Chain for the requested network (Arc by default). */
function chainFor(chainId?: number): Chain {
  if (chainId === undefined || chainId === ARC_CHAIN_ID) return arcTestnet;
  const d = EVM_CHAIN_BY_ID.get(chainId);
  if (!d) return arcTestnet;
  return {
    id: d.chainId,
    name: d.name,
    nativeCurrency: {
      name: d.nativeSymbol,
      symbol: d.nativeSymbol,
      decimals: 18,
    },
    rpcUrls: { default: { http: [d.rpcUrl] } },
    blockExplorers: d.explorerUrl
      ? { default: { name: d.name, url: d.explorerUrl } }
      : undefined,
    testnet: d.testnet,
  } as Chain;
}

export function walletClient(provider: Eip1193Provider, account: `0x${string}`, chainId?: number) {
  return createWalletClient({
    account,
    chain: chainFor(chainId),
    transport: custom(provider as never),
  });
}

function publicClientFor(chainId?: number) {
  return createPublicClient({ chain: chainFor(chainId), transport: http() });
}

/** Backwards-compatible alias (Arc by default). */
export function publicClient(chainId?: number) {
  return publicClientFor(chainId);
}

/**
 * Send the native gas asset (18 decimals on Arc; 18 on every EVM chain).
 * Plain value transfer — no token contract involved.
 */
export async function transferNative(req: TransferRequest): Promise<Hash> {
  assertRecipient(req.to);
  const isArc = req.chainId === undefined || req.chainId === ARC_CHAIN_ID;
  const value = isArc ? parseNative(req.amount) : parseUnits(req.amount, 18);
  try {
    return await walletClient(req.provider, req.from, req.chainId).sendTransaction({
      to: req.to,
      value,
    });
  } catch (err) {
    throw new TransferError(humanizeTransferError(err), { cause: err });
  }
}

/**
 * Send an ERC-20. On Arc this is USDC/EURC (6 decimals); on other chains the
 * token address + decimals are passed in via `token` / `decimals`.
 */
export async function transferErc20(req: TransferRequest): Promise<Hash> {
  assertRecipient(req.to);

  const isArc = req.chainId === undefined || req.chainId === ARC_CHAIN_ID;
  const token =
    req.token ?? (req.asset === "eurc" ? ARC_TOKENS.EURC : ARC_TOKENS.USDC);
  const amount = isArc
    ? parseErc20(req.amount)
    : parseUnits(req.amount, req.decimals ?? 18);

  try {
    return await walletClient(req.provider, req.from, req.chainId).writeContract({
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
export async function waitForTransfer(hash: Hash, chainId?: number) {
  const receipt = await publicClientFor(chainId).waitForTransactionReceipt({ hash });
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
    return "Not enough balance to cover the amount plus gas.";
  }
  if (msg.includes("transfer amount exceeds balance")) {
    return "The amount is larger than your token balance.";
  }
  if (msg.includes("nonce")) {
    return "Transaction nonce conflict — wait for your pending transaction to confirm.";
  }
  if (msg.includes("chain") && msg.includes("mismatch")) {
    return "Your wallet is on the wrong network. Switch to the selected chain.";
  }
  return "The transfer could not be completed. Please try again.";
}
