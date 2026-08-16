/**
 * Charge Launchpad — backend store + on-demand indexer (Arc Testnet).
 *
 * ARCHITECTURE (Decision D3): a Repository interface with a JSON-file adapter so
 * it runs locally with zero infra. A Postgres/Prisma adapter can implement the
 * same interface for production scale (see docs/launchpad-backend.md).
 *
 * INDEXING: rather than a separate long-running daemon, `syncFromChain()` is
 * invoked lazily by the API. It scans Launchpad events from a checkpoint block
 * and upserts tokens + trades into the store. This keeps the app single-process
 * and local-only while still recording every on-chain trade.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  http,
  decodeEventLog,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { arcTestnet } from "@charge/chains";

import {
  LAUNCHPAD_ADDRESSES,
  LAUNCHPAD_ABI,
  LAUNCHPAD_EVENTS_ABI,
} from "@charge/sdk";

const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "launchpad.json");
const CHECKPOINT_FILE = join(DATA_DIR, "launchpad-checkpoint.json");

/** Block the Launchpad was deployed at on Arc Testnet (verified via getLogs). */
const SYNC_START_BLOCK = 57_307_400n;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface LaunchpadToken {
  address: Address;
  name: string;
  symbol: string;
  creator: Address;
  metaHash: string;
  totalSupply: string; // human
  curveType: number;
  createdAt: number; // epoch ms
  graduated: boolean;
  // live (from chain)
  priceUsd: number; // human USDC per token
  marketCapUsd: number;
  volumeUsd: number;
  liquidityUsd: number;
  holders: number;
}

export interface Trade {
  token: Address;
  trader: Address;
  side: "buy" | "sell";
  usd: number; // human USDC
  tokenAmount: number; // human tokens
  priceUsd: number;
  txHash: Hash;
  blockNumber: number;
  timestamp: number;
}

export interface Candle {
  t: number; // bucket start (epoch ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // volume USD
}

/** Minimal ERC-20 metadata ABI used to backfill token details on indexing. */
const ERC20_META_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

// ── Repository interface (Postgres adapter implements the same shape) ───────────
export interface LaunchpadRepository {
  getToken(a: Address): LaunchpadToken | undefined;
  listTokens(): LaunchpadToken[];
  upsertToken(t: LaunchpadToken): void;
  addTrade(t: Trade): void;
  tradesFor(a: Address): Trade[];
  allTrades(): Trade[];
  checkpoint(): bigint;
  setCheckpoint(b: bigint): void;
}

// ── JSON-file adapter ───────────────────────────────────────────────────────────
class JsonStore implements LaunchpadRepository {
  private tokens = new Map<string, LaunchpadToken>();
  private trades: Trade[] = [];
  private cp = SYNC_START_BLOCK;

  constructor() {
    this.load();
  }

  private load() {
    mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(DATA_FILE)) {
      try {
        const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
        (data.tokens ?? []).forEach((t: LaunchpadToken) => this.tokens.set(t.address.toLowerCase(), t));
        this.trades = data.trades ?? [];
      } catch {
        /* corrupt file: start fresh */
      }
    }
    if (existsSync(CHECKPOINT_FILE)) {
      try {
        this.cp = BigInt(JSON.parse(readFileSync(CHECKPOINT_FILE, "utf8")).block);
      } catch {
        /* keep default */
      }
    }
  }

  private flush() {
    writeFileSync(
      DATA_FILE,
      JSON.stringify({ tokens: [...this.tokens.values()], trades: this.trades }, null, 2),
    );
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({ block: this.cp.toString() }));
  }

  getToken(a: Address) {
    return this.tokens.get(a.toLowerCase());
  }
  listTokens() {
    return [...this.tokens.values()];
  }
  upsertToken(t: LaunchpadToken) {
    this.tokens.set(t.address.toLowerCase(), t);
    this.flush();
  }
  addTrade(t: Trade) {
    this.trades.push(t);
    if (this.trades.length > 50000) this.trades = this.trades.slice(-50000); // cap memory
    this.flush();
  }
  tradesFor(a: Address) {
    return this.trades.filter((t) => t.token.toLowerCase() === a.toLowerCase());
  }
  allTrades() {
    return this.trades;
  }
  checkpoint() {
    return this.cp;
  }
  setCheckpoint(b: bigint) {
    this.cp = b;
    this.flush();
  }
}

