"use client";

import { ArrowDown, ExternalLink, RefreshCw, Network } from "lucide-react";
import * as React from "react";
import { useSearchParams } from "next/navigation";

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
  ARC_CHAIN_ID,
  ARC_SWAP_CHAIN,
  SWAP_CHAINS,
  SWAP_CHAINS_EVM,
  TOKEN_REGISTRY,
  arcTxUrl,
  swapChainExplorer,
  swapChainNumericId,
  tokensForChain,
  usesAmmSwap,
  validateSwap,
} from "@charge/chains";
import {
  estimateSwap,
  executeSwap,
  humanizeSwapError,
  quoteAmmSwap,
  executeAmmSwap,
  readTokenMeta,
  type SwapEstimate,
} from "@charge/sdk";
import { useWallet, useTokenBalance } from "@charge/web3";

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
  const { address, getProvider, chainId, switchChain } = useWallet();

  // Default to Arc Testnet — swaps route through the live Uniswap V2 AMM
  // (per Circle arc-node#160) which has USDC/EURC liquidity. Mainnets use
  // Circle App Kit. Either way the panel shows a real quote out of the box.
  const [selectedChain, setSelectedChain] = React.useState<string>(ARC_SWAP_CHAIN);
  const [tokenIn, setTokenIn] = React.useState("USDC");
  const [tokenOut, setTokenOut] = React.useState("EURC");
  const [amountIn, setAmountIn] = React.useState("");
  const [estimate, setEstimate] = React.useState<SwapEstimate | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);

  const debouncedAmount = useDebounced(amountIn, 450);

  // Launched/custom tokens arrive as addresses (?from=/?to=). Resolve symbol
  // + decimals on-chain so they can be swapped like registry tokens.
  const params = useSearchParams();
  const [customIn, setCustomIn] = React.useState<{
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  } | null>(null);
  const [customOut, setCustomOut] = React.useState<{
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  } | null>(null);

  React.useEffect(() => {
    let alive = true;
    const from = params.get("from");
    const to = params.get("to");
    if (from && /^0x[a-f0-9]{40}$/i.test(from)) {
      readTokenMeta(from as `0x${string}`)
        .then((m) => {
          if (alive)
            setCustomIn({
              address: from as `0x${string}`,
              symbol: m.symbol || "TOKEN",
              decimals: m.decimals,
            });
        })
        .catch(() => alive && setCustomIn(null));
    } else setCustomIn(null);
    if (to && /^0x[a-f0-9]{40}$/i.test(to)) {
      readTokenMeta(to as `0x${string}`)
        .then((m) => {
          if (alive)
            setCustomOut({
              address: to as `0x${string}`,
              symbol: m.symbol || "TOKEN",
              decimals: m.decimals,
            });
        })
        .catch(() => alive && setCustomOut(null));
    } else setCustomOut(null);
    return () => {
      alive = false;
    };
  }, [params]);

  // Launched tokens on the active chain, merged into the token selectors so
  // users can pick any deployed token (not just the official USDC/EURC/CIRBTC
  // registry set). Each carries its contract address + decimals for the AMM
  // address-override path.
  const [launched, setLaunched] = React.useState<
    { address: `0x${string}`; symbol: string; decimals: number }[]
  >([]);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((d: { tokens?: { address: string; symbol: string; decimals: number }[] }) => {
        if (!alive) return;
        const list = (d.tokens ?? [])
          .filter((t) => t.address?.startsWith("0x"))
          .map((t) => ({
            address: t.address as `0x${string}`,
            symbol: (t.symbol || "TOKEN").toUpperCase(),
            decimals: t.decimals ?? 18,
          }));
        setLaunched(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const chainTokens = React.useMemo(
    () => tokensForChain(selectedChain),
    [selectedChain],
  );

  // Selectable list = registry tokens + launched-token symbols (deduped).
  const selectableIn = React.useMemo(() => {
    const set = new Set(chainTokens);
    launched.forEach((l) => set.add(l.symbol));
    return [...set];
  }, [chainTokens, launched]);
  const selectableOut = selectableIn;

  // When the selected symbol matches a launched token, point customIn /
  // customOut at its contract so quotes/executes route via the AMM override.
  React.useEffect(() => {
    const match = launched.find((l) => l.symbol === tokenIn);
    setCustomIn(match ? { address: match.address, symbol: match.symbol, decimals: match.decimals } : null);
  }, [tokenIn, launched]);
  React.useEffect(() => {
    const match = launched.find((l) => l.symbol === tokenOut);
    setCustomOut(match ? { address: match.address, symbol: match.symbol, decimals: match.decimals } : null);
  }, [tokenOut, launched]);

  const chainTokensForValidation = React.useMemo(
    () => [...new Set([...chainTokens, ...launched.map((l) => l.symbol)])],
    [chainTokens, launched],
  );

  // Keep the selected tokens valid for the active chain; fall back to the
  // first available if the chain change dropped the current pick.
  React.useEffect(() => {
    if (!chainTokensForValidation.includes(tokenIn)) setTokenIn(chainTokens[0] ?? "USDC");
    if (!chainTokensForValidation.includes(tokenOut)) {
      setTokenOut(chainTokens.find((t) => t !== tokenIn) ?? chainTokens[0] ?? "USDC");
    }
  }, [chainTokens, chainTokensForValidation, tokenIn, tokenOut]);

  const selectedNumeric = swapChainNumericId(selectedChain);
  const needsSwitch = selectedNumeric !== undefined && chainId !== selectedNumeric;

  // Per-token balances for the selected from/to assets on the active chain.
  // Custom (launched) tokens use a synthesized meta resolved on-chain.
  const tokenInMeta =
    customIn?.address != null
      ? {
          address: customIn.address,
          decimals: customIn.decimals,
          symbol: customIn.symbol,
        }
      : TOKEN_REGISTRY[selectedChain]?.[tokenIn];
  const tokenOutMeta =
    customOut?.address != null
      ? {
          address: customOut.address,
          decimals: customOut.decimals,
          symbol: customOut.symbol,
        }
      : TOKEN_REGISTRY[selectedChain]?.[tokenOut];
  const balIn = useTokenBalance({
    chainId: selectedNumeric ?? ARC_CHAIN_ID,
    address,
    token: tokenInMeta,
  });
  const balOut = useTokenBalance({
    chainId: selectedNumeric ?? ARC_CHAIN_ID,
    address,
    token: tokenOutMeta,
  });

  // Effective token ids: addresses when custom (so validateSwap + the SDK
  // address override both resolve the real contract).
  const effectiveIn = customIn?.address ?? tokenIn;
  const effectiveOut = customOut?.address ?? tokenOut;

  const pairCheck = React.useMemo(
    () =>
      validateSwap({
        chain: selectedChain,
        tokenIn: effectiveIn,
        tokenOut: effectiveOut,
        amountIn: debouncedAmount || "0",
      }),
    [selectedChain, effectiveIn, effectiveOut, debouncedAmount],
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

        const est = usesAmmSwap(selectedChain)
          ? await quoteAmmSwap({
              provider: provider as never,
              address: address as `0x${string}`,
              chain: selectedChain,
              tokenIn: effectiveIn,
              tokenOut: effectiveOut,
              tokenInAddress: customIn?.address,
              tokenOutAddress: customOut?.address,
              tokenInDecimals: customIn?.decimals,
              tokenOutDecimals: customOut?.decimals,
              amountIn: debouncedAmount,
            })
          : await estimateSwap({
              provider,
              address: address as `0x${string}`,
              chain: selectedChain,
              tokenIn: effectiveIn,
              tokenOut: effectiveOut,
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
  }, [debouncedAmount, selectedChain, tokenIn, tokenOut, pairCheck.ok, getProvider]);

  function flip() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setEstimate(null);
  }

  async function ensureChain() {
    if (needsSwitch && selectedNumeric !== undefined) {
      await switchChain(selectedNumeric);
    }
  }

  async function onSwap(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !pairCheck.ok) return;

    setError(null);
    setPhase("signing");
    try {
      // Make sure the wallet is on the chain we're swapping on before the
      // user is asked to sign — otherwise the wallet rejects with a
      // "wrong network" error.
      await ensureChain();

      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      const res = usesAmmSwap(selectedChain)
        ? await executeAmmSwap({
            provider: provider as never,
            address: address as `0x${string}`,
            chain: selectedChain,
            tokenIn: effectiveIn,
            tokenOut: effectiveOut,
            tokenInAddress: customIn?.address,
            tokenOutAddress: customOut?.address,
            tokenInDecimals: customIn?.decimals,
            tokenOutDecimals: customOut?.decimals,
            amountIn,
          })
        : await executeSwap({
            provider,
            address: address as `0x${string}`,
            chain: selectedChain,
            tokenIn: effectiveIn,
            tokenOut: effectiveOut,
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
    pairCheck.ok && Number(amountIn) > 0 && !!estimate && !busy;

  const explorerBase = swapChainExplorer(selectedChain);
  const chainName =
    SWAP_CHAINS.find((c) => c.id === selectedChain)?.name ?? selectedChain;

  return (
    <form onSubmit={onSwap} className="space-y-4">
      {/* Network selector — swaps run on any supported chain, not just Arc. */}
      <div>
        <Label>Network</Label>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-fg/10 bg-fg/[0.03] px-3 py-3 text-sm font-medium focus-within:border-charge/50">
          <Network className="size-4 text-fg-secondary" aria-hidden />
          <select
            aria-label="Swap network"
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="w-full bg-transparent outline-none"
          >
            {SWAP_CHAINS_EVM.map((c) => (
              <option key={c.id} value={c.id} className="bg-elevated">
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="swap-from">You pay</Label>
        <div className="mt-2 flex gap-2">
          <select
            aria-label="Token to swap from"
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            className="rounded-xl border border-fg/10 bg-fg/[0.03] px-3 py-3 text-sm font-medium outline-none focus:border-charge/50"
          >
            {selectableIn.map((t) => (
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
        <div className="mt-1.5 flex items-center justify-between text-xs text-fg-tertiary">
          <span>
            {balIn.balance != null
              ? `Balance: ${balIn.balance} ${tokenIn}`
              : "Balance unavailable"}
          </span>
          {balIn.balance != null && Number(balIn.balance) > 0 && (
            <button
              type="button"
              onClick={() => setAmountIn(balIn.balance ?? "")}
              className="font-medium text-charge transition hover:opacity-80"
            >
              MAX
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={flip}
          aria-label="Swap direction"
          className={cn(
            "rounded-xl border border-fg/10 bg-fg/[0.03] p-2",
            "transition hover:bg-fg/[0.07] active:scale-95",
          )}
        >
          <ArrowDown className="size-4" aria-hidden />
        </button>
      </div>

      <div>
        <Label htmlFor="swap-to">You receive</Label>
        <div className="flex gap-2">
          <select
            aria-label="Token to swap to"
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="rounded-xl border border-fg/10 bg-fg/[0.03] px-3 py-3 text-sm font-medium outline-none focus:border-charge/50"
          >
            {selectableOut.map((t) => (
              <option key={t} value={t} className="bg-elevated">
                {t}
              </option>
            ))}
          </select>
          <div className="flex flex-1 items-center rounded-xl border border-fg/10 bg-fg/[0.02] px-4 py-3 text-lg tabular-nums text-fg-secondary">
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
        <div className="mt-1.5 flex items-center justify-between text-xs text-fg-tertiary">
          <span>
            {balOut.balance != null
              ? `Balance: ${balOut.balance} ${tokenOut}`
              : "Balance unavailable"}
          </span>
        </div>
      </div>

      {!pairCheck.ok && <StatusLine tone="warning">{pairCheck.error}</StatusLine>}

      {estimate && (
        <Card className="p-4">
          <DetailRow
            label="Rate"
            value={`1 ${tokenIn} ≈ ${estimate.rate} ${tokenOut}`}
          />
          <DetailRow label="Slippage tolerance" value="3.00%" />
          <DetailRow label="Network" value={chainName} />
        </Card>
      )}

      <p className="text-xs leading-relaxed text-fg-tertiary">
        Swaps are routed through a third-party aggregator (currently LiFi). The
        aggregator may vary by route and is subject to change.
      </p>

      {needsSwitch && (
        <StatusLine tone="warning">
          Your wallet is on a different network. Switch to {chainName} to swap.
        </StatusLine>
      )}

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "done" && txHash && (
        <StatusLine tone="success">
          Swap complete.{" "}
          <a
            href={
              explorerBase ? `${explorerBase}/tx/${txHash}` : arcTxUrl(txHash)
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            View transaction
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </StatusLine>
      )}

      <Button type="submit" size="xl" block loading={busy} disabled={!canSwap}>
        {busy
          ? "Confirm in your wallet…"
          : needsSwitch
            ? `Switch to ${chainName}`
            : "Swap"}
      </Button>
    </form>
  );
}
