# THE LOOP — the canonical development process

**Version: 1.0.0** · Locked 2026-06-09 · Supersedes every plan in `docs/plans/` (they are history, not process)

All development in this repo — site code, the marketing brain, cron agents, producers, every Claude Code session — routes through this one self-improving cycle. This document is the single source of truth for HOW work happens. The sync gate (`scripts/check-process-canon.mjs`, G44) fails the build if the entry points stop pointing here, if a pointer's version drifts from this header, or if a new plan doc lands unregistered.

## Why this beats "more gates"

Static gates freeze yesterday's mistakes. They are necessary (a fixed class must never regress) but not sufficient — they cannot tell you what to build next, and a ratchet that only grandfathers debt makes the backlog invisible. THE LOOP wraps the gates in a feedback system that ingests real outcome data, decides the highest-ROI improvement, ships it as a measured experiment, learns from the result, and only THEN locks the win behind a gate. Gates are the ratchet teeth; the loop is the engine turning the wheel.

## The cycle

```
ingest -> diagnose -> prioritize -> fix-the-class -> verify -> ship -> measure -> learn -> lock (gate) -> compete
   ^                                                                                              |
   +----------------------------------------------------------------------------------------------+
```

1. **Ingest.** Pull the scoreboard: GA4 (sessions, conversion, bounce by surface), Search Console (impressions, clicks, CTR, position by query and page), Meta/ads (spend, CPL by campaign and LP), FUB (leads created, source, outcome), Core Web Vitals (`web_vitals` by route), competitor signals. Normalized into `site_signal` (view) keyed by route + date.
2. **Diagnose** with rules, not vibes: impressions high + CTR < 2% → rewrite title/meta. Position 5–15 on real volume → on-page depth. Traffic high + conversion low → UX/CTA fix. Spend high + LP conversion low → funnel fix. LCP > 2.5s on a hot route → performance fix. Competitor outranks us on a target query → targeted content.
3. **Prioritize.** `score = reach x gap-to-benchmark x confidence / effort`, where confidence is the learned win-rate for that change-class from `site_improvement_ledger`. Top candidate wins the cycle.
4. **Fix the class, never the instance.** The unit of work is the root-cause cluster resolved everywhere it occurs, in one coordinated change. Honor the preflight contract (below).
5. **Verify exhaustively before Matt sees it.** Every affected instance, mobile and desktop, every number traced to source (§0). tsc, tests, `npm run ci:gates`, build, and a rendered-browser pass on the affected surfaces. Matt confirms a class is resolved; he does not find the bugs.
6. **Ship** per the live-environment rules (below). Draft-first for content and consumer-visible changes; explicit approval, then commit + push to `main` and watch the deploy go READY.
7. **Measure.** Stamp the baseline metric + window before shipping. A/B where the surface supports it, else before/after.
8. **Learn.** After the window closes, write `(change_class, surface, predicted_delta, actual_delta)` to `site_improvement_ledger`. The per-class win-rate it accumulates is the `confidence` input for the next cycle's prioritization. Mispredictions sharpen the value function.
9. **Lock.** Every fix that killed a class adds or tightens a mechanical gate so it cannot recur. A win that can silently regress is incomplete work. Catalog: `docs/MECHANICAL_GATES.md`.
10. **Compete.** A standing benchmark of rankings / CTR / conversion vs named competitors on target queries. The gap to the leader feeds the value function, so the loop preferentially attacks where we are losing.

## The preflight contract (no change starts blind)

| The change touches | Load first (mandatory) |
|---|---|
| Database / data / a stat | `docs/DATABASE_SCHEMA_SNAPSHOT.md` + `docs/DAL_INDEX.md` + the relevant DAL function. Deliverable carries a §0 verification trace per figure. |
| A page or surface | The surface's mockup (`design_system/ryan-realty/ui_kits/<surface>/`) + its `parity.json` + the canonical data source + the existing component. |
| Design / UI / layout | `design_system/ryan-realty/` specs + tokens. Headings via the display primitives. Components from `@/components/ui`. |
| An audit finding | The actual file at the cited line, read directly — never acted on from a subagent's recall. |
| Live runtime (DAL, crons, producers) | The affected path's current behavior; route-smoke green; risky changes verify on a preview deploy first. |

