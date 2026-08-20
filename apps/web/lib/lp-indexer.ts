/**
 * Chargefi LP analytics indexer (Arc Testnet).
 *
 * ARCHITECTURE: mirrors lib/launchpad.ts — a single-process, self-contained
 * indexer with NO external DB and NO custody. It scans Uniswap-V2 `Swap` events
 * from each pool's pair contract via viem `getLogs`, aggregates real
 * volume + fees by day-bucket, and caches the result to `.data/lp-stats.json`.
 *
 * HONESTY: every number comes from on-chain events. When a window has no swap
 * activity (common on testnet), the API returns `null` so the UI shows "—"
 * rather than a fabricated APR/volume. We never hardcode or estimate volume.
 *
 * Re-sync is triggered lazily by the API and is bounded (a rolling window of
 * blocks) so it stays cheap. The cache is refreshed at most once per
 * `CACHE_TTL_MS`.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";
import {
  ARC_TESTNET_AMM,
  UNISWAP_V2_PAIR_ABI,
  getActivePools,
  getPoolById,
  type GraduatedToken,
  type LpPoolDef,
} from "@charge/chains";
import { listGraduatedTokens } from "@/lib/launchpad";

const DATA_DIR = join(process.cwd(), ".data");
const CACHE_FILE = join(DATA_DIR, "lp-stats.json");
const CACHE_TTL_MS = 60_000; // re-scan at most once per minute

// Rolling window to scan. Arc testnet block time is fast; 200k blocks (~a few
// days) is enough to populate 30d volume without an unbounded query.
const SCAN_BLOCKS = 200_000n;

const ARC_RPC =
  process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network/";

function client(): PublicClient {
  return createPublicClient({
    chain: {
      id: 5042002,
      name: "arc-testnet",
      rpcUrls: { default: { http: [ARC_RPC] } },
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    },
    transport: http(ARC_RPC),
  });
}

type DayBucket = {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  volumeA: number; // human tokenA units
  volumeB: number; // human tokenB units
  feesA: number; // human tokenA-equivalent fees (volumeA * feeBps/10000)
};

export interface PoolAnalytics {
  poolId: string;
  pair: Address;
  tvlA: number;
  reserveA: number;
  reserveB: number;
  totalSupply: number;
  feeBps: number;
  // Real volumes (null when no activity in the window)
  volume24hA: number | null;
  volume7dA: number | null;
  volume30dA: number | null;
  fees24hA: number | null;
  fees7dA: number | null;
  fees30dA: number | null;
  // Windowed Estimated Fee APR (null when no volume)
  feeApr24h: number | null;
  feeApr7d: number | null;
  feeApr30d: number | null;
  // 30-day daily buckets for charts (oldest → newest)
  history: DayBucket[];
  updatedAt: number;
}

function emptyAnalytics(pool: LpPoolDef, pair: Address, tvlA: number, reserveA: number, reserveB: number, totalSupply: number): PoolAnalytics {
  return {
    poolId: pool.id,
    pair,
    tvlA,
    reserveA,
    reserveB,
    totalSupply,
    feeBps: pool.feeBps,
    volume24hA: null,
    volume7dA: null,
    volume30dA: null,
    fees24hA: null,
    fees7dA: null,
    fees30dA: null,
    feeApr24h: null,
    feeApr7d: null,
    feeApr30d: null,
    history: [],
    updatedAt: Date.now(),
  };
}

function dayKey(tsMs: number): string {
  return new Date(tsMs).toISOString().slice(0, 10);
}

/** Aggregate Swap events for a single pool into day-bucketed volume + fees. */
async function scanPool(pool: LpPoolDef, pc: PublicClient): Promise<PoolAnalytics> {
  const pair = pool.pairAddress;
  // Read live reserves + supply for TVL.
  let tvlA = 0;
  let reserveA = 0;
  let reserveB = 0;
  let totalSupply = 0;
  try {
    const c = {
      address: pair,
      abi: UNISWAP_V2_PAIR_ABI,
      client: pc,
    } as const;
    const [reserves, supply] = await Promise.all([
      pc.readContract({ ...c, functionName: "getReserves" }) as Promise<[bigint, bigint, bigint]>,
      pc.readContract({ ...c, functionName: "totalSupply" }) as Promise<bigint>,
    ]);
    // Stables ~1:1, so TVL ≈ reserveA + reserveB in tokenA units.
    tvlA = Number(reserves[0]) / 1e6 + Number(reserves[1]) / 1e6;
    reserveA = Number(reserves[0]) / 1e6;
    reserveB = Number(reserves[1]) / 1e6;
    totalSupply = Number(supply) / 1e18;
  } catch {
    // pair may not exist yet for graduated pools; return empty analytics
  }

  if (pair === "0x0000000000000000000000000000000000000000") {
    return emptyAnalytics(pool, pair, tvlA, reserveA, reserveB, totalSupply);
  }

  const latest = Number(await pc.getBlockNumber());
  const from = latest > SCAN_BLOCKS ? latest - Number(SCAN_BLOCKS) : 0;

  let logs: { args: { amount0In: bigint; amount1In: bigint; amount0Out: bigint; amount1Out: bigint }; blockNumber: bigint }[] = [];
  try {
    logs = (await pc.getLogs({
      address: pair,
      event: {
        type: "event",
        name: "Swap",
        inputs: [
          { name: "sender", type: "address", indexed: true },
          { name: "amount0In", type: "uint256", indexed: false },
          { name: "amount1In", type: "uint256", indexed: false },
          { name: "amount0Out", type: "uint256", indexed: false },
          { name: "amount1Out", type: "uint256", indexed: false },
          { name: "to", type: "address", indexed: true },
        ],
        anonymous: false,
      },
      fromBlock: BigInt(from),
      toBlock: BigInt(latest),
    })) as unknown as typeof logs;
  } catch {
    // getLogs can fail on some RPCs for wide ranges; fall back to empty (null volume)
    return emptyAnalytics(pool, pair, tvlA, reserveA, reserveB, totalSupply);
  }

  if (logs.length === 0) {
    return emptyAnalytics(pool, pair, tvlA, reserveA, reserveB, totalSupply);
  }

  const dayBuckets = new Map<string, DayBucket>();
  const fee = pool.feeBps / 10_000;
  let totalVolA = 0;
  for (const log of logs) {
    const ts = Number(
      (await pc.getBlock({ blockNumber: log.blockNumber })).timestamp,
    ) * 1000;
    const d = dayKey(ts);
    const volA = Number(log.args.amount0In + log.args.amount0Out) / 1e6;
    const volB = Number(log.args.amount1In + log.args.amount1Out) / 1e6;
    const bucket =
      dayBuckets.get(d) ?? { date: d, volumeA: 0, volumeB: 0, feesA: 0 };
    bucket.volumeA += volA;
    bucket.volumeB += volB;
    bucket.feesA += volA * fee;
    dayBuckets.set(d, bucket);
    totalVolA += volA;
  }

  const history = [...dayBuckets.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const sumWindow = (days: number): number => {
    if (history.length === 0) return 0;
    const last = history[history.length - 1]!;
    const lastDate = new Date(last.date).getTime();
    return history
      .filter((h) => lastDate - new Date(h.date).getTime() <= days * 86_400_000)
      .reduce((s, h) => s + h.volumeA, 0);
  };

  const vol24 = sumWindow(1);
  const vol7 = sumWindow(7);
  const vol30 = sumWindow(30);
  const feeApr = (vol: number, days: number): number | null =>
    tvlA > 0 && vol > 0 ? ((vol * fee) / tvlA / days) * 365 * 100 : null;

  return {
    poolId: pool.id,
    pair,
    tvlA,
    reserveA,
    reserveB,
    totalSupply,
    feeBps: pool.feeBps,
    volume24hA: vol24 > 0 ? vol24 : null,
    volume7dA: vol7 > 0 ? vol7 : null,
    volume30dA: vol30 > 0 ? vol30 : null,
    fees24hA: vol24 > 0 ? vol24 * fee : null,
    fees7dA: vol7 > 0 ? vol7 * fee : null,
    fees30dA: vol30 > 0 ? vol30 * fee : null,
    feeApr24h: feeApr(vol24, 1),
    feeApr7d: feeApr(vol7, 7),
    feeApr30d: feeApr(vol30, 30),
    history,
    updatedAt: Date.now(),
  };
}

type CacheShape = Record<string, PoolAnalytics>;

function readCache(): CacheShape {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(data: CacheShape) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

/** Return analytics for every enabled pool, re-scanning if the cache is stale. */
export async function getAllPoolAnalytics(force = false): Promise<PoolAnalytics[]> {
  // Single source of truth: core pools + any graduated launchpad token that
  // now has a live TOKEN/USDC pair on the Arc AMM.
  const graduated = listGraduatedTokens() as GraduatedToken[];
  const active = await getActivePools(graduated);

  const cache = readCache();
  const now = Date.now();
  const fresh =
    !force &&
    existsSync(CACHE_FILE) &&
    Object.values(cache).every((v) => now - v.updatedAt < CACHE_TTL_MS) &&
    Object.keys(cache).length >= active.length;

  if (fresh) {
    return active.map(
      (p) => cache[p.id] ?? emptyAnalytics(p, p.pairAddress, 0, 0, 0, 0),
    );
  }

  const pc = client();
  const out: PoolAnalytics[] = [];
  for (const pool of active) {
    out.push(await scanPool(pool, pc));
  }
  const next = { ...cache };
  for (const a of out) next[a.poolId] = a;
  writeCache(next);
  return out;
}

/** Analytics for a single pool id. */
export async function getPoolAnalytics(poolId: string, force = false): Promise<PoolAnalytics | null> {
  const pool = getPoolById(poolId);
  if (!pool) return null;
  const all = await getAllPoolAnalytics(force);
  return all.find((a) => a.poolId === poolId) ?? null;
}
