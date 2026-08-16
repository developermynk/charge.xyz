"use client";

import * as React from "react";
import { BackButton } from "@/components/app/back-button";
import { TokenDetailPanel } from "@/components/app/token-detail-panel";

export default function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = React.use(params);
  return (
    <div className="space-y-5">
      <BackButton />
      <TokenDetailPanel address={address as `0x${string}`} />
    </div>
  );
}
