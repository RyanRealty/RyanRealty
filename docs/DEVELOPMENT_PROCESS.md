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

Everything in `docs/plans/` is registered here. A new file in that directory without a row below fails G44 — plans do not accumulate as rogue process forks; they are inputs to THIS process. The rogue check recurses into subdirectories: a `.md` inside a registered PACKAGE directory (a `Doc` cell ending in `/`) is covered by that package's row; a `.md` in any other subdirectory, or a new top-level file, needs its own row. G44 also fails when a registered `Doc` no longer exists on disk (stale registration).

W13.1 Batch 2 (2026-07-27): deleted superseded audits, phase briefs, dated session handoffs, and executed CRM/westside/streamline records. Kept PROGRAM + ADMIN_REBUILD packages, CROSS_AGENT_HANDOFF, task-registry, GLOBAL_SKILLS_REGISTRY, continuous-improvement, master-plan, data-architecture-plan, and plans still marked live/open.

| Doc | Status |
|---|---|
| `ENTERPRISE_MAP/` | **live** — whole-system enterprise map (inventories, plan dispositions, CAP/INT/FAC matrices, evidence log, advancement plan, session handoff). Covers product + integrations + dev factory + plan ghosts. Bootstrap: `docs/plans/ENTERPRISE_MAP/SESSION_HANDOFF.md`. Every file within is covered by this row. |
| `PROGRAM_2026-07-21/` | **live** — the RR-PLATFORM-DECISIONS completion program package (master spec, recorded decisions, audits, completion ledger, preserved skills). One of the two sanctioned plan homes; every file within it is covered by this row. |
| `ADMIN_REBUILD/` | **live** — the admin/CRM rebuild package (specs, audit reports). The second sanctioned plan home; every file within it is covered by this row. |
| `ADMIN_PRODUCT/` | **live** — Admin Product OS memory root (state, registry, process specs). Every file within is covered by this row. |
| `seo-voice/` | **live** — top-site public program: **GOAL_10X_EXECUTABLE** (master), feature verify/improve grind + VERIFY_LOG, goal system, IA matrix, data foundation, dual-source measurement, bottlenecks, endtoend foundation log. Every file within is covered by this row. |
| `master-plan.md`, `data-architecture-plan.md`, `continuous-improvement.md` | superseded by this canon for process authority; still on disk as orchestrate/ownership reference inputs (W13.1 keep) |
| `money-path-contract-plan-2026-06-04.md` | open input — feed into the loop's backlog |
| `DSCR_DEAL_FINDER_2026-08-03.md` | **live** — DSCR acquisition screen at `/admin/dscr`: composite Deal Score, admin-nav discoverability, and a draft-first emailable deal list. Rent is sourced per-property (Zillow rentZestimate) into `public.dscr_rent_estimates` because the MLS carries a rent figure on ~4% of listings. Sending stays per-action approval under §1. |
| `WESTSIDE_BACKLOG.md` | **live** — west-side dominance ranked backlog (market map, funnel truth, gap ranking); execution tracked per item, re-ranked as items ship |
| `F7-sync-contention.md`, `F7-proposed-migration-listing-tile-mv.sql` | **open** — buyer-journey audit finding F7: `listing_tile_mv_src` selects `now() AS refreshed_at`, which makes every row differ on every refresh, so `REFRESH MATERIALIZED VIEW CONCURRENTLY` degenerates into a full 593,890-row rewrite (measured: 1,161 implied full rewrites vs 1.3 for the control MV). That job averages 492s on a 900s cadence and is why a 106ms query renders as a 51s page. The proposed DDL sits beside the doc rather than in `supabase/migrations/` on purpose: unapplied it fails `ci:migration-drift` and blocks every unrelated push, and applying it rebuilds the view behind every search page with a roughly eight-minute blackout. Awaiting Matt plus a maintenance window. |
| `VOICE-CANON-2026-08-05.md` | **live** — the end-to-end voice migration prompt (Matt 2026-08-05). Buffett-anchored canon at `marketing_brain_skills/brand-voice/VOICE.md` becomes the single voice document; every competing doc, banned-word list, and in-code style prompt is deleted and rebuilt from it, all public-facing copy is rewritten, and two gates (banned constructions, canon singularity) stop it recurring. |
| `cma-accuracy-pipeline-2026-07-11.md` | record — CMA/BPO accuracy pipeline progress log |
| `COMING_SOON_SQL_FOLLOWUP.md` | open input — SQL-layer residue from the 2026-07-21 Coming Soon public-exposure fix |
| `../EXPERIENCE_SYSTEM.md` | **live canon** — six page archetypes, route map, shared module kit, engagement telemetry spec |
| `KB_SITE_CONVERSION_GOAL.md` | **live** — whole-site KB conversion goal |
| `PAGE_REVIEW_REDESIGN_RUNBOOK.md` | **live** — page-review + redesign runbook |
| `PAID_ADS_PLAN.md`, `ADS_CREATIVE_DIRECTION.md`, `ADS_BRIEFS.md`, `ADS_BUYER_SCRIPT.md`, `ADS_FOOTAGE_PLAN.md`, `ADS_PRO_EXAMPLES.md`, `ADS_GO_LIVE.md` | **live** — paid-ads program |
| `TC_ARCHITECTURE_REVIEW.md` | **live** — Vault TC architecture backlog |
| `AGENTIC_GRAPH_ENGINEERING_2026-07-30.md` | **live** — agentic-graph-engineering research + incorporation backlog: saved workflow library (`.claude/workflows/`), graph escape hatch in the loop skills, consumer-driven KG evaluation |
| `TC_BUILDOUT_HANDOFF.md` | **paused 2026-06-24** — TC build-out resume point |
| `twilio-cutover-2026-06-24.md` | **live** — Twilio cutover backlog |
| `crm-attribution-coverage-2026-06-24.md` | **live** — attribution coverage map |
| `crm-completion-spec-2026-06-25.md` | **live** — CRM completion plan |
| `crm-golive-execution-2026-06-25.md` | **live** — CRM go-live execution log |
| `PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md` | **live** — Brain Dump 2: prospecting → CMA → measurement workflow, and the public-site IA/density pass |
| `SEARCH_OPTIMIZATION_PLAN_2026-07-29.md` | **live** — Flexmls search/map/subscription teardown + phased plan to parity-plus site search (filters, map geography, alerts engine, portal) |
| `SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30.md` | **live** — second pass over the shipped search surface: generate the filter set from Spark field metadata (1,562 searchable fields, of which 239 are visible to residential class A and are the honest target), expose sub types and zoning-with-definitions, and gate completeness mechanically |
| `SEARCH_UX_WAVE3_PLAN.md` | **live** — mockup gap + UX + performance plan for `/homes-for-sale` (Wave 0 cold-load perf; Waves 1–4 chrome, craft, pan, map depth) |
| `CMA_PIPELINE_TO_PRODUCTION_2026-07-30.md` | **live** — end-to-end goal for taking the CMA/BPO pipeline to production grade (registered here by a sibling session's request; owner is that session) |
| `WESTSIDE_BACKLOG.md` | **live** — west-side dominance ranked backlog, generated 2026-07-28 from live competitor/market data |
| `MOBILE_GRIND/` | **live** — mobile-audit defect-CLASS remediation package (state machine, per-class census tables, ledger). Matt's 2026-08-06 iPhone pass produced ~19 reported defects; each is treated as a sample of a class, so every step is census-first (enumerate every instance repo-wide) → fix all → gate the class. Every file within is covered by this row. |
| `CROSS_AGENT_HANDOFF.md` | session-continuity (required agent handoff protocol) |
| `CRM_BUILD_MISSION.md` | **live** — CRM delivery mission |
| `DELTA_SYNC_UNIFICATION_HANDOFF.md` | **open input** — delta-sync unification cutover handoff |
| `CRM_AUDIT_2026-07-02.md` | **live** — desktop CRM audit ledger |
| `CRM_AUDIT_MOBILE_2026-07-02.md` | **live** — mobile CRM audit ledger |
| `EMAIL_SEND_AUDIT_2026-07-02.md` | open input — email-send audit |
| `CONTACT_HEADER_REDESIGN_2026-06-30.md` | open input — contact header redesign |
| `GLOBAL_SKILLS_REGISTRY.md` | tool index (live reference) |
| `SAVED_SEARCH_MASTER_GOAL.md` | **live** — saved-search + market-report subscriptions |
| `BROKER_SMS_AGENT_2026-07-31.md` | **live** — broker SMS agent: conversational agent on the marketing line for CMA/content/database/law Q&A with broker self-approval; includes the Phase 0 pipeline repairs (humanApprovedAt wiring, needs_changes constraint) |
| `LIFECYCLE_WORKFLOWS_MASTER_GOAL.md` | **live** — lifecycle workflows master goal |
| `ADMIN_CONSOLIDATION_MASTER_GOAL.md` | **live** — admin consolidation master goal |
| `ADMIN_CONSOLIDATION_AUDIT.md` | **live** — admin consolidation Phase 0 findings |
| `task-registry.json` | live registry (non-md, exempt) |

## Changelog

- **1.1.0 (2026-06-10)** — Loop topology locked: five domain loops (Growth, Demand, Nurture, Transaction, Experience) over one shared spine + cron substrate; one session per loop; contact-journey stage as the cross-loop funnel object; collision and session-discipline rules.
- **1.0.0 (2026-06-09)** — Initial canon, distilled from `ultracode-site-consistency-kickoff.md` after the 06-09 audit was executed end to end. Ledgers + sync gate land in the same delivery.
