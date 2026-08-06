"use client";

import { ArrowRight, ExternalLink, Send } from "lucide-react";
import * as React from "react";
import { isAddress } from "viem";

import {
  AmountInput,
  Badge,
  Button,
  Card,
  DetailRow,
  Input,
  Label,
  StatusLine,
  cn,
} from "@charge/ui";
import { arcTxUrl, ARC_TOKENS } from "@charge/chains";
import {
  transfer,
  waitForTransfer,
  humanizeTransferError,
  type TransferAsset,
} from "@charge/sdk";
import { useArcBalance, useWallet } from "@charge/web3";

type Phase = "idle" | "signing" | "pending" | "done" | "error";

const ASSETS: {
  id: TransferAsset;
  label: string;
  hint: string;
  decimals: number;
}[] = [
  {
    id: "native",
    label: "Gas USDC",
    hint: "Native · 18 decimals · pays fees",
    decimals: 18,
  },
  {
    id: "usdc",
    label: "USDC",
    hint: "ERC-20 · 6 decimals",
    decimals: 6,
  },
  {
    id: "eurc",
    label: "EURC",
    hint: "ERC-20 · 6 decimals",
    decimals: 6,
  },
];

export function SendPanel() {
  const { address, getProvider, isOnArc } = useWallet();
  const balance = useArcBalance(address);

  const [asset, setAsset] = React.useState<TransferAsset>("usdc");
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  const available =
    asset === "native" ? balance.nativeFormatted : balance.usdcFormatted;

  // Validate as the user types rather than only on submit.
  const recipientError =
    to.length > 0 && !isAddress(to) ? "Enter a valid 0x address." : null;

  const amountNum = Number(amount);
  const amountError =
    amount.length > 0 && (!Number.isFinite(amountNum) || amountNum <= 0)
      ? "Enter an amount greater than zero."
      : amount.length > 0 && amountNum > Number(available)
        ? `Exceeds your balance of ${available}.`
        : null;

  const canSubmit =
    isOnArc &&
    isAddress(to) &&
    amount.length > 0 &&
    !amountError &&
    phase !== "signing" &&
    phase !== "pending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !address) return;

    setError(null);
    setTxHash(null);
    setPhase("signing");

    try {
      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      const hash = await transfer({
        provider,
        from: address,
        to,
        amount,
        asset,
      });

      setTxHash(hash);
      setPhase("pending");

      await waitForTransfer(hash);

      setPhase("done");
      setAmount("");
      setTo("");
      balance.refetch();
    } catch (err) {
      setError(humanizeTransferError(err));
      setPhase("error");
    }
  }

  const busy = phase === "signing" || phase === "pending";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Asset selector — explicit, never inferred. */}
      <div>
        <Label>Asset</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {ASSETS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAsset(a.id)}
              aria-pressed={asset === a.id}
              className={cn(
                "rounded-xl border p-3 text-left transition-all duration-200",
                asset === a.id
                  ? "border-charge/45 bg-charge/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              <span className="block text-sm font-medium text-fg">
                {a.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-fg-tertiary">
                {a.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="recipient">Recipient address</Label>
        <Input
          id="recipient"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="mt-2 font-mono"
          aria-invalid={Boolean(recipientError)}
          aria-describedby={recipientError ? "recipient-error" : undefined}
        />
        {recipientError && (
          <p id="recipient-error" className="mt-1.5 text-xs text-danger">
            {recipientError}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="amount">Amount</Label>
          <span className="text-xs tabular-nums text-fg-tertiary">
            Available {available}
          </span>
        </div>
        <AmountInput
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          symbol={ASSETS.find((a) => a.id === asset)?.label}
          onMax={() => setAmount(available)}
          className="mt-2"
          aria-invalid={Boolean(amountError)}
        />
        {amountError && (
          <p className="mt-1.5 text-xs text-danger">{amountError}</p>
        )}
      </div>

      {asset !== "native" && balance.nativeRaw === 0n && (
        <StatusLine tone="warning">
          You have no gas balance. Even an ERC-20 transfer needs native USDC to
          pay the fee.
        </StatusLine>
      )}

      <Card className="p-4">
        <DetailRow label="Network" value="Arc Testnet" />
        <DetailRow
          label="Token contract"
          value={
            asset === "native"
              ? "Native asset"
              : `${(asset === "eurc" ? ARC_TOKENS.EURC : ARC_TOKENS.USDC).slice(0, 10)}…`
          }
        />
        <DetailRow label="Decimals" value={asset === "native" ? "18" : "6"} />
      </Card>

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "pending" && (
        <StatusLine>Waiting for the transaction to confirm…</StatusLine>
      )}

      {phase === "done" && txHash && (
        <StatusLine tone="success">
          Sent.{" "}
          <a
            href={arcTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            View on explorer
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </StatusLine>
      )}

      <Button type="submit" size="lg" block loading={busy} disabled={!canSubmit}>
        {phase === "signing" ? (
          "Confirm in your wallet…"
        ) : phase === "pending" ? (
          "Confirming…"
        ) : (
          <>
            <Send className="size-4" aria-hidden />
            Send
          </>
        )}
      </Button>

      {!isOnArc && (
        <p className="text-center text-xs text-fg-tertiary">
          Switch to Arc Testnet to send.
        </p>
      )}
    </form>
  );
}
