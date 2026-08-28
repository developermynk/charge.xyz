/**
 * Server-side CCTP bridge watcher.
 *
 * Confirms each transfer end-to-end via on-chain events: the source chain's
 * MessageTransmitter `MessageSent` (burn landed) and the destination chain's
 * `MessageReceived` (mint confirmed). Read-only (getLogs), no keys, no signing.
 *
 * NOTE: Arc Testnet is CCTP domain 26 and Circle's public IRIS attestation API
 * does not index Arc-origin burns (circlefin/evm-cctp-contracts#110), so we
 * verify on the destination chain instead of polling IRIS.
 */

import { createPublicClient, http, type PublicClient, type Hash, type Log } from "viem";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import {
  EVM_CHAIN_BY_SDK_ID,
  CCTP_MESSAGE_TRANSMITTER_V2,
  CCTP_DOMAIN_BY_SDK_ID,
  type BridgeStage,
} from "@charge/chains";

// Event topics (CCTP v2, stable across deployments).
// MessageSent(bytes message); MessageReceived(bytes message);
const MESSAGE_SENT_TOPIC =
  "0x8c5261668696ce22758910d05bab8f186d6ebc765cd5cdfd9611d09ee8649da3" as const;
const MESSAGE_RECEIVED_TOPIC =
  "0x9d3d9a2155f19e0fd0019809ec1a0273177f7c557b5cb63762fccc2c92abdf28" as const;

const MESSAGE_TRANSMITTER_ABI = [
  {
    type: "event",
    name: "MessageSent",
    inputs: [{ name: "message", type: "bytes", indexed: false }],
    anonymous: false,
  },
  {
    type: "event",
    name: "MessageReceived",
    inputs: [{ name: "message", type: "bytes", indexed: false }],
    anonymous: false,
  },
] as const;

export interface BridgeEntry {
  hash: string;
  fromChain: string;
  toChain: string;
  amount?: string;
  stage: BridgeStage;
  fromDomain?: number;
  toDomain?: number;
  destinationTxHash?: string;
  toMessageHash?: string;
  updatedAt: number;
  note?: string;
}

// --- /tmp store (Vercel serverless = ephemeral FS; same pattern as history route) ---
const STORE_DIR = "/tmp/charge-bridge";
const storeFile = (hash: string) => `${STORE_DIR}/${hash.toLowerCase()}.json`;

function readEntry(hash: string): BridgeEntry | null {
  try {
    const raw = readFileSync(storeFile(hash), "utf8");
    return JSON.parse(raw) as BridgeEntry;
  } catch {
    return null;
  }
}

function writeEntry(entry: BridgeEntry) {
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(storeFile(entry.hash), JSON.stringify(entry, null, 2));
}

const clientCache = new Map<string, PublicClient>();
function clientFor(sdkId: string): PublicClient | null {
  const cached = clientCache.get(sdkId);
  if (cached) return cached;
  const def = EVM_CHAIN_BY_SDK_ID.get(sdkId);
  if (!def) return null;
  const client = createPublicClient({
    chain: {
      id: def.chainId,
      name: def.name,
      nativeCurrency: { name: def.nativeSymbol, symbol: def.nativeSymbol, decimals: 18 },
      rpcUrls: { default: { http: [def.rpcUrl] } },
    },
    transport: http(def.rpcUrl),
  });
  clientCache.set(sdkId, client);
  return client;
}

/** Pull the source nonce (first 4 bytes of the message) to correlate burn→mint. */
function messageNonce(message: string): string | undefined {
  // CCTP message layout (v2): version(4) sourceDomain(4) destinationDomain(4) nonce(8) ...
  try {
    const hex = message.replace(/^0x/, "");
    if (hex.length < 32) return undefined;
    return hex.slice(16, 32); // 8 bytes after the two 4-byte domain fields
  } catch {
    return undefined;
  }
}

async function checkSource(client: PublicClient, hash: string): Promise<{ burned: boolean; message?: string }> {
  try {
    const logs = (await client.getLogs({
      address: undefined,
      events: MESSAGE_TRANSMITTER_ABI,
      fromBlock: "earliest" as never,
      toBlock: "latest" as never,
    })) as Log[];
    const receipt = await client.getTransactionReceipt({ hash: hash as Hash });
    const relevant = logs.filter(
      (l) => l.transactionHash?.toLowerCase() === hash.toLowerCase(),
    );
    const sent = relevant.find(
      (l) => (l.topics?.[0] ?? "").toLowerCase() === MESSAGE_SENT_TOPIC,
    );
    if (sent) {
      const decoded = sent as unknown as { args?: { message?: string } };
      return { burned: true, message: decoded.args?.message };
    }
    void receipt;
    return { burned: false };
  } catch {
    return { burned: false };
  }
}

