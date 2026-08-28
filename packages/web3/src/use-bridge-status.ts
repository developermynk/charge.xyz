import * as React from "react";

import type { BridgeStage } from "@charge/chains";

export interface BridgeStatus {
  hash: string;
  fromChain: string;
  toChain: string;
  amount?: string;
  stage: BridgeStage;
  fromDomain?: number;
  toDomain?: number;
  destinationTxHash?: string;
  updatedAt: number;
  note?: string;
}

/**
 * Bridge tracking: register the burn hash with the server backend
 * (POST /api/bridge/status) and poll it (GET) so the UI shows an honest timeline
 * (burned → attesting → minted) instead of a single multi-minute spinner.
 *
 * The server verifies completion on the destination chain's MessageTransmitter
 * (chain-agnostic), so it works even for Arc-origin transfers that Circle's
 * public IRIS API does not index (domain 26).
 */
export function useBridgeStatus(burnHash: string | null) {
  const [status, setStatus] = React.useState<BridgeStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Register on burn hash set.
  React.useEffect(() => {
    if (!burnHash) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bridge/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hash: burnHash }),
        });
        if (!res.ok) throw new Error("Failed to register bridge");
        const data = (await res.json()) as BridgeStatus;
        if (!cancelled) setStatus(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Bridge tracking error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [burnHash]);

  // Poll while in flight.
  React.useEffect(() => {
    if (!burnHash) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/bridge/status?hash=${burnHash}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as BridgeStatus;
        if (cancelled) return;
        setStatus(data);
        if (data.stage === "minted" || data.stage === "failed") {
          clearInterval(timer);
        }
      } catch {
        /* keep last status */
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [burnHash]);

  return { status, error };
}
