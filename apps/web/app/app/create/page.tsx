import type { Metadata } from "next";

import { Card } from "@charge/ui";

import { CreateTokenPanel } from "@/components/app/create-token-panel";

export const metadata: Metadata = { title: "Launch a token" };

export default function CreateTokenPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Launch a token
        </h1>
        <p className="mt-1 text-fg-secondary">
          Deploy a fixed-supply ERC-20 on Arc. No mint function, no admin keys.
        </p>
      </header>

      <Card className="p-6">
        <CreateTokenPanel />
      </Card>
    </div>
  );
}
