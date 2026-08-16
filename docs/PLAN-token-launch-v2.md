# Token Launch V2 — DexScreener / 01.exchange style

**Status:** DRAFT — awaiting lock + 3 decisions (D1–D3 below).
**Scope:** Arc Testnet only (mainnet later, behind a flag).
**Rule:** No contract deploy / on-chain sign until mayank explicitly approves.

---

## 1. Goal
A token launcher where anyone can:
- Deploy a token with **image, description, social links**, **default supply 1,000,000,000 (1B)**, and **optional mintable / burnable flags**.
- Immediately after deploy, **anyone can buy and trade it** (DexScreener-style detail page + live price, chart, holders, liquidity).

## 2. Current baseline (verified in code)
- `packages/contracts/src/ChargeToken.sol`: fixed-supply ERC-20, **no mint, no owner, no burn**. Constructor `(name, symbol, decimals, totalSupply)`, 100% to deployer.
- `packages/sdk/src/token.ts`: `deployToken()` deploys from the user's wallet, fixed-supply ABI.
- `apps/web/components/app/create-token-panel.tsx`: form = name / symbol / supply / decimals only.
- `apps/web/app/app/market/*`: static `SEED_TOKENS` mock data; no on-chain reads.
- `apps/web/app/app/swap/*`: Arc AMM (Uniswap V2 router `0xe27d…a6d9`) — already routes any ERC-20/USDC pair.

## 3. Decisions needed BEFORE coding

### D1 — Trading mechanism (the big fork)
- **(A) Bonding curve / launchpad [01.exchange style, recommended for fidelity]**: a `ChargeLaunchPad` contract sells tokens for USDC along a rising curve; at a threshold it seeds a Uniswap V2 pool and "graduates". Truest to the 01.exchange reference, but most contract work.
- **(B) Deploy + auto-create Uniswap V2 pool**: at deploy, also create a USDC pair on the existing Arc AMM with deployer-chosen initial USDC liquidity. Reuses the live router I already verified; ships fastest; token is immediately tradeable on Swap. Risk: small pools = high slippage.
- **(C) Deploy only, manual liquidity**: deploy token, owner adds liquidity themselves later via Swap. Least work, but "anyone can buy" isn't automatic.

### D2 — Metadata storage (image / description / socials)
- **(A) Charge indexer API route + JSON store [recommended for testnet]**: a Next.js route that records launches (address → {image, description, socials}) and serves them. Cheap, no backend.
- **(B) On-chain**: store URI/strings in the contract or a registry. More trust, more gas, bigger ABI.
- **(C) IPFS/Arweave pin**: image + JSON pinned; contract stores hash. Best for mainnet, overkill for testnet.

### D3 — Flag defaults
- Default supply = **1,000,000,000** (confirmed).
- **mintable / burnable default OFF** (keeps the anti-rug guarantee), but user-toggleable. If mintable is ON, the token detail page shows a prominent red **MINT ENABLED — owner can inflate** badge. Confirm this is acceptable, or you want them ON by default.

## 4. Proposed design (if D1=A, D2=A, D3=off)
**Contracts (`packages/contracts/src`)**
- `ChargeTokenV2.sol`: adds `bool mintable, bool burnable` constructor flags + `owner` (only if mintable). `mint(to,amt)` / `burn(amt)` gated by flags. Same anti-rug guarantees when both off.
- `ChargeLaunchPad.sol` (if D1=A): bonding curve, graduate-to-pool.
- Recompile with Foundry → new bytecode artifact in `@charge/contracts`.

**SDK (`packages/sdk/src/token.ts`)**
- `deployTokenV2()` with flags + metadata; `launchPadBuy()/sell()` if D1=A; pool-create if D1=B.

**UI**
- Redesign `/app/create` (launch form): image upload, description, social links (twitter/tg/site), supply (default 1B), decimals, mintable/burnable toggles, live "what you get" security box that updates with flags.
- New `/app/token/[address]` detail page (DexScreener style): header (image, name, symbol, CA, socials), price + market cap + 24h (from pool reserves or curve), holders (Transfer logs), liquidity, chart (reserves over time), buy/sell widget, flags badges (MINT/BURN).
- Market page merges on-chain launches with `SEED_TOKENS`.

**Indexer**
- `apps/web/app/api/tokens/route.ts`: records launches + metadata (D2=A); `apps/web/app/api/tokens/[address]/route.ts`: serves detail. Scans Arc for `ChargeTokenV2` deploys (factory event or Transfer logs) to populate Market.

## 5. Phases
- **P0** — `ChargeTokenV2` + (launchpad or pool) Solidity, Foundry compile, new artifact. *Needs deploy approval.*
- **P1** — Launch form redesign (`/app/create`) + SDK `deployTokenV2`.
- **P2** — Indexer API + metadata store; Market merge.
- **P3** — Token detail page (`/app/token/[address]`), DexScreener style.
- **P4** — Buy/sell (bonding curve or AMM pool) wired to detail page.

## 6. Verification
- Foundry tests for V2 flags (mint gated, burn gated, fixed when off).
- Live deploy on Arc Testnet from a wallet; token appears in Market + detail page.
- Buy/sell round-trip (buy on detail page → sell → balance changes; price moves).
- typecheck / lint 0; pages 200.

## 7. Cautions
- **Mintable tokens are a rug vector.** If D3 lets mintable stay toggleable, the detail page MUST surface it loudly (red badge + owner address). Non-negotiable for "caution".
- **Bonding curve (D1=A)** is the most code and the most failure surface; if time/scope matters, D1=B ships faster and reuses the proven Arc AMM.
- **No backend** means D2=A indexer is local/testnet-only; mainnet needs a real DB or on-chain/D2=B/C.
- All contract work requires explicit deploy approval before any broadcast.
