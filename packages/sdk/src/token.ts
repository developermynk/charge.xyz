/**
 * ERC-20 token deployment on Arc — from the USER's wallet.
 *
 * DESIGN DECISION (approved): tokens are deployed by the connected user, not by
 * Circle's Smart Contract Platform. SCP deploys from a developer-controlled
 * wallet, which would make Charge.xyz the owner and minter of every token a
 * user creates. Deploying from the user's own wallet means the deployer, owner,
 * and initial-supply holder are all the user. Charge never holds the keys.
 *
 * The contract is a fixed-supply ERC-20: the entire supply is minted to the
 * deployer at construction and there is no mint function afterwards. That
 * removes the whole class of "hidden mint" rug vectors by construction, which
 * the security review flagged as mandatory for a public token launcher.
 */

import { createWalletClient, custom, type Abi, type Hash } from "viem";

import { arcTestnet } from "@charge/chains";

import { ChargeError } from "./errors.ts";
import { publicClient } from "./transfer.ts";
import type { Eip1193Provider } from "./app-kit.ts";

export class TokenCreateError extends ChargeError {}

export interface CreateTokenRequest {
  provider: Eip1193Provider;
  account: `0x${string}`;
  name: string;
  symbol: string;
  /** Whole-token supply as a string, e.g. "1000000". */
  totalSupply: string;
  decimals?: number;
}

export interface CreateTokenResult {
  txHash: Hash;
  contractAddress: `0x${string}`;
}

/**
 * Fixed-supply ERC-20 ABI.
 * constructor(string name, string symbol, uint8 decimals, uint256 supply)
 */
export const FIXED_SUPPLY_ERC20_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "decimals_", type: "uint8" },
      { name: "totalSupply_", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

export interface TokenValidation {
  ok: boolean;
  error?: string;
}

/** Validate before asking the user to pay gas for a doomed deploy. */
export function validateTokenParams(params: {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals?: number;
}): TokenValidation {
  const { name, symbol, totalSupply, decimals = 18 } = params;

  if (name.trim().length === 0) return { ok: false, error: "Token name is required." };
  if (name.length > 64) return { ok: false, error: "Token name must be 64 characters or fewer." };

  const sym = symbol.trim();
  if (sym.length === 0) return { ok: false, error: "Token symbol is required." };
  if (sym.length > 11) return { ok: false, error: "Token symbol must be 11 characters or fewer." };
  if (!/^[A-Za-z0-9]+$/.test(sym)) {
    return { ok: false, error: "Token symbol must be letters and numbers only." };
  }

  if (!/^\d+$/.test(totalSupply.trim())) {
    return { ok: false, error: "Total supply must be a whole number." };
  }
  if (BigInt(totalSupply) <= 0n) {
    return { ok: false, error: "Total supply must be greater than zero." };
  }
  // 2^256 headroom check: supply * 10^decimals must not overflow uint256.
  if (BigInt(totalSupply) * 10n ** BigInt(decimals) >= 2n ** 256n) {
    return { ok: false, error: "Total supply is too large for a uint256 at that precision." };
  }

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    return { ok: false, error: "Decimals must be a whole number between 0 and 18." };
  }

  return { ok: true };
}

/**
 * Deploy the token. Bytecode is supplied by the caller from the compiled
 * `@charge/contracts` artifact (generated by Foundry at build time), so the
 * browser never compiles Solidity and the deployed bytecode is identical and
 * auditable for everyone. There is no mint function and no owner/admin key in
 * the artifact — supply is fixed at construction, so the deployer holds 100%
 * of it from block one.
 */
export async function deployToken(
  req: CreateTokenRequest,
  bytecode: `0x${string}`,
): Promise<CreateTokenResult> {
  const decimals = req.decimals ?? 18;
  const check = validateTokenParams({ ...req, decimals });
  if (!check.ok) throw new TokenCreateError(check.error ?? "Invalid token parameters.");

  const supply = BigInt(req.totalSupply) * 10n ** BigInt(decimals);

  const wallet = createWalletClient({
    account: req.account,
    chain: arcTestnet,
    transport: custom(req.provider as never),
  });

  try {
    const txHash = await wallet.deployContract({
      abi: FIXED_SUPPLY_ERC20_ABI,
      bytecode,
      args: [req.name.trim(), req.symbol.trim().toUpperCase(), decimals, supply],
    });

    const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      throw new TokenCreateError("The deployment transaction reverted on chain.");
    }
    if (!receipt.contractAddress) {
      throw new TokenCreateError("Deployment confirmed but no contract address was returned.");
    }

    return { txHash, contractAddress: receipt.contractAddress };
  } catch (err) {
    if (err instanceof TokenCreateError) throw err;
    throw new TokenCreateError(humanizeDeployError(err), { cause: err });
  }
}

export function humanizeDeployError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  if (msg.includes("user rejected") || msg.includes("user denied")) {
    return "You rejected the deployment in your wallet.";
  }
  if (msg.includes("insufficient funds")) {
    return "Not enough USDC to pay the deployment gas. Get testnet USDC from faucet.circle.com.";
  }
  if (msg.includes("chain") && msg.includes("mismatch")) {
    return "Your wallet is on the wrong network. Switch to Arc Testnet.";
  }
  return "The token could not be deployed. Please try again.";
}
