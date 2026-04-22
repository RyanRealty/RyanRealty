> **This brief is a historical work artifact.** It describes what was specified for this phase; it does not track live status. Authoritative status is in `docs/plans/task-registry.json`. Do not update this file to reflect later code changes — create a new brief or update the registry.

# Phase 1: Reporting Data Layer + Sync Hooks

**Status**: Complete
**Prerequisite for**: Phase 2 page restructuring
**Estimated scope**: 8 tasks, foundational data work

This brief executes Phase 1 from `docs/plans/master-plan.md` and establishes the reporting data layer as the canonical source for market intelligence.

---

## Task 1.1: Database Migration

**Files**:
- `supabase/migrations/*_market_stats_cache.sql`

**Changes**:
1. Create `market_stats_cache` table for period stats by geography and period.
2. Create `market_pulse_live` table for real-time per-geography snapshot.
3. Create `market_narratives` table for generated narrative content.
4. Add indexes for geography/period lookups and freshness reads.

**Verification**:
- `supabase db push` succeeds.
- Tables and indexes exist with expected columns.

---

## Task 1.2: Data Investigation

**Files**:
- `scripts/investigate-market-data.ts` (or equivalent admin utility)

**Changes**:
1. Scan closed listings `details` JSON for `ClosePrice`, `OriginalListPrice`, `SoldPrice`.
2. Test Spark Market Statistics API reachability and log status outcomes.
3. Output findings in a machine-readable summary for repeatability.

**Verification**:
- Utility runs successfully and prints field availability + API status.

---

## Task 1.3: Computation RPCs

**Files**:
- `supabase/migrations/*_market_rpcs.sql`

**Changes**:
1. Add `compute_and_cache_period_stats`.
2. Add `refresh_market_pulse`.
3. Add `refresh_current_period_stats`.
4. Ensure RPCs upsert into reporting cache tables.

**Verification**:
- Manual RPC execution populates `market_stats_cache` and `market_pulse_live`.

---

## Task 1.4: Market Health Score

**Files**:
- `supabase/migrations/*_market_rpcs.sql` (within `compute_and_cache_period_stats`)

**Changes**:
1. Compute 0-100 market health score from the weighted dimensions in master plan.
2. Persist score and normalized label buckets (Very Hot/Hot/Warm/Cool/Cold).

**Verification**:
- Bend sample calculation produces plausible score and matching label.

---

## Task 1.5: Narrative Generation Engine

**Files**:
- `supabase/migrations/*_narrative_engine.sql` (or equivalent SQL function file)
- optionally `lib/market-narrative.ts` for template helpers

**Changes**:
1. Implement `generate_market_narrative`.
2. Produce structured overview + analysis + buyer/seller outlook + FAQ JSON.
3. Persist narrative rows into `market_narratives`.

**Verification**:
- Generated narrative for a target city includes real values and coherent prose.

---

## Task 1.6: Backfill + Post-Sync Hooks

**Files**:
- migration file for `backfill_all_historical_stats` RPC
- `app/api/cron/sync-full/route.ts`

**Changes**:
1. Add historical backfill RPC for city/subdivision/region period coverage.
2. Freeze completed periods.
3. Trigger `refresh_market_pulse` + `refresh_current_period_stats` after full sync chunk completion.

**Verification**:
- Backfill produces long-range rows.
- Post-sync refresh updates `market_pulse_live.updated_at`.

---

## Task 1.7: Server Actions

**Files**:
- `app/actions/market-stats.ts`

**Changes**:
1. Add actions:
   - `getCachedStats`
   - `getStatsTimeSeries`
   - `getLiveMarketPulse`
   - `getMarketNarrative`
   - `getMarketOverview`
   - `getHottestCommunities`
2. Return stable typed response shapes for downstream UI.

**Verification**:
- Actions compile and return expected contracts.

---

## Task 1.8: Reporting Components

**Files**:
- `components/reports/StatCard.tsx`
- `components/reports/LivePulseBanner.tsx`
- `components/reports/FreshnessBadge.tsx`
- `components/reports/MiniSparkline.tsx`
- `components/reports/MarketHealthGauge.tsx`
- `components/reports/PriceBandChart.tsx`
- `components/reports/TrendLineChart.tsx`
- `components/reports/CommunityLeaderboard.tsx`

**Changes**:
1. Add reusable reporting primitives consuming Task 1.7 actions.
2. Keep token-based styling and shadcn compatibility.

**Verification**:
- Components render with representative/mock data.
- `npm run build` passes.

---

## Completion Checklist

- [x] Task 1.1 complete
- [x] Task 1.2 complete
- [x] Task 1.3 complete
- [x] Task 1.4 complete
- [x] Task 1.5 complete
- [x] Task 1.6 complete
- [x] Task 1.7 complete
- [x] Task 1.8 complete
- [x] `npm run build` passes with zero errors
- [x] SEO phase gate from master plan checklist passes for scope
