# Charge.xyz — Build Spec v2 (clean rebuild)

> Status: **AWAITING SIGN-OFF**. No implementation until Mayank approves.
> Method: gstack (office-hours → plan reviews → spec → implement → cso → qa → ship)
> Stack: Arc Testnet (Circle L1) + Circle SDK suite + Privy auth + Next.js 16 monorepo

---

## 0. Why rebuild (evidence, not opinion)

Recon of the current tree found four structural defects that cannot be patched incrementally:

| # | Defect | Evidence |
|---|--------|----------|
| 1 | **Repo does not typecheck** | `pnpm -w typecheck` fails: `@repo/hooks` has irreconcilable `viem` type conflicts — duplicate viem copies at `packages/hooks/node_modules/viem` vs `node_modules/@circle-fin/modular-wallets-core/node_modules/viem`. Two `Chain` types "with this name exist, but they are unrelated." |
| 2 | **Wrong project fused in** | `packages/contracts` is a **UMA optimistic-oracle prediction market** (`EventBasedPredictionMarket.sol`, `PredictionMarketAMM.sol`, `@uma/core` artifacts). Nothing to do with swap/bridge/token-create. `packages/hooks` carries `useMarket`, `useAMM`, `useOracleState` dead weight. |
| 3 | **Monorepo boundary broken** | `backend/` is a standalone **npm** project (`package-lock.json`, own `node_modules`) sitting inside a **pnpm** workspace that only globs `apps/*` and `packages/*`. It is not a workspace member — turbo never builds it. Requirement says monorepo; this violates it. |
| 4 | **Dead/contradictory API surface** | `POST /api/swap` returns HTTP 400 "disabled" by design. Uncommitted drift across 9 files. `packages/infra` is an empty stub. |

**Verdict:** rebuild the workspace clean. Salvage the genuinely-correct logic (Arc chain constants, Circle swap chain/token tables, panel UX) rather than the scaffolding.

---

## 1. Product thesis (office-hours reframe)

> **Charge.xyz is the USDC-native control panel for Arc.** Because Arc charges gas in USDC, a user can hold exactly one asset and still do everything. Charge removes the single most hated step in crypto onboarding — "go acquire the gas token first." Sign in with an email, land on a chain where your money *is* the gas, and swap, bridge, mint, or send within one screen.

**Wedge vs existing dapps:** every other swap/bridge UI assumes a separate volatile gas asset and a browser extension. Charge assumes neither. Email login → Circle smart account → USDC pays for everything.

**Must-have features (locked, matches the request):**
1. Landing page — professional marketing surface
2. Swap (Circle Swap Kit, Arc Testnet)
3. Bridge (CCTP, Arc ↔ other testnets)
4. Token creation on Arc
5. Transfer funds
6. Dual auth: **email via Privy** + **continue with wallet**

---

## 2. Architecture lock (eng review)

### 2.1 Target monorepo layout

```
charge.xyz/
├── apps/
│   └── web/                     # Next.js 16 (App Router) — UI + route handlers
│       ├── app/
│       │   ├── (marketing)/     # landing — public, static, fast
│       │   └── (app)/           # dashboard — auth-gated
│       │       ├── swap/  bridge/  create/  transfer/
│       │       └── api/         # server-only: quote, deploy, config
│       └── ...
├── packages/
│   ├── ui/                      # design-system primitives (no web3 imports)
│   ├── chains/                  # Arc + Circle chain/token constants (SSOT)
│   ├── web3/                    # wagmi config, Privy config, wallet context
│   ├── sdk/                     # Circle kit wrappers + ABIs
│   └── config/                  # shared tsconfig / eslint / tailwind preset
├── docs/SPEC.md
├── pnpm-workspace.yaml   turbo.json   tsconfig.base.json
```

**Deleted:** `packages/contracts` (UMA prediction market), `packages/infra` (empty), `backend/` (folded into `apps/web/app/api` — see D2).

### 2.2 The viem-duplication fix (root cause, not a symptom patch)

Defect #1 is caused by multiple resolved copies of `viem`. Fix in `package.json` at root:

```jsonc
"pnpm": {
  "overrides": { "viem": "2.47.5" },     // single resolved copy, repo-wide
  "peerDependencyRules": { "allowedVersions": { "viem": "2" } }
}
```
Every package declares `viem` as a **peer + dev** dep, never a plain dependency, so hoisting cannot fork it. Verification gate: `pnpm ls viem -r --depth 10 | grep -c "viem 2"` must resolve to exactly one version, and `pnpm -w typecheck` must exit 0.

### 2.3 Arc network facts (verified live, not from memory)

| Field | Value | Verified by |
|---|---|---|
| Chain ID | `5042002` (`0x4cef52`) | `arc-canteen rpc eth_chainId` → `0x4cef52` ✅ |
| Chain def | `viem/chains` → `arcTestnet` | resolved live in repo ✅ (no custom def needed) |
| Native gas | **USDC, 18 decimals** | viem `nativeCurrency` ✅ |
| ERC-20 USDC | `0x3600...0000`, **6 decimals** | Arc docs ✅ |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`, 6 | Arc docs |
| CCTP domain | `26` | Arc docs |
| Explorer | `https://testnet.arcscan.app` | Arc docs |
| Faucet | `https://faucet.circle.com` | Arc docs |
| SCP chain id | `ARC-TESTNET` | Circle SCP docs |

