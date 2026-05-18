# Phase 2.5 execution log

**Task:** Write `marketing_brain_skills/research/asset-library-map.md`
**Deliverable path:** `/Users/matthewryan/RyanRealty/marketing_brain_skills/research/asset-library-map.md`

## Timing

- Started: 2026-05-16
- Finished: 2026-05-16

## Verification

- Word count: 6,164 (minimum 3,000 required — PASS)
- Em-dash grep (`grep -P "[–—]"`): 0 matches (PASS)
- En-dash grep: 0 matches (PASS)

## Files read

1. `video_production_skills/asset-library/SKILL.md` — full asset library producer contract
2. `data/asset-library/schema.json` — asset record JSON schema (4.3 KB)
3. `data/asset-library/manifest.json` — read first 60 lines for envelope schema; analyzed via python3 for asset counts
4. `lib/asset-library.mjs` — full ESM module (591 lines), all exports documented
5. `out/proof/2026-05-14/publish-status.json` — confirmed social-drops naming convention and bucket existence
6. `marketing_brain_skills/tools_registry/agentfire-wordpress/SKILL.md` — WordPress REST API media upload endpoint
7. `app/api/cron/gbp-media-refresh/route.ts` — GBP media cron route (first 60 lines)
8. `scripts/publish-2026-05-14-rollout.mjs` — first 80 lines confirming DROP_PREFIX and bucket name
9. `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md` — Phase 2.5 context and Phase 4.6 §7 requirements

## Shell commands run

- `ls /Users/matthewryan/RyanRealty/public/list-kits/` and subdirs
- `ls /Users/matthewryan/RyanRealty/listing_video_v4/public/` and subdirs including `v5_library/`, `audio/`, `brand/`
- `ls /Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/` and `brand/`, `hero/`, `team/`
- `ls /Users/matthewryan/RyanRealty/out/` and `out/proof/2026-05-14/` subdirs
- `ls /Users/matthewryan/RyanRealty/listing_video_v4/out/`
- `ls /Users/matthewryan/RyanRealty/app/api/cron/` confirming `gbp-media-refresh` exists
- `grep -r "asset.library" supabase/migrations/` (no tracked migration found)
- `python3` asset count analysis on manifest.json

## Blockers

**No tracked migration for `public.asset_library`:** The Supabase table and `asset-library` bucket exist and are in production use, but no SQL migration file was found in `supabase/migrations/`. The table was created outside the tracked migration sequence. This is documented in section 13 with a recommended migration SQL block.

**`wikimedia` and `stock` source values not in schema.json:** The manifest.json contains assets with `source` values of `wikimedia` and `stock` that are not enumerated in `schema.json`. The manifest has drifted from its schema definition. Documented in section 3.

**List-kits not registered in asset library:** `public/list-kits/beaumont/` assets exist on disk and in git but have no entries in `data/asset-library/manifest.json` or `public.asset_library`. The repurpose engine cannot discover them. Documented and a migration path provided in section 15.

**`content_performance` table not yet created:** Query 4 (IG Reel top saves) requires `content_performance.asset_library_refs` which does not exist until Phase 4.6 completes. The query is documented as a target state with a note that it is not yet operational.

## Token cost estimate

Approximately 50,000 input tokens (files read) and 8,000 output tokens (the bible). At Sonnet 4.6 pricing, estimated cost under $0.40.
