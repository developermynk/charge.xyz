/**
 * Charge Launchpad SDK — Pump.fun-style bonding-curve launchpad on Arc.
 *
 * ARC-NATIVE PUSH MODEL (verified on Arc Testnet):
 *   Arc blocks USDC value into fresh contracts (native->contract reverts; ERC-20
 *   transferFrom pulled by a contract reverts at the blocklist precompile). The
 *   working path is: the trader pushes USDC via ERC-20 `transfer` (EOA->Launchpad,
 *   6dp units), then calls `router.buy(token, usdIn6, minOut)`. The Launchpad
 *   credits the already-received USDC. Sells pay native USDC back to the EOA.
 *
 * Reads (`getPrice`/`getMarketCap`/...) are pure view calls — no push needed.
 */

import type { Abi, Hash, Log, Address } from "viem";
import { parseUnits, encodeFunctionData, decodeEventLog } from "viem";

import {
  arcTestnet,
  ARC_CHAIN_ID,
  ARC_TESTNET_USDC,
} from "@charge/chains";
import {
  publicClient,
  walletClient,
  transferErc20,
  type TransferRequest,
} from "./transfer.ts";
import type { Eip1193Provider } from "./app-kit.ts";

export class LaunchpadError extends Error {
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = "LaunchpadError";
    if (opts?.cause) (this as any).cause = opts.cause;
  }
}

/** Deployed protocol addresses (Arc Testnet). Update from deployments/arc-testnet.json. */
export const LAUNCHPAD_ADDRESSES = {
  chainId: ARC_CHAIN_ID,
  feeManager: "0x0F894aDF71E0aBdeA7A6796d1A6227B3080374c3" as const,
  treasury: "0x5F6826296c75074bb0eA83F4660defAe0337Bd54" as const,
  factory: "0x9ac168a5B701CF59Ad699E63B576DD125CF53BD7" as const,
  liquidityManager: "0xF9422E6105F353832a6B94230aF02088F918DE7D" as const,
  launchpad: "0xf0b3bbFb24c64Fa6Cfe4048A376C5eb5a6Eb8849" as const,
  router: "0xE6027493cBe753212555b1719edb611fB6A6C001" as const,
  usdc: ARC_TESTNET_USDC,
} as const;

