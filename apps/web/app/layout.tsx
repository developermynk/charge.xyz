import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://charge.xyz"),
  title: {
    default: "Charge.xyz — DeFi at full charge on Arc",
    template: "%s · Charge.xyz",
  },
  description:
    "The USDC-native control panel for Arc. Swap, bridge, launch tokens and send funds on the chain where USDC is the gas. Sign in with email — no wallet required.",
  keywords: [
    "Arc",
    "Circle",
    "USDC",
    "stablecoin",
    "DeFi",
    "swap",
    "CCTP bridge",
    "token launcher",
  ],
  openGraph: {
    title: "Charge.xyz — DeFi at full charge on Arc",
    description:
      "Swap, bridge, launch and send USDC on Arc, where your money is also your gas.",
    url: "https://charge.xyz",
    siteName: "Charge.xyz",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Charge.xyz — DeFi at full charge on Arc",
    description:
      "Swap, bridge, launch and send USDC on Arc, where your money is also your gas.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08090C",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        {/* Apply the saved theme before paint to avoid a flash of the wrong
            mode. Default is dark; a persisted "light" removes the class. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('charge-theme');var d=t? t==='dark' : true;document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-base font-sans text-fg antialiased`}
      >
        {/* Skip link — keyboard users should not have to tab the whole nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-charge focus:px-4 focus:py-2 focus:font-medium focus:text-black"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
