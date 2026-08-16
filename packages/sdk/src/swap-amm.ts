/**
 * On-chain AMM swap path for Arc Testnet.
 *
 * Circle's Stablecoin Service aggregator currently has no seeded swap liquidity
 * on Arc Testnet, so `kit.swap` returns "No route available". Arc Testnet does
 * however have a live Uniswap V2 deployment (per Circle arc-node#160) with real
 * USDC/EURC reserves. This module routes Arc Testnet swaps directly through that
 * router via the user's wallet — no Circle key required, the user signs.
 *
 * Mainnets keep using Circle App Kit (`swap.ts`). This is only for chains where
 * `usesAmmSwap()` is true (currently Arc Testnet).
 */
import {
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  getContract,
  http,
  maxUint256,
  parseUnits,
} from "viem";
import {
  ARC_AMM_ROUTER_ABI,
  ARC_TESTNET_AMM,
  EVM_CHAIN_BY_SDK_ID,
  TOKEN_REGISTRY,
} from "@charge/chains";

const ROUTER_ABI = ARC_AMM_ROUTER_ABI;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export interface AmmSwapRequest {
  provider: EIP1193Provider;
  address: Address;
  chain: string; // "Arc_Testnet"
  tokenIn: string; // symbol, resolved via TOKEN_REGISTRY
  tokenOut: string;
  /** Optional ERC-20 address override (launched/custom tokens). */
  tokenInAddress?: `0x${string}`;
  tokenOutAddress?: `0x${string}`;
  /** Decimals for an address override (read on-chain by the caller). */
  tokenInDecimals?: number;
  tokenOutDecimals?: number;
  amountIn: string; // decimal string
  slippageBps?: number;
}

function tokenMeta(
  chain: string,
  symbol: string,
  override?: `0x${string}`,
  decimalsOverride?: number,
): { address: Address; decimals: number } {
  if (override) {
    const reg = TOKEN_REGISTRY[chain]?.[symbol];
    return {
      address: getAddress(override),
      decimals: decimalsOverride ?? reg?.decimals ?? 18,
    };
  }
  const reg = TOKEN_REGISTRY[chain];
  const entry = reg?.[symbol];
  if (!entry?.address) {
    throw new Error(`No token address for ${symbol} on ${chain}`);
  }
  return { address: getAddress(entry.address), decimals: entry.decimals ?? 18 };
}

function publicClientFor(chain: string): PublicClient {
  const def = EVM_CHAIN_BY_SDK_ID.get(chain);
  if (!def) throw new Error(`Unknown chain ${chain}`);
  return createPublicClient({
    chain: {
      id: def.chainId,
      name: def.name,
      nativeCurrency: { name: def.nativeSymbol, symbol: def.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [def.rpcUrl] } },
    },
    transport: http(),
  }) as PublicClient;
}

function walletClientFor(provider: EIP1193Provider, chain: string): WalletClient {
  const def = EVM_CHAIN_BY_SDK_ID.get(chain);
  if (!def) throw new Error(`Unknown chain ${chain}`);
  return createWalletClient({
    chain: {
      id: def.chainId,
      name: def.name,
      nativeCurrency: { name: def.nativeSymbol, symbol: def.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [def.rpcUrl] } },
    },
    transport: custom(provider),
  }) as WalletClient;
}

export async function quoteAmmSwap(req: AmmSwapRequest): Promise<{
  estimatedOutput: string;
  rate: string;
  tokenOut: string;
}> {
  const { address: tokenIn, decimals } = tokenMeta(
    req.chain,
    req.tokenIn,
    req.tokenInAddress,
    req.tokenInDecimals,
  );
  const { address: tokenOut } = tokenMeta(
    req.chain,
    req.tokenOut,
    req.tokenOutAddress,
    req.tokenOutDecimals,
  );
  if (tokenIn === tokenOut) throw new Error("Cannot swap a token for itself.");

  const pc = publicClientFor(req.chain);
  const amountIn = parseUnits(req.amountIn, decimals);

  const router = getContract({
    address: ARC_TESTNET_AMM.router as Address,
    abi: ROUTER_ABI,
    client: pc,
  });
  const amounts = (await router.read.getAmountsOut([amountIn, [tokenIn, tokenOut]])) as bigint[];
  const out = amounts[amounts.length - 1]!;

  const inNum = Number(req.amountIn);
  const outNum = Number(out) / 10 ** decimals;
  return {
    // Decimal string (matches Circle's SwapEstimate.estimatedOutput shape) so
    // the "You receive" box renders 0.352104, not the raw wei integer.
    estimatedOutput: outNum.toString(),
    rate: inNum > 0 ? (outNum / inNum).toFixed(6) : "0",
    tokenOut: req.tokenOut,
  };
}

export async function executeAmmSwap(req: AmmSwapRequest): Promise<{
  txHash: string;
  amountOut?: string;
}> {
  const { address: tokenIn, decimals } = tokenMeta(
    req.chain,
    req.tokenIn,
    req.tokenInAddress,
    req.tokenInDecimals,
  );
  const { address: tokenOut } = tokenMeta(
    req.chain,
    req.tokenOut,
    req.tokenOutAddress,
    req.tokenOutDecimals,
  );
  if (tokenIn === tokenOut) throw new Error("Cannot swap a token for itself.");

  const pc = publicClientFor(req.chain);
  const wc = walletClientFor(req.provider, req.chain);

  const amountIn = parseUnits(req.amountIn, decimals);

  // Quote min out with slippage.
  const router = getContract({
    address: ARC_TESTNET_AMM.router as Address,
    abi: ROUTER_ABI,
    client: pc,
  });
  const amounts = (await router.read.getAmountsOut([amountIn, [tokenIn, tokenOut]])) as bigint[];
  const expected = amounts[amounts.length - 1]!;
  const slippage = req.slippageBps ?? 50;
  const minOut = (expected * BigInt(10000 - slippage)) / 10000n;

  // Ensure allowance.
  const allowance = (await pc.readContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [req.address, ARC_TESTNET_AMM.router as Address],
  })) as bigint;
  if (allowance < amountIn) {
    const [approveHash] = (await wc.writeContract({
      address: tokenIn,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ARC_TESTNET_AMM.router as Address, maxUint256],
      account: req.address,
    } as never)) as unknown as [string];
    await pc.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const raw = (await wc.writeContract({
    address: ARC_TESTNET_AMM.router as Address,
    abi: ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, minOut, [tokenIn, tokenOut], req.address, deadline],
    account: req.address,
  } as never)) as string | [string];
  // viem's walletClient.writeContract returns the tx hash directly (string),
  // not a tuple — handle both shapes so we never emit an invalid hash.
  const swapHash = Array.isArray(raw) ? raw[0] : raw;
  await pc.waitForTransactionReceipt({ hash: swapHash as `0x${string}` });

  return { txHash: swapHash };
}
