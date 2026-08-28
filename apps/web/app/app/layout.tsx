import type { Metadata } from "next";

import { AuthGuard } from "@/components/app/auth-guard";
import { AppTopNav } from "@/components/app/app-top-nav";

export const metadata: Metadata = {
  title: "App",
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        className="grid-bg absolute inset-0 -z-20 opacity-30"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 -z-20 h-72 bg-gradient-to-b from-charge/[0.07] to-transparent"
        aria-hidden
      />

      <AppTopNav />
      <main
        id="main"
        className="relative z-0 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6"
      >
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