export const LAUNCHPAD_ABI = [
  // Router
  {
    type: "function",
    name: "createToken",
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "totalSupply", type: "uint256" },
      { name: "curveType", type: "uint8" },
      { name: "metaHash", type: "string" },
    ],
    outputs: [{ name: "token", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buy",
    inputs: [
      { name: "token", type: "address" },
      { name: "usdIn", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
    ],
    outputs: [{ name: "tokenOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sell",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenIn", type: "uint256" },
      { name: "minUsdOut", type: "uint256" },
    ],
    outputs: [{ name: "usdOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "quoteBuy",
    inputs: [
      { name: "token", type: "address" },
      { name: "usdIn", type: "uint256" },
    ],
    outputs: [{ name: "tokenOut", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "quoteSell",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenIn", type: "uint256" },
    ],
    outputs: [{ name: "usdOut", type: "uint256" }],
    stateMutability: "view",
  },
  // Launchpad reads
  {
    type: "function",
    name: "getPrice",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "priceUsd", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMarketCap",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "marketCapUsd", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVolume",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "usd", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLiquidity",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "usd", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getHolders",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "holders", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creatorOf",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "creator", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createdAt",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "ts", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isGraduated",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "graduated", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "curveView",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "virtualUsd", type: "uint256" },
      { name: "virtualTokens", type: "uint256" },
      { name: "feeBps", type: "uint16" },
      { name: "graduated", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const satisfies Abi;

export const LAUNCHPAD_EVENTS_ABI = [
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "name_", type: "string", indexed: false },
      { name: "symbol_", type: "string", indexed: false },
      { name: "totalSupply", type: "uint256", indexed: false },
      { name: "curveType", type: "uint8", indexed: false },
      { name: "metaHash", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Bought",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "usdIn", type: "uint256", indexed: false },
      { name: "tokenOut", type: "uint256", indexed: false },
      { name: "priceUsd", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sold",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "tokenIn", type: "uint256", indexed: false },
      { name: "usdOut", type: "uint256", indexed: false },
      { name: "priceUsd", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PriceUpdated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "priceUsd", type: "uint256", indexed: false },
      { name: "marketCapUsd", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Graduated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "usdcToPool", type: "uint256", indexed: false },
      { name: "tokensToPool", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

export interface LaunchpadTokenState {
  address: Address;
  creator: Address;
  createdAt: bigint;
  priceUsd: bigint; // 6dp
  marketCapUsd: bigint; // 6dp
  volumeUsd: bigint; // 6dp (realUsd)
  liquidityUsd: bigint; // 6dp
  holders: bigint;
  graduated: boolean;
}

export interface CreateTokenRequest {
  provider: Eip1193Provider;
  account: Address;
  name: string;
  symbol: string;
  totalSupply: string; // whole tokens, e.g. "1000000000"
  curveType?: number; // 0 = constant-product virtual reserves
  metaHash: string; // ipfs://... or "" 
}

export interface TradeRequest {
  provider: Eip1193Provider;
  account: Address;
  token: Address;
  /** Amount in USDC (human, e.g. "5"). 6dp on Arc. */
  amountUsd: string;
  /** Slippage tolerance fraction, e.g. 0.05 = 5%. */
  slippage?: number;
  chainId?: number;
}

// ── Reads ──────────────────────────────────────────────────────────────────
export async function getTokenState(token: Address, chainId?: number): Promise<LaunchpadTokenState> {
  const c = publicClient(chainId);
  const [priceUsd, marketCapUsd, volumeUsd, liquidityUsd, holders, creator, createdAt, graduated] =
    await Promise.all([
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "getPrice", args: [token] }),
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "getMarketCap", args: [token] }),
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "getVolume", args: [token] }),
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "getLiquidity", args: [token] }),
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "getHolders", args: [token] }),
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "creatorOf", args: [token] }),
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "createdAt", args: [token] }),
      c.readContract({ address: LAUNCHPAD_ADDRESSES.launchpad, abi: LAUNCHPAD_ABI, functionName: "isGraduated", args: [token] }),
    ]);
  return { address: token, creator, createdAt, priceUsd, marketCapUsd, volumeUsd, liquidityUsd, holders, graduated };
}

export async function quoteBuy(token: Address, amountUsd: string, chainId?: number): Promise<bigint> {
  const usdIn = parseUnits(amountUsd, 6);
  return publicClient(chainId).readContract({
    address: LAUNCHPAD_ADDRESSES.router,
    abi: LAUNCHPAD_ABI,
    functionName: "quoteBuy",
    args: [token, usdIn],
  }) as Promise<bigint>;
}

