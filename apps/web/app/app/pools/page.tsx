import type { Metadata } from "next";
import { Suspense } from "react";

import { BackButton } from "@/components/app/back-button";
import { PoolList } from "@/components/app/pool-list";

export const metadata: Metadata = { title: "Pools" };

export default function PoolsPage() {
  return (
    <div className="space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Liquidity</h1>
        <p className="mt-1 text-fg-secondary">
          Provide liquidity to Chargefi&apos;s public AMM pools and earn a share
          of every swap&apos;s fees. All liquidity is on-chain and
          non-custodial.
        </p>
      </header>

      <Suspense fallback={<p className="text-fg-tertiary">Loading…</p>}>
        <PoolList />
      </Suspense>
    </div>
  );
}
