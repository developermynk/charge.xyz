"use client";

import { Wallet } from "lucide-react";
import * as React from "react";

import { Button, Card } from "@charge/ui";
import { useWallet } from "@charge/web3";

import { ConnectModal } from "@/components/connect-modal";

/**
 * Auth gate for the app.
 *
 * Renders a real sign-in prompt rather than redirecting to `/`, because the
 * user asked for a specific page (e.g. /app/swap) and bouncing them to
 * marketing loses that intent. After signing in they stay exactly where they
 * meant to be.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useWallet();
  const [open, setOpen] = React.useState(false);

  // Avoid a hydration mismatch: wallet state is only known on the client.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Gate ONLY on hydration. Rendering must never depend on a third-party
  // wallet SDK's readiness (Privy `ready`), which can be delayed or never
  // resolve on some mobile browsers (tracking-protection / private-DNS block
  // its init beacon). The connect modal disables the email button on its own
  // while Privy initializes, so the rest of the app stays usable.
  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-white/15 border-t-charge motion-reduce:animate-none" />
        <span className="sr-only">Loading your account…</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <Card className="max-w-md p-8 text-center" glow>
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-charge/15 text-charge">
            <Wallet className="size-6" aria-hidden />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            Sign in to continue
          </h1>
          <p className="mt-2 text-pretty text-fg-secondary">
            Use your email or connect a wallet. Either way you keep full custody
            of your funds.
          </p>
          <Button block className="mt-6" onClick={() => setOpen(true)}>
            Sign in
          </Button>
        </Card>
        <ConnectModal open={open} onClose={() => setOpen(false)} />
      </div>
    );
  }

  return <>{children}</>;
}
