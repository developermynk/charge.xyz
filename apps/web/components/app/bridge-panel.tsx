"use client";

import { ArrowRight, ExternalLink, Network } from "lucide-react";
import * as React from "react";

import {
  AmountInput,
  Button,
  Card,
  DetailRow,
  Label,
  StatusLine,
  TxProgress,
  cn,
  type StepState,
} from "@charge/ui";
import {
  ARC_SWAP_CHAIN,
  SWAP_CHAINS,
  SWAP_CHAINS_EVM,
  USDC_CONTRACTS,
  ARC_CHAIN_ID,
  arcTxUrl,
  bridgeAddParams,
  bridgeExplorer,
  swapChainNumericId,
  BRIDGE_DESTINATIONS,
} from "@charge/chains";
import {
  BRIDGE_STAGES,
  executeBridge,
  recordTx,
  humanizeBridgeError,
  type BridgeStageId,
  type BridgeStepInfo,
} from "@charge/sdk";
import { useWallet, useChainBalance } from "@charge/web3";
import { ChainIcon } from "@/components/app/token-icon";

type Phase = "idle" | "running" | "done" | "error";

/**
 * Bridge directions Circle's testnet CCTP actually supports (empirically
 * verified against @circle-fin/app-kit@1.11.0 in the charge-cctp-bridge-debug
 * skill). Arc Testnet <-> each of the 5 testnet destinations, in BOTH
 * directions. Derived from `BRIDGE_DESTINATIONS` so it can never drift from the
 * chain list — add a destination there and both directions open up.
 */
const BRIDGE_ROUTES_VERIFIED: ReadonlyArray<[string, string]> = [
  ...BRIDGE_DESTINATIONS.map(
    (d): [string, string] => ["Arc_Testnet", d.id],
  ),
  ...BRIDGE_DESTINATIONS.map(
    (d): [string, string] => [d.id, "Arc_Testnet"],
  ),
];

const routeUnsupported = (from: string, to: string) =>
  !BRIDGE_ROUTES_VERIFIED.some(([f, t]) => f === from && t === to);

const chainName = (sdkId: string) =>
  SWAP_CHAINS_EVM.find((c) => c.id === sdkId)?.name ?? sdkId;

