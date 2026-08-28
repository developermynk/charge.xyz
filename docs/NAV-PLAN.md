# Nav Bar Plan — Chargefi (gstack review)

Status: PROPOSED — not approved. No code changes until Mayank says "locked".

## 1. CEO review (product job-to-be-done)
The nav is the user's primary orientation surface. Its job: let a first-time
visitor find any of the 9 functions in <2 seconds, and signal product maturity
("this is a real, trustworthy dapp") within the first glance.

Current: 9 links grouped Trade/Earn/Explore + dividers. Solves the "cluttered
flat list" complaint. Gap vs a 10/10 professional nav: no chain/network context
in the bar, no primary-action emphasis, and no discoverable search affordance
beyond an icon.

10/10 nav for a multichain DeFi dapp (Uniswap / Phantom / Jupiter reference):
logo + grouped primary nav + persistent chain pill + ⌘K search + connect, all
visible without scrolling, with a single unmistakable active state.

## 2. Eng review (architecture)
Single source of truth already exists: `lib/nav.ts` (`APP_NAV`, `NAV_GROUPS`).
Render layer `app-top-nav.tsx` is the only consumer (desktop + mobile sheet).
This is correct and boring — keep it.

Decisions to lock:
- Add a `primary?: boolean` and optional `icon` field to `NavItem` so one item
  (Swap) can be emphasized and so icons can be shown *only on the primary*
  action, not every link (avoids the original clutter).
- Chain switcher: render the existing `ChainSelect` as a compact pill in the
  right cluster (desktop only; mobile keeps it in the sheet). No new component.
- Keep SSR-safe, `prefers-reduced-motion` respected (NavPill already is).
- Complexity check: this touches 2 files (nav.ts, app-top-nav.tsx) — under the
  8-file smell threshold. No new deps, no new classes.

## 3. Design review (0–10, what a 10 looks like)
| Dimension        | Now | 10 looks like |
|------------------|-----|---------------|
| Information arch | 7   | Grouped + one emphasized primary action; chain context visible |
| Visual hierarchy | 7   | Clear active pill, primary action stands out, no equal-weight noise |
| Density          | 8   | Comfortable spacing, no cramming |
| Responsiveness   | 7   | Mobile sheet grouped by section (done); chain pill collapses cleanly |
| Motion           | 7   | NavPill slide (done); no competing animations |
| Accessibility    | 8   | aria-current, focus rings (done); add visible focus on icon buttons |

Target after plan: each 8–9, no regressions.

## 4. DX review (scaling the nav)
Adding a 10th feature should be a one-line `APP_NAV` edit that auto-sorts into
the right group — already true. Mobile sheet already sections by group. The
only DX gap: a new "primary" action needs an explicit decision (only Swap
should be primary; don't let it sprawl).

## 5. Proposed nav spec (target)
Desktop bar, left→right:
- Logo + "Chargefi"
- Groups with dividers: TRADE (Swap★, Bridge, Send, Receive) | EARN (Pool,
  Launch) | EXPLORE (Market, Portfolio, History)
  - ★ Swap rendered as the emphasized primary (slightly stronger bg / icon),
    others text-only — keeps it scannable, not noisy.
- Right cluster: ChainSelect pill · ⌘K search icon · ThemeToggle ·
  WalletButton / LaunchAppButton
Mobile (<lg): logo + chain pill + search + hamburger. Sheet groups by section
with headers, Swap pinned to top of TRADE as primary.

This is the proposal. The one open decision is the topology/primary emphasis
below.

## GSTACK REVIEW REPORT
Runs / Status / Findings:
| Lens | Score | Verdict |
|------|-------|---------|
| CEO  | 7/10  | Good grouping; add chain context + primary emphasis |
| Eng  | 8/10  | Architecture correct; 2-file change, low risk |
| Design | 7/10 | Raise to 8–9 via primary emphasis + chain pill |
| DX   | 8/10  | Scales via single source of truth |

VERDICT: APPROVE WITH ONE DECISION (see open question). No code until "locked".

UNRESOLVED DECISIONS:
- Nav topology / primary emphasis (asked via clarify; pending Mayank).
