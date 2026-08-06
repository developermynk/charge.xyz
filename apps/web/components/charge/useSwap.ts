"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnectorClient } from "wagmi";
import { useWallet } from "@repo/hooks/WalletContext";
import {
  OFFICIAL_SWAP_CHAINS,
  tokensForChain,
  isArcUsdcNativePair,
  type SwapChain,
} from "@/lib/swap/chains";

/* ─── Types ─────────────────────────────────────────────────────── */

export type SwapStatus =
  | "idle"
  | "quoting"
  | "quoted"
  | "swapping"
  | "success"
  | "error";

export interface SwapQuote {
  estimatedOutput?: string;
  fees?: unknown;
  minReceived?: string;
  rate?: string;
  priceImpactBps?: number;
  slippageBps?: number;
  route?: unknown;
  developerFee?: { percentageBps: number; recipientAddress: string } | null;
}

export interface SwapResult {
  txHash?: string;
  explorerUrl?: string;
  amountIn?: string;
  amountOut?: string;
  tokenIn?: string;
  tokenOut?: string;
  chain?: string;
  fees?: unknown;
  /** The address that actually signed/sent the transaction (must match connected wallet) */
  executorAddress?: string;
  /** The connected user's wallet address */
  connectedWalletAddress?: string;
}

export interface SwapConfig {
  configured: boolean;
  missing: string[];
  feesEnabled: boolean;
}

export interface SwapTransaction {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut?: string;
  chain: string;
  txHash?: string;
  explorerUrl?: string;
  timestamp: number;
  status: "success" | "error";
  error?: string;
}

/* ─── Debug Logger ──────────────────────────────────────────────── */

function logSwap(step: string, data: Record<string, unknown>) {
  const ts = new Date().toISOString();
  console.log(`[SWAP][${ts}] ${step}`, JSON.stringify(data, null, 2));
}

/* ─── Hook ──────────────────────────────────────────────────────── */

