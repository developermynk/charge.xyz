"use client";

import * as React from "react";
import {
  networkIcons,
  tokenIcons,
  walletIcons,
  type BaseIconProps,
} from "@web3icons/react";

import {
  chainIconKey,
  tokenIconKey,
  walletIconKey,
} from "@charge/chains/icons";

/** Shared icon sizing + className passthrough. */
type IconProps = {
  size?: number;
  className?: string;
};

/** A rounded monogram fallback when no brand icon is available. */
function Monogram({ label, className }: { label: string; className?: string }) {
  const ch = label.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "?";
  return (
    <span
      className={
        "flex items-center justify-center rounded-full bg-fg/10 text-fg-secondary font-semibold " +
        (className ?? "")
      }
      aria-hidden
    >
      {ch}
    </span>
  );
}

/** Genuine token brand icon (USDC, EURC, cirBTC/BTC, etc.). */
export function TokenIcon({
  symbol,
  size = 28,
  className,
}: { symbol: string } & IconProps) {
  const key = tokenIconKey(symbol);
  const Comp = key ? (tokenIcons as Record<string, React.ComponentType<BaseIconProps>>)[`Token${key}`] : undefined;

  if (!Comp) {
    return (
      <Monogram
        label={symbol}
        className={className}
      />
    );
  }
  return <Comp size={size} className={className} />;
}

/** Genuine chain brand icon (Arc, Ethereum, Base, etc.). */
export function ChainIcon({
  chainId,
  size = 28,
  className,
}: { chainId: number | undefined } & IconProps) {
  const key = chainIconKey(chainId);
  const Comp = key ? (networkIcons as Record<string, React.ComponentType<BaseIconProps>>)[key] : undefined;

  if (!Comp) {
    return <Monogram label={String(chainId)} className={className} />;
  }
  return <Comp size={size} className={className} />;
}

/** Genuine wallet brand icon, resolved from a wagmi connector id. */
export function WalletIcon({
  connectorId,
  size = 28,
  className,
}: { connectorId: string } & IconProps) {
  const key = walletIconKey(connectorId);
  const Comp = key ? (walletIcons as Record<string, React.ComponentType<BaseIconProps>>)[key] : undefined;

  if (!Comp) {
    return <Monogram label={connectorId} className={className} />;
  }
  return <Comp size={size} className={className} />;
}