async function checkDestination(
  client: PublicClient,
  transmitter: `0x${string}`,
  nonce: string,
): Promise<{ minted: boolean; hash?: string }> {
  try {
    const logs = (await client.getLogs({
      address: transmitter,
      events: MESSAGE_TRANSMITTER_ABI,
      fromBlock: "earliest" as never,
      toBlock: "latest" as never,
    })) as Log[];
    const received = logs.filter(
      (l) => (l.topics?.[0] ?? "").toLowerCase() === MESSAGE_RECEIVED_TOPIC,
    );
    const match = received.find((l) => {
      const decoded = l as unknown as { args?: { message?: string } };
      const n = decoded.args?.message ? messageNonce(decoded.args.message) : undefined;
      return n === nonce;
    });
    if (match) return { minted: true, hash: match.transactionHash ?? undefined };
    return { minted: false };
  } catch {
    return { minted: false };
  }
}

export async function trackBridge(input: {
  hash: `0x${string}`;
  fromChain: string;
  toChain: string;
  amount?: string;
}): Promise<BridgeEntry> {
  const existing = readEntry(input.hash);
  if (existing) return existing;

  const entry: BridgeEntry = {
    hash: input.hash,
    fromChain: input.fromChain,
    toChain: input.toChain,
    amount: input.amount,
    stage: "await_burn",
    fromDomain: CCTP_DOMAIN_BY_SDK_ID[input.fromChain],
    toDomain: CCTP_DOMAIN_BY_SDK_ID[input.toChain],
    updatedAt: Date.now(),
  };
  writeEntry(entry);
  void refresh(entry);
  return entry;
}

export async function getBridgeStatus(hash: string): Promise<BridgeEntry | null> {
  const entry = readEntry(hash);
  if (!entry) return null;
  if (entry.stage === "minted" || entry.stage === "failed") return entry;
  return refresh(entry);
}

export async function listActiveBridges(): Promise<BridgeEntry[]> {
  try {
    if (!existsSync(STORE_DIR)) return [];
    return readdirSync(STORE_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(`${STORE_DIR}/${f}`, "utf8")) as BridgeEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is BridgeEntry => x !== null)
      .filter((e) => e.stage !== "minted" && e.stage !== "failed")
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function refresh(entry: BridgeEntry): Promise<BridgeEntry> {
  const fromClient = clientFor(entry.fromChain);
  if (!fromClient) {
    entry.note = `Unsupported source chain ${entry.fromChain}`;
    entry.stage = "failed";
    writeEntry(entry);
    return entry;
  }

  if (entry.stage === "await_burn") {
    const src = await checkSource(fromClient, entry.hash);
    if (!src.burned) {
      entry.updatedAt = Date.now();
      writeEntry(entry);
      return entry; // still waiting for burn to land
    }
    entry.stage = "burned";
    (entry as BridgeEntry & { _message?: string })._message = src.message;
    writeEntry(entry);
  }

  const transmitter = CCTP_MESSAGE_TRANSMITTER_V2[entry.toChain];
  const message = (entry as BridgeEntry & { _message?: string })._message;
  const nonce = message ? messageNonce(message) : undefined;

  if (!transmitter || !nonce) {
    // Burn confirmed and attestation in flight, but we can't verify the
    // destination without a transmitter address or nonce. Keep it as "attesting"
    // rather than failing — the mint may still land client-side.
    entry.stage = "attesting";
    entry.note = transmitter
      ? "Attestation in flight — finality on destination chain."
      : "Destination MessageTransmitter address unknown; awaiting client mint.";
    entry.updatedAt = Date.now();
    writeEntry(entry);
    return entry;
  }

  const destClient = clientFor(entry.toChain);
  if (!destClient) {
    entry.note = `Unsupported destination chain ${entry.toChain}`;
    entry.stage = "failed";
    writeEntry(entry);
    return entry;
  }

  entry.stage = "attesting";
  const dst = await checkDestination(destClient, transmitter, nonce);
  if (dst.minted) {
  entry.stage = "minted";
  entry.destinationTxHash = dst.hash ?? undefined;
  entry.note = "Mint confirmed on destination chain.";
  }
  entry.updatedAt = Date.now();
  writeEntry(entry);
  return entry;
}
