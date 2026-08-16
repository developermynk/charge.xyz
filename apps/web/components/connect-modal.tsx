"use client";

import { Mail, Wallet, ChevronRight, ShieldCheck } from "lucide-react";
import * as React from "react";

import { Button, Modal, StatusLine } from "@charge/ui";
import Link from "next/link";
import {
  isPrivyConfigured,
  useConnect,
  usePrivyBridge,
  useWallet,
} from "@charge/web3";

/**
 * Minimal error boundary. Used to isolate the Privy-dependent email section so
 * that a Privy init failure on an unexpected origin (e.g. a random
 * *.trycloudflare.com tunnel host) degrades to the wallet-only path instead of
 * taking down the whole modal — or, worse, the app.
 */
class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Connect modal — the single most important screen in the app.
 *
 * Design review requirements encoded here:
 *  1. Both paths visible at once. No hidden "advanced" toggle.
 *  2. The email path NEVER uses the word "wallet". That is the entire point:
 *     a non-crypto user should not have to learn what a wallet is to send USDC.
 *  3. No dead ends. If a path is unavailable, say why and keep the other usable.
 */

/**
 * Single source of truth for the connect modal.
 *
 * WHY A CONTEXT (not per-component useState):
 * `LaunchAppButton` used to call `useConnectModal()` for the button AND render
 * its own `<ConnectModal open={open}>`, so two independent `useState`s existed
 * for the same flag. Under React 19 Strict Mode + slow hydration (e.g. behind a
 * Cloudflare tunnel) the discarded first mount's `onClick` (a stale `openModal`
 * closure) could outlive the remounted instance that actually renders the
 * modal — so clicking set dead state and the dialog never opened. Centralising
 * the flag in one provider (mounted once at the app root, with a single
 * `<ConnectModal>`) eliminates the dual-instance stale-closure entirely.
 */
type ConnectModalState = {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const ConnectModalContext = React.createContext<ConnectModalState | null>(null);

export function ConnectModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo<ConnectModalState>(
    () => ({
      open,
      openModal: () => setOpen(true),
      closeModal: () => setOpen(false),
    }),
    [open],
  );
  return (
    <ConnectModalContext.Provider value={value}>
      {children}
      {/* One modal for the whole app — never one per button. */}
      <ConnectModal open={open} onClose={() => setOpen(false)} />
    </ConnectModalContext.Provider>
  );
}

export function useConnectModal(): ConnectModalState {
  const ctx = React.useContext(ConnectModalContext);
  if (!ctx) {
    throw new Error("useConnectModal must be used within <ConnectModalProvider>");
  }
  return ctx;
}

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
        <SectionErrorBoundary
          fallback={
            <StatusLine tone="warning">
              Email sign-in is temporarily unavailable. You can still continue
              with a wallet below.
            </StatusLine>
          }
        >
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
        </SectionErrorBoundary>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-fg/8" />
          <span className="text-xs font-medium text-fg-tertiary">OR</span>
          <span className="h-px flex-1 bg-fg/8" />
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
                className="group flex w-full items-center gap-4 rounded-2xl border border-fg/10 bg-fg/[0.03] p-4 text-left transition-all duration-200 hover:border-fg/20 hover:bg-fg/[0.07] disabled:opacity-50"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fg/[0.06] text-fg-secondary">
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

export function LaunchAppButton({
  size = "md",
  block,
  label = "Launch app",
  className,
  children,
}: {
  size?: "sm" | "md" | "lg" | "xl" | "icon";
  block?: boolean;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { openModal } = useConnectModal();
  const { isConnected } = useWallet();

  // Already signed in? Go straight into the dapp — don't reopen the connect
  // modal (which auto-closes when connected, making the click feel dead).
  if (isConnected) {
    return (
      <Button size={size} block={block} className={className} asChild>
        <Link href="/app">{children ?? label}</Link>
      </Button>
    );
  }

  // Modal is rendered once at the app root (see ConnectModalProvider), so this
  // button only needs to open it. No per-button modal instance.
  return (
    <Button
      size={size}
      block={block}
      className={className}
      onClick={openModal}
    >
      {children ?? label}
    </Button>
  );
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
  const { openModal } = useConnectModal();
  const { isConnected, address } = useWallet();

  if (isConnected && address) {
    return (
      <Button variant="secondary" size={size} block={block}>
        {`${address.slice(0, 6)}…${address.slice(-4)}`}
      </Button>
    );
  }

  return (
    <Button size={size} block={block} onClick={openModal}>
      {label}
    </Button>
  );
}
