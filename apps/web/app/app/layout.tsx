import type { Metadata } from "next";

import { AuthGuard } from "@/components/app/auth-guard";
import {
  AppMobileNav,
  AppSidebar,
  WrongNetworkBanner,
} from "@/components/app/sidebar";

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
    <div className="flex min-h-dvh">
      <AppSidebar />
      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto max-w-4xl px-6 py-8 pb-28 lg:pb-8">
          <WrongNetworkBanner />
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      <AppMobileNav />
    </div>
  );
}
