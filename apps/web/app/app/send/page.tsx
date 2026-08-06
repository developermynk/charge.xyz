import type { Metadata } from "next";

import { Card } from "@charge/ui";

import { SendPanel } from "@/components/app/send-panel";

export const metadata: Metadata = { title: "Send" };

export default function SendPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p className="mt-1 text-fg-secondary">
          Transfer funds to any address on Arc.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <SendPanel />
      </Card>
    </div>
  );
}
