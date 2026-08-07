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
import { arcTxUrl, ARC_SWAP_CHAIN, BRIDGE_DESTINATIONS, BRIDGE_CHAIN_META } from "@charge/chains";
import {
  BRIDGE_STAGES,
  executeBridge,
  humanizeBridgeError,
  type BridgeStageId,
  type BridgeStepInfo,
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
  const [destinationTxHash, setDestinationTxHash] = React.useState<string | null>(null);
  const [steps, setSteps] = React.useState<BridgeStepInfo[]>([]);

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

  /** Proactively add the destination chain to the wallet so the mint step's
   *  `wallet_switchEthereumChain` doesn't fail with "Unrecognized chain ID".
   *  Base Sepolia ships pre-added; OP/Aribtrum/Polygon/Amoy/Fuji are not, which
   *  is why those bridges failed at the mint step. */
  async function ensureDestinationChain(chainId: string) {
    const meta = BRIDGE_CHAIN_META[chainId];
    if (!meta) return;
    try {
      const provider = await getProvider();
      if (!provider?.request) return;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [meta.addParams],
      });
    } catch {
      // User dismissed the add prompt, or chain already existed — the SDK's own
      // switch will surface a real error if it genuinely can't proceed.
    }
  }

  function onSelectDestination(value: string) {
    setToChain(value);
    void ensureDestinationChain(value);
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

      // Ensure the destination is added to the wallet before the mint step needs
      // to switch to it (prevents "Unrecognized chain ID" at the mint step).
      await ensureDestinationChain(toChain);

      const result = await executeBridge(
        {
          provider,
          fromChain: ARC_SWAP_CHAIN,
          toChain,
          amount,
        },
        (s) => setStage(s),
      );

      // BridgeResult.state is the authoritative outcome: 'success' only after
      // the destination mint lands. Surface pending/error honestly instead of
      // always reporting success (which previously hid a failed mint).
      setTxHash(result.txHash ?? null);
      setDestinationTxHash(result.destinationTxHash ?? null);
      setSteps(result.steps);
      if (result.state === "success") {
        setPhase("done");
      } else if (result.state === "error") {
        const failed = result.steps.find((s) => s.state === "error");
        setError(
          failed?.errorMessage
            ? `Bridge failed at ${failed.name}: ${failed.errorMessage}`
            : "The bridge could not be completed.",
        );
        setPhase("error");
      } else {
        // Pending — relayer/mint still settling. Keep the running UI but mark
        // the burn done so the user sees progress.
        setStage("mint");
        setPhase("done");
      }
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
              onChange={(e) => onSelectDestination(e.target.value)}
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

      {steps.length > 0 && (phase === "done" || phase === "error") && (
        <Card className="p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            Transfer steps
          </p>
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-fg">{s.name}</span>
                <span
                  className={
                    s.state === "success"
                      ? "text-accent"
                      : s.state === "error"
                        ? "text-danger"
                        : "text-fg-tertiary"
                  }
                >
                  {s.state}
                  {s.txHash && (
                    <a
                      href={
                        s.explorerUrl ??
                        (s.name.toLowerCase().includes("mint")
                          ? `${BRIDGE_CHAIN_META[toChain]?.explorerBase ?? "https://sepolia.basescan.org"}/tx/${s.txHash}`
                          : arcTxUrl(s.txHash))
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 underline underline-offset-2"
                    >
                      ↗
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {phase === "done" && (
        <StatusLine tone="success">
          {destinationTxHash ? (
            <>
              Bridge complete — your USDC was minted on the destination.{" "}
              <a
                href={`${BRIDGE_CHAIN_META[toChain]?.explorerBase ?? "https://sepolia.basescan.org"}/tx/${destinationTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                View destination transaction
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          ) : (
            <>
              Burn confirmed on Arc. Your USDC is now minting on the destination
              — that step finishes when Circle&apos;s attestation lands (usually
              1–15 min). The burn shows as a transfer to the null address,
              which is normal for CCTP.{" "}
            </>
          )}
          {txHash && (
            <a
              href={arcTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-1 underline underline-offset-2"
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
