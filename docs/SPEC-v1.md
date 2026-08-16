# Charge.xyz v1 — Executable SPEC (gstack Phase 5)

> PHASE: v1 of the phased plan (decision D1, approved). Scope = the differentiators.
> PRE-CODE: nothing in this spec is implemented yet. On approval, build against this.
> Wallet keystone here is **multi-chain EVM only**; Solana/non-EVM is v2.

## Scope (v1)
1. Multi-chain EVM wallet (all Arc-supported EVM chains) — keystone
2. Portfolio / Overview with **Networks filter** (All networks ↔ single chain):
   tokens on all chains, per-chain drill-down. (NFTs + full history = v2 history depth.)
3. Market: Trending / Recents / Watchlist (replaces "token deployment" nav)
4. Token Launch (upgrade existing `/app/create`): image, name, symbol, paired
   asset (native per chain), website/X/Telegram, description, editable vs locked
   metadata, insider allocation. UniV4 + locked token-only liquidity, ETH-priced,
   per PRD rules.
5. Send/Receive: existing `/app/send` + new `/app/receive` with QR.

> Out of v1 (explicitly v2): any-to-any cross-chain swap rewrite, any-to-any CCTP
> bridge rewrite (v1 keeps current Arc→testnet bridge), Solana non-EVM, history/NFT depth.

## Architecture

### A. Wallet keystone — `packages/web3/src/wagmi.ts`
- Replace `chains: [arcTestnet]` with **all EVM chains from `SWAP_CHAINS`**
  (Base, Arbitrum, OP, Polygon, Avalanche, Ethereum, Unichain, Ink, Linea,
  Plume, Sei, Sonic, World, XDC, HyperEVM, + testnets: Base Sepolia, Arbitrum
  Sepolia, OP Sepolia, Sepolia, Avalanche Fuji). Keep `arcTestnet` first.
- Add a `transports` entry per chain. Use `http()` with per-chain RPC from
  `BRIDGE_CHAIN_META`/Public RPCs; honor `NEXT_PUBLIC_ARC_RPC_URL` for Arc.
- Keep Privy embedded (email) + injected/WalletConnect. Solana adapter = v2.

### B. Account context — `packages/web3/src/wallet-context.tsx`
- `useWallet()` currently returns one `address` + `method`. Extend to expose
  **`chains: { chainId, address }[]`** for all connected EVM chains + a
  `activeChainId` selector. Keep backward-compatible `address` = active chain.
- Email login → Privy embedded wallet per chain; injected → all chains the
  external wallet holds.

### C. Balances — upgrade `use-arc-balance.ts` → `use-balance.ts`
- New `useBalance({ chainId, address })` returning token list per chain
  (ERC-20 + native). Keep the Arc two-view (native USDC vs ERC-20) logic for
  `5042002` only, via the existing `isArcChain` guard. Other chains: standard
  native + ERC-20.

### D. Portfolio — `apps/web/app/app/page.tsx` (Overview)
- Add **Networks filter**: `All networks` (default) shows aggregate tokens across
  every chain; selecting one chain filters to that chain's assets (PRD rule).
- Replace the two hard-coded USDC cards with a **token list grouped by chain**,
  plus a per-chain native balance. Keep copy-address + faucet warning.
- Quick actions: keep Swap/Bridge/Send; add **Market** + **Launch**.

### E. Market — new `apps/web/app/app/market/page.tsx` + components
- Tabs: **Trending** (tokens sorted by market cap desc across all chains when
  "All networks", per-chain when a chain is selected), **Recents** (recent
  launches), **Watchlist** (user-saved, persisted in localStorage).
- Reference UX: 01.exchange market section (clean ranked table: rank, token,
  chain, price, mcap, 24h, sparkline, watch-star).
- Data source v1: on-chain token registry + a `launchEvents` feed (events from
  the launch contract). Market cap = price × fixed supply. Timeframes (1h/6h/24h/
  7d) filter the sort window.
- Native paired asset per chain (from `circle.ts` map): USDC@Arc, ETH@Base,
  AVAX@Avalanche, etc.

### F. Token Launch — upgrade `apps/web/app/app/create/page.tsx` + `CreateTokenPanel`
Fields (PRD): token image (upload/IPFS pin), name, symbol, **paired asset**
(native of selected chain — USDC@Arc, ETH@Base, …), project website, X, Telegram,
description. **Launch options**: editable metadata OR locked; insider allocation
(amount drawn from fixed supply before pool seed).
- On submit: deploy token (ERC-20 fixed supply; **BRC-20 framing on Base Sepolia
  per PRD — confirm exact standard**, see Open Q), seed **Uniswap v4** pool with
  token-only liquidity **permanently locked**, price in ETH. Swap fees frozen
  per launch; pull-based claims for creator/platform/referrer.
- Profile editing (v1-lite): update identity fields (name/links) only — no mint,
  no pause, no remove-liquidity. Enforce in contract + UI.

### G. Send / Receive — `apps/web/app/app/send` (exists) + new `/app/receive`
- Send: keep transfer; add **NFT send** (ERC-721/1155) + QR-scan recipient input.
- Receive: render **QR code** of active address (qrcode.react), chain badge, copy.

## Data layer additions — `packages/chains/src/circle.ts`
- Add `NATIVE_PAIRED_ASSET: Record<chainId, {symbol, address?}>` (USDC@Arc,
  ETH@Base, AVAX@Avalanche, MATIC@Polygon, …).
- Extend `SWAP_CHAINS` typing to carry `evm: boolean` + numeric `chainIdNum` so
  the wallet + market can key off it. (Solana flagged `evm:false` for v2.)

## Open questions (resolve before launch-feature implementation)
- **OQ1:** "BRC-20 on Base Sepolia" — BRC-20 is Bitcoin-only. On EVM this is an
  ERC-20 with BRC-20-style mint/inscription semantics, or a specific deployed
  standard. Need your exact contract target.
- **OQ2:** UniV4 deployment target chain for v1 — Arc Testnet (USDC paired) per
  PRD's "arc only USDC", but PRD also says Base Sepolia uses ETH. Confirm v1
  ships launch on **both Arc (USDC) and Base Sepolia (ETH)** or one.
- **OQ3:** Web docs (Arc/Circle llms.txt) were unreachable at plan time; UniV4
  hooks + launch contract specifics must be confirmed against Arc docs before
  coding the launch contract. Will re-attempt web fetch when credits restored.

## Verification
- `pnpm build` (apps/web) passes + TypeScript clean (repo's gate).
- Manual: connect injected wallet holding multiple chains → Overview shows
  All-networks aggregate + per-chain filter works; Market tabs render + watchlist
  persists; Launch form validates + submits (testnet, requires your live sig);
  Receive shows scannable QR for active address.
- No on-chain tx (launch/deploy) without your explicit approve + signature.
