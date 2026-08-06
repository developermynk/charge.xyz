import Link from "next/link";

import { Button } from "@charge/ui";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6">
      <div
        className="absolute left-1/2 top-1/3 -z-10 h-80 w-[600px] -translate-x-1/2 rounded-full opacity-50 blur-[110px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,229,138,0.14) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="text-center">
        <p className="text-7xl font-semibold tabular-nums text-white/[0.08]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          This page is off the grid
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-pretty text-fg-secondary">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/app">Open the app</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
