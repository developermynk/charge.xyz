import type { Metadata } from "next";

import { Card } from "@charge/ui";

import { BridgePanel } from "@/components/app/bridge-panel";

export const metadata: Metadata = { title: "Bridge" };

export default function BridgePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bridge</h1>
        <p className="mt-1 text-fg-secondary">
          Move real USDC across chains with CCTP — burned on the source, minted
          on the destination.
        </p>
      </header>

      <Card className="p-6">
        <BridgePanel />
      </Card>
    </div>
  );
}
