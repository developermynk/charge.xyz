"use client";

import { ArrowLeftRight, Coins, Copy, Check, Fuel, Send, Waypoints } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Badge, Button, Card, Skeleton } from "@charge/ui";
import { useArcBalance, useWallet } from "@charge/web3";

export default function OverviewPage() {
  const { address, method } = useWallet();
  const balance = useArcBalance(address);
  const [copied, setCopied] = React.useState(false);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-fg-secondary">
            Your balances on Arc Testnet.
          </p>
        </div>
        <Badge tone={method === "email" ? "charge" : "accent"}>
          {method === "email" ? "Email account" : "Connected wallet"}
        </Badge>
      </header>

      {/* Address */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-fg-tertiary">Your address</p>
          <p className="mt-0.5 truncate font-mono text-sm text-fg">{address}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void copyAddress()}>
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              Copy
            </>
          )}
        </Button>
      </Card>

      {/*
        Two balances, shown separately and labelled explicitly.

        On Arc the gas asset and the ERC-20 are BOTH called USDC but use 18 and
        6 decimals. Collapsing them into one "USDC balance" is how users end up
        unable to explain why a transfer failed while the app says they have
        funds. So: two cards, two labels, two purposes.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <BalanceCard
          label="Gas balance"
          sublabel="Native USDC · pays transaction fees"
          value={balance.nativeFormatted}
          loading={balance.isLoading}
          tone="charge"
          icon={<Fuel className="size-4" aria-hidden />}
        />
        <BalanceCard
          label="USDC balance"
          sublabel="ERC-20 · used for swaps and transfers"
          value={balance.usdcFormatted}
          loading={balance.isLoading}
          tone="accent"
          icon={<span className="text-xs font-bold">$</span>}
        />
      </div>

      {balance.rpcError && !balance.isLoading && (
        <Card className="border-danger/25 bg-danger/[0.07] p-4">
          <p className="text-sm text-fg">
            <strong className="font-semibold">Cannot reach Arc.</strong> The
            RPC endpoint is unreachable — balances may be wrong. Check{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-xs">
              NEXT_PUBLIC_ARC_RPC_URL
            </code>
            .
          </p>
        </Card>
      )}

      {balance.nativeRaw === 0n && !balance.isLoading && !balance.rpcError && (
        <Card className="border-warning/25 bg-warning/[0.07] p-4">
          <p className="text-sm text-fg">
            <strong className="font-semibold">No gas balance.</strong> You need
            native USDC to pay transaction fees on Arc. Get testnet funds from{" "}
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-charge underline underline-offset-2"
            >
              Circle&apos;s faucet
            </a>
            .
          </p>
        </Card>
      )}

      {/* Actions */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-fg-secondary">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionTile
            href="/app/swap"
            icon={<ArrowLeftRight className="size-4" aria-hidden />}
            title="Swap"
            body="Trade between tokens on Arc"
          />
          <ActionTile
            href="/app/bridge"
            icon={<Waypoints className="size-4" aria-hidden />}
            title="Bridge"
            body="Move USDC across chains via CCTP"
          />
          <ActionTile
            href="/app/send"
            icon={<Send className="size-4" aria-hidden />}
            title="Send"
            body="Transfer funds to any address"
          />
          <ActionTile
            href="/app/create"
            icon={<Coins className="size-4" aria-hidden />}
            title="Launch token"
            body="Deploy a fixed-supply ERC-20"
          />
        </div>
      </section>
    </div>
  );
}

function BalanceCard({
  label,
  sublabel,
  value,
  loading,
  tone,
  icon,
}: {
  label: string;
  sublabel: string;
  value: string;
  loading: boolean;
  tone: "charge" | "accent";
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-7 items-center justify-center rounded-lg ${
            tone === "charge"
              ? "bg-charge/15 text-charge"
              : "bg-accent/15 text-accent"
          }`}
        >
          {icon}
        </span>
        <p className="text-sm font-medium text-fg">{label}</p>
      </div>
      {loading ? (
        <Skeleton className="mt-4 h-9 w-40" />
      ) : (
        <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
          {formatAmount(value)}
        </p>
      )}
      <p className="mt-1.5 text-xs text-fg-tertiary">{sublabel}</p>
    </Card>
  );
}

function ActionTile({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="flex items-center gap-4 p-4 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-fg-secondary transition-colors group-hover:text-fg">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-fg">{title}</span>
          <span className="block text-sm text-fg-secondary">{body}</span>
        </span>
      </Card>
    </Link>
  );
}

/** Group thousands and cap to 6 dp so long decimals do not blow out the card. */
function formatAmount(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}
