"use client";

import { Check, Coins, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import * as React from "react";

import {
  Button,
  Card,
  DetailRow,
  Input,
  Label,
  StatusLine,
} from "@charge/ui";
import { arcAddressUrl, arcTxUrl } from "@charge/chains";
import { CHARGE_TOKEN_BYTECODE } from "@charge/contracts";
import {
  deployToken,
  humanizeDeployError,
  validateTokenParams,
  type CreateTokenResult,
} from "@charge/sdk";
import { useArcBalance, useWallet } from "@charge/web3";

type Phase = "idle" | "signing" | "pending" | "done" | "error";

export function CreateTokenPanel() {
  const { address, getProvider, isOnArc } = useWallet();
  const balance = useArcBalance(address);

  const [name, setName] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [supply, setSupply] = React.useState("");
  const [decimals, setDecimals] = React.useState("18");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CreateTokenResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Validate through the SDK so the UI and the chain agree on the rules.
  const validation = React.useMemo(
    () =>
      validateTokenParams({
        name,
        symbol,
        totalSupply: supply,
        decimals: Number(decimals),
      }),
    [name, symbol, supply, decimals],
  );

  const touched = name.length > 0 || symbol.length > 0 || supply.length > 0;
  const canSubmit =
    isOnArc && validation.ok && phase !== "signing" && phase !== "pending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !address) return;

    setError(null);
    setResult(null);
    setPhase("signing");

    try {
      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      setPhase("pending");
      const res = await deployToken(
        {
          provider,
          account: address,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          totalSupply: supply,
          decimals: Number(decimals),
        },
        CHARGE_TOKEN_BYTECODE,
      );

      setResult(res);
      setPhase("done");
      balance.refetch();
    } catch (err) {
      setError(humanizeDeployError(err));
      setPhase("error");
    }
  }

  async function copyAddress() {
    if (!result) return;
    await navigator.clipboard.writeText(result.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const busy = phase === "signing" || phase === "pending";

  if (phase === "done" && result) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/15 text-success">
            <Check className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            {name} is live on Arc
          </h2>
          <p className="mt-1.5 text-fg-secondary">
            The entire supply is in your wallet. No one can mint more.
          </p>
        </div>

        <Card className="p-4">
          <DetailRow label="Name" value={name} />
          <DetailRow label="Symbol" value={symbol.toUpperCase()} />
          <DetailRow label="Total supply" value={supply} />
          <DetailRow label="Decimals" value={decimals} />
        </Card>

        <div>
          <Label>Contract address</Label>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-sm">
              {result.contractAddress}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyAddress()}
            >
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" asChild>
            <a
              href={arcAddressUrl(result.contractAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              View contract
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a
              href={arcTxUrl(result.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              Deployment transaction
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        </div>

        <Button
          block
          variant="secondary"
          onClick={() => {
            setPhase("idle");
            setResult(null);
            setName("");
            setSymbol("");
            setSupply("");
          }}
        >
          Launch another token
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="token-name">Token name</Label>
          <Input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Charge Points"
            maxLength={64}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="token-symbol">Symbol</Label>
          <Input
            id="token-symbol"
            value={symbol}
            onChange={(e) =>
              setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            placeholder="CHRG"
            maxLength={11}
            className="mt-2 font-mono uppercase"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="token-supply">Total supply</Label>
          <Input
            id="token-supply"
            value={supply}
            onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="1000000"
            inputMode="numeric"
            className="mt-2 tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor="token-decimals">Decimals</Label>
          <Input
            id="token-decimals"
            value={decimals}
            onChange={(e) =>
              setDecimals(e.target.value.replace(/[^\d]/g, "").slice(0, 2))
            }
            inputMode="numeric"
            className="mt-2 tabular-nums"
          />
        </div>
      </div>

      {touched && !validation.ok && (
        <StatusLine tone="warning">{validation.error}</StatusLine>
      )}

      {/*
        State the guarantees explicitly. A token launcher that does not say who
        can mint is asking users to trust it blindly — the contract has no mint
        function at all, so say so.
      */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-charge"
            aria-hidden
          />
          <div className="text-sm">
            <p className="font-medium text-fg">What you get</p>
            <ul className="mt-1.5 space-y-1 text-fg-secondary">
              <li>Entire supply minted to your wallet at deployment.</li>
              <li>No mint function — the supply can never increase.</li>
              <li>No owner or admin keys. Charge holds nothing.</li>
            </ul>
          </div>
        </div>
      </Card>

      {balance.nativeRaw === 0n && !balance.isLoading && (
        <StatusLine tone="warning">
          You need native USDC to pay the deployment fee.
        </StatusLine>
      )}

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "pending" && (
        <StatusLine>Deploying your contract to Arc…</StatusLine>
      )}

      <Button type="submit" size="lg" block loading={busy} disabled={!canSubmit}>
        {phase === "signing" ? (
          "Confirm in your wallet…"
        ) : phase === "pending" ? (
          "Deploying…"
        ) : (
          <>
            <Coins className="size-4" aria-hidden />
            Launch token
          </>
        )}
      </Button>

      {!isOnArc && (
        <p className="text-center text-xs text-fg-tertiary">
          Switch to Arc Testnet to deploy.
        </p>
      )}
    </form>
  );
}