export function useSwap() {
  /* Chain & token selection */
  const defaultChain =
    OFFICIAL_SWAP_CHAINS.find((c) => c.id === "Arc_Testnet") ??
    OFFICIAL_SWAP_CHAINS[0];

  const [chain, setChain] = useState<SwapChain>(defaultChain);
  const tokens = tokensForChain(chain.id);
  const [tokenIn, setTokenIn] = useState(tokens[0]);
  const [tokenOut, setTokenOut] = useState(tokens[1] ?? tokens[0]);
  const [amount, setAmount] = useState("1.0");
  const [slippage, setSlippage] = useState("0.5");

  /* Status & results */
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<SwapConfig | null>(null);
  const [history, setHistory] = useState<SwapTransaction[]>([]);
  const [kitKey, setKitKey] = useState<string | null>(null);

  /* Wallet connection */
  const { address, isConnected, walletType } = useWallet();
  const { data: connectorClient } = useConnectorClient();

  /* Auto-quote debounce */
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Derived state ────────────────────────────────────────────── */

  const invalidPair = isArcUsdcNativePair(chain.id, tokenIn, tokenOut);
  const samePair = tokenIn.toUpperCase() === tokenOut.toUpperCase();
  const isMainnet = !chain.testnet;
  const parsedAmount = parseFloat(amount || "0");
  const canAct =
    tokens.includes(tokenIn) &&
    tokens.includes(tokenOut) &&
    !invalidPair &&
    !samePair &&
    parsedAmount > 0;

  const slippageBps = Math.round(Number(slippage) * 100);

  /* ── Config + kit key fetch ───────────────────────────────────── */

  useEffect(() => {
    fetch("/api/swap/config")
      .then((r) => r.json())
      .then((data: SwapConfig) => setConfig(data))
      .catch(() =>
        setConfig({ configured: false, missing: ["unknown"], feesEnabled: false }),
      );
    fetch("/api/swap/key")
      .then((r) => r.json())
      .then((data: { kitKey?: string }) => {
        if (data.kitKey) setKitKey(data.kitKey);
      })
      .catch(() => {});
  }, []);

  /* ── Actions ──────────────────────────────────────────────────── */

  const resetTransient = useCallback(() => {
    setQuote(null);
    setResult(null);
    setError(null);
    setStatus("idle");
  }, []);

  const changeChain = useCallback(
    (c: SwapChain) => {
      setChain(c);
      const syms = tokensForChain(c.id);
      setTokenIn(syms[0]);
      setTokenOut(syms[1] ?? syms[0]);
      resetTransient();
    },
    [resetTransient],
  );

  const changeTokenIn = useCallback(
    (sym: string) => {
      setTokenIn(sym);
      resetTransient();
    },
    [resetTransient],
  );

  const changeTokenOut = useCallback(
    (sym: string) => {
      setTokenOut(sym);
      resetTransient();
    },
    [resetTransient],
  );

  const flipTokens = useCallback(() => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    resetTransient();
  }, [tokenIn, tokenOut, resetTransient]);

  const changeAmount = useCallback((v: string) => {
    setAmount(v);
    setQuote(null);
    setStatus("idle");
  }, []);

  /* ── Quote (server-side estimate — no signing) ────────────────── */

  const getQuote = useCallback(async () => {
    if (!canAct) return;
    setStatus("quoting");
    setError(null);
    setQuote(null);
    try {
      const res = await fetch("/api/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: chain.id,
          tokenIn,
          tokenOut,
          amountIn: amount,
          slippageBps,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Quote failed");
        setStatus("error");
        return;
      }
      setQuote(data as SwapQuote);
      setStatus("quoted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
      setStatus("error");
    }
  }, [canAct, chain.id, tokenIn, tokenOut, amount, slippageBps]);

  /* ── Execute Swap (CLIENT-SIDE ONLY — user's wallet signs) ────── */

  const executeSwap = useCallback(async () => {
    if (!canAct || !address || !kitKey) {
      if (!address) {
        setError("Please connect your wallet first");
        setStatus("error");
      } else if (!kitKey) {
        setError("Swap not configured — kit key missing");
        setStatus("error");
      }
      return;
    }

    // Circle Smart Account (ERC-4337) via Privy doesn't expose EIP-1193 provider.
    // Swap Kit requires an EIP-1193 provider (injected wallet like MetaMask).
    if (walletType === "circle") {
      setError(
        "Swap not supported with Circle Smart Account. Please connect with MetaMask or another injected wallet to swap.",
      );
      setStatus("error");
      return;
    }

    if (!connectorClient) {
      setError("Please connect your wallet first");
      setStatus("error");
      return;
    }

    setStatus("swapping");
    setError(null);
    setResult(null);

    // Log connected wallet
    logSwap("CONNECTED_WALLET", {
      connectedWalletAddress: address,
      walletType,
      chainId: chain.id,
      tokenIn,
      tokenOut,
      amountIn: amount,
      slippageBps,
    });

    try {
      // Dynamic imports to avoid SSR issues
      const [{ SwapKit }, { createViemAdapterFromProvider }] = await Promise.all([
        import("@circle-fin/swap-kit"),
        import("@circle-fin/adapter-viem-v2"),
      ]);

      // Extract EIP-1193 provider from wagmi connector client
      const provider =
        (connectorClient as any).transport?.value?.provider ??
        (connectorClient as any).transport?.provider ??
        (connectorClient as any).provider ??
        (typeof window !== "undefined" ? (window as any).ethereum : null);

      if (!provider) {
        throw new Error(
          "Could not extract EIP-1193 provider from connected wallet. " +
            "Make sure your wallet extension is active and connected.",
        );
      }

      if (typeof provider.request !== "function") {
        throw new Error(
          "Connected wallet does not expose a valid EIP-1193 provider. " +
            "Please ensure MetaMask (or compatible wallet) is installed and unlocked.",
        );
      }

      // Get signer address from provider and verify it matches connected wallet
      let signerAddress: string | undefined;
      try {
        const accounts = await provider.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          signerAddress = accounts[0];
        }
      } catch {
        // ignore
      }

      logSwap("SIGNER_VERIFIED", {
        connectedWalletAddress: address,
        signerAddressFromProvider: signerAddress,
        match: signerAddress?.toLowerCase() === address.toLowerCase(),
      });

      if (signerAddress && signerAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error(
          `Wallet address mismatch! Connected: ${address}, Provider signer: ${signerAddress}. ` +
            `Please reconnect your wallet.`,
        );
      }

      // Build adapter from user's browser wallet
      const adapter = await createViemAdapterFromProvider({
        provider,
        capabilities: { addressContext: "user-controlled" },
      });

      logSwap("ADAPTER_CREATED", {
        connectedWalletAddress: address,
        chainId: chain.id,
      });

      const kit = new SwapKit();

      logSwap("SWAP_START", {
        connectedWalletAddress: address,
        signerAddress,
        chainId: chain.id,
        tokenIn,
        tokenOut,
        amountIn: amount,
        slippageBps,
      });

      const swapResult = await kit.swap({
        from: { adapter, chain: chain.id as any },
        tokenIn,
        tokenOut,
        amountIn: amount,
        config: {
          kitKey,
          allowanceStrategy: "approve",
          ...(slippageBps ? { slippageBps } : {}),
        },
      });

      const sr = swapResult as unknown as Record<string, unknown>;

      // Extract executor address from result
      const executorAddr =
        (sr.fromAddress as string | undefined) ||
        (sr.executorAddress as string | undefined) ||
        signerAddress;

      logSwap("SWAP_SUCCESS", {
        connectedWalletAddress: address,
        signerAddressFromProvider: signerAddress,
        executorAddressFromResult: executorAddr,
        txHash: sr.txHash,
        explorerUrl: sr.explorerUrl,
        amountIn: sr.amountIn,
        amountOut: sr.amountOut,
      });

      // Verify executor matches connected wallet
      if (executorAddr && executorAddr.toLowerCase() !== address.toLowerCase()) {
        logSwap("EXECUTOR_MISMATCH", {
          connectedWalletAddress: address,
          executorAddress: executorAddr,
          error: "Transaction sent from different address than connected wallet!",
        });
        throw new Error(
          `Transaction executor mismatch: connected wallet is ${address} but transaction was sent from ${executorAddr}. This should not happen with user-controlled wallet.`,
        );
      }

      const resultData: SwapResult = {
        txHash: sr.txHash as string | undefined,
        explorerUrl: sr.explorerUrl as string | undefined,
        amountIn: sr.amountIn as string | undefined,
        amountOut: sr.amountOut as string | undefined,
        tokenIn: sr.tokenIn as string | undefined,
        tokenOut: sr.tokenOut as string | undefined,
        chain: sr.chain as string | undefined,
        fees: sr.fees,
        executorAddress: executorAddr,
        connectedWalletAddress: address,
      };

      setResult(resultData);
      setStatus("success");
      setHistory((h) => [
        {
          id: crypto.randomUUID(),
          tokenIn,
          tokenOut,
          amountIn: amount,
          amountOut: resultData.amountOut,
          chain: chain.id,
          txHash: resultData.txHash,
          explorerUrl: resultData.explorerUrl,
          timestamp: Date.now(),
          status: "success",
        },
        ...h,
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed";
      logSwap("SWAP_FAILED", {
        connectedWalletAddress: address,
        error: msg,
        errorStack: e instanceof Error ? e.stack : undefined,
      });
      setError(msg);
      setStatus("error");
      setHistory((h) => [
        {
          id: crypto.randomUUID(),
          tokenIn,
          tokenOut,
          amountIn: amount,
          chain: chain.id,
          timestamp: Date.now(),
          status: "error",
          error: msg,
        },
        ...h,
      ]);
    }
  }, [
    canAct,
    address,
    walletType,
    connectorClient,
    kitKey,
    chain.id,
    chain.name,
    tokenIn,
    tokenOut,
    amount,
    slippageBps,
  ]);

  /* ── Auto-quote when params change ────────────────────────────── */

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    if (canAct && config?.configured) {
      quoteTimer.current = setTimeout(() => {
        getQuote();
      }, 800);
    }
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [chain.id, tokenIn, tokenOut, amount, canAct, config?.configured, getQuote]);

  return {
    /* State */
    chain,
    chains: OFFICIAL_SWAP_CHAINS,
    tokens,
    tokenIn,
    tokenOut,
    amount,
    slippage,
    status,
    quote,
    result,
    error,
    config,
    history,
    /* Derived */
    invalidPair,
    samePair,
    isMainnet,
    canAct,
    canSwap: canAct && isConnected && !!kitKey && walletType === "metamask",
    slippageBps,
    isConnected,
    /* Actions */
    changeChain,
    changeTokenIn,
    changeTokenOut,
    flipTokens,
    changeAmount,
    setSlippage,
    getQuote,
    executeSwap,
    resetTransient,
  };
}