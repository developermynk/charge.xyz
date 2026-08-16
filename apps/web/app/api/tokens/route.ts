import { NextResponse } from "next/server";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Charge token-launch indexer (testnet).
 *
 * No external DB: launches are recorded to a local JSON file keyed by contract
 * address. This is intentionally the lightest possible store for a testnet
 * launcher — swap in a real DB (or on-chain registry) before mainnet.
 */

const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "launches.json");

type Launch = {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string | null;
  decimals: number;
  totalSupply: string;
  mintable: boolean;
  burnable: boolean;
  owner: string;
  socials?: { twitter?: string; telegram?: string; website?: string };
  poolSeeded?: boolean;
  createdAt: number;
};

function readAll(): Launch[] {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as Launch[];
  } catch {
    return [];
  }
}

function writeAll(rows: Launch[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2));
}

export async function GET() {
  const rows = readAll().sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ tokens: rows });
}

export async function POST(req: Request) {
  let body: Partial<Launch>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawAddress = typeof body.address === "string" ? body.address.toLowerCase() : "";
  const address = rawAddress;
  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid contract address" }, { status: 400 });
  }

  const rows = readAll();
  const idx = rows.findIndex((r) => r.address === address);
  const entry: Launch = {
    address,
    name: String(body.name ?? "Unknown").slice(0, 64),
    symbol: String(body.symbol ?? "???").toUpperCase().slice(0, 11),
    description: body.description?.slice(0, 280),
    image: body.image ?? null,
    decimals: Number(body.decimals ?? 18),
    totalSupply: String(body.totalSupply ?? "0"),
    mintable: Boolean(body.mintable),
    burnable: Boolean(body.burnable),
    owner: String(body.owner ?? ""),
    socials: body.socials ?? {},
    poolSeeded: Boolean(body.poolSeeded),
    createdAt: idx >= 0 ? (rows[idx]?.createdAt ?? Date.now()) : Date.now(),
  };

  if (idx >= 0) rows[idx] = entry;
  else rows.push(entry);
  writeAll(rows);

  return NextResponse.json({ ok: true, token: entry });
}
