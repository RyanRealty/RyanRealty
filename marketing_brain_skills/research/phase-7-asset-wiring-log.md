# Phase 7 — Asset library reuse wiring log

**Started:** 2026-05-17
**Finished:** 2026-05-17
**Wall clock:** ~15 min
**Agent:** orchestrator inline

## Deliverables landed

1. `marketing_brain_skills/research/reuse-query-patterns.md` (7 producer-ready query patterns + integration contract + surfaced gap on unregistered list-kit / v5_library assets).

## Schema confirmation

- `data/asset-library/manifest.json` schema (per `data/asset-library/schema.json`) has been upgraded by Phase 4.6 to include `tags`, `performance_score`, `surface`, `asset_type`, `fingerprint`, `last_used_at`, `originated_from_action_id`. Confirmed by reading Phase 4.6 rationale doc.
- `content_performance.asset_library_refs text[]` confirmed added by `20260516200100_content_performance_upgrade.sql` (Phase 4.6).
- `lib/asset-library.mjs` exports `search()`, `register()`, `markUsed()`, `stats()` (per Phase 2.5 audit). JSDoc `AssetRecord` typedef added by Phase 4.6 with all 25 fields.

## Producer integration contract (deferred check)

The validator (Phase 7.5) will enforce: every producer §6 must reference one of patterns 1, 2, or 3 by string match, plus pattern 5 (fingerprint dedup) and pattern 6 (mark-used). Existing 32 producers will fail this check until the retrofit pass lands. New 20 producers in Phase 6 batches A-D include this wiring per their authoring prompts.

## Surfaced gap: untracked production renders

Phase 2.5 identified that `public/list-kits/<address>/v3/` and `listing_video_v4/public/v5_library/` are not registered. The reuse-query-patterns.md gap section documents the three follow-up tasks (one-time backfill, generator updates, render-script updates). Surfaced for Matt's next-cycle attention. Not blocking the current build's smoke test.

## Verification

- `reuse-query-patterns.md` em-dash grep: 0 (clean).
- 7 query patterns documented with both TypeScript producer code and SQL equivalents.
- Cross-reference table to related references included.
- Producer integration contract section explicit (validator will enforce).

## Phase 7 status

PASSED. Advancing.
