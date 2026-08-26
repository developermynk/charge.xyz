/**
 * Liquidity-provision SDK for Chargefi's stable LP program on Arc Testnet.
 *
 * Arc runs a Uniswap V2 compatible AMM (router `ARC_TESTNET_AMM.router`,
 * verified as `UniswapV2Router02`). Users provide/remove liquidity to the
 * USDC/EURC and USDC/cirBTC pools and earn the AMM's 30 bps swap fee, which
 * accrues into the pool and raises the value of every LP token.
 *
 * No Chargefi contract is required for the core flow — the AMM mints/burns LP
 * tokens and accrues fees natively. This module wraps `addLiquidity` /
 * `removeLiquidity` + the read calls the UI needs (reserves, LP supply, your
 * position, share %, and an HONEST APY derived from real on-chain volume).
 *
 * APY honesty: we never hardcode a yield. `computeApy` uses
 * `(24h swap volume * feeBps) / TVL`. If there is no recent volume the UI
 * shows "—" rather than a fake number.
 */
import {
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  getAddress,
  getContract,
  http,
  maxUint256,
  parseUnits,
  formatUnits,
} from "viem";
import {
  ARC_AMM_FACTORY,
  ARC_AMM_FEE_BPS,
  ARC_TESTNET_AMM,
  EVM_CHAIN_BY_SDK_ID,
  TOKEN_REGISTRY,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V2_ROUTER_ABI,
  getPoolById,
} from "@charge/chains";
import {
  ERC20_ABI,
  publicClientFor,
  tokenMeta,
  waitReceipt,
  walletClientFor,
} from "./swap-amm.ts";

const CHAIN = "Arc_Testnet";

export interface LpRequest {
  provider: EIP1193Provider;
  address: Address;
  tokenA: string; // symbol, e.g. "USDC"
  tokenB: string; // symbol, e.g. "EURC"
  /** Human decimal amounts the user typed. */
  amountA: string;
  amountB: string;
  slippageBps?: number;
}

export interface LpPosition {
  pair: Address;
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  userBalance: bigint;
  /** User's share of the pool, 0..1. */
  share: number;
  /** TVL denominated in tokenA units (reserve0 + reserve1 priced 1:1 for stables). */
  tvlA: number;
  tokenADecimals: number;
  tokenBDecimals: number;
}

/** Resolve the pair address for a token pair via the factory. */
export async function pairAddress(
  tokenA: string,
  tokenB: string,
): Promise<Address> {
  const a = tokenMeta(CHAIN, tokenA).address;
  const b = tokenMeta(CHAIN, tokenB).address;
  const pc = publicClientFor(CHAIN);
  const factory = getContract({
    address: ARC_AMM_FACTORY as Address,
    abi: UNISWAP_V2_FACTORY_ABI,
    client: pc,
  });
  const pair = (await factory.read.getPair([a, b])) as Address;
  if (pair === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `No ${tokenA}/${tokenB} pool exists yet. Seed it first (Chargefi admin action).`,
    );
  }
  return pair;
}

/** Read a pool's reserves, LP supply, and the user's position. */
export async function getLpPosition(
  tokenA: string,
  tokenB: string,
  user: Address,
): Promise<LpPosition> {
  const pc = publicClientFor(CHAIN);
  const pair = await pairAddress(tokenA, tokenB);
  const c = getContract({
    address: pair,
    abi: UNISWAP_V2_PAIR_ABI,
    client: pc,
  });
  const [reserves, totalSupply, userBalance, token0, token1] = (await Promise.all([
    c.read.getReserves(),
    c.read.totalSupply(),
    c.read.balanceOf([user]),
    c.read.token0(),
    c.read.token1(),
  ])) as [
    [bigint, bigint, bigint],
    bigint,
    bigint,
    Address,
    Address,
  ];

  // Map reserve0/reserve1 to tokenA/tokenB by matching token0/token1.
  const metaA = tokenMeta(CHAIN, tokenA);
  const metaB = tokenMeta(CHAIN, tokenB);
  const aIsToken0 = getAddress(metaA.address) === getAddress(token0);
  const reserveA = aIsToken0 ? reserves[0] : reserves[1];
  const reserveB = aIsToken0 ? reserves[1] : reserves[0];

  const tvlA =
    Number(formatUnits(reserveA, metaA.decimals)) +
    Number(formatUnits(reserveB, metaB.decimals)); // stables ~1:1

  const share =
    totalSupply > 0n ? Number((userBalance * 10n ** 18n) / totalSupply) / 1e18 : 0;

  return {
    pair,
    token0,
    token1,
    reserve0: reserves[0],
    reserve1: reserves[1],
    totalSupply,
    userBalance,
    share,
    tvlA,
    tokenADecimals: metaA.decimals,
    tokenBDecimals: metaB.decimals,
  };
}