let _store: JsonStore | null = null;
export function store(): JsonStore {
  if (!_store) _store = new JsonStore();
  return _store;
}

// ── On-chain client ──────────────────────────────────────────────────────────
const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const ROUTER = LAUNCHPAD_ADDRESSES.router as Address;
const LAUNCHPAD = LAUNCHPAD_ADDRESSES.launchpad as Address;

/**
 * Sync Launchpad events from the checkpoint to the latest block. Idempotent:
 * re-running only processes new logs and upserts. Resolves on-chain live fields
 * for every known token at the end.
 */
export async function syncFromChain(): Promise<{ tokens: number; trades: number }> {
  const s = store();
  const latest = await client.getBlockNumber();
  let from = s.checkpoint();
  if (from > latest) return { tokens: 0, trades: 0 };

  const BATCH = 5_000n;
  let tokens = 0;
  let trades = 0;
  const FACTORY = LAUNCHPAD_ADDRESSES.factory as Address;

  while (from <= latest) {
    const to = from + BATCH > latest ? latest : from + BATCH - 1n;
    const logs = await client.getLogs({
      address: [LAUNCHPAD, ROUTER, FACTORY],
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const r = applyLog(s, log);
      if (r === "token") tokens++;
      else if (r === "trade") trades++;
    }
    from = to + 1n;
  }

  s.setCheckpoint(latest + 1n);

  // refresh live fields for all known tokens
  for (const t of s.listTokens()) {
    await refreshLive(t);
  }
  return { tokens, trades };
}

interface LaunchpadEventArgs {
  token?: `0x${string}`;
  creator?: `0x${string}`;
  name_?: string;
  symbol_?: string;
  metaHash?: string;
  totalSupply?: bigint;
  curveType?: number;
  trader?: `0x${string}`;
  usdIn?: bigint;
  usdOut?: bigint;
  tokenOut?: bigint;
  tokenIn?: bigint;
  priceUsd?: bigint;
}

function applyLog(s: JsonStore, log: Log): "token" | "trade" | null {
  try {
    const d = decodeEventLog({ abi: LAUNCHPAD_EVENTS_ABI, data: log.data, topics: log.topics });
    const args = d.args as LaunchpadEventArgs;
    if (d.eventName === "TokenCreated") {
      s.upsertToken({
        address: args.token!,
        name: args.name_ ?? "",
        symbol: args.symbol_ ?? "",
        creator: args.creator!,
        metaHash: args.metaHash ?? "",
        totalSupply: (BigInt(args.totalSupply ?? 0n) / 10n ** 18n).toString(),
        curveType: Number(args.curveType ?? 0),
        createdAt: Date.now(),
        graduated: false,
        priceUsd: 0,
        marketCapUsd: 0,
        volumeUsd: 0,
        liquidityUsd: 0,
        holders: 0,
      });
      return "token";
    }
    if (d.eventName === "Bought" || d.eventName === "Sold") {
      const token = args.token!;
      // Index the token from trade activity (robust to Factory TokenCreated
      // ABI drift): if we haven't seen it, backfill metadata on-chain.
      if (!s.getToken(token)) {
        ensureToken(s, token).catch(() => {});
      }
      s.addTrade({
        token,
        trader: args.trader!,
        side: d.eventName === "Bought" ? "buy" : "sell",
        usd: Number(BigInt(args.usdIn ?? args.usdOut ?? 0n)) / 1e6,
        tokenAmount: Number(BigInt(args.tokenOut ?? args.tokenIn ?? 0n)) / 1e18,
        priceUsd: Number(BigInt(args.priceUsd ?? 0n)) / 1e6,
        txHash: (log.transactionHash ?? "0x") as Hash,
        blockNumber: Number(log.blockNumber ?? 0),
        timestamp: Date.now(),
      });
      return "trade";
    }
  } catch {
    /* non-launchpad log */
  }
  return null;
}

/** Backfill a token's metadata from on-chain views (Launchpad + ERC-20). */
async function ensureToken(s: JsonStore, token: Address) {
  const [creator, createdAt, name, symbol, totalSupply, graduated] = await Promise.all([
    client.readContract({ address: LAUNCHPAD, abi: LAUNCHPAD_ABI, functionName: "creatorOf", args: [token] }) as Promise<Address>,
    client.readContract({ address: LAUNCHPAD, abi: LAUNCHPAD_ABI, functionName: "createdAt", args: [token] }) as Promise<bigint>,
    client.readContract({ address: token, abi: ERC20_META_ABI, functionName: "name" }) as Promise<string>,
    client.readContract({ address: token, abi: ERC20_META_ABI, functionName: "symbol" }) as Promise<string>,
    client.readContract({ address: token, abi: ERC20_META_ABI, functionName: "totalSupply" }) as Promise<bigint>,
    client.readContract({ address: LAUNCHPAD, abi: LAUNCHPAD_ABI, functionName: "isGraduated", args: [token] }) as Promise<boolean>,
  ]);
  const created = Number(createdAt) > 0 ? Number(createdAt) * 1000 : Date.now();
  s.upsertToken({
    address: token,
    name,
    symbol,
    creator,
    metaHash: "",
    totalSupply: (totalSupply / 10n ** 18n).toString(),
    curveType: 0,
    createdAt: created,
    graduated,
    priceUsd: 0,
    marketCapUsd: 0,
    volumeUsd: 0,
    liquidityUsd: 0,
    holders: 0,
  });
}

async function refreshLive(t: LaunchpadToken) {
  // Read each view independently — a single reverting getter must not zero out
  // the others (getLiquidity/getHolders can revert on fresh curves).
  type AnyRead = (args: {
    address: `0x${string}`;
    abi: typeof LAUNCHPAD_ABI;
    functionName: string;
    args: `0x${string}`[];
  }) => Promise<bigint>;
  const reader = client.readContract as unknown as AnyRead;
  const read = (fn: string) =>
    reader({ address: LAUNCHPAD, abi: LAUNCHPAD_ABI, functionName: fn, args: [t.address] })
      .then((v: bigint) => Number(v))
      .catch(() => 0);
  const [price, mcap, vol, liq, holders] = await Promise.all([
    read("getPrice"),
    read("getMarketCap"),
    read("getVolume"),
    read("getLiquidity"),
    read("getHolders"),
  ]);
  const grad = await client
    .readContract({ address: LAUNCHPAD, abi: LAUNCHPAD_ABI, functionName: "isGraduated", args: [t.address] })
    .then((v) => Boolean(v))
    .catch(() => t.graduated);
  t.priceUsd = price / 1e6;
  t.marketCapUsd = mcap / 1e6;
  t.volumeUsd = vol / 1e6;
  t.liquidityUsd = liq / 1e6;
  t.holders = holders;
  t.graduated = grad;
  store().upsertToken(t);
}

// ── Query helpers (used by API routes) ─────────────────────────────────────────
export type SortKey = "newest" | "trending" | "volume" | "marketCap";

export function discover(opts: { sort?: SortKey; page?: number; pageSize?: number; q?: string } = {}) {
  const s = store();
  let rows = s.listTokens();
  if (opts.q) {
    const q = opts.q.toLowerCase();
    rows = rows.filter(
      (t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q),
    );
  }
  const sort = opts.sort ?? "newest";
  rows.sort((a, b) => {
    if (sort === "newest") return b.createdAt - a.createdAt;
    if (sort === "trending") return b.volumeUsd - a.volumeUsd; // simplified trending
    if (sort === "volume") return b.volumeUsd - a.volumeUsd;
    return b.marketCapUsd - a.marketCapUsd;
  });
  const pageSize = opts.pageSize ?? 24;
  const page = opts.page ?? 1;
  const start = (page - 1) * pageSize;
  return {
    total: rows.length,
    page,
    pageSize,
    tokens: rows.slice(start, start + pageSize),
  };
}

export function candles(token: Address, bucketMs = 60_000): Candle[] {
  const trades = store()
    .tradesFor(token)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!trades.length) return [];
  const buckets = new Map<number, Trade[]>();
  for (const t of trades) {
    const key = Math.floor(t.timestamp / bucketMs) * bucketMs;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(t);
  }
  const out: Candle[] = [];
  for (const [t, ts] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const prices = ts.map((x) => x.priceUsd);
    out.push({
      t,
      o: prices[0]!,
      h: Math.max(...prices),
      l: Math.min(...prices),
      c: prices[prices.length - 1]!,
      v: ts.reduce((s, x) => s + x.usd, 0),
    });
  }
  return out;
}
