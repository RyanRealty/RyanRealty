# Autonomous pipeline build — live status

**Last updated:** 2026-05-17, late stage
**Source of truth:** `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md`
**Loop mode:** /loop self-paced. Orchestrator: Opus. Subagents: Sonnet.

## Phase status (21 of 22 done; 1 in flight; 1 blocked on Matt)

| Phase | Status | Highlights |
|---|---|---|
| 0 Pre-flight | DONE | 17 files catalogued |
| 1 tool-inventory.md | DONE | 12,843 words, 147 URLs |
| 2 platform-bible.md | DONE | 11,815 words + 135 captions |
| 2.5 asset-library-map.md | DONE | 6,164 words |
| 2.6 bend-market-bible.md | DONE | 9,518 words, 133 citations |
| 3 Gate 1 verification | DONE | All 4 bibles PASS |
| 4 Registry refresh | DONE | 20 new producer rows |
| 4.5 env-manifest.md | DONE | 107 vars, 34 ACTION REQUIRED |
| 4.6 Data model deepening | DONE | 6 migrations drafted, asset schema upgraded |
| 5A Brain audit | DONE | 23 gaps (7 P0 fixed by 5B) |
| 5B Strategy doc | DONE | 36,580 words, 95 KPIs, 10 decision-logic examples, 7 P0 gaps fixed |
| 6 Batch A (5 video) | DONE | 1,824 lines |
| 6 Batch B (5 image) | DONE | 1,885 lines |
| 6 Batch C (5 text/paid) | DONE | 2,234 lines |
| 6 Batch D (6 ops/site/comms/analyze) | DONE | 2,842 lines |
| 6 Retrofit (55 producers) | DONE | 430 FM fields, 137 refs, 52 S12s, 2,275 dashes stripped; 0 remaining |
| 7 Asset reuse wiring | DONE | reuse-query-patterns.md, 7 patterns |
| 7.5 Validator script | DONE | scripts/validate-producer.mjs, 542 lines + fixtures |
| 8A Publishing audit | DONE | 17 bugs (3 P0; dash-guard PATCHED inline) |
| 8B Performance crons | DONE | 3 handlers, CRON_SECRET auth, vercel.json +3 |
| 9 Tool gap aggregation | DONE | tool-acquisition-recommendations.md, 4 tiers, 30+ recs |
| 10 Smoke test (newsletter) | DONE — PASS | 11 steps executed, live data, 0 unexpected asks |
| 10.5 Catalog UI | DONE | 8 files, 1,188 lines, Supabase auth reused |
| 10.6 Approval Queue UI | DONE | 8 files, 1,319 lines, Realtime subscribed |
| 11 CLAUDE.md update | DONE | Marketing Brain Pipeline section, ~90 lines |
| 11 User guide | DONE | docs/MARKETING_BRAIN_USER_GUIDE.md, 2,400 words |
| 11 Summary HTML | DONE | out/proof/2026-05-17/pipeline-build-summary.html |
| 11.5 Go-live wiring | BLOCKED ON MATT | Waiting on Q3 strategy ratification (UPDATE marketing_strategy SET status='active') |

## What's left for the orchestrator

- Update summary HTML retrofit cell (Phase 6 Retrofit is now DONE).
- Run `scripts/validate-producer.mjs` across all 55 retrofitted producers to confirm validator pass.
- Phase 11.5 cannot run until Matt ratifies strategy. Surface the SQL command in the summary HTML CTA block.

## What's left for Matt

The summary HTML at `out/proof/2026-05-17/pipeline-build-summary.html` contains the canonical ACTION REQUIRED block at the top. Highlights:

1. Resend domain verify + 4 env vars
2. Maps APIs (6 remaining one-click enables)
3. WordPress App Password
4. TikTok OAuth walk-through
5. Pinterest app create
6. Apply 6 Supabase migrations
7. Ratify Q3 strategy

Total Matt-action time: under 2 hours including OAuth walks.

## Cost ledger (rough estimate)

- Spent on completed work: ~$370
- Phase 6 Retrofit: ~$30 (complete)
- Total projected: ~$400-420 (under the $550 budget)

## Resumability

Phase 6 Retrofit is now complete. Log at `phase-6-retrofit-log.md`.

If the orchestrator session dies:
1. Read this file first.
2. Read `AUTONOMOUS_PIPELINE_BRIEF.md`.
3. All phases through Phase 10.6 are DONE.
4. Only remaining: update summary HTML retrofit cell + Phase 11.5 (blocked on Matt).
