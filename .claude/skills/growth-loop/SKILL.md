---
name: growth-loop
description: Run ONE iteration of the Growth loop (Loop 1, the orchestrator) — ingest the real scoreboard (GA4, Search Console, web vitals, competitor benchmark), diagnose by canon rules, ship the single top-scored fix per THE LOOP, stamp the measurement, learn, lock a gate. Also arbitrates cross-loop conflicts per the topology. Use when Matt says "/growth-loop", "run the loop", "run THE LOOP", "growth iteration", or when a /loop firing carries this protocol.
---

# Growth loop — one iteration of THE LOOP, run by the orchestrator

This is Loop 1 of the five-loop topology in `docs/DEVELOPMENT_PROCESS.md` §Loop topology (canon, v1.1.0+). One firing = one cycle of ingest → diagnose → prioritize → fix-the-class → verify → ship → measure → learn → lock. Never two cycles per firing. Quiet when blocked on a Matt review or an open measurement window with nothing else actionable.

## Scope (what this loop owns)

- Page content, titles/meta, on-page depth (thin → thick), internal linking
- AI visibility: `app/llms.txt/route.ts`, JSON-LD coverage via `lib/site/json-ld.ts` + `MetadataBlock`, sitemap/robots/canonicals
- Conversion surfaces: CTAs, forms-to-FUB money paths, UX friction on ranking pages
- Core Web Vitals on hot routes
- The competitor benchmark (rankings / CTR / conversion vs named local competitors)
- Cross-loop arbitration (this session is the orchestrator — see §Arbitration)

NOT owned: page *structure* under active Experience migration (frozen — check the rollout ledger), outbound comms (Nurture), ad spend (Demand), anything legally binding (Transaction).

## The iteration

### 0. Orient (always, cheap)
1. Read `docs/DEVELOPMENT_PROCESS.md` — the cycle, the topology, the preflight contract, the approval model. The canon outranks this skill; if they disagree, fix this skill.
2. Read `docs/EXPERIENCE_SYSTEM.md` §Rollout status — every page family currently mid-migration is **frozen to Growth** this iteration.
3. Query `site_improvement_ledger` (DAL-first; read-only) — open experiments, their windows, anything whose window closed and needs its `actual_delta` written (that is a Learn step and takes priority over starting new work).

### 1. Ingest the scoreboard
Pull fresh — never from memory: GA4 (sessions, conversions, bounce by surface), Search Console (impressions, clicks, CTR, position by query and page), `web_vitals` by route, Meta/ads CPL by LP (read-only — actions on spend belong to Demand), FUB leads by source, competitor positions on target queries. Sources: the `site_signal` view and the `agent_insights` / marketing snapshot tables populated by the substrate crons (`marketing-snapshot-ga4`, `marketing-snapshot-gsc`, etc.). Respect data-access discipline: schema snapshot + DAL index first, no ad-hoc fishing.

**`site_signal` scope contract (locked 2026-06-10):** per-page analysis MUST filter `scope='page'`. Scope-level rollups carry `surface='site:<scope>'` (e.g. `site:account` = GSC site-wide daily totals) and must never enter per-page aggregations. GSC query-level rows are `scope='campaign'` with `surface='query:<q>'`. GSC page/query coverage is top-25-per-day only — a page outside the daily top 25 has no rows, so absence is not zero.

### 2. Diagnose with the canon rules, not vibes
- Impressions high + CTR < 2% → rewrite title/meta
- Position 5–15 on real volume → on-page depth
- Traffic high + conversion low → UX/CTA fix
- Spend high + LP conversion low → funnel fix (coordinate with Demand, Growth executes the LP side)
- LCP > 2.5s on a hot route → performance fix
- Competitor outranks us on a target query → targeted content
- Page missing JSON-LD fields / not in llms.txt / thin (< the archetype's content floor) → AI-visibility fix

### 3. Prioritize
`score = reach × gap-to-benchmark × confidence ÷ effort`, confidence = the learned win-rate for that change-class from `site_improvement_ledger`. Skip candidates in frozen families. ONE class wins the iteration.

### 4. Fix the class, never the instance
Preflight contract applies (mockup + parity.json for surfaces, DAL for data, §0 trace for every stat). Resolve the root-cause cluster everywhere it occurs in one coordinated change.

### 5. Verify exhaustively
tsc, tests, `npm run ci:gates`, real `next build`, rendered-browser pass on every affected surface, mobile and desktop. Matt confirms classes are resolved; he does not find bugs.

### 6. Ship per the approval model
- Consumer-visible content/UX change → **draft-first**: screenshots + verification trace, wait for Matt's explicit go, then commit + push and watch the deploy to READY.
- SEO/meta/JSON-LD plumbing, gates, infra, docs → continuous ship once verified: commit + push immediately.
- Before any commit: `git status` — other loop sessions share this checkout. Stage ONLY this iteration's files. Never sweep another loop's in-flight work into a commit.

### 7. Measure
Stamp the baseline metric + window into the `site_improvement_ledger` row BEFORE shipping. A/B where supported, else before/after.

### 8. Learn + lock
When a window closes, write `actual_delta` and let the class confidence update. Every killed class adds or tightens a mechanical gate (`docs/MECHANICAL_GATES.md` pattern). A win that can silently regress is incomplete.

### 9. Report and end the turn
One tight block: what shipped (with evidence), what is now measuring (metric + window), the next top candidate, any cross-loop flag raised. If running under /loop dynamic mode, schedule the next wake-up: ~30 min while verifying a deploy or measurement-adjacent work; 1–3 h when the next action is just "re-ingest the scoreboard"; quiet/long when blocked on Matt.

## Arbitration (orchestrator duty, every iteration)

Check for cross-loop conflicts before picking work: a family Experience is migrating that Growth wants to edit (Growth yields), a Demand LP test that needs a Growth page change (Growth executes it as a scored candidate), a Nurture journey-stage change another loop depends on (sequence it explicitly in the report). Topology collision rules in the canon are the law; log any arbitration call in the iteration report.

## Backlog seed (2026-06-10 — re-score every iteration, do not treat as a queue)

- JSON-LD field-level coverage completion across listing/place/article surfaces
- Wave-4 SEO gates: wire `scripts/check-seo-routes.mjs` into `ci:gates` (canonical redirects + structured-data coverage)
- Thin-content depth pass on ranking geo pages (position 5–15 candidates first)
- llms.txt freshness + coverage audit
- Commit the v1.1.0 canon topology change once the working tree allows a clean stage (pending from 2026-06-10)

## Hard rules inherited (non-negotiable)

CLAUDE.md §0 data accuracy (verification trace per figure), §0.5 draft-first for consumer-visible deliverables, brand voice on every client-readable string, design-system components only, no ad-hoc SQL, single-checkout `main`, push immediately after an approved commit.
