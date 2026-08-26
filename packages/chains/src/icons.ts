/**
 * Genuine brand icon mapping for tokens and chains.
 *
 * We render real brand marks via `@web3icons/react` (Family's library —
 * auto-updated, genuine token + chain logos) so the dapp shows USDC, EURC,
 * cirBTC, the Arc chain, etc. with their actual logos instead of plain text.
 *
 * IMPORTANT (web3icons v4 namespace shape, verified at runtime):
 *   - tokens : `tokenIcons.TokenUSDC`      -> keys are "Token" + SYMBOL
 *   - networks: `networkIcons.NetworkArc`  -> keys are "Network" + NAME
 *   - wallets : `walletIcons.WalletMetamask` -> keys are "Wallet" + NAME
 *     (note: WalletConnect exports as `WalletWalletConnect`)
 *
 * The values below are the EXACT exported member names (full prefix included)
 * so the React components can look them up directly without re-prefixing.
 * Unknown entries fall back to a monogram in the UI (no broken images).
 */

/** token symbol (uppercase) -> web3icons token member name (Token + SYMBOL) */
export const TOKEN_ICON_KEY: Record<string, string> = {
  USDC: "USDC",
  USDT: "USDT",
  EURC: "EURC",
  ETH: "ETH",
  WETH: "ETH", // no TokenWETH in web3icons; ETH brand is closest
  WBTC: "WBTC",
  cbBTC: "CBTC",
  BTC: "WBTC",
  cirBTC: "WBTC", // BTC-pegged; genuine BTC brand mark
  DAI: "DAI",
  MATIC: "MATIC",
  AVAX: "AVAX",
  ARB: "ARB",
  OP: "OP",
  SOL: "SOL",
};

/** numeric chain id -> web3icons network member name (Network + NAME) */
export const CHAIN_ICON_KEY: Record<number, string> = {
  5042002: "NetworkArc", // Arc Testnet — genuine Arc brand mark
  1: "NetworkEthereum",
  11155111: "NetworkEthereum",
  8453: "NetworkBase",
  84532: "NetworkBase",
  42161: "NetworkArbitrumOne",
  421614: "NetworkArbitrumSepolia",
  10: "NetworkOptimism",
  11155420: "NetworkOptimism",
  137: "NetworkPolygon",
  43114: "NetworkAvalanche",
  43113: "NetworkAvalanche",
  42220: "NetworkCelo",
  59144: "NetworkLinea",
  130: "NetworkUnichain",
  480: "NetworkWorld",
  100: "NetworkGnosis",
  324: "NetworkZksync",
  534352: "NetworkScroll",
  81457: "NetworkBlast",
  5000: "NetworkMantle",
  1868: "NetworkSoneium",
  1329: "NetworkSeiNetwork",
  747: "NetworkFlow",
  57073: "NetworkInk",
  999: "NetworkHyperEvm",
  10143: "NetworkMonad",
  50: "NetworkXdc",
  146: "NetworkSonic",
  98866: "NetworkPlume",
};

/** wallet connector id (lowercased) -> web3icons wallet member name (Wallet + NAME) */
export const WALLET_ICON_KEY: Record<string, string> = {
  metamask: "WalletMetamask",
  coinbase: "WalletCoinbase",
  walletconnect: "WalletWalletConnect",
  okx: "WalletOkx",
  rabby: "WalletRabby",
  trust: "WalletTrust",
  phantom: "WalletPhantom",
  rainbow: "WalletRainbow",
  ledger: "WalletLedger",
};

export function tokenIconKey(symbol: string): string | undefined {
  return TOKEN_ICON_KEY[symbol.toUpperCase()];
}
export function chainIconKey(chainId: number | undefined): string | undefined {
  return chainId === undefined ? undefined : CHAIN_ICON_KEY[chainId];
}
export function walletIconKey(connectorId: string): string | undefined {
  return WALLET_ICON_KEY[connectorId.toLowerCase()];
}
