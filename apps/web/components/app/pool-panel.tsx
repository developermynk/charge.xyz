"use client";

import * as React from "react";
import { Droplets, Info } from "lucide-react";
import { type EIP1193Provider, formatUnits } from "viem";

import {
  AmountInput,
  Button,
  Card,
  DetailRow,
  Label,
  StatusLine,
  cn,
} from "@charge/ui";
import { ARC_AMM_FEE_BPS, LP_POOLS, getPoolById, type LpPoolDef } from "@charge/chains";
import {
  computeApy,
  formatApy,
  getLpPosition,
  provideLiquidity,
  quoteDeposit,
  quoteRemoveLiquidity,
  removeLiquidity,
  tokenMeta,
  type LpPosition,
} from "@charge/sdk";
import { useWallet, useTokenBalance } from "@charge/web3";

type Phase = "idle" | "running" | "done" | "error";
type Mode = "deposit" | "withdraw";

const ARC_CHAIN_ID = 5042002;

/** Map raw viem/revert errors to human-readable messages (no raw codes shown). */
function humanizeLpError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  if (m.includes("user rejected") || m.includes("rejected")) {
    return "Transaction rejected in your wallet.";
  }
  if (m.includes("allowance") || m.includes("approval")) {
    return "Token approval failed. Please approve the token and try again.";
  }
  if (m.includes("transfer_from_failed") || m.includes("transferfrom")) {
    return "Token transfer failed. Check your balance and approval, then retry.";
  }
  if (m.includes("insufficient") || m.includes("balance")) {
    return "Insufficient balance for this amount.";
  }
  if (m.includes("exceeds") || m.includes("slippage") || m.includes("deadline")) {
    return "The pool ratio changed. Please refresh the quote and try again.";
  }
  if (m.includes("receipt") || m.includes("timeout")) {
    return "We couldn't confirm the transaction. Check ArcScan — it may have succeeded.";
  }
  if (m.includes("zero") || m.includes("greater than zero")) {
    return "Enter an amount greater than zero.";
  }
  return "The transaction could not be completed. Please try again.";
}

