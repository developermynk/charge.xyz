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

/**
 * Inline SVG chain & token logos — ported 1:1 from the Figma Make design so the
 * selects, inputs and hero render the exact colored marks from the source of
 * truth (rather than emoji stand-ins).
 */

import type { ReactElement } from "react";

interface LogoProps {
  size?: number;
}

export function EthLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 2L7 16.5L16 21L25 16.5L16 2Z" fill="#627EEA" />
      <path d="M7 16.5L16 30L25 16.5L16 21L7 16.5Z" fill="#627EEA" opacity="0.7" />
      <path d="M16 2L7 16.5L16 12.5V2Z" fill="#C0CBF6" />
      <path d="M16 12.5L7 16.5L16 21V12.5Z" fill="#8198EE" />
    </svg>
  );
}

export function ArbLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#213147" />
      <path d="M10 22L14 10L20 22H17L16 19L15 22H10Z" fill="#28A0F0" />
      <path d="M18 22L22 10L24 22H18Z" fill="#28A0F0" opacity="0.6" />
    </svg>
  );
}

export function BaseLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path
        d="M16 8C11.6 8 8 11.6 8 16C8 20.4 11.6 24 16 24C20.4 24 24 20.4 24 16H16V8Z"
        fill="white"
      />
    </svg>
  );
}

export function SolLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="16" fill="#1a1a2e" />
      <path d="M8 21h13l3-2H11L8 21Z" fill="#9945FF" />
      <path d="M8 16h13l3-2H11L8 16Z" fill="#14F195" />
      <path d="M8 11h13l3 2H11L8 11Z" fill="#9945FF" />
    </svg>
  );
}

export function AvaxLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#E84142" />
      <path d="M12 22L16 14L20 22H12Z" fill="white" />
      <path d="M8 22L10 18H14L12 22H8Z" fill="white" opacity="0.6" />
    </svg>
  );
}

export function OpLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#FF0420" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="white" strokeWidth="2.5" />
    </svg>
  );
}

export function MaticLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#8247E5" />
      <path d="M20 13L16 10L12 13V19L16 22L20 19V13Z" fill="none" stroke="white" strokeWidth="2" />
      <path d="M16 10V22" stroke="white" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

export function MonadLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#836EF9" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        M
      </text>
    </svg>
  );
}

export function NearLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#00C08B" />
      <path
        d="M10 22V10L16 20L22 10V22"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function AptosLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#2AC4D4" />
      <circle cx="16" cy="12" r="3" fill="white" />
      <circle cx="11" cy="19" r="3" fill="white" opacity="0.7" />
      <circle cx="21" cy="19" r="3" fill="white" opacity="0.7" />
    </svg>
  );
}

export function UniLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#FF007A" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        🦄
      </text>
    </svg>
  );
}

export function EvmLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#3C3C3C" />
      <path
        d="M8 16H24M16 8L8 16L16 24M16 8L24 16L16 24"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function ArcLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#C4FF00" />
      <path d="M17.5 6L9 18H14.5L13.5 26L23 13H16.5L17.5 6Z" fill="#0A0A0A" />
    </svg>
  );
}

export function UsdcLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        $
      </text>
    </svg>
  );
}

export function WbtcLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        ₿
      </text>
    </svg>
  );
}

/** Resolve a chain code (mainnet or `-TESTNET`/`-SEPOLIA` variant) to its logo.
 *  Also handles Circle SDK identifiers like "Arc_Testnet", "Ethereum", etc. */
export function getChainLogo(code: string, size = 20): ReactElement {
  // Normalize: split on dash for internal codes, and map SDK identifiers
  const base = code.split("-")[0];
  const sdkMap: Record<string, string> = {
    Ethereum: "ETH", Arbitrum: "ARB", Base: "BASE", Solana: "SOL",
    Avalanche: "AVAX", Optimism: "OP", Polygon: "MATIC", Monad: "MONAD",
    Unichain: "UNI", Arc_Testnet: "ARC",
    HyperEVM: "EVM", Ink: "EVM", Linea: "ETH", Plume: "EVM",
    Sei: "EVM", Sonic: "EVM", World_Chain: "EVM", XDC: "EVM",
  };
  const key = sdkMap[code] ?? base;
  switch (key) {
    case "ETH":
      return <EthLogo size={size} />;
    case "ARB":
      return <ArbLogo size={size} />;
    case "BASE":
      return <BaseLogo size={size} />;
    case "SOL":
      return <SolLogo size={size} />;
    case "AVAX":
      return <AvaxLogo size={size} />;
    case "OP":
      return <OpLogo size={size} />;
    case "MATIC":
      return <MaticLogo size={size} />;
    case "MONAD":
      return <MonadLogo size={size} />;
    case "NEAR":
      return <NearLogo size={size} />;
    case "APTOS":
      return <AptosLogo size={size} />;
    case "UNI":
      return <UniLogo size={size} />;
    case "ARC":
      return <ArcLogo size={size} />;
    default:
      return <EvmLogo size={size} />;
  }
}

export function EurcLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#1A6DFF" />
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="sans-serif">€</text>
    </svg>
  );
}

export function CirBtcLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <circle cx="16" cy="16" r="12" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" />
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="sans-serif">₿</text>
    </svg>
  );
}

export function NativeLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#3C3C3C" />
      <path d="M16 8L10 16H14L12 24L22 14H17L20 8H16Z" fill="#C4FF00" />
    </svg>
  );
}

export function WethLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16 4L8 16L16 20L24 16L16 4Z" fill="white" opacity="0.8" />
      <path d="M8 16L16 28L24 16L16 20L8 16Z" fill="white" opacity="0.5" />
    </svg>
  );
}

export function UsdtLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="sans-serif">₮</text>
    </svg>
  );
}

/** Resolve a token symbol to its logo. */
export function getTokenLogo(symbol: string, size = 20): ReactElement {
  switch (symbol) {
    case "ETH":
      return <EthLogo size={size} />;
    case "USDC":
      return <UsdcLogo size={size} />;
    case "WBTC":
      return <WbtcLogo size={size} />;
    case "ARB":
      return <ArbLogo size={size} />;
    case "OP":
      return <OpLogo size={size} />;
    case "MATIC":
      return <MaticLogo size={size} />;
    case "SOL":
    case "WSOL":
      return <SolLogo size={size} />;
    case "AVAX":
    case "WAVAX":
      return <AvaxLogo size={size} />;
    case "EURC":
      return <EurcLogo size={size} />;
    case "cirBTC":
      return <CirBtcLogo size={size} />;
    case "NATIVE":
      return <NativeLogo size={size} />;
    case "WETH":
      return <WethLogo size={size} />;
    case "USDT":
      return <UsdtLogo size={size} />;
    case "DAI":
    case "USDE":
      return <UsdcLogo size={size} />;
    case "WPOL":
      return <MaticLogo size={size} />;
    case "PYUSD":
      return <UsdcLogo size={size} />;
    default:
      return <span style={{ fontSize: size * 0.7 }}>◎</span>;
  }
}
