/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

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
  const { address, isConnected, walletType, bundlerClient } = useWallet();
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

  /* ── Quote (still server-side — no secret needed for estimates) ── */

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

  /* ── Swap (CLIENT-SIDE — user's connected wallet signs) ────────── */

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

    // Circle Smart Account (ERC-4337) via Privy doesn't expose an EIP-1193 provider.
    // Swap Kit currently requires an EIP-1193 provider (injected wallet like MetaMask).
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

    try {
      // Dynamically import to keep these out of the initial bundle and
      // to avoid SSR issues (these modules use browser APIs).
      const [{ SwapKit }, { createViemAdapterFromProvider }] = await Promise.all(
        [
          import("@circle-fin/swap-kit"),
          import("@circle-fin/adapter-viem-v2"),
        ],
      );

      // Extract the EIP-1193 provider from wagmi's connector client
      // Try multiple paths for different wagmi/viem versions
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

      // Validate provider has required EIP-1193 methods
      if (typeof provider.request !== "function") {
        throw new Error(
          "Connected wallet does not expose a valid EIP-1193 provider. " +
            "Please ensure MetaMask (or compatible wallet) is installed and unlocked.",
        );
      }

      // Build adapter from the user's browser wallet
      const adapter = await createViemAdapterFromProvider({
        provider,
        capabilities: { addressContext: "user-controlled" },
      });

      const kit = new SwapKit();

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
      const resultData: SwapResult = {
        txHash: sr.txHash as string | undefined,
        explorerUrl: sr.explorerUrl as string | undefined,
        amountIn: sr.amountIn as string | undefined,
        amountOut: sr.amountOut as string | undefined,
        tokenIn: sr.tokenIn as string | undefined,
        tokenOut: sr.tokenOut as string | undefined,
        chain: sr.chain as string | undefined,
        fees: sr.fees,
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
  }, [canAct, address, walletType, connectorClient, kitKey, chain.id, tokenIn, tokenOut, amount, slippageBps]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.id, tokenIn, tokenOut, amount, canAct, config?.configured]);

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
