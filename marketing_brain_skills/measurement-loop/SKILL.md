---
name: marketing-brain-measurement-loop
description: Daily measurement of executed action rows. Pulls per-post metrics from each platform at 24h / 7d / 30d windows, writes to content_performance, gives the brain a feedback signal so it can learn which formats actually convert. Use this skill when the user asks "what worked", "did the brain's briefs actually drive leads", "show me content performance", "what's our best-performing format", or wants to wire the brain's learning loop.
---

# marketing-brain: measurement-loop

The brain's feedback layer. Without this, the brain proposes briefs and producers ship them — but nothing ever measures whether the work converted. The measurement loop closes that gap: every executed action row gets measured at 24h, 7d, and 30d intervals, the metrics land in `public.content_performance`, and downstream consumers weight future decisions by what actually worked.

**Status:** Scaffolded 2026-05-14. Active for Meta Graph (Instagram + Facebook) only. TikTok / YouTube / LinkedIn / X / GBP integrations are TODOs in `measurePlatformPost()`.

---

## When to use this skill

- Matt asks: "what's working?" / "show me content performance" / "did that brief land?"
- A downstream skill (`audit-findings-builder`, `generate-briefs`) wants to weight signals by historical ER
- Building the dashboard's performance view
- Investigating why a producer keeps under-delivering (its measurements are in the table)

For purely **proposing** content, use `marketing_brain_skills/run/` (the brain cycle) or `produce/` (direct).

---

## Required reading

| Reference | Why |
|---|---|
| `CLAUDE.md` §0 — Data Accuracy | Every metric we surface traces to a platform API source |
| `marketing_brain_skills/producers/REGISTRY.md` Section D + E | Producers that write `executor_response.published_posts` |
| `marketing_brain_skills/tools_registry/meta-graph/SKILL.md` | Auth + endpoint patterns for the live measurement path |
| `lib/marketing-brain/measurement-loop.ts` | The implementation |
| `supabase/migrations/*content_performance*` (schema lives in an earlier migration) | The output table |

---

## The producer contract

When a producer transitions an action row from `status='approved'` to `status='executed'`, it MUST populate `executor_response.published_posts` with one entry per platform destination:

```typescript
interface PublishedPost {
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'gbp' | 'blog'
  platform_post_id: string  // the platform's native id (IG media id, FB post id, etc.)
  url?: string              // optional shareable URL
  published_at: string      // ISO 8601 — when it actually went live
}

// Written to: marketing_brain_actions.executor_response
{
  published_posts: PublishedPost[]
  // ...other producer-specific fields
}
```

If a producer publishes to multiple platforms in one action (list-kit, listing_launch), it writes one entry per platform. The loop measures each independently.

**Without this contract, the loop has nothing to measure.** A producer that ships content without writing `published_posts` is a feedback-loop blind spot. Producer Authoring session is responsible for updating producer SKILL.md files to enforce this.

---

## Measurement windows

Three windows per post: 24h, 7d, 30d.

| Hours since publish | What we measure | Why this window |
|---|---|---|
| 24h | Day-1 reach + initial ER | Tests algorithmic distribution; bad if reach is below baseline |
| 7d | Week-1 totals + sustained engagement | Catches the slower-burn formats (long YouTube, blog) |
| 30d | Lifetime-to-date | Final read; what the brain treats as the post's true performance |

Window tolerance: ±24h. The loop measures within the tolerance window, then skips that (post, window) combo for the rest of its life.

Saturday / Sunday cron runs are OK — backlog accumulates and gets caught up Monday.

---

## What the loop does, step by step

1. Query `marketing_brain_actions` for status='executed' rows with `executor_response IS NOT NULL` from the last 90 days.
2. For each `published_posts[i]`:
   - Compute `hours_since_publish` from `published_at`
   - Pick the highest `MEASUREMENT_WINDOWS_HOURS` bucket the post is past (within tolerance)
   - Skip if a `content_performance` row already exists for (platform_post_id, window)
