# THE LOOP — the canonical development process

**Version: 1.1.0** · Locked 2026-06-09 · Topology locked 2026-06-10 · Supersedes every plan in `docs/plans/` (they are history, not process)

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

## Loop topology (locked 2026-06-10)

THE LOOP is the meta-process. It runs as **five domain loops over one shared spine**, plus a deterministic cron substrate. One Claude Code session per loop — never two sessions in the same domain at once.

| # | Loop | Session / trigger | Cadence | Owns | State ledger |
|---|---|---|---|---|---|
| 1 | **Growth** (SEO, AI visibility, content depth, conversion) | Orchestrator session — runs THE LOOP cycle directly | Continuous | Page content/meta/JSON-LD/llms.txt, thin-vs-thick fixes, CWV, competitor benchmark | `site_improvement_ledger`, `site_signal` |
| 2 | **Demand** (paid + organic acquisition) | `/facebook-seller-growth` | Weekly + producer crons | Meta ads, audiences, LP conversion, organic social, experiments | `LEARNINGS.md`, `.auto-memory/fb-ads-loop-state.json` |
| 3 | **Nurture** (CRM, comms, follow-up intelligence) | `/loop /crm-e2e` | Self-paced guardian | FUB mirror, Gmail/Twilio ingest, sequences, auto-enroll, suppressions, smart follow-ups | `tmp/crm-e2e-latest.json`, `docs/CRM_REPLACEMENT_BLUEPRINT.md` |
| 4 | **Transaction** (TC + Oregon law) | `/loop /tc-builder` | Self-paced ladder | Deals, documents, signing, compliance engine, the Oregon law/forms knowledge base | `docs/TC_SYSTEM.md`, `docs/TC_OREGON_COMPLIANCE.md` |
| 5 | **Experience** (UX archetype migration) | `/loop /experience-rollout` | One family per iteration | Page-family visual/UX rebuilds to the v3 archetype language | `docs/EXPERIENCE_SYSTEM.md` §Rollout status |
| — | **Substrate** (deterministic machinery) | Vercel crons (`vercel.json`) | 10 min – weekly | Spark→Supabase sync, market stats cache, CRM crons, producer dispatch/runtime/publish, measurement, digests | Supabase tables |
| — | **Immune system** | `/deep-audit` | On demand / monthly | Cross-cutting health: stuck rows, dead crons, expired tokens, drifted skills | `out/audits/` |

**The shared spine** every loop reads and writes: Supabase (one database, DAL-only access), the ledgers above, and the **contact journey** — one stage per person (`visitor → lead → nurtured → active client → under contract → closed → past client → repeat`) so Growth hands to Demand hands to Nurture hands to Transaction without a seam. The journey stage lives on `crm_people`; any loop may advance it, no loop may fork its own funnel model.

**Collision rules.** Experience owns page *structure*; Growth owns page *content and meta* — a file family under active Experience migration is frozen to Growth until the family ships. Nurture owns outbound comms; Demand never sends directly. Transaction owns anything legally binding. The orchestrator session arbitrates conflicts and owns prioritization across loops (step 3 of the cycle, applied fleet-wide).

**Session discipline.** Ad-hoc sessions are for one-off tasks only and close when done. Anything recurring belongs to one of the five loops or becomes a cron. A sixth standing session is a smell — fold it in or gate it.

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
| `../EXPERIENCE_SYSTEM.md` | **live canon** — six page archetypes, route map, shared module kit, engagement telemetry spec, never-regress mechanics. Orchestrator for the Wave 3 UX rebuild. |
| `KB_SITE_CONVERSION_GOAL.md` | **live** — whole-site KB (kinetic-brutalist) conversion goal, wave plan, and progress log (Phase 9+). |
| `PAGE_REVIEW_REDESIGN_RUNBOOK.md` | **live** — render-don't-read page-review + redesign runbook (six-phase per-page loop, brutalist QA rubric, market-chart honesty spec, per-page competitor bars). Active page-class backlog. |
| `PAID_ADS_PLAN.md`, `ADS_CREATIVE_DIRECTION.md`, `ADS_BRIEFS.md`, `ADS_BUYER_SCRIPT.md`, `ADS_FOOTAGE_PLAN.md`, `ADS_PRO_EXAMPLES.md`, `ADS_GO_LIVE.md` | **live** — paid-ads program (one premium buyer ad): Meta plan, creative North Star, copy-ready briefs, buyer script v3 ("A Tuesday", broker-free), footage sourcing + the two costed gap clips, pro swipe file, and the go-live runbook. |
| `TC_ARCHITECTURE_REVIEW.md` | **live** — senior-engineer deep dive on the Vault transaction-coordination (`tc_*`) system: architecture overview, ranked problem areas (C1-C4 critical), phased refactor strategy, target architecture + code. The build-out backlog. |
| `TC_BUILDOUT_HANDOFF.md` | **paused 2026-06-24** — resume point for the TC build-out: what's done (C4 + §5.1 FSM + H4 tests + H5 schema), the 3 Matt-gated migrations, the next code-only increments, and Phase 1+. Read to pick up cold. |
| `twilio-cutover-2026-06-24.md` | **live** — Twilio cutover from Follow Up Boss: live-verified audit (8 subsystems), the broker→Twilio→cell model, per-wave build plan + progress log. The active cutover backlog. |
| `crm-attribution-coverage-2026-06-24.md` | **live** — per-channel broker-attribution + open/deliver/bounce tracking coverage map (newsletter, market report, saved-search alert, CMA) for the CRM record-card cutover; names each send-path chokepoint to route through `attributeOutbound`/`attributeUrl`. |
| `crm-completion-spec-2026-06-25.md` | **live** — the canonical CRM completion plan (locked scope, bulletproof bar, 9-wave build sequence) reconciled against `docs/fub-feature-audit/FUB_FEATURE_AUDIT.md`. The HOW to the audit's WHAT. Active build backlog. |
| `crm-golive-execution-2026-06-25.md` | **live** — execution log for the CRM go-live wave (Wave 6 automation engine, FUB §8.5 parity, trigger/condition/analytics build). Tracks per-deliverable status against `crm-completion-spec`. |
| `RENTAL_CALCULATOR_BUILD_PROMPT.md` | executed (record) |
| `SKYSLOPE_COMPLIANCE_HANDOFF_2026-05-28.md` | ops record (not site process) |
| `CROSS_AGENT_HANDOFF.md`, `SESSION_HANDOFF_2026-06-01.md`, `SESSION_HANDOFF_2026-06-01_PARTB.md`, `task-handoff-template.md` | session-continuity records |
| `ADMIN_CURATION_TO_BAR.md`, `HANDOFF-cma-form-twilio-2026-06-13.md`, `HANDOFF_CRM_SESSION_2026-06-12.md`, `HANDOFF_HEATH_LP_2026-06-13.md`, `NEXT_SESSION_START_HERE_2026-06-13.md` | parallel-session records (archive) |
| `GLOBAL_SKILLS_REGISTRY.md` | tool index (live reference) |
| `task-registry.json` | live registry (non-md, exempt) |

## Changelog

- **1.1.0 (2026-06-10)** — Loop topology locked: five domain loops (Growth, Demand, Nurture, Transaction, Experience) over one shared spine + cron substrate; one session per loop; contact-journey stage as the cross-loop funnel object; collision and session-discipline rules.
- **1.0.0 (2026-06-09)** — Initial canon, distilled from `ultracode-site-consistency-kickoff.md` after the 06-09 audit was executed end to end. Ledgers + sync gate land in the same delivery.
