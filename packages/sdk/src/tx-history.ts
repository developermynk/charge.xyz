/**
 * Local transaction history.
 *
 * Two complementary sources feed the History view:
 *   1. On-chain `Transfer` logs (read by @charge/web3 useChainActivity) —
 *      catches *any* send/receive for the address, even ones not made in-app.
 *   2. This module — the dapp records every swap/bridge/send *it* submits,
 *      so the user sees their own action the instant it is broadcast, before
 *      the chain confirms and long before the log is scannable.
 *
 * Storage is the browser's localStorage keyed per address (no server, no PII
 * leaves the device). Capped at 100 entries, newest first.
 */

export type TxType = "send" | "receive" | "swap" | "bridge";

export interface TxRecord {
  /** Stable id — the chain tx hash (or hash+direction for on-chain items). */
  id: string;
  type: TxType;
  /** Numeric EVM chain id the action targeted. */
  chainId: number;
  /** Transaction hash on that chain. */
  hash: string;
  /** ISO timestamp at record time. */
  ts: string;
  /** Best-effort human summary, e.g. "25 USDC via Arc Testnet". */
  summary: string;
  /** Counterparty / destination chain label where relevant. */
  counterparty?: string;
}

const KEY_PREFIX = "charge-tx-history:";
const MAX = 100;

function keyFor(address: string): string {
  return KEY_PREFIX + address.toLowerCase();
}

export function getTxHistory(address: string | undefined): TxRecord[] {
  if (!address) return [];
  try {
    const raw = localStorage.getItem(keyFor(address));
    if (!raw) return [];
    const arr = JSON.parse(raw) as TxRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Persist a record. `id` must be unique per entry; for on-chain items pass
 * `${hash}:${direction}` so a single tx that is both sent-from and received-to
 * is not collapsed. Returns the updated list.
 */
export function recordTx(
  address: string | undefined,
  rec: TxRecord,
): TxRecord[] {
  if (!address) return [];
  try {
    const cur = getTxHistory(address).filter((r) => r.id !== rec.id);
    const next = [rec, ...cur].slice(0, MAX);
    localStorage.setItem(keyFor(address), JSON.stringify(next));
    return next;
  } catch {
    return [rec];
  }
}

/** Drop a single record (e.g. a tx that failed after broadcast). */
export function removeTx(address: string | undefined, id: string): void {
  if (!address) return;
  try {
    const next = getTxHistory(address).filter((r) => r.id !== id);
    localStorage.setItem(keyFor(address), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
