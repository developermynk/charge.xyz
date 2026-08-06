"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import * as React from "react";

import {
  AmountInput,
  Button,
  Card,
  DetailRow,
  Label,
  StatusLine,
  TxProgress,
  type StepState,
} from "@charge/ui";
import { arcTxUrl, ARC_SWAP_CHAIN, BRIDGE_DESTINATIONS } from "@charge/chains";
import {
  BRIDGE_STAGES,
  executeBridge,
  humanizeBridgeError,
  type BridgeStageId,
} from "@charge/sdk";
import { useArcBalance, useWallet } from "@charge/web3";

type Phase = "idle" | "running" | "done" | "error";

export function BridgePanel() {
  const { address, getProvider, isOnArc } = useWallet();
  const balance = useArcBalance(address);

  const [toChain, setToChain] = React.useState<string>(
    BRIDGE_DESTINATIONS[0]?.id ?? "",
  );
  const [amount, setAmount] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [stage, setStage] = React.useState<BridgeStageId | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  const amountNum = Number(amount);
  const amountError =
    amount.length > 0 && (!Number.isFinite(amountNum) || amountNum <= 0)
      ? "Enter an amount greater than zero."
      : amount.length > 0 && amountNum > Number(balance.usdcFormatted)
        ? `Exceeds your balance of ${balance.usdcFormatted}.`
        : null;

  const canSubmit =
    isOnArc &&
    amount.length > 0 &&
    !amountError &&
    Boolean(toChain) &&
    phase !== "running";

  /**
   * Map the SDK's current stage onto per-step UI state.
   *
   * CCTP takes minutes because of Circle's attestation wait, so showing named
   * steps is not decoration — a single spinner for that long reads as a hang
   * and makes people close the tab mid-transfer.
   */
  function stateFor(id: BridgeStageId): StepState {
    if (phase === "done") return "done";
    if (!stage) return "pending";

    const order = BRIDGE_STAGES.map((s) => s.id);
    const current = order.indexOf(stage);
    const mine = order.indexOf(id);

    if (phase === "error" && mine === current) return "error";
    if (mine < current) return "done";
    if (mine === current) return "active";
    return "pending";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !address) return;

    setError(null);
    setTxHash(null);
    setStage("approve");
    setPhase("running");

    try {
      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      const result = await executeBridge(
        {
          provider,
          fromChain: ARC_SWAP_CHAIN,
          toChain,
          amount,
        },
        (s) => setStage(s),
      );

      if (result.txHash) setTxHash(result.txHash);
      setPhase("done");
      setAmount("");
      balance.refetch();
    } catch (err) {
      setError(humanizeBridgeError(err));
      setPhase("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Route */}
      <div>
        <Label>Route</Label>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="block text-xs text-fg-tertiary">From</span>
            <span className="mt-0.5 block font-medium text-fg">Arc Testnet</span>
          </div>
          <ArrowRight className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
          <div className="flex-1">
            <label htmlFor="to-chain" className="sr-only">
              Destination chain
            </label>
            <select
              id="to-chain"
              value={toChain}
              onChange={(e) => setToChain(e.target.value)}
              className="h-[58px] w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-fg outline-none transition-colors focus-visible:border-charge/50 focus-visible:ring-2 focus-visible:ring-charge/25"
            >
              {BRIDGE_DESTINATIONS.map((c) => (
                <option key={c.id} value={c.id} className="bg-elevated">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="bridge-amount">Amount</Label>
          <span className="text-xs tabular-nums text-fg-tertiary">
            Available {balance.usdcFormatted} USDC
          </span>
        </div>
        <AmountInput
          id="bridge-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          symbol="USDC"
          onMax={() => setAmount(balance.usdcFormatted)}
          className="mt-2"
          aria-invalid={Boolean(amountError)}
        />
        {amountError && (
          <p className="mt-1.5 text-xs text-danger">{amountError}</p>
        )}
      </div>

      <Card className="p-4">
        <DetailRow label="Protocol" value="CCTP (burn and mint)" />
        <DetailRow label="You receive" value="Native USDC, not a wrapped IOU" />
        <DetailRow label="Typical time" value="1–15 minutes" />
      </Card>

      {(phase === "running" || phase === "done" || phase === "error") && (
        <Card className="p-4">
          <TxProgress
            steps={BRIDGE_STAGES.map((s) => ({
              id: s.id,
              label: s.label,
              state: stateFor(s.id),
            }))}
          />
        </Card>
      )}

      {phase === "running" && stage === "attest" && (
        <StatusLine>
          Circle is attesting the burn. This is the slow step — your USDC is
          already burned on Arc and will mint on the destination. Safe to keep
          this tab open.
        </StatusLine>
      )}

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "done" && (
        <StatusLine tone="success">
          Burn confirmed on Arc. Your USDC is now minting on the destination —
          that step finishes when Circle&apos;s attestation lands (usually 1–15
          min). The burn shows as a transfer to the null address, which is
          normal for CCTP.{" "}
          {txHash && (
            <a
              href={arcTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              View source transaction
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </StatusLine>
      )}

      <Button
        type="submit"
        size="xl"
        block
        loading={phase === "running"}
        disabled={!canSubmit}
      >
        {phase === "running" ? "Bridging…" : "Bridge USDC"}
      </Button>

      {!isOnArc && (
        <p className="text-center text-xs text-fg-tertiary">
          Switch to Arc Testnet to bridge.
        </p>
      )}
    </form>
  );
}
