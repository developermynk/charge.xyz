"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChainSelect, GlassCard, AccentButton } from "..";
import { DEFAULT_CHAIN, type Chain } from "../data";
import { useCreateToken, type TokenFormData } from "../useCreateToken";

type FormKey = "name" | "symbol" | "supply" | "decimals" | "chain";
type ToggleKey = "mintable" | "burnable" | "pausable";

export function CreateTokenPanel() {
  const [form, setForm] = useState<TokenFormData>({
    name: "",
    symbol: "",
    supply: "1000000",
    decimals: "18",
    mintable: false,
    burnable: false,
    pausable: false,
    chain: DEFAULT_CHAIN.code,
  });
  const [chain, setChain] = useState<Chain>(DEFAULT_CHAIN);
  const [walletConfigured, setWalletConfigured] = useState(false);

  const { status, result, error, isChecking, deployToken, reset, canDeploy, isDeploying } =
    useCreateToken();

  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // Check if wallet is configured on mount
  const checkWalletConfig = async () => {
    try {
      const res = await fetch("/api/token/deploy/config");
      const data = await res.json();
      setWalletConfigured(data.hasWalletId);
    } catch {
      setWalletConfigured(false);
    }
  };

  if (!walletConfigured) {
    return (
      <div className="flex flex-col gap-3.5">
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/20 text-amber-400 text-lg">⚠</div>
            <div className="flex-1">
              <h3 className="text-[14px] font-bold text-amber-300">Developer Wallet Not Configured</h3>
              <p className="mt-1 text-[12px] text-ink-3">
                Token deployment requires a Circle Developer-Controlled Wallet to pay for gas fees.
              </p>
              <p className="mt-1 text-[11px] text-ink-3">
                Click below to create one via Circle API, then add the <code className="font-mono text-[11px] text-amber-300">CIRCLE_WALLET_ID</code> to your <code className="font-mono text-[11px] text-amber-300">.env.local</code> and <code className="font-mono text-[11px] text-amber-300">backend/.env</code>.
              </p>
            </div>
          </div>
          <AccentButton
            onClick={async () => {
              setIsCreatingWallet(true);
              try {
                const res = await fetch("/api/wallet/create", { method: "POST" });
                const data = await res.json();
                if (data.walletId) {
                  alert(`Wallet created: ${data.walletId}\n\nAdd this to your .env files:\nCIRCLE_WALLET_ID=${data.walletId}\n\nThen restart the dev servers.`);
                  window.location.reload();
                } else {
                  alert("Failed: " + JSON.stringify(data));
                }
              } catch (e) {
                alert("Error: " + e);
              }
              setIsCreatingWallet(false);
            }}
            full
            size="lg"
            disabled={isCreatingWallet}
          >
            {isCreatingWallet ? "⟳ Creating Wallet…" : "⚡ Create Developer Wallet"}
          </AccentButton>
        </div>
      </div>
    );
  }

  const set = (k: FormKey | ToggleKey) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setChainHandler = (c: Chain) => {
    setChain(c);
    set("chain")(c.code);
  };

  const handleDeploy = () => {
    if (!canDeploy) return;
    deployToken({
      ...form,
      chain: chain.code,
    });
  };

  const textField = (
    label: string,
    key: FormKey,
    placeholder: string,
    mono = false,
    disabled = false,
  ) => (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <input
        value={form[key]}
        onChange={(e) => set(key)(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isDeploying}
        className={`w-full rounded-[10px] border border-line-strong px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none placeholder:text-ink-3 ${
          mono ? "font-mono" : ""
        } ${disabled || isDeploying ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ background: "var(--surface-1)" }}
      />
    </div>
  );

  const toggle = (label: string, key: ToggleKey, desc: string) => (
    <div
      onClick={() => set(key)(!form[key])}
      className="flex cursor-pointer items-center justify-between rounded-[10px] border px-3.5 py-2.5 transition-colors"
      style={{
        background: form[key] ? "var(--lime-dim)" : "var(--surface-1)",
        borderColor: form[key] ? "rgba(196,255,0,0.2)" : "var(--line)",
        opacity: isDeploying ? 0.6 : 1,
      }}
    >
      <div>
        <div
          className="text-[14px] font-semibold"
          style={{ color: form[key] ? "var(--lime)" : "var(--ink)" }}
        >
          {label}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-3">{desc}</div>
      </div>
      <div
        className="relative h-6 w-11 flex-shrink-0 rounded-xl transition-colors"
        style={{ background: form[key] ? "var(--lime)" : "var(--surface-3)" }}
      >
        <div
          className="absolute h-[18px] w-[18px] rounded-full transition-all"
          style={{
            top: 3,
            left: form[key] ? 23 : 3,
            background: form[key] ? "#080808" : "var(--ink-3)",
          }}
        />
      </div>
    </div>
  );

  const formatAddress = (addr?: string) =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";

  return (
    <div className="flex flex-col gap-3.5">
      <ChainSelect value={chain} onChange={setChainHandler} label="Deploy on" />

      <div className="grid grid-cols-2 gap-3">
        {textField("Token Name", "name", "My Token", false, isDeploying)}
        {textField("Symbol", "symbol", "MTK", false, isDeploying)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {textField("Total Supply", "supply", "1,000,000", true, isDeploying)}
        {textField("Decimals", "decimals", "18", true, isDeploying)}
      </div>

      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
        Features
      </div>
      {toggle("Mintable", "mintable", "Allow minting new tokens after deployment")}
      {toggle("Burnable", "burnable", "Allow token holders to burn their tokens")}
      {toggle("Pausable", "pausable", "Owner can pause all token transfers")}

      <GlassCard style={{ padding: "12px 14px", borderRadius: 10 }}>
        {[
          ["Deployment Cost", "~$12.40"],
          ["Network", chain.name],
          ["Standard", "ERC-20"],
          ["Compiler", "Solidity 0.8.24"],
        ].map(([k, v], i, arr) => (
          <div
            key={k}
            className="flex items-center justify-between"
            style={{
              paddingBottom: 6,
              marginBottom: 6,
              borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <span className="text-[12px] text-ink-3">{k}</span>
            <span className="font-mono text-[12px] text-ink-2">{v}</span>
          </div>
        ))}
      </GlassCard>

      {/* Status Display */}
      <AnimatePresence mode="wait">
        {status === "deploying" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3"
          >
            <div className="flex items-center gap-2 text-[12px] text-amber-300">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <span>Initiating deployment via Circle SCP…</span>
            </div>
            {result?.transactionId && (
              <div className="mt-2 text-[11px] text-ink-3">
                Transaction ID: <code className="font-mono">{result.transactionId}</code>
              </div>
            )}
          </motion.div>
        )}

        {status === "checking" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3"
          >
            <div className="flex items-center gap-2 text-[12px] text-amber-300 mb-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <span>Waiting for deployment to complete…</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="text-ink-3">Contract ID</div>
              <div className="font-mono text-ink-2">{result?.contractId?.slice(0, 12)}…</div>
              <div className="text-ink-3">Status</div>
              <div className="font-medium text-amber-300">{result?.deploymentStatus || "PENDING"}</div>
              <div className="text-ink-3">Address</div>
              <div className="font-mono text-ink-2">{formatAddress(result?.contractAddress)}</div>
            </div>
          </motion.div>
        )}

        {status === "deployed" && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-lime/30 bg-lime/5 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime text-charge-bg text-[12px] font-bold">✓</div>
              <span className="text-[13px] font-semibold text-lime">Token Deployed Successfully</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-ink-3">Contract Address</span>
                <code className="font-mono text-lime">{result.contractAddress}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Contract ID</span>
                <code className="font-mono text-ink-2">{result.contractId}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">Transaction ID</span>
                <code className="font-mono text-ink-2">{result.transactionId}</code>
              </div>
            </div>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-400/30 bg-red-400/5 p-3"
          >
            <div className="flex items-center gap-2 text-[12px] text-red-400">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-400/20 text-red-400 text-[12px] font-bold">✕</div>
              <span className="font-semibold">Deployment Failed</span>
            </div>
            <p className="mt-1.5 text-[11px] text-red-300/80">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deploy Button */}
      <AccentButton
        onClick={handleDeploy}
        full
        size="lg"
        disabled={!canDeploy || !form.name || !form.symbol}
      >
        {isDeploying ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-charge-bg border-t-transparent mr-2" />
            {status === "checking" ? "⟳ Waiting for confirmation…" : "⟳ Deploying…"}
          </>
        ) : (
          "⚡ Deploy Token"
        )}
      </AccentButton>

      {status === "deployed" && (
        <AccentButton onClick={reset} full size="lg" style={{ background: "transparent", color: "var(--lime)", boxShadow: "none", border: "1px solid var(--lime)" }}>
          Deploy Another Token
        </AccentButton>
      )}
    </div>
  );
}