## Live-environment rules (the site is production, no fallback)

- Nothing reaches production unverified. `ci:gates` + tests + build green BEFORE push; the deploy is watched to READY; the post-deploy smokes (route-smoke + the money-page content gates in `smoke-test.yml`) are the regression tripwire.
- Schema changes are expand-contract, applied to hosted Supabase in the same delivery as the code that depends on them. Then `npm run ci:data-access -- --refresh`.
- Money paths first and hardest: lead-capture forms into FUB, ranking pages (redirect, never 404 a page holding a position), market-data accuracy (§0). A regression here is a P0.
- Every risky change names its rollback before it ships. Regressions are caught by the system (gates, smokes, Sentry, the deploy watcher), not by a user and not by Matt.

## When something escapes

A defect that reached Matt or production gets three things, always: (1) the whole class fixed, (2) the check added that would have caught it, (3) a row in `process_escape_ledger` (defect, why review missed it, the check added). "You're right, I should have looked at X" is banned — X becomes a mandatory preflight input instead. Escapes trending to zero is a tracked metric of the process itself.

## Approval model

- **Draft-first (CLAUDE.md §0.5)** governs content deliverables and consumer-visible changes: Matt sees the draft, says go, then it ships. Silence, passing gates, and finished builds are not approval.
- Infra, gates, skills, docs, and bugfix-to-intended-behavior ship continuously once verified, per Matt's standing "go" — with the full verification of step 5 every time.
- External/irreversible actions (publishing posts, sending messages, OAuth grants, ad spend) are always per-action approvals.

## The ledgers (live in Supabase)

- `site_improvement_ledger` — one row per shipped experiment: change_class, surface, metric, predicted_delta, actual_delta, window. Feeds prioritization confidence.
- `process_escape_ledger` — one row per escape: what slipped, why, the check added.
- `site_signal` (view) — the normalized scoreboard the diagnose step reads.

## Registered plan documents

Everything in `docs/plans/` is registered here. A new file in that directory without a row below fails G44 — plans do not accumulate as rogue process forks; they are inputs to THIS process.

| Doc | Status |
|---|---|
| `ultracode-site-consistency-kickoff.md` | executed — birthed this canon (archive) |
| `site-consistency-audit-2026-06-09.md` | executed 2026-06-09 (record) |
| `site-consistency-audit-2026-06-04.md`, `site-consistency-audit-2026-06-04-completeness.md` | superseded by 06-09 audit (record) |
| `SITE_AUDIT_2026-06-03.md` | superseded (record) |
| `master-plan.md`, `PRODUCT_SPEC_V2.md`, `INDEX_MASTER_DEAL_PIPELINE.md`, `USER_JOURNEYS.md`, `data-architecture-plan.md`, `continuous-improvement.md`, `phase-0-brief.md`, `phase-1-brief.md`, `phase-2-brief.md`, `phase-3-brief.md`, `phase-4-brief.md`, `phase-5-brief.md`, `phase-6-brief.md` | superseded by this canon (archive) |
| `money-path-contract-plan-2026-06-04.md` | open input — feed into the loop's backlog |
| `RENTAL_CALCULATOR_BUILD_PROMPT.md` | executed (record) |
| `SKYSLOPE_COMPLIANCE_HANDOFF_2026-05-28.md` | ops record (not site process) |
| `CROSS_AGENT_HANDOFF.md`, `SESSION_HANDOFF_2026-06-01.md`, `SESSION_HANDOFF_2026-06-01_PARTB.md`, `task-handoff-template.md` | session-continuity records |
| `GLOBAL_SKILLS_REGISTRY.md` | tool index (live reference) |
| `task-registry.json` | live registry (non-md, exempt) |

## Changelog

- **1.0.0 (2026-06-09)** — Initial canon, distilled from `ultracode-site-consistency-kickoff.md` after the 06-09 audit was executed end to end. Ledgers + sync gate land in the same delivery.
