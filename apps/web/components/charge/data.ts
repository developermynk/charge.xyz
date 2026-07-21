/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Chain {
  code: string;
  name: string;
  icon: string;
  color: string;
  testnet: boolean;
  group: "Mainnet" | "Testnet";
}

export const ALL_CHAINS: Chain[] = [
  // ── Mainnet ──
  { code: "ETH", name: "Ethereum", icon: "⟠", color: "#627EEA", testnet: false, group: "Mainnet" },
  { code: "ARB", name: "Arbitrum", icon: "🔵", color: "#28A0F0", testnet: false, group: "Mainnet" },
  { code: "AVAX", name: "Avalanche", icon: "🔺", color: "#E84142", testnet: false, group: "Mainnet" },
  { code: "BASE", name: "Base", icon: "●", color: "#0052FF", testnet: false, group: "Mainnet" },
  { code: "MONAD", name: "Monad", icon: "◈", color: "#836EF9", testnet: false, group: "Mainnet" },
  { code: "NEAR", name: "NEAR", icon: "◎", color: "#00C08B", testnet: false, group: "Mainnet" },
  { code: "OP", name: "Optimism", icon: "⬤", color: "#FF0420", testnet: false, group: "Mainnet" },
  { code: "MATIC", name: "Polygon PoS", icon: "◆", color: "#8247E5", testnet: false, group: "Mainnet" },
  { code: "SOL", name: "Solana", icon: "◎", color: "#9945FF", testnet: false, group: "Mainnet" },
  { code: "APTOS", name: "Aptos", icon: "▲", color: "#2AC4D4", testnet: false, group: "Mainnet" },
  { code: "UNI", name: "Unichain", icon: "🦄", color: "#FF007A", testnet: false, group: "Mainnet" },
  { code: "EVM", name: "Other EVM", icon: "⬡", color: "#8A8A95", testnet: false, group: "Mainnet" },
  // ── Testnet ──
  { code: "ARB-SEPOLIA", name: "Arbitrum Sepolia", icon: "🔵", color: "#28A0F0", testnet: true, group: "Testnet" },
  { code: "ETH-SEPOLIA", name: "Ethereum Sepolia", icon: "⟠", color: "#627EEA", testnet: true, group: "Testnet" },
  { code: "BASE-SEPOLIA", name: "Base Sepolia", icon: "●", color: "#0052FF", testnet: true, group: "Testnet" },
  { code: "OP-SEPOLIA", name: "Optimism Sepolia", icon: "⬤", color: "#FF0420", testnet: true, group: "Testnet" },
  { code: "AVAX-FUJI", name: "Avalanche Fuji", icon: "🔺", color: "#E84142", testnet: true, group: "Testnet" },
  { code: "MATIC-AMOY", name: "Polygon Amoy", icon: "◆", color: "#8247E5", testnet: true, group: "Testnet" },
  { code: "SOL-DEVNET", name: "Solana Devnet", icon: "◎", color: "#9945FF", testnet: true, group: "Testnet" },
  { code: "APTOS-TESTNET", name: "Aptos Testnet", icon: "▲", color: "#2AC4D4", testnet: true, group: "Testnet" },
  { code: "MONAD-TESTNET", name: "Monad Testnet", icon: "◈", color: "#836EF9", testnet: true, group: "Testnet" },
  { code: "NEAR-TESTNET", name: "NEAR Testnet", icon: "◎", color: "#00C08B", testnet: true, group: "Testnet" },
  { code: "UNI-SEPOLIA", name: "Unichain Sepolia", icon: "🦄", color: "#FF007A", testnet: true, group: "Testnet" },
  { code: "ARC-TESTNET", name: "Arc Testnet", icon: "⚡", color: "#C4FF00", testnet: true, group: "Testnet" },
];

// This app is Arc-native: every on-chain action (swap, bridge, deploy, transfer)
// happens on Arc Testnet, so it is the default everywhere a chain is picked.
export const DEFAULT_CHAIN = ALL_CHAINS.find((c) => c.code === "ARC-TESTNET")!;
export const DEFAULT_TO_CHAIN = ALL_CHAINS.find((c) => c.code === "ARC-TESTNET")!;

export interface Token {
  symbol: string;
  name: string;
  icon: string;
  price: number;
}

export const TOKENS: Token[] = [
  { symbol: "ETH", name: "Ethereum", icon: "⟠", price: 3241.82 },
  { symbol: "USDC", name: "USD Coin", icon: "◎", price: 1.0 },
  { symbol: "WBTC", name: "Wrapped BTC", icon: "₿", price: 64280.5 },
  { symbol: "ARB", name: "Arbitrum", icon: "🔵", price: 1.14 },
  { symbol: "OP", name: "Optimism", icon: "⬤", price: 2.38 },
  { symbol: "MATIC", name: "Polygon", icon: "◆", price: 0.84 },
  { symbol: "SOL", name: "Solana", icon: "◎", price: 178.4 },
  { symbol: "AVAX", name: "Avalanche", icon: "🔺", price: 38.2 },
];

export interface WalletOption {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: "injected" | "passkey";
}

export const WALLETS: WalletOption[] = [
  { id: "metamask", name: "MetaMask", icon: "🦊", desc: "Browser extension & mobile", kind: "injected" },
  { id: "walletconnect", name: "WalletConnect", icon: "🔗", desc: "Scan QR with any wallet", kind: "injected" },
  { id: "coinbase", name: "Coinbase Wallet", icon: "🔵", desc: "Self-custody wallet", kind: "injected" },
  { id: "phantom", name: "Phantom", icon: "👻", desc: "Solana & multi-chain", kind: "injected" },
  { id: "trust", name: "Trust Wallet", icon: "🛡️", desc: "Mobile first crypto wallet", kind: "injected" },
  { id: "ledger", name: "Ledger", icon: "📱", desc: "Hardware wallet", kind: "injected" },
];

export interface DashNavItem {
  id: string;
  label: string;
  icon: string;
  desc: string;
  path: string;
}

export const NAV_ITEMS: DashNavItem[] = [
  { id: "swap", label: "Swap", icon: "⇌", desc: "Trade tokens instantly", path: "/dashboard/swap" },
  { id: "bridge", label: "Bridge", icon: "⬡", desc: "Cross-chain transfers", path: "/dashboard/bridge" },
  { id: "launch", label: "Create Token", icon: "✦", desc: "Deploy ERC-20 contracts", path: "/dashboard/launch" },
  { id: "transfer", label: "Transfer", icon: "→", desc: "Send tokens anywhere", path: "/dashboard/transfer" },
];