> **Decimals hazard — the #1 bug source on Arc.** Native gas is 18dp, ERC-20 USDC is 6dp, and *both are called USDC*. Mitigation: `packages/chains` exports branded types `NativeAmount` / `Erc20Amount`; no raw `bigint` crosses a function boundary. Unit tests assert `parseUnits(x, 18) !== parseUnits(x, 6)` handling on every path.

### 2.4 Feature → implementation matrix

| Feature | Path | SDK | Signer | Notes |
|---|---|---|---|---|
| Swap | client-side | `@circle-fin/app-kit` (Swap Kit) | **user's wallet** (EIP-1193) | Quote via server route (holds `KIT_KEY`); execution client-side. Arc Testnet tokens limited to `USDC`, `EURC`, `cirBTC`. USDC↔NATIVE is a same-asset no-op → blocked in UI. |
| Bridge | client-side | `@circle-fin/app-kit` bridge (CCTP) | user's wallet | No kit key needed for bridge. Arc domain 26. Full approve→burn→attest→mint lifecycle in one `kit.bridge()`. |
| Create token | on-chain | viem `deployContract` (see D1) | user's wallet | Own audited ERC-20; user owns the token. |
| Transfer | on-chain | viem | user's wallet | Native (18dp) and ERC-20 (6dp) paths are separate code paths. |
| Auth (email) | Privy | `@privy-io/react-auth` | embedded wallet → Circle smart account | `loginMethods: [email, google, passkey]` |
| Auth (wallet) | wagmi | injected + WalletConnect | user's wallet | |

### 2.5 Security boundary (non-negotiable)

- `KIT_KEY`, `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET` are **server-only**. Never `NEXT_PUBLIC_`. A build-time guard script fails CI if a secret name appears in client bundle output.
- **No developer wallet ever signs a user's transaction.** The old `WALLET_ADDRESS`-signs-swaps design is removed. Every value-moving tx is signed by the connected user.
- `.gitignore` covers `.env*`. `backend/.env` currently holds a real `CIRCLE_ENTITY_SECRET` — must be confirmed untracked, and rotated if it ever hit git.
- Full `cso` pass (OWASP + STRIDE + web3: reentrancy, access control, approval abuse, front-running) before any deploy.

---

## 3. Design direction (ui-ux-pro-max)

`search.py` on "defi swap bridge dapp dark professional fintech" returned:
- **Primary:** Glassmorphism + Dark Mode (OLED); secondary Motion-Driven
- **Landing:** Conversion-Optimized
- **Dashboard:** Real-Time Monitoring, Data-Dense
- **Palette:** dark tech base + trust + vibrant accent

**Charge identity:** OLED near-black base `#08090C`, electric charge-green primary `#00E58A` (the "charged" cue), USDC-blue `#2775CA` as the trust/secondary, amber warnings, red errors. Type: Geist/Inter tight tracking, tabular-nums for every numeric. Motion: framer-motion, 150–250ms, respects `prefers-reduced-motion`.

**A 10/10 for the four critical screens:**
1. *Connect* — both auth paths visible in one modal, no dead-ends, email path never says the word "wallet"
2. *Main action* — quote visible before commit; fees, rate, min-received, price impact all explicit
3. *Tx pending* — real progress stages (approve → burn → attest → mint), never an indefinite spinner
4. *Success/failure* — arcscan link, plain-language error, one-click retry

Accessibility: WCAG AA contrast, full keyboard path, focus rings, screen-reader labels on every numeric field.

---

## 4. Test + verification gates

| Gate | Command | Pass condition |
|---|---|---|
| Single viem | `pnpm ls viem -r` | exactly one version |
| Types | `pnpm -w typecheck` | exit 0 |
| Lint | `pnpm -w lint` | exit 0 |
| Unit | `pnpm -w test` | decimals, quote math, chain guards green |
| Build | `pnpm -w build` | exit 0 |
| Secret leak | `scripts/check-secrets.mjs` | no server key in client bundle |
| Live chain | `arc-canteen rpc eth_chainId` | `0x4cef52` |
| QA | gstack `qa` in real browser | both auth paths + 4 features exercised |

---

## 5. Phasing

- **P0** Workspace skeleton, viem override, tooling, CI gates
- **P1** `packages/chains` + `packages/ui` design system
- **P2** Auth (Privy email + wallet) end-to-end
- **P3** Landing page
- **P4** Transfer (simplest value path — proves signing works)
- **P5** Swap
- **P6** Bridge
- **P7** Token creation
- **P8** cso audit → qa → ship → `arc-canteen update-product`

---

## 6. Open decisions (need Mayank)

**D1 — Token creation signer.** Circle SCP (`ARC-TESTNET`) deploys from a *developer-controlled wallet*, so **Charge would own every token users mint**, and it needs `CIRCLE_WALLET_ID` which is currently blank. Deploying via viem from the *user's* wallet makes the user the real owner. Recommend: **viem / user-owned**.

**D2 — Backend.** Fold `backend/` into `apps/web/app/api` (one deploy target, matches existing `vercel.json`), or keep a separate `apps/api` Express service as a workspace member. Recommend: **fold in**.

**D3 — Git strategy.** Rebuild on a `rebuild/v2` branch with history preserved, vs wipe and re-init. Recommend: **branch**.

**D4 — Secret rotation.** `backend/.env` contains a live `CIRCLE_ENTITY_SECRET` + `CIRCLE_API_KEY`. Confirm they were never committed; rotate if unsure.
