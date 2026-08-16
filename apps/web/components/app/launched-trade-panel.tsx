"use client";

import {
  ExternalLink,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import * as React from "react";
import { createWalletClient, custom, parseUnits } from "viem";

import { Button, Card, Label } from "@charge/ui";
import {
  ARC_CHAIN_ID,
  ARC_TESTNET_AMM,
  ARC_TESTNET_USDC,
  arcTxUrl,
  publicClientForChain,
} from "@charge/chains";
import {
  executeAmmSwap,
  quoteAmmSwap,
  CHARGETOKENV2_ABI,
  type AmmSwapRequest,
} from "@charge/sdk";
import { useWallet } from "@charge/web3";

const SYNC_EVENT = {
  anonymous: false,
  name: "Sync",
  type: "event",
  inputs: [
    { name: "reserve0", type: "uint112", indexed: false },
    { name: "reserve1", type: "uint112", indexed: false },
  ],
} as const;

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function LaunchedTradePanel({
  token,
  symbol,
  decimals,
}: {
  token: `0x${string}`;
  symbol: string;
  decimals: number;
}) {
  const { address, getProvider, isConnected, isOnArc } = useWallet();
  const [side, setSide] = React.useState<"buy" | "sell">("buy");
  const [amount, setAmount] = React.useState("");
  const [quote, setQuote] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "quoting" | "signing" | "done" | "error">("idle");
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [chart, setChart] = React.useState<number[]>([]);
  const [txns, setTxns] = React.useState<
    { hash: string; from: string; to: string; value: string }[]
  >([]);

  // Build the AMM request for the current side. Buy = USDC -> token,
  // Sell = token -> USDC. The launched token is always passed by address so
  // the SDK routes through the verified AMM override path.
  async function buildReq(amountIn: string): Promise<AmmSwapRequest> {
    const provider = await getProvider();
    if (!provider) throw new Error("Connect your wallet to trade.");
    const base = {
      provider: provider as never,
      address: address as `0x${string}`,
      chain: "Arc_Testnet",
      amountIn,
    };
    return side === "buy"
      ? {
          ...base,
          tokenIn: "USDC",
          tokenOut: symbol,
          tokenOutAddress: token,
          tokenOutDecimals: decimals,
        }
      : {
          ...base,
          tokenIn: symbol,
          tokenInAddress: token,
          tokenInDecimals: decimals,
          tokenOut: "USDC",
        };
      // sell uses tokenInAddress + tokenInDecimals above
  }

  async function refreshData() {
    try {
      const pc = publicClientForChain("Arc_Testnet");
      if (!pc) return;
      // Arc caps getLogs ranges at 100k blocks and is slow on big scans; use a
      // recent 50k window (still covers all recent activity incl. mints).
      const latest = await pc.getBlockNumber();
      const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;
      const usdc = ARC_TESTNET_USDC as `0x${string}`;
      const factory = ARC_TESTNET_AMM.factory as `0x${string}`;
      const pair = (await pc.readContract({
        address: factory,
        abi: [
          {
            name: "getPair",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "tokenA", type: "address" },
              { name: "tokenB", type: "address" },
            ],
            outputs: [{ name: "pair", type: "address" }],
          },
        ],
        functionName: "getPair",
        args: [token, usdc],
      })) as `0x${string}`;
      if (!pair || pair === "0x0000000000000000000000000000000000000000") return;

      // Determine pair ordering so we price the token correctly.
      const token0 = (await pc.readContract({
        address: pair,
        abi: [
          {
            name: "token0",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "address" }],
          },
        ],
        functionName: "token0",
      })) as `0x${string}`;
      const tokenIsToken0 = token0.toLowerCase() === token.toLowerCase();

      // Chart: sample Sync events -> price = usdcReserve / tokenReserve.
      const syncs = await pc.getLogs({
        address: pair,
        event: SYNC_EVENT,
        fromBlock,
        toBlock: "latest" as never,
      });
      const prices: number[] = [];
      for (const s of syncs.slice(-40)) {
        const args = s.args as { reserve0: bigint; reserve1: bigint };
        const r0 = Number(args.reserve0) / 10 ** 18;
        const r1 = Number(args.reserve1) / 10 ** 18;
        if (r0 > 0 && r1 > 0) {
          // reserve0 maps to token0. If our token is token0, price(USD)=r1/r0 else r0/r1.
          const p = tokenIsToken0 ? r1 / r0 : r0 / r1;
          prices.push(p);
        }
      }
      if (prices.length) setChart(prices);

      // Live transactions: recent Transfer events on the token.
      const logs = await pc.getLogs({
        address: token,
        event: {
          name: "Transfer",
          type: "event",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
          ],
        },
        args: undefined,
        fromBlock,
        toBlock: "latest" as never,
      });
      const rows = logs
        .slice(-12)
        .reverse()
        .map((l) => {
          const a = l.args as { from: string; to: string; value: bigint };
          return {
            hash: l.transactionHash ?? "",
            from: a.from,
            to: a.to,
            value: (Number(a.value) / 10 ** decimals).toLocaleString("en-US", {
              maximumFractionDigits: 2,
            }),
          };
        });
      setTxns(rows);
    } catch {
      /* best-effort */
    }
  }

  React.useEffect(() => {
    refreshData();
    const t = setInterval(refreshData, 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onQuote() {
    if (!amount || Number(amount) <= 0) return;
    setPhase("quoting");
    setError(null);
    try {
      const res = await quoteAmmSwap(await buildReq(amount));
      setQuote(res.estimatedOutput);
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
      setPhase("error");
    }
  }

  async function onSwap() {
    if (!amount || Number(amount) <= 0) return;
    setPhase("signing");
    setError(null);
    try {
      const res = await executeAmmSwap(await buildReq(amount));
      setTxHash(res.txHash ?? null);
      setPhase("done");
      setAmount("");
      setQuote(null);
      refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swap failed");
      setPhase("error");
    }
  }

  const needsArc = isConnected && !isOnArc;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-fg">Trade {symbol}</p>
        <div className="flex rounded-lg border border-fg/10 p-0.5 text-sm">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSide(s);
                setQuote(null);
                setError(null);
              }}
              className={`rounded-md px-3 py-1 capitalize transition ${
                side === s
                  ? s === "buy"
                    ? "bg-charge text-white"
                    : "bg-danger text-white"
                  : "text-fg-secondary hover:text-fg"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>{side === "buy" ? "Spend USDC" : `Spend ${symbol}`}</Label>
        <div className="mt-2 flex gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^0-9.]/g, ""));
              setQuote(null);
            }}
            placeholder="0.00"
            className="flex-1 rounded-xl border border-fg/10 bg-fg/[0.03] px-4 py-3 text-lg tabular-nums outline-none focus:border-charge/50"
          />
          <span className="flex items-center text-sm text-fg-tertiary">
            {side === "buy" ? "USDC" : symbol}
          </span>
        </div>
      </div>

      {quote != null && (
        <p className="text-sm text-fg-secondary">
          You receive ≈{" "}
          <span className="font-semibold text-fg">
            {Number(quote).toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
            {side === "buy" ? symbol : "USDC"}
          </span>
        </p>
      )}

      {needsArc && (
        <p className="text-xs text-fg-tertiary">Switch to Arc Testnet to trade.</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onQuote} disabled={phase === "quoting" || !amount}>
          {phase === "quoting" ? <RefreshCw className="size-4 animate-spin" /> : null}
          Quote
        </Button>
        <Button
          type="button"
          onClick={onSwap}
          disabled={phase === "signing" || !quote || !isConnected}
          className={side === "sell" ? "bg-danger hover:bg-danger/90" : ""}
        >
          {phase === "signing" ? <RefreshCw className="size-4 animate-spin" /> : null}
          {side === "buy" ? "Buy" : "Sell"} {symbol}
        </Button>
      </div>

      {txHash && (
        <a
          href={arcTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-charge hover:underline"
        >
          View tx <ExternalLink className="size-3" />
        </a>
      )}

      {/* Price chart (from pair Sync events) */}
      <div className="border-t border-fg/[0.06] pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-tertiary">
          <TrendingUp className="size-3.5" /> Price (USDC)
        </p>
        {chart.length > 1 ? (
          <PriceSparkline data={chart} />
        ) : (
          <p className="text-xs text-fg-tertiary">No price history yet.</p>
        )}
      </div>

      {/* Live transactions */}
      <div className="border-t border-fg/[0.06] pt-4">
        <p className="mb-2 text-xs font-medium text-fg-tertiary">Live transactions</p>
        {txns.length ? (
          <ul className="space-y-1.5">
            {txns.map((t) => (
              <li key={t.hash} className="flex items-center justify-between text-xs">
                <a
                  href={arcTxUrl(t.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-charge hover:underline"
                >
                  {short(t.hash)} <ExternalLink className="size-3" />
                </a>
                <span className="text-fg-secondary">
                  {short(t.from)} → {short(t.to)}
                </span>
                <span className="tabular-nums text-fg">{t.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-fg-tertiary">No transfers yet.</p>
        )}
      </div>
    </Card>
  );
}

function PriceSparkline({ data }: { data: number[] }) {
  const w = 280;
  const h = 64;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-charge"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Owner-only mint / burn controls for the deployed token.
 * The token (CHARGETOKENV2_ABI) exposes owner-gated `mint(to, amount)` and
 * `burn(amount)`. Only shown when the connected wallet is the token owner and
 * the token is flagged mintable/burnable.
 */
export function TokenOwnerControls({
  token,
  owner,
  mintable,
  burnable,
  decimals,
}: {
  token: `0x${string}`;
  owner: string;
  mintable: boolean;
  burnable: boolean;
  decimals: number;
}) {
  const { address, getProvider, isConnected } = useWallet();
  const isOwner =
    isConnected && !!owner && !!address && owner.toLowerCase() === address.toLowerCase();
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [phase, setPhase] = React.useState<"idle" | "signing" | "done" | "error">("idle");
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOwner || (!mintable && !burnable)) return null;

  const target = (to.trim() || address) as `0x${string}`;

  async function send(kind: "mint" | "burn") {
    if (!amount || Number(amount) <= 0) return;
    setPhase("signing");
    setError(null);
    try {
      const provider = await getProvider();
      if (!provider) throw new Error("Connect your wallet.");
      const pc = publicClientForChain("Arc_Testnet");
      if (!pc) throw new Error("Arc Testnet client unavailable.");
      const wc = createWalletClient({
        account: address as `0x${string}`,
        chain: { id: ARC_CHAIN_ID, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [pc.transport.url as string] } } },
        transport: custom(provider),
      });
      const value = parseUnits(amount, decimals);
      const hash = (await wc.writeContract({
        address: token,
        abi: CHARGETOKENV2_ABI,
        functionName: kind,
        args: kind === "mint" ? [target, value] : [value],
        account: address as `0x${string}`,
      } as never)) as string;
      await pc.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      setTxHash(hash);
      setPhase("done");
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
      setPhase("error");
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <p className="text-sm font-medium text-fg">
        Creator controls {mintable && burnable ? "(mint / burn)" : mintable ? "(mint)" : "(burn)"}
      </p>
      <p className="text-xs text-fg-tertiary">
        You are the token owner. These actions are gated to your wallet only.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Amount"
          className="rounded-xl border border-fg/10 bg-fg/[0.03] px-4 py-3 text-lg tabular-nums outline-none focus:border-charge/50"
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={address ? `To (default: you)` : "Recipient"}
          className="rounded-xl border border-fg/10 bg-fg/[0.03] px-4 py-3 text-sm outline-none focus:border-charge/50"
        />
      </div>
      <div className="flex gap-3">
        {mintable && (
          <Button type="button" variant="secondary" onClick={() => send("mint")} disabled={phase === "signing" || !amount}>
            Mint
          </Button>
        )}
        {burnable && (
          <Button type="button" variant="secondary" onClick={() => send("burn")} disabled={phase === "signing" || !amount}>
            Burn
          </Button>
        )}
      </div>
      {txHash && (
        <a href={arcTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-charge hover:underline">
          View tx <ExternalLink className="size-3" />
        </a>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