export function PoolPanel({ poolId }: { poolId?: string }) {
  const initial = poolId
    ? (getPoolById(poolId) ?? LP_POOLS[0]!)
    : LP_POOLS[0]!;
  const { address, getProvider, isConnected } = useWallet();

  const [pool, setPool] = React.useState<LpPoolDef>(initial);
  const [mode, setMode] = React.useState<Mode>("deposit");
  const [amountA, setAmountA] = React.useState("");
  const [amountB, setAmountB] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [pos, setPos] = React.useState<LpPosition | null>(null);
  const [apy, setApy] = React.useState<number | null>(null);
  const [refetchId, setRefetchId] = React.useState(0);

  const tokenA = tokenMeta("Arc_Testnet", pool.tokenA);
  const tokenB = tokenMeta("Arc_Testnet", pool.tokenB);
  const balA = useTokenBalance({ chainId: ARC_CHAIN_ID, address, token: tokenA });
  const balB = useTokenBalance({ chainId: ARC_CHAIN_ID, address, token: tokenB });

  // Read the pool position + an HONEST APY (null when no real 24h volume).
  React.useEffect(() => {
    if (!address) {
      setPos(null);
      setApy(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await getLpPosition(pool.tokenA, pool.tokenB, address);
        if (cancelled) return;
        setPos(p);
        // APY comes from REAL swap volume. On testnet volume is often zero, so we
        // surface "—" rather than a fabricated yield. (Volume tracking via
        // Swap-event indexing lives in the indexer; until wired we pass null.)
        setApy(computeApy(p.tvlA, null));
      } catch {
        if (!cancelled) {
          setPos(null);
          setApy(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pool, address, refetchId]);

  // When the user types tokenA, quote the matching tokenB at the current ratio.
  React.useEffect(() => {
    if (mode !== "deposit" || !amountA || Number(amountA) <= 0) {
      setAmountB("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = await quoteDeposit(pool.tokenA, pool.tokenB, amountA);
        if (!cancelled) setAmountB(q.amountB);
      } catch {
        if (!cancelled) setAmountB("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amountA, pool, mode]);

  const amountNum = Number(amountA);
  const amountError =
    amountA.length > 0 && (!Number.isFinite(amountNum) || amountNum <= 0)
      ? "Enter an amount greater than zero."
      : amountA.length > 0 &&
          mode === "deposit" &&
          Number(amountA) > Number(balA.balance ?? 0)
        ? `Exceeds your ${pool.tokenA} balance.`
        : null;

  const canSubmit =
    isConnected &&
    pool.available &&
    !amountError &&
    amountA.length > 0 &&
    (mode === "withdraw" || amountB.length > 0) &&
    phase !== "running";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !address) return;
    const provider = await getProvider();
    if (!provider) {
      setError("No wallet provider available.");
      setPhase("error");
      return;
    }
    setError(null);
    setTxHash(null);
    setPhase("running");
    try {
      const res =
        mode === "deposit"
          ? await provideLiquidity({
              provider: provider as unknown as EIP1193Provider,
              address,
              tokenA: pool.tokenA,
              tokenB: pool.tokenB,
              amountA,
              amountB,
            })
          : await removeLiquidity({
              provider: provider as unknown as EIP1193Provider,
              address,
              tokenA: pool.tokenA,
              tokenB: pool.tokenB,
              amountA, // LP amount in withdraw mode
              amountB: "0",
            });
      setTxHash(res.txHash ?? null);
      setPhase("done");
      setAmountA("");
      setAmountB("");
      setRefetchId((n) => n + 1);
    } catch (err) {
      setError(humanizeLpError(err));
      setPhase("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Pool selector */}
      <div>
        <Label>Pool</Label>
        <div className="mt-2 flex gap-2">
          {LP_POOLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPool(p)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                !p.available && "opacity-50",
                p.id === pool.id
                  ? "border-charge/50 bg-charge/10 text-charge"
                  : "border-fg/10 bg-fg/[0.03] text-fg-secondary hover:text-fg",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {!pool.available && pool.unavailableReason && (
          <p className="mt-2 text-xs text-warning">{pool.unavailableReason}</p>
        )}
      </div>

      {/* Position card */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your position</h3>
          <span className="rounded-full bg-charge/10 px-2.5 py-0.5 text-xs font-medium text-charge">
            Fee {ARC_AMM_FEE_BPS / 100}%
          </span>
        </div>
        {!isConnected ? (
          <p className="text-sm text-fg-tertiary">Connect a wallet to view your LP.</p>
        ) : pos ? (
          <div className="space-y-2.5">
            <DetailRow
              label="Est. Fee APR"
              value={`${formatApy(apy)} (from real volume × fee ÷ TVL)`}
            />
            <DetailRow
              label="Your share"
              value={`${(pos.share * 100).toFixed(4)}%`}
            />
            <DetailRow
              label={`${pool.tokenA} reserves`}
              value={fmt(pos.reserve0, pos.tokenADecimals)}
            />
            <DetailRow
              label={`${pool.tokenB} reserves`}
              value={fmt(pos.reserve1, pos.tokenBDecimals)}
            />
            <DetailRow
              label="TVL (≈ stable)"
              value={`$${pos.tvlA.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
            <DetailRow
              label="Your LP tokens"
              value={fmtLp(pos.userBalance)}
            />
          </div>
        ) : (
          <p className="text-sm text-fg-tertiary">
            No liquidity provided to this pool yet.
          </p>
        )}
      </Card>

      {/* Deposit / Withdraw toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("deposit")}
          className={cn(
            "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
            mode === "deposit"
              ? "border-charge/50 bg-charge/10 text-charge"
              : "border-fg/10 bg-fg/[0.03] text-fg-secondary",
          )}
        >
          Provide
        </button>
        <button
          type="button"
          onClick={() => setMode("withdraw")}
          className={cn(
            "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
            mode === "withdraw"
              ? "border-charge/50 bg-charge/10 text-charge"
              : "border-fg/10 bg-fg/[0.03] text-fg-secondary",
          )}
        >
          Remove
        </button>
      </div>

      {/* Amounts */}
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="lp-amount-a">
            {mode === "deposit" ? `Amount ${pool.tokenA}` : "LP amount"}
          </Label>
          <span className="text-xs tabular-nums text-fg-tertiary">
            {mode === "deposit"
              ? `Available ${balA.balance ?? "0"} ${pool.tokenA}`
              : `Holding ${fmt(pos?.userBalance ?? 0n, 18)} LP`}
          </span>
        </div>
        <AmountInput
          id="lp-amount-a"
          value={amountA}
          onChange={(e) => setAmountA(e.target.value.replace(/[^\d.]/g, ""))}
          symbol={mode === "deposit" ? pool.tokenA : "LP"}
          onMax={() =>
            setAmountA(
              mode === "deposit"
                ? balA.balance ?? "0"
                : fmtLp(pos?.userBalance ?? 0n),
            )
          }
          className="mt-2"
          aria-invalid={Boolean(amountError)}
        />
        {amountError && (
          <p className="mt-1.5 text-xs text-danger">{amountError}</p>
        )}

        {mode === "withdraw" && address && (
          <div className="mt-2 flex gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={async () => {
                  if (!pos || pos.userBalance <= 0n) return;
                  const removeRaw =
                    (pos.userBalance * BigInt(pct)) / 100n;
                  setAmountA(formatUnits(removeRaw, 18));
                }}
                className="rounded-md border border-fg/10 px-2.5 py-1 text-xs font-medium text-fg-secondary transition-colors hover:text-fg"
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "deposit" && (
        <div>
          <Label htmlFor="lp-amount-b">Amount {pool.tokenB}</Label>
          <AmountInput
            id="lp-amount-b"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value.replace(/[^\d.]/g, ""))}
            symbol={pool.tokenB}
            className="mt-2"
            readOnly
          />
          <p className="mt-1.5 text-xs text-fg-tertiary">
            Auto-matched to the pool ratio.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-fg/10 bg-fg/[0.03] p-3 text-xs text-fg-tertiary">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          LPs earn {ARC_AMM_FEE_BPS / 100}% of every swap through this pool. Fees
          accrue into the pool and raise your LP value automatically — no staking
          required. APY shows &ldquo;&mdash;&rdquo; until real swap volume flows.
        </p>
      </div>

      {phase === "running" && <StatusLine>Confirm in your wallet…</StatusLine>}
      {phase === "done" && txHash && (
        <StatusLine tone="success">
          {mode === "deposit" ? "Liquidity added." : "Liquidity removed."}{" "}
          <a
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            View transaction ↗
          </a>
        </StatusLine>
      )}
      {error && <StatusLine tone="danger">{error}</StatusLine>}

      <Button
        type="submit"
        size="xl"
        block
        loading={phase === "running"}
        disabled={!canSubmit}
      >
        {mode === "deposit"
          ? `Provide ${pool.tokenA}/${pool.tokenB}`
          : "Remove liquidity"}
      </Button>
    </form>
  );
}

function fmt(raw: bigint, decimals: number): string {
  if (!raw) return "0";
  const v = Number(raw) / 10 ** decimals;
  return v.toLocaleString(undefined, {
    maximumFractionDigits: decimals > 6 ? 6 : decimals,
  });
}

/** LP balance display: full precision, never rounds a non-zero balance to "0". */
function fmtLp(raw: bigint): string {
  if (!raw) return "0";
  const s = formatUnits(raw, 18);
  // Trim trailing zeros, keep up to 10 significant decimals.
  const trimmed = s.includes(".") ? s.replace(/\.?0+$/, "") : s;
  return trimmed;
}
