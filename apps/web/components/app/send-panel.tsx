"use client";

import { ExternalLink, Network, ScanLine, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { isAddress } from "viem";

import {
  AmountInput,
  Button,
  Card,
  DetailRow,
  Input,
  Label,
  StatusLine,
  cn,
} from "@charge/ui";
import {
  ARC_CHAIN_ID,
  SWAP_CHAINS_EVM,
  TOKEN_REGISTRY,
  arcTxUrl,
  swapChainExplorer,
  swapChainNumericId,
  type TokenMeta,
} from "@charge/chains";
import {
  transfer,
  waitForTransfer,
  humanizeTransferError,
  type TransferAsset,
} from "@charge/sdk";
import {
  useWallet,
  useArcBalance,
  useChainBalance,
  useTokenBalance,
} from "@charge/web3";

import { QrScanner } from "@/components/app/qr-scanner";
import { ChainIcon, TokenIcon } from "@/components/app/token-icon";

type Phase = "idle" | "signing" | "pending" | "done" | "error";

interface AssetOption {
  id: TransferAsset;
  label: string;
  hint: string;
  decimals: number;
  isNative: boolean;
  token?: TokenMeta;
}

/** Arc keeps its explicit Gas USDC / USDC / EURC trio. */
const ARC_ASSETS: AssetOption[] = [
  {
    id: "native",
    label: "Gas USDC",
    hint: "Native · 18 decimals · pays fees",
    decimals: 18,
    isNative: true,
  },
  {
    id: "usdc",
    label: "USDC",
    hint: "ERC-20 · 6 decimals",
    decimals: 6,
    isNative: false,
    token: TOKEN_REGISTRY.Arc_Testnet?.USDC,
  },
  {
    id: "eurc",
    label: "EURC",
    hint: "ERC-20 · 6 decimals",
    decimals: 6,
    isNative: false,
    token: TOKEN_REGISTRY.Arc_Testnet?.EURC,
  },
];

function assetsForChain(sdkId: string): AssetOption[] {
  if (sdkId === "Arc_Testnet") return ARC_ASSETS;

  const registry = TOKEN_REGISTRY[sdkId];
  const def = SWAP_CHAINS_EVM.find((c) => c.id === sdkId);
  const nativeSymbol = def?.name ? nativeGasLabel(sdkId) : "ETH";

  const tokens: AssetOption[] = registry
    ? Object.entries(registry).map(([symbol, meta]) => ({
        id: symbol,
        label: symbol,
        hint: `ERC-20 · ${meta.decimals} decimals`,
        decimals: meta.decimals,
        isNative: false,
        token: meta,
      }))
    : [];

  return [
    {
      id: "native",
      label: nativeSymbol,
      hint: "Native · 18 decimals · pays fees",
      decimals: 18,
      isNative: true,
    },
    ...tokens,
  ];
}

function nativeGasLabel(sdkId: string): string {
  const def = SWAP_CHAINS_EVM.find((c) => c.id === sdkId);
  return def?.name ? def.name.split(" ")[0] ?? "ETH" : "ETH";
}

export function SendPanel() {
  const { address, getProvider, chainId, switchChain } = useWallet();
  const params = useSearchParams();
  const requestedChain = Number(params.get("chain"));

  const [selectedChain, setSelectedChain] =
    React.useState<string>("Arc_Testnet");
  const [asset, setAsset] = React.useState<TransferAsset>("usdc");
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [scanOpen, setScanOpen] = React.useState(false);

  // Stable identities so the scanner's start effect doesn't re-run (and
  // re-trigger getUserMedia / the permission prompt) on every render.
  const closeScan = React.useCallback(() => setScanOpen(false), []);
  const onScanResult = React.useCallback(
    (text: string) => {
      const addr =
        /^ethereum:([0-9a-fA-Fx]{40})/i.exec(text)?.[1] ?? text.trim();
      setTo(addr);
    },
    [],
  );

  const selectedNumeric = swapChainNumericId(selectedChain);
  const isArc = selectedChain === "Arc_Testnet";
  const needsSwitch = selectedNumeric !== undefined && chainId !== selectedNumeric;

  const assets = React.useMemo(() => assetsForChain(selectedChain), [selectedChain]);

  // Keep the chosen asset valid for the active chain.
  React.useEffect(() => {
    if (!assets.some((a) => a.id === asset)) setAsset(assets[0]?.id ?? "native");
  }, [assets, asset]);

  const current = assets.find((a) => a.id === asset) ?? assets[0];

  // Balances: native via useChainBalance, ERC-20 via useTokenBalance.
  const chainBal = useChainBalance({
    chainId: selectedNumeric ?? ARC_CHAIN_ID,
    address,
  });
  const arcBal = useArcBalance(address);
  const tokenBal = useTokenBalance({
    chainId: selectedNumeric ?? ARC_CHAIN_ID,
    address,
    token: current?.token,
  });

  const available =
    current?.isNative
      ? isArc
        ? arcBal.nativeFormatted
        : chainBal.nativeFormatted
      : tokenBal.balance ?? "0";

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
    !needsSwitch &&
    isAddress(to) &&
    amount.length > 0 &&
    !amountError &&
    phase !== "signing" &&
    phase !== "pending";

  async function ensureChain() {
    if (needsSwitch && selectedNumeric !== undefined) {
      await switchChain(selectedNumeric);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !address || !current) return;

    setError(null);
    setTxHash(null);
    setPhase("signing");

    try {
      const provider = await getProvider();
      if (!provider) throw new Error("No wallet provider available.");

      await ensureChain();

      const hash = await transfer({
        provider,
        from: address,
        to,
        amount,
        asset: current.id,
        chainId: selectedNumeric,
        token: current.token?.address,
        decimals: current.decimals,
      });

      setTxHash(hash);
      setPhase("pending");

      await waitForTransfer(hash, selectedNumeric);

      setPhase("done");
      setAmount("");
      setTo("");
      chainBal.refetch();
      arcBal.refetch();
      tokenBal.refetch();
    } catch (err) {
      setError(humanizeTransferError(err));
      setPhase("error");
    }
  }

  const busy = phase === "signing" || phase === "pending";
  const chainName =
    SWAP_CHAINS_EVM.find((c) => c.id === selectedChain)?.name ?? selectedChain;
  const explorerBase = swapChainExplorer(selectedChain);

  const contractText = current?.isNative
    ? "Native asset"
    : current?.token
      ? `${current.token.address.slice(0, 10)}…`
      : "—";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {requestedChain && requestedChain !== ARC_CHAIN_ID && (
        <StatusLine tone="warning">
          You opened Send from another chain. Choose the destination network
          below.
        </StatusLine>
      )}

      {/* Network selector */}
      <div>
        <Label>Network</Label>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-fg/10 bg-fg/[0.03] px-3 py-3 text-sm font-medium focus-within:border-charge/50">
          <ChainIcon
            chainId={swapChainNumericId(selectedChain)}
            size={18}
            className="text-fg-secondary"
          />
          <select
            aria-label="Send network"
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

      {/* Asset selector — explicit, never inferred. */}
      <div>
        <Label>Asset</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAsset(a.id)}
              aria-pressed={asset === a.id}
              className={cn(
                "rounded-xl border p-3 text-left transition-all duration-200",
                asset === a.id
                  ? "border-charge/45 bg-charge/10"
                  : "border-fg/10 bg-fg/[0.03] hover:border-fg/20",
              )}
            >
              <span className="flex items-center gap-2">
                <TokenIcon
                  symbol={a.isNative ? (selectedChain === "Arc_Testnet" ? "USDC" : (SWAP_CHAINS_EVM.find((c) => c.id === selectedChain)?.name.split(" ")[0] ?? "ETH")) : a.label}
                  size={20}
                />
                <span className="block text-sm font-medium text-fg">
                  {a.label}
                </span>
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
        <div className="mt-2 flex gap-2">
          <Input
            id="recipient"
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 font-mono"
            aria-invalid={Boolean(recipientError)}
            aria-describedby={recipientError ? "recipient-error" : undefined}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            aria-label="Scan QR code"
            onClick={() => setScanOpen(true)}
          >
            <ScanLine className="size-4" aria-hidden />
          </Button>
        </div>
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
          symbol={current?.label}
          onMax={() => setAmount(available)}
          className="mt-2"
          aria-invalid={Boolean(amountError)}
        />
        {amountError && (
          <p className="mt-1.5 text-xs text-danger">{amountError}</p>
        )}
      </div>

      {current?.isNative && !isArc && chainBal.rpcError && (
        <StatusLine tone="warning">
          Could not read your balance on {chainName}. Check the RPC for this
          network.
        </StatusLine>
      )}

      <Card className="p-4">
        <DetailRow label="Network" value={chainName} />
        <DetailRow label="Token contract" value={contractText} />
        <DetailRow label="Decimals" value={String(current?.decimals ?? 18)} />
      </Card>

      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {phase === "pending" && (
        <StatusLine>Waiting for the transaction to confirm…</StatusLine>
      )}

      {phase === "done" && txHash && (
        <StatusLine tone="success">
          Sent.{" "}
          <a
            href={
              explorerBase
                ? `${explorerBase}/tx/${txHash}`
                : arcTxUrl(txHash)
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            View on explorer
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </StatusLine>
      )}

      <Button
        type="submit"
        size="xl"
        block
        loading={busy}
        disabled={!canSubmit}
      >
        {busy ? (
          phase === "signing" ? (
            "Confirm in your wallet…"
          ) : (
            "Confirming…"
          )
        ) : needsSwitch ? (
          `Switch to ${chainName}`
        ) : (
          <>
            <Send className="size-4" aria-hidden />
            Send
          </>
        )}
      </Button>

      {needsSwitch && (
        <p className="text-center text-xs text-fg-tertiary">
          Switch to {chainName} to send.
        </p>
      )}

      <QrScanner
        open={scanOpen}
        onClose={closeScan}
        onResult={onScanResult}
      />
    </form>
  );
}
