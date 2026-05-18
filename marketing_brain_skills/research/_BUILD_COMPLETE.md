# Autonomous Marketing Pipeline build — complete

**Status:** 21 of 22 phases done. Phase 11.5 blocked on Matt's manual action.
**Final summary surface:** `out/proof/2026-05-17/pipeline-build-summary.html`
**User guide:** `docs/MARKETING_BRAIN_USER_GUIDE.md`
**Build provenance:** `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md`

## What landed

- **4 research bibles** at 40,000 combined words (tool-inventory 12,843, platform-bible 11,815 + 135 captions, asset-library-map 6,164, bend-market-bible 9,518)
- **Strategy ecosystem** at 36,580 combined words (Q3-2026-strategy 13,505, KPI-dashboard 4,411 with 95 metrics, brain-decision-logic 3,988 with 10 worked examples, 5 upstream research notes)
- **20 NEW producer SKILL.md files** authored (8,785 lines, 0 em-dashes)
- **32 existing producer SKILL.md files** retrofitted (frontmatter upgrade, mandatory references, §12 tool gap section, full dash strip)
- **2,982 em/en-dashes stripped** across the entire skill tree via mechanical post-pass. Final count: 0.
- **6 Supabase migrations** drafted under `supabase/migrations/` (4 new tables, 2 ALTERs). Not auto-applied.
- **3 performance-ingestion cron handlers** (48h, 7d, 30d) with CRON_SECRET auth, idempotent upserts, skipped-platform handling.
- **2 admin UIs** at `/admin/producers` and `/admin/approval-queue` (18 files, 2,632 lines, shadcn/ui 100% compliant).
- **Producer validator script** at `scripts/validate-producer.mjs` with test fixtures.
- **CLAUDE.md** updated with the canonical `## Marketing Brain Pipeline` section.
- **User guide** at `docs/MARKETING_BRAIN_USER_GUIDE.md` (2,400 words).
- **P0 inline patch**: `assertNoDashes` now called in the publish route at the platform boundary.

## What is blocked

**Phase 11.5 — Go-live wiring + first brain cycle.**

Pre-flight requires Matt to ratify the Q3 strategy:
```sql
UPDATE marketing_strategy
SET status='active'
WHERE quarter='2026Q3';
```

Until that runs, the brain has no active strategy to execute against and Phase 11.5 cannot proceed.

## ACTION REQUIRED (canonical list, also at top of summary HTML)

1. Verify mail.ryan-realty.com domain in Resend + set RESEND_FROM
2. Set MARKETING_DIGEST_EMAIL
3. Set MARKETING_DASHBOARD_BASE_URL
4. Confirm CRON_SECRET 32+ chars random in .env.local AND Vercel project env
5. Generate WordPress App Password in AgentFire + set env vars
6. Walk through /api/tiktok/authorize/ once
7. Create Pinterest developer app + walk through OAuth
8. Click Enable on the 6 remaining Maps APIs (one-click URLs in summary HTML)
9. Apply 6 Supabase migrations from supabase/migrations/20260516200*.sql
10. Ratify Q3 strategy (SQL above)
11. (Optional) Validator-strict cleanup pass on the existing 32 producer SKILL.md files. The dash gate is clean. The remaining validator gates are exact-string normalization (mandatory-ref citations, frontmatter completion).

## Cost ledger

Estimated Anthropic spend: ~$430-500 against the $550 budget.

## Nothing committed

Per CLAUDE.md §0.5 Draft-First Commit-Last. Every artifact is on disk. Nothing has been git-committed, git-pushed, or published to any external platform. Matt's explicit "ship it" required before any of that fires.

## How to resume Phase 11.5

When Matt has ratified the strategy:

1. Run the strategy-active SQL in Supabase Studio for project dwvlophlbvvygjfxcrhm.
2. From a fresh Claude Code /loop session: "Resume the autonomous pipeline build at Phase 11.5. The strategy is now active. See _BUILD_COMPLETE.md."
3. The orchestrator dispatches a Phase 11.5 agent that:
   a. Adds the `weekly-cycle` and `snapshot-channels` cron entries to vercel.json (if not already present).
   b. Adds the `app/api/cron/weekly-cycle/route.ts` and `snapshot-channels/route.ts` handlers (or aliases to the existing marketing-weekly-cycle and the consolidated snapshot-channels handler).
   c. Manually invokes weekly-cycle once via curl with the CRON_SECRET bearer token.
   d. Confirms the approval queue at /admin/approval-queue is populated with at least 4 action_rows.
   e. Writes phase-11.5-go-live-log.md.

Phase 11.5 wall-clock estimate: ~1 hour including the curl + queue verify.
