import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow the LAN IP so HMR + dev assets load when you open the app from
  // another device on the network (not just localhost).
  allowedDevOrigins: ["192.168.29.22", "192.168.29.223", "localhost"],

  /**
   * Workspace packages ship TypeScript source rather than a build step, so
   * Next compiles them itself. This keeps the monorepo free of a
   * watch-and-rebuild loop during development.
   */
  transpilePackages: [
    "@charge/chains",
    "@charge/ui",
    "@charge/web3",
    "@charge/sdk",
    "@charge/contracts",
  ],

  /**
   * Privy's Solana support arrives via optional peer dependencies. We install
   * them (see apps/web devDependencies) so the module graph resolves, but the
   * code paths are unreachable in an EVM-only app and tree-shake out of the
   * client bundle.
   *
   * Do NOT alias these to an empty stub: the modules are imported by NAME
   * (e.g. `wrapNullable`), so a default-only stub fails the build with
   * "export was not found in module".
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // camera=(self) is REQUIRED for the Send QR scanner (getUserMedia).
            // Vercel/Next default of camera=() silently blocks the camera on
            // every browser. mic/geolocation stay disabled — app doesn't use them.
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
