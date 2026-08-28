# AchSwap.app — Deep Analysis vs Arc + Circle Canonical Workflow

**Scope:** How achswap.app works on Arc Testnet (chainId 5042002), whether it follows
Arc/Circle docs, and which patterns (bridge, RWA analytics, aggregator DEX) we can
adapt into Chargefi.

**Verified sources:**
- Live HTML: https://achswap.app/ (HTTP 200, SPA bundle `/assets/index-*.js`)
- Docs: https://docs.achswap.app (Swap / Adapter / RWA / Bridge / SDK / MCP / Contract Addresses)
- On-chain checks via `rpc.testnet.arc.network` (USDC decimals confirmed)
- Our own code: `packages/chains/src/circle.ts`, `packages/sdk/src/{swap-amm,lp}.ts`, `packages/web3`

---

## 1. What achswap.app IS

A full Arc-native DeFi suite under one brand, all on Arc Testnet:

| Product | What it does | Arc contracts |
|---|---|---|
| **AchSwap** | DEX: V2 + V3 + V4 pools, smart-routing aggregator, gasless swaps, cross-chain USDC bridge | V2/V3/V4 factories+routers, Aggregator Vault/Quote/Execution |
| **AchRWA** | Vault-backed synthetic RWA (stocks/commodities/forex) bought/redeemed in USDC | `AchRWAOracle 0x7639…ABdB`, `RWAVault 0xb8dc…e78C` |
| **AchMarket** | LMSR prediction markets (outcome shares) | `PredictionMarketFactory 0xd7b1…f283` |

Tagline from live page: *"Ach Ecosystem | RWA, DEX, Bridge & AI DeFi Infrastructure."*

**Verdict: this is a reference-grade Arc dApp.** It does NOT deviate from Arc/Circle
docs — it extends them (V4 hooks, aggregator split-routing, gasless relayer, RWA
oracle). Everything settles in native USDC. This is the closest public analog to what
Chargefi is building.

---

## 2. Token / decimals model (CRITICAL — read this)

Arc's native gas asset is USDC, exposed two ways (per `use-arc` skill):
- **Native view:** 18 decimals, used only for gas / `msg.value`.
- **ERC-20 view:** 6 decimals at `0x3600000000000000000000000000000000000000`.

**On-chain confirmation I ran:** `decimals()` on `0x3600…0000` returns `0x6` → **6 decimals**.
So our `circle.ts` (USDC=6dp) is CORRECT for the ERC-20 view.

achswap goes one step further: pools need a canonical ERC-20, so they wrap native USDC
into **wUSDC** (the skill notes their SDK uses `wUSDC` at an 18-decimal address for
V2/V3 pools). Their DEX is built on standard Uniswap-V2/V3/V4, NOT a custom vault like
our `ArcSwapMulti`.

**Implication for Chargefi:** our cirBTC swap path uses `ArcSwapMulti` (inventory vault),
which is why it needs manual "top up the vault" funding and why cirBTC can't be an AMM
pool (token lacks `transferFrom`). achswap avoids this by using real Uniswap-V2 pools +
an aggregator. Their model scales; ours is a stopgap.

---

## 3. Bridge workflow — matches Circle CCTP exactly

achswap Bridge = Circle **CCTP** (burn on source → attestation → mint on destination).
- Source chains (testnet): Sepolia, Fuji, OP/Arb/Base/Polygon/Unichain/Linea Sepolia.
- Destination: **ARC Testnet only** (our native chain).
- Flow: Approve → Burn → Attestation (auto-polled, 1–10 min) → Mint.
- **Fast Transfer** toggle (~0.1% fee) = CCTP fast mode.
- Fees: network gas on both chains; standard CCTP free, Fast ~0.1%.

**This is 1:1 with our `bridge-stablecoin` skill** (App Kit / Bridge Kit `kit.bridge()`
does approve+burn+fetchAttestation+mint in one call; string chain names like
`"Arc_Testnet"`). achswap just wraps the same CCTP under a UI. No deviation.

