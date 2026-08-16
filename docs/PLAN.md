# Charge.xyz v2 — Product & Architecture Plan

> Status: PRE-CODE. gstack Phase 0–2 (reframe → CEO → eng lock). No application
> code is written until this plan is approved and the SPEC is locked.
> Sources used: in-repo `packages/chains` registry, `circle blockchain list`
> (Circle CLI), Arc skill facts. Live web docs were unavailable at plan time.

## 1. Reframe (office-hours / CEO 10-star)

**Thesis.** One control panel where any web3 user connects any wallet, sees
every asset across every Arc-supported chain, and moves value (swap / bridge /
send) or launches a token — without leaving the app or reasoning about which
chain they are on. The wedge is *"all chains, one screen,"* powered by Circle's
USDC-native stack (Swap Kit, CCTP, App Kit) on Arc.

**10-star core — cut anything that does not serve "all chains, one screen":**
1. Multi-chain wallet connect (all EVM chains + non-EVM Solana)
2. Unified portfolio: network filter (All / per-chain) → tokens + NFTs + tx history
3. Any-to-any swap (Circle Swap Kit, cross-chain)
4. Any-to-any USDC bridge (CCTP)
5. Send / Receive with QR code + NFT send
6. Market: Trending / Recents / Watchlist + Token Launch (UniV4, locked liquidity)

## 2. Architecture lock (eng)

### 2.1 The keystone change
`packages/web3/src/wagmi.ts` today: `chains: [arcTestnet]` — Arc-singular by
design. The PRD requires *every* chain, so this is the foundational rewrite.

- **EVM chains:** extend wagmi `chains` to all EVM entries in `SWAP_CHAINS`
  (Base, Arbitrum, OP, Polygon, Avalanche, Ethereum, Unichain, Ink, Linea,
  Plume, Sei, Sonic, World, XDC, HyperEVM, + testnets). Auth = Privy embedded
  (email) + injected / WalletConnect for external wallets.
- **Non-EVM (Solana):** `@solana/wallet-adapter` behind the *same* account
  context. For email login, Privy's Solana embedded wallet. Per PRD, bridging
  to a non-EVM chain requires the user to also connect that chain's wallet.

### 2.2 Data layer (already partially present)
`packages/chains/src/circle.ts` ships `SWAP_CHAINS` (17, incl. Solana + Monad as
legitimate Circle SDK ids), `BRIDGE_DESTINATIONS`, `BRIDGE_CHAIN_META`. Extend
with a per-chain **native paired asset** map for the Market launch flow:
USDC@Arc, ETH@Base, AVAX@Avalanche, SOL@Solana, etc.

### 2.3 Route / feature surface
| Route | State | Work |
|---|---|---|
| `/app` | exists | becomes portfolio/home (networks filter, assets, NFTs, history) |
| `/app/swap` | exists | upgrade single-chain → any-to-any cross-chain |
| `/app/bridge` | exists | upgrade Arc→testnet → any-to-any CCTP |
| `/app/send` | exists | add QR receive + NFT send |
| `/app/receive` | new | QR show / scan |
| `/app/market` | new | Trending / Recents / Watchlist (replaces "token deployment" concept) |
| `/app/launch` | new | token launch: image, name, symbol, paired asset, website/X/telegram, description, editable/locked metadata, insider allocation |

### 2.4 Token launch mechanics (from PRD)
UniV4 pool goes live with the token, priced in ETH. Token-only liquidity is
permanently locked. Fixed supply minted once; optional allocations drawn from
supply before the pool is seeded. Swap fees frozen per launch; pull-based claims
for creator / platform / referrer. Profile editing updates identity fields only
(no mint, no pause, no remove-liquidity). Standard: BRC-20 on Base Sepolia;
per Arc docs elsewhere.

## 3. Open decisions (must resolve before SPEC lock)
- **D1 Phasing** — how to sequence delivery (see clarify prompt).
- **D2 Non-EVM (Solana)** — v1 or v2.
- **D3 "BRC-20 on Base Sepolia"** — BRC-20 is Bitcoin-only; on EVM this means an
  ERC-20 launch with BRC-20-style framing, or a specific contract standard.
  Needs your clarification.

## 4. Risk
Web docs (Arc / Circle llms.txt) were unreachable at plan time. UniV4 + BRC-20
exact mechanics are planned from the PRD + in-repo registry and must be
confirmed against Arc docs before the launch feature is implemented.
