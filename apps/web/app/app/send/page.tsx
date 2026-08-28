import type { Metadata } from "next";

import { Card } from "@charge/ui";

import { BackButton } from "@/components/app/back-button";
import { SendPanel } from "@/components/app/send-panel";
import { PageEnter } from "@/components/motion";

export const metadata: Metadata = { title: "Send" };

export default function SendPage() {
  return (
    <PageEnter className="space-y-6">
      <BackButton />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p className="mt-1 text-fg-secondary">
          Transfer funds to any address on any supported chain.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <SendPanel />
      </Card>
    </PageEnter>
  );
}