export function BridgePanel() {
  const { address, getProvider, chainId, switchChain, isConnected } =
    useWallet();

  const [fromChain, setFromChain] = React.useState<string>(ARC_SWAP_CHAIN);
  const [toChain, setToChain] = React.useState<string>("Base_Sepolia");
  const [amount, setAmount] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [stage, setStage] = React.useState<BridgeStageId | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [destinationTxHash, setDestinationTxHash] = React.useState<string | null>(
    null,
  );
  const [steps, setSteps] = React.useState<BridgeStepInfo[]>([]);

  // Source-chain USDC balance (generic — works for any chain, not just Arc).
  const fromNumeric = swapChainNumericId(fromChain);
  const balance = useChainBalance({
    chainId: fromNumeric ?? ARC_CHAIN_ID,
    address,
    usdcAddress: USDC_CONTRACTS[fromChain],
    sdkId: fromChain,
  });
  const sourceBalance = balance.usdcFormatted ?? "0";

  const fromSwitchId = swapChainNumericId(fromChain);
  const needsFromSwitch =
    fromSwitchId !== undefined && chainId !== fromSwitchId;
  const sameChain = fromChain === toChain;

  const amountNum = Number(amount);
  const amountError =
    amount.length > 0 && (!Number.isFinite(amountNum) || amountNum <= 0)
      ? "Enter an amount greater than zero."
      : amount.length > 0 && amountNum > Number(sourceBalance)
        ? `Exceeds your balance of ${sourceBalance}.`
        : null;

  const canSubmit =
    isConnected &&
    amount.length > 0 &&
    !amountError &&
    Boolean(fromChain) &&
    Boolean(toChain) &&
    !sameChain &&
    !routeUnsupported(fromChain, toChain) &&
    phase !== "running";

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

  async function ensureChain(chainSdkId: string) {
    const numeric = swapChainNumericId(chainSdkId);
    if (numeric === undefined || chainId === numeric) return;
    try {
      const provider = await getProvider();
      if (!provider?.request) return;
      const params = bridgeAddParams(chainSdkId);
      if (params) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [params],
        });
      }
      await switchChain(numeric);
    } catch {
      // User dismissed the prompt or chain already exists — the SDK's own
      // switch will surface a real error if it genuinely can't proceed.
    }
  }

  function onSelectFrom(value: string) {
    setFromChain(value);
    if (value === toChain) {
      // Pick a different default destination so we never bridge to self.
      const alt = SWAP_CHAINS_EVM.find((c) => c.id !== value);
      if (alt) setToChain(alt.id);
    }
  }

  function onSelectTo(value: string) {
    setToChain(value);
    void ensureChain(value);
  }

  function onFlip() {
    setFromChain(toChain);
    setToChain(fromChain);
    void ensureChain(toChain);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !address) return;

    setError(null);
    setTxHash(null);
    setDestinationTxHash(null);
    setStage("approve");
    setPhase("running");

    try {
      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      // Make sure the wallet is on the source chain before the burn.
      await ensureChain(fromChain);

      const result = await executeBridge(
        {
          provider,
          fromChain,
          toChain,
          amount,
        },
        (s) => setStage(s),
      );

      setTxHash(result.txHash ?? null);
      if (result.txHash) {
        recordTx(address, {
          id: `${result.txHash}:bridge`,
          type: "bridge",
          chainId: swapChainNumericId(fromChain) ?? ARC_CHAIN_ID,
          hash: result.txHash,
          ts: new Date().toISOString(),
          summary: `Bridge ${amount} USDC: ${chainName(fromChain)} → ${chainName(toChain)}`,
          counterparty: chainName(toChain),
        });
      }
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

  const fromExplorer = bridgeExplorer(fromChain);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Route: source + destination are both selectable. */}
      <div>
        <Label>Route</Label>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1">
            <label htmlFor="from-chain" className="sr-only">
              Source chain
            </label>
            <div className="relative">
              <ChainIcon
                chainId={swapChainNumericId(fromChain)}
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-secondary"
              />
              <select
                id="from-chain"
                value={fromChain}
                onChange={(e) => onSelectFrom(e.target.value)}
                className="h-[58px] w-full rounded-xl border border-fg/10 bg-fg/[0.03] pl-9 pr-4 text-fg outline-none transition-colors focus-visible:border-charge/50 focus-visible:ring-2 focus-visible:ring-charge/25"
              >
                {SWAP_CHAINS_EVM.map((c) => (
                  <option key={c.id} value={c.id} className="bg-elevated">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="mt-1 flex items-center gap-1.5 pl-1 text-xs text-fg-tertiary">
              <ChainIcon chainId={swapChainNumericId(fromChain)} size={14} />
              From · {chainName(fromChain)}
            </span>
          </div>

          <button
            type="button"
            onClick={onFlip}
            aria-label="Swap route direction"
            className={cn(
              "mt-5 rounded-xl border border-fg/10 bg-fg/[0.03] p-2.5",
              "transition hover:bg-fg/[0.07] active:scale-95",
            )}
          >
            <ArrowRight className="size-4" aria-hidden />
          </button>

          <div className="flex-1">
            <label htmlFor="to-chain" className="sr-only">
              Destination chain
            </label>
            <div className="relative">
              <ChainIcon
                chainId={swapChainNumericId(toChain)}
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-secondary"
              />
              <select
                id="to-chain"
                value={toChain}
                onChange={(e) => onSelectTo(e.target.value)}
                className="h-[58px] w-full rounded-xl border border-fg/10 bg-fg/[0.03] pl-9 pr-4 text-fg outline-none transition-colors focus-visible:border-charge/50 focus-visible:ring-2 focus-visible:ring-charge/25"
              >
                {SWAP_CHAINS_EVM.filter((c) => c.id !== fromChain).map((c) => (
                  <option key={c.id} value={c.id} className="bg-elevated">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="mt-1 flex items-center gap-1.5 pl-1 text-xs text-fg-tertiary">
              <ChainIcon chainId={swapChainNumericId(toChain)} size={14} />
              To · {chainName(toChain)}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="bridge-amount">Amount</Label>
          <span className="text-xs tabular-nums text-fg-tertiary">
            Available {sourceBalance} USDC
          </span>
        </div>
        <AmountInput
          id="bridge-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          symbol="USDC"
          onMax={() => setAmount(sourceBalance)}
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
        <DetailRow label="Rate" value="1:1 — no price slippage" />
        <DetailRow
          label="Fees"
          value="Only network gas; Circle takes no spread"
        />
        <DetailRow label="Typical time" value="1–15 minutes" />
        <p className="mt-2 text-xs text-fg-tertiary">
          CCTP burns your USDC on the source chain and mints the exact same
          amount on the destination — there&apos;s no swap and no slippage, so
          your funds can&apos;t lose value to price movement. The only cost is
          the gas fee for each transaction.
        </p>
      </Card>

      {(phase === "running" || phase === "done" || phase === "error") && (
        <Card className="p-4">
          <TxProgress
            steps={BRIDGE_STAGES.map((s, i) => {
              const detailStep = steps[i];
              const explorerUrl =
                detailStep?.txHash &&
                (detailStep.explorerUrl ??
                  (s.id === "mint"
                    ? `${bridgeExplorer(toChain) ?? "https://sepolia.basescan.org"}/tx/${detailStep.txHash}`
                    : fromExplorer
                      ? `${fromExplorer}/tx/${detailStep.txHash}`
                      : arcTxUrl(detailStep.txHash)));
              const label =
                detailStep && detailStep.state !== "pending" && detailStep.state !== "noop"
                  ? detailStep.state === "success"
                    ? "success"
                    : detailStep.state
                  : undefined;
              return {
                id: s.id,
                label: s.label,
                state: stateFor(s.id),
                detail: label ? (
                  explorerUrl ? (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline underline-offset-2"
                    >
                      {label} ↗
                    </a>
                  ) : (
                    label
                  )
                ) : undefined,
              };
            })}
          />
        </Card>
      )}

      {phase === "running" && stage === "attest" && (
        <StatusLine>
          Circle is attesting the burn. This is the slow step — your USDC is
          already burned on {chainName(fromChain)} and will mint on{" "}
          {chainName(toChain)}. Safe to keep this tab open.
        </StatusLine>
      )}

      {needsFromSwitch && (
        <StatusLine tone="warning">
          Your wallet is on a different network. Switch to{" "}
          {chainName(fromChain)} to bridge.
        </StatusLine>
      )}

      {sameChain && (
        <StatusLine tone="warning">
          Source and destination must be different chains.
        </StatusLine>
      )}

      {!sameChain && routeUnsupported(fromChain, toChain) && (
        <StatusLine tone="warning">
          That bridge route isn&apos;t enabled on testnet yet. Circle&apos;s testnet
          CCTP supports Arc Testnet ↔ Base / Arbitrum / OP / Ethereum Sepolia and
          Avalanche Fuji in both directions. Try one of those pairs.
        </StatusLine>
      )}

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "done" && (
        <StatusLine tone="success">
          {destinationTxHash ? (
            <>
              Bridge complete — your USDC was minted on{" "}
              {chainName(toChain)}.{" "}
              <a
                href={`${bridgeExplorer(toChain) ?? "https://sepolia.basescan.org"}/tx/${destinationTxHash}`}
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
              Burn confirmed on {chainName(fromChain)}. Your USDC is now minting
              on {chainName(toChain)} — that step finishes when Circle&apos;s
              attestation lands (usually 1–15 min). The burn shows as a transfer
              to the null address, which is normal for CCTP.{" "}
            </>
          )}
          {txHash && (
            <a
              href={fromExplorer ? `${fromExplorer}/tx/${txHash}` : arcTxUrl(txHash)}
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
        {phase === "running"
          ? "Bridging…"
          : needsFromSwitch
            ? `Switch to ${chainName(fromChain)}`
            : `Bridge USDC`}
      </Button>
    </form>
  );
}