3. For each candidate, fetch metrics from the platform API (see `measurePlatformPost()` dispatch)
4. Insert one row in `content_performance` with: brief_id=action_id, platform, platform_post_id, published_at, hours_since_publish, all metric fields, metadata
5. Return a report with counts (scanned, candidates, attempted, succeeded, skipped, failed)

---

## Platform coverage today

| Platform | Status | Implementation |
|---|---|---|
| Instagram | ✅ Active | `measureMetaPost('instagram', …)` via Meta Graph `/{media_id}/insights` |
| Facebook | ✅ Active | `measureMetaPost('facebook', …)` via Meta Graph `/{post_id}/insights` |
| TikTok | 📝 Stub | Returns null; loop skips. Next: TikTok v2 `/v2/research/video/query/` |
| YouTube | 📝 Stub | Returns null. Next: YouTube Analytics API `/v2/reports?ids=channel==MINE` filtered by video |
| LinkedIn | 📝 Stub | Returns null. Blocked on the dev-app architecture decision per memory log |
| X / Twitter | 📝 Stub | Returns null. Tier-limited; may not be worth wiring until X drives leads |
| GBP | 📝 Stub | Returns null. GBP doesn't expose per-post analytics; closest is location-level call_clicks |
| Blog | 📝 Stub | Returns null. Needs GA4 page-path filter integration |

The stubs are deliberate. Wiring all 8 in one pass would balloon scope. Meta Graph alone covers the highest-volume channels (IG + FB); the others come online as Producer Authoring fills the publisher layer.

---

## Cron schedule

Daily 15:00 UTC (08:00 PT summer / 07:00 PT winter) per `vercel.json`. Runs AFTER the morning snapshot ingestors (06:30 UTC) so the platform metric cache is fresh.

```json
{ "path": "/api/cron/marketing-measurement-loop", "schedule": "0 15 * * *" }
```

`maxDuration = 300`. The loop is bounded by `maxCandidates=200`; in steady state it handles ≤200 measurements per run, each ~1-3 API calls + 1 insert.

---

## Manual invocation

```sh
# Dry run — show candidates, don't write
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-measurement-loop?dryRun=true"

# Bounded run
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-measurement-loop?maxCandidates=50"
```

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| No `executor_response.published_posts` on any executed row | `scanned > 0, candidates_found = 0` | Producers aren't writing the contract — Producer Authoring update |
| Meta token expired or revoked | `errors[]` populated with 401/403 | Refresh via Meta Graph Explorer; update `NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN` in Vercel |
| Post deleted on platform after publish | `errors[]` 404 — write null metrics row with `metadata.deleted: true` for the audit trail | Producer should handle re-publish, not the loop |
| Platform stub returns null | `measurements_skipped` increments | Expected behavior for unwired platforms |
| Same window measured twice | `isAlreadyMeasured()` short-circuits before fetch | Idempotent by design |

---

## How downstream skills read this

- `audit-findings-builder` joins `content_performance` to `content_classification` for the existing_producers_validated weighting.
- `generate-briefs` reads top-quartile ER per (topic × format) from `content_performance` (joined to action_type) and biases new opportunity mappings toward winners.
- The dashboard surfaces top-performing posts in a new card (TODO).
- The brain's daily digest could include "yesterday's published posts hit X% reach vs baseline" (TODO).

---

## Open work / next pass

1. Wire TikTok measurement (research API tier dependency)
2. Wire YouTube Analytics measurement (per-video query splits)
3. Wire LinkedIn measurement (after dev-app decision)
4. Wire blog measurement via GA4 page-path filter
5. Add `attributed_leads` join from FUB (match by source_medium or UTM)
6. Add the dashboard card surfacing top performers
7. Update producer SKILL.mds to enforce the `published_posts` contract
8. Add a +90d window for "lifetime confirmed" reads

---

## Related skills

- `marketing_brain_skills/run/` — the cycle that generates the briefs being measured
- `marketing_brain_skills/tools_registry/meta-graph/` — the live measurement API
- `marketing_brain_skills/audit-findings/PROTOCOL.md` — `existing_producers_validated` uses this data
- `marketing_brain_skills/producers/*/SKILL.md` — producers MUST write the published_posts contract
