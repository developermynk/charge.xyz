/**
 * Active LP pool registry — the SINGLE SOURCE OF TRUTH consumed by the API,
 * indexer and UI.
 *
 * It returns the statically-configured core pools (LP_POOLS) PLUS any token that
 * has graduated from the Chargefi launchpad and now has a live TOKEN/USDC pair on
 * the Arc AMM. Graduated pools are discovered on-chain (factory.getPair) so they
 * appear in Pools immediately after graduation — no manual registry edits, no
 * second liquidity venue. Public LPs join the SAME pool the launch seeded.
 *
 * No custody, no reward vault: every entry is a real Uniswap-V2 pair on the Arc AMM.
 */

import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";
import {
  ARC_TESTNET_AMM,
  ARC_TESTNET_USDC,
  ARC_AMM_FEE_BPS,
  LP_POOLS,
  UNISWAP_V2_FACTORY_ABI,
  type LpPoolDef,
} from "./circle.ts";

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

const USDC = ARC_TESTNET_USDC as Address;
const FACTORY = ARC_TESTNET_AMM.factory as Address;

export interface GraduatedToken {
  address: Address;
  symbol: string;
  name: string;
}

/** Build a synthetic LpPoolDef for a graduated token if its AMM pair exists. */
async function discoverPool(
  token: GraduatedToken,
): Promise<LpPoolDef | null> {
  try {
    const pair = (await client().readContract({
      address: FACTORY,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [token.address, USDC],
    })) as Address;
    if (!pair || pair === "0x0000000000000000000000000000000000000000") {
      return null;
    }
    return {
      id: `TOKEN-${token.symbol.toUpperCase()}`,
      tokenA: token.symbol.toUpperCase(),
      tokenB: "USDC",
      label: `${token.symbol.toUpperCase()} / USDC`,
      pairAddress: pair,
      routerAddress: ARC_TESTNET_AMM.router,
      factoryAddress: FACTORY,
      feeBps: ARC_AMM_FEE_BPS,
      enabled: true,
      available: true,
      unavailableReason: undefined,
      category: "graduated",
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the full active pool list. `graduated` is injected by the web indexer
 * (which knows the launchpad store); if omitted, only static pools are returned.
 */
export async function getActivePools(
  graduated: GraduatedToken[] = [],
): Promise<LpPoolDef[]> {
  const discovered = (
    await Promise.all(graduated.map((t) => discoverPool(t)))
  ).filter((p): p is LpPoolDef => p !== null);

  // De-dupe by id/pair in case a token was also added statically.
  const seen = new Set<string>();
  const out: LpPoolDef[] = [];
  for (const p of [...LP_POOLS, ...discovered]) {
    const key = p.pairAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
