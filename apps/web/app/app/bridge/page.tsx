import type { Metadata } from "next";

import { Card } from "@charge/ui";

import { BackButton } from "@/components/app/back-button";
import { BridgePanel } from "@/components/app/bridge-panel";
import { PageEnter } from "@/components/motion";

export const metadata: Metadata = { title: "Bridge" };

export default function BridgePage() {
  return (
    <PageEnter className="space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bridge</h1>
        <p className="mt-1 text-fg-secondary">
          Move real USDC across chains with CCTP — burned on the source, minted
          on the destination.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <BridgePanel />
      </Card>
    </PageEnter>
  );
}
