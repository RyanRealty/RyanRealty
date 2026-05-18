# Brain Learning Loop - Implementation Log

**Completed:** 2026-05-17

---

## New file

`/Users/matthewryan/RyanRealty/lib/marketing-brain/performance-bias.ts` - 288 lines

Exports `WinningPattern`, `PerformanceBiasReport`, `Opportunity` interfaces,
`gatherPerformanceBias(supabase, opts?)` async function, and
`applyBiasToOpportunities(opportunities, report)` function.

---

## Diff summary

**generate-briefs.ts:** +100 lines added, -7 lines removed.

Changes:
- Added import of `gatherPerformanceBias`, `applyBiasToOpportunities`,
  `PerformanceBiasReport` from `./performance-bias`.
- Added `performanceBias: PerformanceBiasReport` to `SignalBundle` interface.
- Added `bias_multiplier?: number` to `RankedOpportunity` interface.
- Wired `gatherPerformanceBias(supabase)` into `gatherSignals` parallel
  Promise.all alongside all other audit promises.
- In `synthesizeOpportunities`: bias multiplier applied to `rank_score` before
  final sort when `total_posts_analyzed > 0`.
- In `mapOpportunityToBriefs`: bias annotation appended to
  `predicted_outcome.rationale` for any format with a non-neutral bias score.
- In `persistBriefs`: optional fourth param `performanceBias?`; included as
  `performance_bias_applied` in each `marketing_decisions` row's `data_observed`.
- In `generateWeeklyBriefs`: passes `signals.performanceBias` to `persistBriefs`.

**measurement-loop.ts:** +87 lines added, -1 line removed.

Changes:
- After successful upserts at the end of `runMeasurementLoop`: calls
  `persistLoopDigest(report)` (soft-fail, non-fatal).
- New `persistLoopDigest` function: queries last 90 days of
  `content_performance` for top-3 winners and bottom-3 losers by
  `north_star_attributed_seller_leads`, then INSERTs a
  `marketing_decisions` row with `decision_type='performance_loop_completed'`
  and full loop stats + winner/loser arrays in `data_observed`.

---

## Bias algorithm (5 sentences)

The bias module pulls all `content_performance` rows from the last 30 days
where `metrics_7d` is populated, joining to `marketing_brain_actions` to
resolve the `format` field for each post.

Rows are grouped by `(format, platform)`; each group with 3 or more samples
computes `avg_save_rate = saves / impressions`, `avg_share_rate = shares /
impressions`, and `avg_north_star_attribution` from
`north_star_attributed_seller_leads`.

`bias_score = 1.0 + (avg_north_star * 0.6) + (avg_save_rate * 0.25) +
(avg_share_rate * 0.15)`, where 1.0 is baseline, above 1.2 is a winner,
and below 0.8 is a loser.

A `format_bias_map` aggregates each format's average score across all platforms
and a `platform_bias_map` aggregates each platform's average score across all
formats.

In `synthesizeOpportunities`, each `RankedOpportunity`'s `rank_score` is
multiplied by the format-level bias so winning formats float up in the sorted
list before brief emission.

---

## Soft-fail strategy

If `content_performance` has zero rows in the window, the query errors, or any
exception occurs inside `gatherPerformanceBias`, the function catches the error,
logs it to `console.error`, and returns an empty report with
`total_posts_analyzed=0`; all downstream consumers check this count before
applying any multiplier, making the bias step a true no-op.

---

## How to verify in production

After running the performance ingestion crons and then triggering a new
generate-briefs cycle, confirm the bias was applied:

```bash
curl -s "https://dwvlophlbvvygjfxcrhm.supabase.co/rest/v1/marketing_decisions?decision_type=eq.brief_generated&order=created_at.desc&limit=1&select=data_observed" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq '.[0].data_observed.performance_bias_applied'
```

A non-null result with `total_posts_analyzed > 0` confirms the loop is wired.
A null result means no historical data existed yet (expected on first run).

---

## Token cost estimate

This was a focused 2-file edit plus 1 new file. Estimated context consumed:
generate-briefs.ts (47k tokens read), measurement-loop.ts (8k), phase-4.6 doc
(4k), plus edits. Total session: approximately 80-100k tokens (Sonnet 4.6).
