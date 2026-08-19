import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@charge/ui";

import { BackButton } from "@/components/app/back-button";
import { PoolPanel } from "@/components/app/pool-panel";

export const metadata: Metadata = { title: "Pool" };

export default function PoolPage() {
  return (
    <div className="space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pool</h1>
        <p className="mt-1 text-fg-secondary">
          Provide USDC, EURC and cirBTC liquidity and earn the protocol&apos;s swap fees.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <Suspense fallback={<p className="text-fg-tertiary">Loading…</p>}>
          <PoolPanel />
        </Suspense>
      </Card>
    </div>
  );
}
