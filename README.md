# Charge

**DeFi at full charge.** Swap, bridge, and deploy tokens across every major chain
with institutional-grade speed and zero compromise on security.

Chargefi is a multi-chain DeFi application — a marketing landing page plus a
wallet-gated dashboard for swapping, bridging, launching ERC-20 tokens, and
transferring assets. It is built as a **pnpm + Turborepo monorepo** with a
Next.js App Router frontend, wagmi/viem wallet connectivity, and Circle modular
(passkey) smart-account wallets.

---

## Monorepo layout

```
apps/
  web/        # Next.js 16 App Router frontend (landing + dashboard)
packages/
  ui/         # Shared shadcn/ui primitives (@repo/ui)
  hooks/      # Wallet context, wagmi config, chain, Circle helpers (@repo/hooks)
  sdk/        # On-chain SDK helpers (@repo/sdk)
  contracts/  # Solidity contracts + deploy scripts (@repo/contracts)
  utils/      # Shared utilities incl. cn() (@repo/utils)
  types/      # Shared TypeScript types (@repo/types)
  infra/      # Terraform / AWS infra config (@repo/infra)
```

## App structure (`apps/web`)

- **Landing** (`app/page.tsx`) — Nav, Hero, Stats, Features, CTA, Footer.
- **Dashboard** (`app/dashboard/*`) — one shared `DashboardLayout` + `DashboardSidebar`,
  with routes:
  - `/dashboard/swap` — token swaps
  - `/dashboard/bridge` — cross-chain bridging
  - `/dashboard/launch` — deploy ERC-20 tokens ("Create Token")
  - `/dashboard/transfer` — send tokens
- **Reusable UI** lives in `components/charge/` (design primitives, chain/token SVG
  logos, panels, landing sections, and the wallet connect modal).

## Wallet & blockchain

- **wagmi + viem** with an injected connector (MetaMask / any injected EVM wallet).
- **Circle modular wallets** for passkey-based smart accounts
  (`@circle-fin/modular-wallets-core`), with gasless UserOperations via the
  bundler/paymaster.
- Wallet state is centralized in `@repo/hooks` (`WalletContext`), surfaced through
  the Charge login modal (Google / Email → passkey, or connect an EVM wallet).

## Getting started

```bash
pnpm install
pnpm dev          # run all apps in parallel via Turborepo
pnpm build        # build all packages/apps
pnpm lint         # lint
pnpm typecheck    # typecheck
```

### Environment

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:

- `NEXT_PUBLIC_ALCHEMY_RPC_URL` — RPC endpoint
- `NEXT_PUBLIC_CIRCLE_CLIENT_KEY` / `NEXT_PUBLIC_CIRCLE_CLIENT_URL` — Circle
  modular-wallet credentials (required for passkey wallet support)

## Tech stack

Next.js App Router · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui ·
framer-motion · wagmi · viem · Circle modular wallets · Turborepo · pnpm.
