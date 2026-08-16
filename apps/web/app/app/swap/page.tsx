import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@charge/ui";

import { BackButton } from "@/components/app/back-button";
import { SwapPanel } from "@/components/app/swap-panel";

export const metadata: Metadata = { title: "Swap" };

export default function SwapPage() {
  return (
    <div className="space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Swap</h1>
        <p className="mt-1 text-fg-secondary">
          Trade tokens on Arc through Circle&apos;s routing.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <Suspense fallback={<p className="text-fg-tertiary">Loading…</p>}>
          <SwapPanel />
        </Suspense>
      </Card>
    </div>
  );
}
