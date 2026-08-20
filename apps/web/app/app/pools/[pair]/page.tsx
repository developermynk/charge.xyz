import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { BackButton } from "@/components/app/back-button";
import { PoolDetail } from "@/components/app/pool-detail";
import { getPoolById } from "@charge/chains";

export const metadata: Metadata = { title: "Pool" };

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair } = await params;
  const def = getPoolById(pair.toUpperCase());
  if (!def || !def.enabled) {
    return (
      <div className="space-y-6">
        <BackButton />
        <div className="rounded-xl border border-fg/10 bg-fg/[0.03] p-6">
          <h1 className="text-xl font-semibold">Pool not found</h1>
          <p className="mt-2 text-fg-secondary">
            {def && !def.available
              ? def.unavailableReason ??
                "This pool is not available on Arc Testnet yet."
              : "That pool does not exist."}
          </p>
          <Link
            href="/app/pools"
            className="mt-4 inline-block text-sm font-medium text-charge hover:underline"
          >
            ← Back to all pools
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {def.label}
        </h1>
        <span className="rounded-full bg-charge/10 px-2.5 py-0.5 text-xs font-medium text-charge">
          Fee {def.feeBps / 100}%
        </span>
      </header>

      <Suspense fallback={<p className="text-fg-tertiary">Loading…</p>}>
        <PoolDetail poolId={def.id} />
      </Suspense>
    </div>
  );
}