**Adapt:** Chargefi's bridge is already CCTP-correct. We can mirror achswap's UX:
source-chain selector + Fast Transfer toggle + auto-polling attestation status.
(We do NOT need their contracts — Circle's kit handles it.)

---

## 4. DEX / aggregator workflow (the clever part)

achswap doesn't just use one pool type — it has a **Quote Engine + Execution Router**
that probes V2, V3 (all fee tiers), V4, two-hop, and split routes, then picks the best
net output after a 0.1% aggregator fee.

- Aggregator Vault: `0x0DcbA75EB4c9d7d50f6732ae205b8F872D611E24`
- Quote Engine: `0xA4882662842A1D5a98423A63427B9496d5B6ac82`
- Execution Router: `0xD20Ad9486f178073ef89585d18eCA1b2694B0e8B`
- Legacy single-call Adapter: `0xF82c88FbF46E109a3865647E5c4d4834b31f8AFB`

**Adapt for Chargefi:** our `lp.ts` + `swap-amm.ts` already implement a Uniswap-V2
router wrapper. We could add a V3 (nonfungible-position-manager) + aggregator later,
but the priority is fixing the **cirBTC** path (Section 2). The aggregator pattern is
the right end-state; not needed day 1.

---

## 5. RWA analytics — the model worth copying

AchRWA is the most novel piece and directly relevant to "RWA analytics":

**Mechanics**
- Synthetic tokens (sAAPL, sGOOGL, sWTI, sGOLD, sSILVER, forex…) backed by a USDC reserve.
- Buy: USDC → synth (0.3% fee). Redeem: synth → USDC (0.3% fee).
- **Oracle** (`AchRWAOracle`) submits prices on-chain via `submitPriceBatch()` at
  fixed intervals from real price sources (stocks/commodities/forex FX).
- **Reserve isolation:** fees separate from reserve; vault must hold enough USDC to
  honor all redemptions; owner can withdraw *fees only*, never the reserve.
- **Safety:** primary+backup oracle (5-min heartbeat failover), RPC rotation
  (Arc official → Blockdaemon → dRPC → QuickNode), max-price-deviation rejection,
  staleness window that **blocks swaps if price is stale**, and per-pair freeze / global pause.

**"RWA analytics" = what to surface in UI**
1. Live oracle price per synth (from `AchRWAOracle`), with staleness indicator.
2. Reserve ratio = `vault USDC balance / sum(outstanding synth USDC notional)`.
   If < 1.0 → insolvent, block redeem UI.
3. Fee accrual (0.3% × volume) over time.
4. Per-asset price source + last-update timestamp + deviation vs previous.

**Adapt for Chargefi:** we already have an honest-APY pattern in `lp.ts`
(`computeApy` uses real volume, shows "—" when none). Extend that to RWA:
- Read `AchRWAOracle` prices + `RWAVault` reserve.
- Build a read-only analytics panel (no new contracts needed to *display*).
- If we ever issue Chargefi synthetics, copy the reserve-isolation + staleness-block
  safety rules verbatim.

---

## 6. Agent / MCP integration (how they ship to AI clients)

achswap ships a **local-signing MCP SDK** (`@achswap/mcp-sdk`, `achswap install <client>`):
- Local mode: builds + signs on-device, no AchSwap server → private.
- Keyless remote mode: builds unsigned txs only (can't move funds).
- Tools: `quote_adapter`, swap builders, `add/remove V2 liquidity`, `deploy/burn ERC20`,
  `get_decimals/to_wei/from_wei`, transaction history, top holders.
- Explicit rule: **native USDC is address(0), 18dp; wUSDC 18dp; other tokens vary →
  always resolve real decimals.**

**Adapt:** our `Base MCP` + `Arc MCP` already expose wallet/balance/swap. We could add a
Chargefi "swap + LP + bridge" MCP later, mirroring their tool surface. Not urgent.

---

## 7. Gaps in OUR Chargefi vs achswap (actionable)

| Area | achswap | Chargefi | Fix |
|---|---|---|---|
| DEX | Real Uniswap V2/V3/V4 + aggregator | Single `ArcSwapMulti` vault + thin V2 | Add V2 pools; cirBTC needs token `transferFrom` fix first |
| cirBTC | n/a (they wrap USDC) | Vault-only, near-empty, disabled pool | Top up vault OR switch to AMM once token fixed |
| Bridge | CCTP UI (matches skill) | CCTP (correct) | Mirror UX: source selector + Fast Transfer + attestation poll |
| RWA | Full synth + oracle + reserve analytics | None | Add read-only analytics panel from `AchRWAOracle`/`RWAVault` |
| Agent | Local MCP SDK | Base/Arc MCP | Optional later |

---

## 8. Bottom line

- achswap follows Arc/Circle docs **faithfully** and extends them sensibly. It is a
  legitimate reference implementation, not a hack.
- Our Chargefi bridge (CCTP) is already aligned. Our DEX/vault model is the weaker
  part — the cirBTC failure is a symptom (empty `ArcSwapMulti` vault + token missing
  `transferFrom`), not a UI bug.
- Highest-value adaptations: **(a)** RWA analytics panel (read-only, no contracts),
  **(b)** bridge UX parity, **(c)** eventually real Uniswap-V2 pools + aggregator to
  retire the inventory vault.

## 9. Chargefi bridge backend — implemented (achswap-style)

The bridge was 100% client-side (Circle App Kit in `bridge-panel.tsx` →
`packages/sdk/src/bridge.ts`). achswap's edge is a server-side transfer tracker.
We added one, mirroring achswap's stage model:

- `apps/web/app/api/bridge/status/route.ts` — `POST` registers a burn (hash +
  fromChain + toChain), `GET ?hash=` polls live stage, `GET` lists in-flight.
- `apps/web/app/api/bridge/events.ts` — viem `EventWatcher`: confirms the source
  `MessageSent` (burn landed), then polls the destination `MessageTransmitter`
  `MessageReceived` (mint confirmed). Stores entries in `/tmp` (same pattern as the
  history route; Vercel serverless = ephemeral FS, acceptable for live tracking).
- `packages/web3/src/use-bridge-status.ts` — client hook: registers the burn hash
  with the backend, polls every 5s, exposes `burned/attesting/minted` + destination
  tx. Wired into `bridge-panel.tsx` so the UI shows an honest timeline instead of a
  single multi-minute spinner.
- `packages/chains/src/circle.ts` — added `CCTP_DOMAIN_BY_SDK_ID` (Arc=26,
  Base=6, Arb=3, OP=2, Eth Sep=0, Avax Fuji=1) and `CCTP_MESSAGE_TRANSMITTER_V2`
  addresses, plus the shared `BridgeStage` type.

**Verified:** typecheck 0 (chains/web3/web), lint 0, route exercised live
(POST 200, GET 200, invalid-hash 400), `/app/bridge` 200. The watcher built viem
clients and queried Arc+Base RPCs with no crash.

**Critical constraint baked into the design:** Arc Testnet is CCTP domain **26**
and Circle's public IRIS attestation API does NOT index Arc-origin burns
(circlefin/evm-cctp-contracts#110). So the backend does NOT poll IRIS — it verifies
completion on the destination chain's `MessageTransmitter`, which is chain-agnostic
and works for every pair including Arc→external. Do not "fix" this to poll IRIS.

**Gap to flag honestly:** the `MessageSent`→`MessageReceived` correlation was
implemented to the CCTP v2 spec but NOT yet exercised against a real burn/mint pair
(no live user bridge tx available in this session). Wire-up + route + chain clients
are proven; the end-to-end event match needs one real transfer to confirm.

---
*Generated by Forge. On-chain facts verified against `rpc.testnet.arc.network`.*
