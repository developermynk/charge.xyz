"use client";

import { ArrowDown, ExternalLink, RefreshCw } from "lucide-react";
import * as React from "react";

import {
  AmountInput,
  Button,
  Card,
  DetailRow,
  Label,
  StatusLine,
  cn,
} from "@charge/ui";
import {
  ARC_SWAP_CHAIN,
  SWAP_TOKENS,
  arcTxUrl,
  validateSwap,
} from "@charge/chains";
import {
  estimateSwap,
  executeSwap,
  humanizeSwapError,
  type SwapEstimate,
} from "@charge/sdk";
import { useWallet } from "@charge/web3";

type Phase = "idle" | "quoting" | "signing" | "done" | "error";

/** Debounce so we don't fire a quote request on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SwapPanel() {
  const { address, getProvider, isOnArc } = useWallet();

  const [tokenIn, setTokenIn] = React.useState("USDC");
  const [tokenOut, setTokenOut] = React.useState("EURC");
  const [amountIn, setAmountIn] = React.useState("");
  const [estimate, setEstimate] = React.useState<SwapEstimate | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  const debouncedAmount = useDebounced(amountIn, 450);

  // Arc's native gas asset IS USDC, so USDC <-> NATIVE is a no-op, not a swap.
  // validateSwap encodes that rule; surface it before quoting.
  const pairCheck = React.useMemo(
    () =>
      validateSwap({
        chain: ARC_SWAP_CHAIN,
        tokenIn,
        tokenOut,
        amountIn: debouncedAmount || "0",
      }),
    [tokenIn, tokenOut, debouncedAmount],
  );

  // Fetch a quote whenever the (debounced) inputs form a valid request.
  React.useEffect(() => {
    let cancelled = false;
    const amt = Number(debouncedAmount);

    if (!pairCheck.ok || !Number.isFinite(amt) || amt <= 0) {
      setEstimate(null);
      return;
    }

    void (async () => {
      setPhase("quoting");
      setError(null);
      try {
        const provider = await getProvider();
        if (!provider) throw new Error("Connect a wallet to see a quote.");

        const est = await estimateSwap({
          provider,
          chain: ARC_SWAP_CHAIN,
          tokenIn,
          tokenOut,
          amountIn: debouncedAmount,
        });
        if (cancelled) return;
        setEstimate(est);
        setPhase("idle");
      } catch (err) {
        if (cancelled) return;
        setError(humanizeSwapError(err));
        setEstimate(null);
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedAmount, tokenIn, tokenOut, pairCheck.ok, getProvider]);

  function flip() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setEstimate(null);
  }

  async function onSwap(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !pairCheck.ok) return;

    setError(null);
    setPhase("signing");
    try {
      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      const res = await executeSwap({
        provider,
        chain: ARC_SWAP_CHAIN,
        tokenIn,
        tokenOut,
        amountIn,
      });

      setTxHash(res.txHash ?? null);
      setPhase("done");
      setAmountIn("");
      setEstimate(null);
    } catch (err) {
      setError(humanizeSwapError(err));
      setPhase("error");
    }
  }

  const busy = phase === "signing";
  const canSwap =
    isOnArc && pairCheck.ok && Number(amountIn) > 0 && !!estimate && !busy;

  return (
    <form onSubmit={onSwap} className="space-y-4">
      <div>
        <Label htmlFor="swap-from">You pay</Label>
        <div className="mt-2 flex gap-2">
          <select
            aria-label="Token to swap from"
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-medium outline-none focus:border-charge/50"
          >
            {SWAP_TOKENS.map((t) => (
              <option key={t} value={t} className="bg-elevated">
                {t}
              </option>
            ))}
          </select>
          <AmountInput
            id="swap-from"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.00"
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={flip}
          aria-label="Swap direction"
          className={cn(
            "rounded-xl border border-white/10 bg-white/[0.03] p-2",
            "transition hover:bg-white/[0.07] active:scale-95",
          )}
        >
          <ArrowDown className="size-4" aria-hidden />
        </button>
      </div>

      <div>
        <Label htmlFor="swap-to">You receive</Label>
        <div className="mt-2 flex gap-2">
          <select
            aria-label="Token to swap to"
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-medium outline-none focus:border-charge/50"
          >
            {SWAP_TOKENS.map((t) => (
              <option key={t} value={t} className="bg-elevated">
                {t}
              </option>
            ))}
          </select>
          <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-lg tabular-nums text-fg-secondary">
            {phase === "quoting" ? (
              <span className="inline-flex items-center gap-2 text-sm">
                <RefreshCw className="size-3.5 animate-spin" aria-hidden />
                Fetching quote…
              </span>
            ) : (
              (estimate?.estimatedOutput ?? "0.00")
            )}
          </div>
        </div>
      </div>

      {!pairCheck.ok && (
        <StatusLine tone="warning">{pairCheck.error}</StatusLine>
      )}

      {estimate && (
        <Card className="p-4">
          <DetailRow
            label="Rate"
            value={`1 ${tokenIn} ≈ ${estimate.rate} ${tokenOut}`}
          />
          <DetailRow label="Slippage tolerance" value="3.00%" />
          <DetailRow label="Network" value="Arc Testnet" />
        </Card>
      )}

      {/*
        Required disclosure: swaps route through a third-party aggregator
        (currently LiFi), which the user is subject to the terms of.
      */}
      <p className="text-xs leading-relaxed text-fg-tertiary">
        Swaps are routed through a third-party aggregator (currently LiFi). The
        aggregator may vary by route and is subject to change.
      </p>

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "done" && txHash && (
        <StatusLine tone="success">
          Swap complete.{" "}
          <a
            href={arcTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            View transaction
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </StatusLine>
      )}

      <Button type="submit" size="lg" block loading={busy} disabled={!canSwap}>
        {busy ? "Confirm in your wallet…" : "Swap"}
      </Button>

      {!isOnArc && (
        <p className="text-center text-xs text-fg-tertiary">
          Switch to Arc Testnet to swap.
        </p>
      )}
    </form>
  );
}
