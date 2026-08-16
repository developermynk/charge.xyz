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
    <div className="flex min-h-dvh flex-col">
      <AppTopNav />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