/**
 * Given an amount of tokenA, compute the required tokenB to add at the current
 * ratio (so the user doesn't get slipped on the deposit). Uses the router's
 * pure `quote` (amountB = amountA * reserveB / reserveA).
 */
export async function quoteDeposit(
  tokenA: string,
  tokenB: string,
  amountA: string,
): Promise<{ amountB: string; reserveA: string; reserveB: string }> {
  const pos = await getLpPosition(tokenA, tokenB, "0x0000000000000000000000000000000000000000" as Address);
  const metaA = tokenMeta(CHAIN, tokenA);
  const metaB = tokenMeta(CHAIN, tokenB);
  const aIsToken0 = getAddress(metaA.address) === getAddress(pos.token0);
  const reserveA = aIsToken0 ? pos.reserve0 : pos.reserve1;
  const reserveB = aIsToken0 ? pos.reserve1 : pos.reserve0;
  const amtA = parseUnits(amountA, metaA.decimals);
  // amountB = amtA * reserveB / reserveA
  const amtB = (amtA * reserveB) / reserveA;
  return {
    amountB: formatUnits(amtB, metaB.decimals),
    reserveA: formatUnits(reserveA, metaA.decimals),
    reserveB: formatUnits(reserveB, metaB.decimals),
  };
}

/** Provide liquidity: approve both tokens, addLiquidity, confirm. */
export async function provideLiquidity(
  req: LpRequest,
): Promise<{ txHash: string; liquidity?: string }> {
  const metaA = tokenMeta(CHAIN, req.tokenA);
  const metaB = tokenMeta(CHAIN, req.tokenB);
  const amtA = parseUnits(req.amountA, metaA.decimals);
  const amtB = parseUnits(req.amountB, metaB.decimals);
  if (amtA <= 0n || amtB <= 0n) throw new Error("Enter an amount greater than zero.");

  const pc = publicClientFor(CHAIN);
  const wc = walletClientFor(req.provider, CHAIN);
  const router = ARC_TESTNET_AMM.router as Address;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1_200);
  const slippage = req.slippageBps ?? 50;
  const minA = (amtA * BigInt(10000 - slippage)) / 10000n;
  const minB = (amtB * BigInt(10000 - slippage)) / 10000n;

  // The router SORTS the pair to (token0, token1); addLiquidity enforces
  // amountAMin/amountBMin against the SORTED output. Pass tokens + mins in
  // sorted order so they line up regardless of which symbol is token0.
  const pair = await pairAddress(req.tokenA, req.tokenB);
  const pos = await getLpPosition(req.tokenA, req.tokenB, "0x0000000000000000000000000000000000000000" as Address);
  const aIsToken0 = getAddress(metaA.address) === getAddress(pos.token0);
  const [tok0, tok1, amt0, amt1, min0, min1] = aIsToken0
    ? [metaA.address, metaB.address, amtA, amtB, minA, minB]
    : [metaB.address, metaA.address, amtB, amtA, minB, minA];

  // Approve both tokens to the router (in sorted order).
  for (const [token, amt] of [
    [tok0, amt0],
    [tok1, amt1],
  ] as const) {
    const allowance = (await pc.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [req.address, router],
    })) as bigint;
    if (allowance < amt) {
      const approveHash = await wc.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [router, maxUint256],
        account: req.address,
      } as never);
      await waitReceipt(pc, approveHash as string);
    }
  }

  // Re-read reserves FRESH right before the on-chain call to eliminate
  // stale-reserve slippage reverts.
  const fresh = await pc.readContract({
    address: pair,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: "getReserves",
  });
  const freshReserve0 = fresh[0], freshReserve1 = fresh[1];
  const freshTotal = await pc.readContract({
    address: pair,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: "totalSupply",
  });
  const fReserveA = aIsToken0 ? freshReserve0 : freshReserve1;
  const fReserveB = aIsToken0 ? freshReserve1 : freshReserve0;
  // Recompute expected outputs and mins from fresh state.
  const fAmt0 = aIsToken0 ? amtA : amtB;
  const fAmt1 = aIsToken0 ? amtB : amtA;
  const outA = (fReserveA * fAmt0) / freshTotal;
  const outB = (fReserveB * fAmt1) / freshTotal;
  const fMinA = (outA * BigInt(10000 - slippage)) / 10000n;
  const fMinB = (outB * BigInt(10000 - slippage)) / 10000n;
  const fMin0 = aIsToken0 ? fMinA : fMinB;
  const fMin1 = aIsToken0 ? fMinB : fMinA;

  const raw = await wc.writeContract({
    address: router,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "addLiquidity",
    args: [
      tok0,
      tok1,
      amt0,
      amt1,
      fMin0,
      fMin1,
      req.address,
      deadline,
    ],
    account: req.address,
  } as never);
  // viem's walletClient.writeContract returns the tx hash directly (string),
  // not a tuple — handle both shapes so we never emit an invalid hash.
  const addHash = Array.isArray(raw) ? raw[0] : raw;
  const receipt = await waitReceipt(pc, addHash as string);
  return { txHash: receipt.transactionHash ?? (addHash as string) };
}

