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

import {
  arcTestnet,
  ARC_TESTNET_AMM,
  ARC_TESTNET_USDC,
  ARC_AMM_ROUTER_ABI,
} from "@charge/chains";

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
  if (msg.includes("unrecognized chain") || msg.includes("unknown chain") || msg.includes("wallet_addethereumchain") || msg.includes("chainid")) {
    return "Your wallet doesn't have Arc Testnet added. Approve the add-network prompt (or add it manually) and retry.";
  }
  // Surface the real error instead of swallowing it — a generic message hides
  // the actual cause and makes debugging impossible.
  if (err instanceof Error && err.message && err.message !== "[object Object]") {
    return err.message;
  }
  return "The token could not be deployed. Please try again.";
}

/**
 * ChargeTokenV2 ABI — adds `mint`/`burn` (present only when the matching flag
 * was enabled at deploy) on top of the standard ERC-20 surface. `mintable` and
 * `burnable` are immutable constructor flags.
 */
export const CHARGETOKENV2_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "decimals_", type: "uint8" },
      { name: "totalSupply_", type: "uint256" },
      { name: "mintable_", type: "bool" },
      { name: "burnable_", type: "bool" },
    ],
    stateMutability: "nonpayable",
  },
  ...FIXED_SUPPLY_ERC20_ABI.filter(
    (e) => e.type !== "constructor" && e.type !== "event",
  ),
  {
    type: "function",
    name: "mintable",
    inputs: [],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "burnable",
    inputs: [],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "burn",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

const ERC20_APPROVE_ABI = [
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
] as const;

export interface LaunchTokenV2Request {
  provider: Eip1193Provider;
  account: `0x${string}`;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals?: number;
  mintable?: boolean;
  burnable?: boolean;
  /**
   * Optional initial USDC liquidity (human units, 6 decimals) to seed a
   * USDC pair for the token on the Arc AMM. 0 = deploy only (tradeable once
   * liquidity is added later). Seeding makes the token buyable immediately.
   */
  seedUsdc?: string;
}

export interface LaunchTokenV2Result extends CreateTokenResult {
  mintable: boolean;
  burnable: boolean;
  poolSeeded: boolean;
  poolTxHash?: Hash;
}

/**
 * Deploy a ChargeTokenV2 and optionally seed a USDC/Token pool on the live Arc
 * AMM so the token is tradeable right away. All actions are signed by the
 * user's own wallet — Charge holds no keys, never custodies, and never
 * front-runs the pool.
 */
export async function launchTokenV2(
  req: LaunchTokenV2Request,
  bytecode: `0x${string}`,
): Promise<LaunchTokenV2Result> {
  const decimals = req.decimals ?? 18;
  const mintable = req.mintable ?? false;
  const burnable = req.burnable ?? false;

  const check = validateTokenParams({ ...req, decimals });
  if (!check.ok) throw new TokenCreateError(check.error ?? "Invalid token parameters.");

  const supply = BigInt(req.totalSupply) * 10n ** BigInt(decimals);
  const seedUsdcRaw = req.seedUsdc ? BigInt(Math.floor(Number(req.seedUsdc) * 1e6)) : 0n;

  const wallet = createWalletClient({
    account: req.account,
    chain: arcTestnet,
    transport: custom(req.provider as never),
  });

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  let deployTx: Hash;
  let contractAddress: `0x${string}`;

  try {
    deployTx = await wallet.deployContract({
      abi: CHARGETOKENV2_ABI,
      bytecode,
      args: [
        req.name.trim(),
        req.symbol.trim().toUpperCase(),
        decimals,
        supply,
        mintable,
        burnable,
      ],
    });
    const receipt = await publicClient().waitForTransactionReceipt({ hash: deployTx });
    if (receipt.status === "reverted") {
      throw new TokenCreateError("The deployment transaction reverted on chain.");
    }
    if (!receipt.contractAddress) {
      throw new TokenCreateError("Deployment confirmed but no contract address was returned.");
    }
    contractAddress = receipt.contractAddress;
  } catch (err) {
    if (err instanceof TokenCreateError) throw err;
    throw new TokenCreateError(humanizeDeployError(err), { cause: err });
  }

  let poolSeeded = false;
  let poolTxHash: Hash | undefined;

  if (seedUsdcRaw > 0n) {
    try {
      // Approve the router to spend both tokens.
      const a1 = await wallet.writeContract({
        address: contractAddress,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [ARC_TESTNET_AMM.router as `0x${string}`, supply],
      });
      await publicClient().waitForTransactionReceipt({ hash: a1 });

      const a2 = await wallet.writeContract({
        address: ARC_TESTNET_USDC as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [ARC_TESTNET_AMM.router as `0x${string}`, seedUsdcRaw],
      });
      await publicClient().waitForTransactionReceipt({ hash: a2 });

      poolTxHash = await wallet.writeContract({
        address: ARC_TESTNET_AMM.router as `0x${string}`,
        abi: ARC_AMM_ROUTER_ABI,
        functionName: "addLiquidity",
        args: [
          ARC_TESTNET_USDC as `0x${string}`,
          contractAddress,
          seedUsdcRaw,
          supply,
          (seedUsdcRaw * 99n) / 100n,
          (supply * 99n) / 100n,
          req.account,
          deadline,
        ],
      });
      const poolReceipt = await publicClient().waitForTransactionReceipt({ hash: poolTxHash });
      poolSeeded = poolReceipt.status === "success";
    } catch (err) {
      // Liquidity seeding is best-effort: the token is still live even if the
      // pool step fails (e.g. user rejected, or no USDC balance).
      throw new TokenCreateError(
        `Token deployed at ${contractAddress}, but liquidity seeding failed: ${
          err instanceof Error ? err.message : String(err)
        }. You can add liquidity later from the token page.`,
        { cause: err },
      );
    }
  }

  return {
    txHash: deployTx,
    contractAddress,
    mintable,
    burnable,
    poolSeeded,
    poolTxHash,
  };
}

/** Read deployed-token metadata straight from chain (Arc). */
export async function readTokenMeta(address: `0x${string}`) {
  const pc = publicClient();
  const [name, symbol, decimals, totalSupply, mintable, burnable, owner] =
    await Promise.all([
      pc.readContract({ address, abi: CHARGETOKENV2_ABI, functionName: "name" }),
      pc.readContract({ address, abi: CHARGETOKENV2_ABI, functionName: "symbol" }),
      pc.readContract({ address, abi: CHARGETOKENV2_ABI, functionName: "decimals" }),
      pc.readContract({
        address,
        abi: CHARGETOKENV2_ABI,
        functionName: "totalSupply",
      }),
      pc.readContract({
        address,
        abi: CHARGETOKENV2_ABI,
        functionName: "mintable",
      }),
      pc.readContract({
        address,
        abi: CHARGETOKENV2_ABI,
        functionName: "burnable",
      }),
      pc.readContract({ address, abi: CHARGETOKENV2_ABI, functionName: "owner" }),
    ]);
  return {
    name: name as string,
    symbol: symbol as string,
    decimals: decimals as number,
    totalSupply: totalSupply as bigint,
    mintable: mintable as boolean,
    burnable: burnable as boolean,
    owner: owner as `0x${string}`,
  };
}

/**
 * Live price of a launched token in USDC, derived from its USDC pool on the
 * Arc AMM (Uniswap V2). Returns null if there is no seeded pool yet.
 */
export async function readTokenPriceUsdc(
  token: `0x${string}`,
): Promise<{ priceUsdc: number; poolExists: boolean } | null> {
  const pc = publicClient();
  const factory = ARC_TESTNET_AMM.factory as `0x${string}`;
  try {
    const pair = (await pc.readContract({
      address: factory,
      abi: [
        {
          type: "function",
          name: "getPair",
          stateMutability: "view",
          inputs: [
            { name: "a", type: "address" },
            { name: "b", type: "address" },
          ],
          outputs: [{ type: "address" }],
        },
      ],
      functionName: "getPair",
      args: [ARC_TESTNET_USDC as `0x${string}`, token],
    })) as `0x${string}`;

    if (pair === "0x0000000000000000000000000000000000000000") {
      return { priceUsdc: 0, poolExists: false };
    }

    const [r0, r1] = (await pc.readContract({
      address: pair,
      abi: [
        {
          type: "function",
          name: "getReserves",
          stateMutability: "view",
          inputs: [],
          outputs: [
            { name: "reserve0", type: "uint112" },
            { name: "reserve1", type: "uint112" },
            { name: "blockTimestampLast", type: "uint32" },
          ],
        },
      ],
      functionName: "getReserves",
    })) as [bigint, bigint, number];

    // Determine ordering: factory getPair returns pair with token0/token1 order.
    const t0 = (await pc.readContract({
      address: pair,
      abi: [
        {
          type: "function",
          name: "token0",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "address" }],
        },
      ],
      functionName: "token0",
    })) as `0x${string}`;

    // USDC is 6 decimals; the launched token's decimals come from the token
    // contract itself (not assumed 18 — a wrong assumption misprices tokens
    // with any other precision). Compute in BigInt to avoid precision loss.
    const tokenDecimals = (await pc.readContract({
      address: token,
      abi: [
        {
          type: "function",
          name: "decimals",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "uint8" }],
        },
      ],
      functionName: "decimals",
    })) as number;

    const usdcIs0 = t0.toLowerCase() === ARC_TESTNET_USDC.toLowerCase();
    const usdcReserve = usdcIs0 ? r0 : r1;
    const tokenReserve = usdcIs0 ? r1 : r0;
    if (tokenReserve === 0n) return { priceUsdc: 0, poolExists: true };

    // price(USDC) = (usdcReserve / 10^6) / (tokenReserve / 10^tokenDecimals)
    //            = usdcReserve * 10^tokenDecimals / (10^6 * tokenReserve)
    const priceRaw =
      (usdcReserve * 10n ** BigInt(tokenDecimals)) /
      (10n ** 6n * tokenReserve);
    const price = Number(priceRaw) / 1e18;
    return { priceUsdc: price, poolExists: true };
  } catch {
    return null;
  }
}


