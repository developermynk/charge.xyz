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

  // Approve both tokens to the router.
  for (const [token, amt] of [
    [metaA.address, amtA],
    [metaB.address, amtB],
  ] as const) {
    const allowance = (await pc.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [req.address, router],
    })) as bigint;
    if (allowance < amt) {
      const [h] = await wc.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [router, maxUint256],
        account: req.address,
      } as never);
      await waitReceipt(pc, h as string);
    }
  }

  const [hash] = await wc.writeContract({
    address: router,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "addLiquidity",
    args: [
      metaA.address,
      metaB.address,
      amtA,
      amtB,
      minA,
      minB,
      req.address,
      deadline,
    ],
    account: req.address,
  } as never);
  const receipt = await waitReceipt(pc, hash as string);
  return { txHash: receipt.transactionHash ?? (hash as string) };
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
  const pair = await pairAddress(req.tokenA, req.tokenB);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1_200);
  const slippage = req.slippageBps ?? 200;

  // Estimate the two output amounts from the user's share to set sane mins.
  const pos = await getLpPosition(req.tokenA, req.tokenB, req.address);
  const outA = (pos.reserve0 * liquidity) / pos.totalSupply;
  const outB = (pos.reserve1 * liquidity) / pos.totalSupply;
  const minA = (outA * BigInt(10000 - slippage)) / 10000n;
  const minB = (outB * BigInt(10000 - slippage)) / 10000n;

  const allowance = (await pc.readContract({
    address: pair,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [req.address, router],
  })) as bigint;
  if (allowance < liquidity) {
    const [h] = await wc.writeContract({
      address: pair,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [router, maxUint256],
      account: req.address,
    } as never);
    await waitReceipt(pc, h as string);
  }

  const [hash] = await wc.writeContract({
    address: router,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "removeLiquidity",
    args: [metaA.address, metaB.address, liquidity, minA, minB, req.address, deadline],
    account: req.address,
  } as never);
  const receipt = await waitReceipt(pc, hash as string);
  return { txHash: receipt.transactionHash ?? (hash as string) };
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
  if (tvlA <= 0 || volume24hA === null || volume24hA <= 0) return null;
  const fees24h = (volume24hA * ARC_AMM_FEE_BPS) / 10000;
  const dailyYield = fees24h / tvlA;
  return dailyYield * 365 * 100; // percent
}

/** Human-readable APY string, or "—" when no real volume exists. */
export function formatApy(apy: number | null): string {
  return apy === null ? "—" : `${apy.toFixed(2)}%`;
}

export { ARC_AMM_FEE_BPS };