/** Remove liquidity: approve the pair LP token, removeLiquidity, confirm. */
export async function removeLiquidity(
  req: LpRequest,
): Promise<{ txHash: string }> {
  const metaA = tokenMeta(CHAIN, req.tokenA);
  const metaB = tokenMeta(CHAIN, req.tokenB);
  const liquidity = parseUnits(req.amountA, 18); // LP token is 18dp
  if (liquidity <= 0n) throw new Error("Enter an amount greater than zero.");

  const pc = publicClientFor(CHAIN);
  const wc = walletClientFor(req.provider, CHAIN);
  const router = ARC_TESTNET_AMM.router as Address;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1_200);
  const slippage = req.slippageBps ?? 200;

  // The router SORTS the pair to (token0, token1) and returns amount0/amount1
  // in that order, enforcing amountAMin <= amount0Out and amountBMin <=
  // amount1Out. So we must pass the tokens in sorted order and derive the min
  // amounts from the SORTED reserves — otherwise reserve0 maps to the wrong
  // token and the router reverts ("pool ratio changed").
  const pos = await getLpPosition(req.tokenA, req.tokenB, req.address);
  const aIsToken0 = getAddress(metaA.address) === getAddress(pos.token0);
  const reserve0 = aIsToken0 ? pos.reserve0 : pos.reserve1;
  const reserve1 = aIsToken0 ? pos.reserve1 : pos.reserve0;
  let outA = (reserve0 * liquidity) / pos.totalSupply;
  let outB = (reserve1 * liquidity) / pos.totalSupply;
  let minA = (outA * BigInt(10000 - slippage)) / 10000n;
  let minB = (outB * BigInt(10000 - slippage)) / 10000n;

  // Pass tokens to the router in sorted (token0, token1) order.
  const [tok0, tok1, min0, min1] = aIsToken0
    ? [metaA.address, metaB.address, minA, minB]
    : [metaB.address, metaA.address, minB, minA];

  const pair = await pairAddress(req.tokenA, req.tokenB);

  const allowance = (await pc.readContract({
    address: pair,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [req.address, router],
  })) as bigint;
  if (allowance < liquidity) {
    const approveHash = await wc.writeContract({
      address: pair,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [router, maxUint256],
      account: req.address,
    } as never);
    await waitReceipt(pc, approveHash as string);
  }

  // Re-read reserves FRESH right before the on-chain call to eliminate
  // stale-reserve slippage reverts ("pool ratio changed").
  const fresh = await pc.readContract({
    address: pair,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: "getReserves",
  });
  const freshReserve0 = fresh[0], freshReserve1 = fresh[1];
  const freshTotal = await pc.readContract({
    address: pair,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: "totalSupply",
  });
  const fReserveA = aIsToken0 ? freshReserve0 : freshReserve1;
  const fReserveB = aIsToken0 ? freshReserve1 : freshReserve0;
  outA = (fReserveA * liquidity) / freshTotal;
  outB = (fReserveB * liquidity) / freshTotal;
  minA = (outA * BigInt(10000 - slippage)) / 10000n;
  minB = (outB * BigInt(10000 - slippage)) / 10000n;
  const fMin0 = aIsToken0 ? minA : minB;
  const fMin1 = aIsToken0 ? minB : minA;

  const raw = await wc.writeContract({
    address: router,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "removeLiquidity",
    args: [tok0, tok1, liquidity, fMin0, fMin1, req.address, deadline],
    account: req.address,
  } as never);
  const removeHash = Array.isArray(raw) ? raw[0] : raw;
  const receipt = await waitReceipt(pc, removeHash as string);
  return { txHash: receipt.transactionHash ?? (removeHash as string) };
}