export async function quoteSell(token: Address, tokenAmount: bigint, chainId?: number): Promise<bigint> {
  return publicClient(chainId).readContract({
    address: LAUNCHPAD_ADDRESSES.router,
    abi: LAUNCHPAD_ABI,
    functionName: "quoteSell",
    args: [token, tokenAmount],
  }) as Promise<bigint>;
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function createToken(req: CreateTokenRequest): Promise<{ txHash: Hash; token: Address }> {
  const supply = parseUnits(req.totalSupply, 18);
  const wc = walletClient(req.provider, req.account);
  const txHash = await wc.writeContract({
    address: LAUNCHPAD_ADDRESSES.router,
    abi: LAUNCHPAD_ABI,
    functionName: "createToken",
    args: [req.name, req.symbol, supply, req.curveType ?? 0, req.metaHash],
  });
  return { txHash, token: LAUNCHPAD_ADDRESSES.launchpad }; // token addr recovered from receipt by caller
}

/**
 * Buy: Arc-native push. Step 1 pushes USDC (ERC-20 transfer, 6dp) to the
 * Launchpad; step 2 calls router.buy. Returns both tx hashes + the bought amount
 * (resolved from the Bought event on the buy receipt).
 */
export async function buy(req: TradeRequest): Promise<{ pushTx: Hash; buyTx: Hash; tokenOut: bigint }> {
  const usdIn = parseUnits(req.amountUsd, 6);
  const minOut = req.slippage != null ? await computeMinOut(req.token, usdIn, req.slippage) : 0n;

  const pushReq: TransferRequest = {
    provider: req.provider,
    from: req.account,
    to: LAUNCHPAD_ADDRESSES.launchpad,
    asset: "usdc",
    amount: req.amountUsd,
    chainId: ARC_CHAIN_ID,
  };
  const pushTx = await transferErc20(pushReq);

  const wc = walletClient(req.provider, req.account);
  const buyTx = await wc.writeContract({
    address: LAUNCHPAD_ADDRESSES.router,
    abi: LAUNCHPAD_ABI,
    functionName: "buy",
    args: [req.token, usdIn, minOut],
  });

  const c = publicClient(req.chainId ?? ARC_CHAIN_ID);
  const receipt = await c.waitForTransactionReceipt({ hash: buyTx });
  const tokenOut = parseBought(receipt.logs, req.token);
  return { pushTx, buyTx, tokenOut };
}

export async function sell(req: TradeRequest & { tokenAmount: bigint }): Promise<{ txHash: Hash; usdOut: bigint }> {
  const minUsdOut = req.slippage != null ? await computeMinUsdOut(req.token, req.tokenAmount, req.slippage) : 0n;
  const wc = walletClient(req.provider, req.account);
  const txHash = await wc.writeContract({
    address: LAUNCHPAD_ADDRESSES.router,
    abi: LAUNCHPAD_ABI,
    functionName: "sell",
    args: [req.token, req.tokenAmount, minUsdOut],
  });
  const c = publicClient(req.chainId ?? ARC_CHAIN_ID);
  const receipt = await c.waitForTransactionReceipt({ hash: txHash });
  const usdOut = parseSold(receipt.logs, req.token);
  return { txHash, usdOut };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function computeMinOut(token: Address, usdIn: bigint, slippage: number): Promise<bigint> {
  const out = (await quoteBuy(token, (Number(usdIn) / 1e6).toString())) as bigint;
  return (out * BigInt(Math.floor((1 - slippage) * 1e4))) / 10000n;
}

async function computeMinUsdOut(token: Address, tokenAmount: bigint, slippage: number): Promise<bigint> {
  const out = (await quoteSell(token, tokenAmount)) as bigint;
  return (out * BigInt(Math.floor((1 - slippage) * 1e4))) / 10000n;
}

function parseBought(logs: Log[], token: Address): bigint {
  for (const log of logs) {
    try {
      const d = decodeEventLog({ abi: LAUNCHPAD_EVENTS_ABI, data: log.data, topics: log.topics });
      if (d.eventName === "Bought" && (d.args as any).token?.toLowerCase() === token.toLowerCase()) {
        return (d.args as any).tokenOut as bigint;
      }
    } catch {
      /* ignore non-matching logs */
    }
  }
  return 0n;
}

function parseSold(logs: Log[], token: Address): bigint {
  for (const log of logs) {
    try {
      const d = decodeEventLog({ abi: LAUNCHPAD_EVENTS_ABI, data: log.data, topics: log.topics });
      if (d.eventName === "Sold" && (d.args as any).token?.toLowerCase() === token.toLowerCase()) {
        return (d.args as any).usdOut as bigint;
      }
    } catch {
      /* ignore */
    }
  }
  return 0n;
}

/** Encode createToken calldata (for estimation / custom flows). */
export function encodeCreateToken(args: [string, string, bigint, number, string]): `0x${string}` {
  return encodeFunctionData({
    abi: LAUNCHPAD_ABI,
    functionName: "createToken",
    args,
  });
}
