/**
 * Market data — v1 seed.
 *
 * Real data will come from the token-launch contract events (UniV4 pool
 * creation + fixed supply) once the launch feature lands. Until then this seed
 * drives the Trending / Recents UI so the screen is real and reviewable. Every
 * field here is shaped exactly like what the on-chain feed will produce, so the
 * page does not change when the source swaps from seed → contract.
 *
 * `chainId` keys into `EVM_CHAIN_BY_ID` from @charge/chains.
 */

export interface MarketToken {
  id: string;
  name: string;
  symbol: string;
  chainId: number;
  /** USD price. */
  price: number;
  /** Market cap in USD. */
  marketCap: number;
  /** 24h change, fraction (0.12 = +12%). */
  change24h: number;
  /** Paired asset symbol (native of the chain). */
  paired: string;
  launchedAt: number;
  /** On-chain contract address, when this is a real launched token. Enables
   *  the inline trade panel; absent for purely-seed placeholders. */
  address?: string;
  /** Optional project links surfaced on the token row. */
  links?: { website?: string; x?: string; telegram?: string };
}

export const SEED_TOKENS: MarketToken[] = [
  {
    id: "arc-charge",
    name: "Charge",
    symbol: "CHARGE",
    chainId: 5042002,
    price: 0.0421,
    marketCap: 4_210_000,
    change24h: 0.182,
    paired: "USDC",
    launchedAt: Date.now() - 1000 * 60 * 60 * 6,
    address: "0x09117E4E6dc3F8c2AF9Ae6d1881bf3d39bbd145d",
    links: { website: "https://chargexyz.vercel.app", x: "https://x.com/Charge01_" },
  },
  {
    id: "base-moon",
    name: "Moonbase",
    symbol: "MOON",
    chainId: 8453,
    price: 1.17,
    marketCap: 11_700_000,
    change24h: 0.064,
    paired: "ETH",
    launchedAt: Date.now() - 1000 * 60 * 60 * 26,
    links: { telegram: "https://t.me/moonbase" },
  },
  {
    id: "arb-pixel",
    name: "Pixel",
    symbol: "PIXEL",
    chainId: 42161,
    price: 0.0088,
    marketCap: 880_000,
    change24h: -0.041,
    paired: "ETH",
    launchedAt: Date.now() - 1000 * 60 * 60 * 50,
  },
  {
    id: "base-aurora",
    name: "Aurora",
    symbol: "AUR",
    chainId: 84532,
    price: 0.231,
    marketCap: 2_310_000,
    change24h: 0.31,
    paired: "ETH",
    launchedAt: Date.now() - 1000 * 60 * 30,
  },
];

/** Sort by market cap desc. `chainId` filters to a single chain when set. */
export function trending(
  tokens: MarketToken[],
  chainId: number | "all",
): MarketToken[] {
  const list =
    chainId === "all" ? tokens : tokens.filter((t) => t.chainId === chainId);
  return [...list].sort((a, b) => b.marketCap - a.marketCap);
}

export function recents(
  tokens: MarketToken[],
  chainId: number | "all",
): MarketToken[] {
  const list =
    chainId === "all" ? tokens : tokens.filter((t) => t.chainId === chainId);
  return [...list].sort((a, b) => b.launchedAt - a.launchedAt);
}