/** Snapshot of a pool's on-chain state (reserves, LP supply, TVL). */
export interface PoolStats {
  poolId: string;
  pair: Address;
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  tvlA: number; // TVL denominated in tokenA units (stables ~1:1)
  tokenADecimals: number;
  tokenBDecimals: number;
}

/** Resolve a pool definition by id into its canonical on-chain state. */
export async function getPool(poolId: string): Promise<PoolStats> {
  const def = getPoolById(poolId);
  if (!def) throw new Error(`Unknown pool: ${poolId}`);
  const pos = await getLpPosition(def.tokenA, def.tokenB, "0x0000000000000000000000000000000000000000" as Address);
  return {
    poolId,
    pair: pos.pair,
    token0: pos.token0,
    token1: pos.token1,
    reserve0: pos.reserve0,
    reserve1: pos.reserve1,
    totalSupply: pos.totalSupply,
    tvlA: pos.tvlA,
    tokenADecimals: pos.tokenADecimals,
    tokenBDecimals: pos.tokenBDecimals,
  };
}

/** Alias of getPool for API/UI symmetry (per spec: GET /api/pools/:pair/stats). */
export const getPoolStats = getPool;

/** User's LP position for a pool (LP balance, share %, position value). */
export async function getUserPosition(
  poolId: string,
  user: Address,
): Promise<LpPosition> {
  const def = getPoolById(poolId);
  if (!def) throw new Error(`Unknown pool: ${poolId}`);
  return getLpPosition(def.tokenA, def.tokenB, user);
}

/**
 * Given an amount of LP tokens the user wants to remove, compute the tokenA/tokenB
 * they will receive at the current reserve ratio, with slippage-protected minimums.
 * Returns human-decimal strings for the UI plus the raw LP amount to pass on-chain.
 */
export async function quoteRemoveLiquidity(
  tokenA: string,
  tokenB: string,
  lpAmount: string,
  user: Address,
  slippageBps = 50,
): Promise<{
  lpRaw: bigint;
  amountA: string;
  amountB: string;
  minA: string;
  minB: string;
}> {
  const metaA = tokenMeta(CHAIN, tokenA);
  const metaB = tokenMeta(CHAIN, tokenB);
  const liquidity = parseUnits(lpAmount, 18); // LP token is 18dp
  if (liquidity <= 0n) throw new Error("Enter an amount greater than zero.");
  const pos = await getLpPosition(tokenA, tokenB, user);
  const outA = (pos.reserve0 * liquidity) / pos.totalSupply;
  const outB = (pos.reserve1 * liquidity) / pos.totalSupply;
  const minA = (outA * BigInt(10000 - slippageBps)) / 10000n;
  const minB = (outB * BigInt(10000 - slippageBps)) / 10000n;
  return {
    lpRaw: liquidity,
    amountA: formatUnits(outA, metaA.decimals),
    amountB: formatUnits(outB, metaB.decimals),
    minA: formatUnits(minA, metaA.decimals),
    minB: formatUnits(minB, metaB.decimals),
  };
}

/**
 * Windowed, HONEST Estimated Fee APR.
 * `volumeA` must be REAL swap volume (in tokenA units) over the window.
 * `days` scales the daily yield to the requested window (7/30 preferred — 24h is noisy).
 * Returns null when there is no volume (UI shows "—", never a fabricated yield).
 */
export function computeApyForWindow(
  tvlA: number,
  volumeA: number | null,
  days: number,
): number | null {
  if (tvlA <= 0 || volumeA === null || volumeA <= 0) return null;
  const fees = (volumeA * ARC_AMM_FEE_BPS) / 10000;
  const windowYield = fees / tvlA; // fraction of TVL earned over the window
  return (windowYield / days) * 365 * 100; // annualized percent
}

/**
 * HONEST APY: (24h swap volume in tokenA * feeBps/10000) / TVL, annualized
 * (×365). `volume24hA` must come from real Swap-event volume on the pair.
 * Returns null when there is no volume (UI shows "—", never a fabricated yield).
 */
export function computeApy(
  tvlA: number,
  volume24hA: number | null,
): number | null {
  return computeApyForWindow(tvlA, volume24hA, 1);
}

/** Human-readable APY string, or "—" when no real volume exists. */
export function formatApy(apy: number | null): string {
  return apy === null ? "—" : `${apy.toFixed(2)}%`;
}

export { ARC_AMM_FEE_BPS };
