"use client";

import { Mail, Wallet, ChevronRight, ShieldCheck } from "lucide-react";
import * as React from "react";

import { Button, Modal, StatusLine } from "@charge/ui";
import {
  isPrivyConfigured,
  useConnect,
  usePrivyBridge,
  useWallet,
} from "@charge/web3";

/**
 * Connect modal — the single most important screen in the app.
 *
 * Design review requirements encoded here:
 *  1. Both paths visible at once. No hidden "advanced" toggle.
 *  2. The email path NEVER uses the word "wallet". That is the entire point:
 *     a non-crypto user should not have to learn what a wallet is to send USDC.
 *  3. No dead ends. If a path is unavailable, say why and keep the other usable.
 */
export function ConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connectors, connectAsync, isPending } = useConnect();
  const privy = usePrivyBridge();
  const { isConnected } = useWallet();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [privyBlocked, setPrivyBlocked] = React.useState(false);

  // Surface Privy's "source not authorized" origin error, which otherwise only
  // shows up as a silent console unhandledRejection and a dead email button.
  React.useEffect(() => {
    function onRejection(ev: PromiseRejectionEvent) {
      const msg = String(ev.reason?.message ?? ev.reason ?? "");
      if (/has not been authorized yet/i.test(msg)) {
        setPrivyBlocked(true);
        setError(
          "Email sign-in is blocked: this site's origin is not authorized in the Privy dashboard. Add this origin under Settings → Domains, then reload.",
        );
      }
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  // Close automatically once a connection lands.
  React.useEffect(() => {
    if (isConnected && open) onClose();
  }, [isConnected, open, onClose]);

  const walletConnectors = React.useMemo(
    () =>
      connectors.filter(
        (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
      ),
    [connectors],
  );

  async function handleWallet(connectorId: string) {
    const connector = walletConnectors.find((c) => c.id === connectorId);
    if (!connector) return;
    setError(null);
    setBusy(connectorId);
    try {
      await connectAsync({ connector });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /rejected|denied/i.test(msg)
          ? "Connection request was rejected in your wallet."
          : "Could not connect to that wallet. Is it installed and unlocked?",
      );
    } finally {
      setBusy(null);
    }
  }

  function handleEmail() {
    setError(null);
    try {
      privy.login();
      onClose();
    } catch {
      setError("Email sign-in is not configured for this deployment.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign in to Charge"
      description="Two ways in. Both land you on Arc, where USDC pays the gas."
    >
      <div className="space-y-5">
        {error && <StatusLine tone="danger">{error}</StatusLine>}

        {/* ── Path 1: email. Deliberately first, and free of jargon. ── */}
        <section>
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
            Recommended
          </p>
          {isPrivyConfigured() && !privyBlocked ? (
            <button
              type="button"
              onClick={handleEmail}
              disabled={privy.isLoading}
              className="group flex w-full items-center gap-4 rounded-2xl border border-charge/25 bg-charge/[0.07] p-4 text-left transition-all duration-200 hover:border-charge/45 hover:bg-charge/[0.12] disabled:opacity-50"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-charge/15 text-charge">
                <Mail className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-fg">
                  Continue with email
                </span>
                <span className="block text-sm text-fg-secondary">
                  We create your secure account instantly. Nothing to install.
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          ) : (
            <StatusLine tone="warning">
              Email sign-in is unavailable: this deployment has no Privy app id
              configured. You can still continue with a wallet below.
            </StatusLine>
          )}
          {privyBlocked && (
            <StatusLine tone="warning">
              Email sign-in is blocked: this origin is not authorized in the
              Privy dashboard. Add it under Settings → Domains, then reload.
            </StatusLine>
          )}
        </section>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-white/8" />
          <span className="text-xs font-medium text-fg-tertiary">OR</span>
          <span className="h-px flex-1 bg-white/8" />
        </div>

        {/* ── Path 2: bring your own wallet. ── */}
        <section>
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
            Already have a wallet
          </p>
          <div className="space-y-2">
            {walletConnectors.length === 0 && (
              <StatusLine tone="warning">
                No wallet detected in this browser. Install MetaMask or use email
                sign-in above.
              </StatusLine>
            )}
            {walletConnectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                onClick={() => handleWallet(connector.id)}
                disabled={isPending || busy !== null}
                className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-50"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-fg-secondary">
                  <Wallet className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fg">
                    {connector.name}
                  </span>
                  <span className="block text-sm text-fg-secondary">
                    {busy === connector.id
                      ? "Check your wallet to approve…"
                      : "Connect an existing wallet"}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </section>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-tertiary">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Charge never takes custody. Every transaction is signed by you, in
            your own wallet.
          </span>
        </p>
      </div>
    </Modal>
  );
}

/** Small hook so any component can open the connect modal. */
export function useConnectModal() {
  const [open, setOpen] = React.useState(false);
  return {
    open,
    openModal: React.useCallback(() => setOpen(true), []),
    closeModal: React.useCallback(() => setOpen(false), []),
  };
}

export function ConnectButton({
  size = "md",
  block,
  label = "Launch app",
}: {
  size?: "sm" | "md" | "lg";
  block?: boolean;
  label?: string;
}) {
  const { open, openModal, closeModal } = useConnectModal();
  const { isConnected, address } = useWallet();

  if (isConnected && address) {
    return (
      <Button variant="secondary" size={size} block={block}>
        {`${address.slice(0, 6)}…${address.slice(-4)}`}
      </Button>
    );
  }

  return (
    <>
      <Button size={size} block={block} onClick={openModal}>
        {label}
      </Button>
      <ConnectModal open={open} onClose={closeModal} />
    </>
  );
}
