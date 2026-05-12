---
name: marketing-brain-weekly-cycle
description: Run the full marketing brain pass once a week. Diagnoses every channel, runs all four audits (website, ads, crm, platform-trends), generates up to 10 content briefs from the combined signals, validates each brief against brand voice, persists everything to Supabase, and surfaces a structured report. Use Sunday evening to set the next week's plan, or any time for an ad-hoc full pass.
---

# marketing-brain: weekly-cycle

The top-level orchestrator. Every other marketing-brain skill is a primitive; this one composes them.

---

## When to use this skill

- **Sunday cron** — automatic weekly pass at 02:00 UTC (Sunday 18:00 PT prior day). Sets next week's plan.
- **Manual ad-hoc** — call the route any time you want a full read on the brain. Useful for the first analysis pass after a big change.
- **Dry-run mode** — `?dryRun=true` returns the would-be briefs without persisting them. Useful for verifying voice + mapping before publishing decisions.

---

## What it does

1. **Diagnose every channel.** Calls `generateInsightSummary` on each of 11 channels (ga4, meta_ads, meta_page, instagram, fub, gsc, youtube, linkedin, x, tiktok, gbp). Runs in parallel.
2. **Run the 3 deep audits.** website + ads + crm — in parallel. Each returns its `*AuditReport` with `opportunities[]`.
3. **Generate briefs.** Calls `generateWeeklyBriefs` which itself re-runs the audits + pulls competitor + platform-trends signals + maps everything to content_briefs.
4. **Persist the cycle.** Writes one row to `marketing_decisions` with decision_type='weekly_cycle' (or 'weekly_cycle_dryrun') containing the channel count, brief count, anomaly count, and error count.
5. **Return the report.** Full `WeeklyCycleReport` JSON.

---

## Report shape

```ts
interface WeeklyCycleReport {
  cycle_id: string
  as_of_date: string
  window_days: number
  generated_at: string
  channel_insights: Array<{ channel: Channel; summary: InsightSummary | { error: string } }>
  audits: {
    website: WebsiteAuditReport | { error: string }
    ads: AdsAuditReport | { error: string }
    crm: CRMAuditReport | { error: string }
  }
  briefs: GeneratedBrief[]
  briefs_persisted: number
  brief_voice_failures: number
  errors: string[]
}
```

Channels with no data return `{ error: 'insufficient_data' }` instead of stopping the cycle. The brain reports gaps but does not crash on them.

---

## Cron schedule

Configured in `vercel.json`:

```json
{ "path": "/api/cron/marketing-weekly-cycle", "schedule": "0 2 * * 1" }
```

That's Monday 02:00 UTC, which is Sunday 18:00 PT during PT daylight time and Sunday 19:00 PT during PT standard time. The weekly review timing matches Matt's existing Sunday-prep workflow.

---

## Manual invocation

```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/marketing-weekly-cycle?asOfDate=2026-05-12&dryRun=true&windowDays=7"
```

- `asOfDate=YYYY-MM-DD` — anchor date for the cycle. Defaults to yesterday.
- `dryRun=true` — generate briefs but do not persist them.
- `windowDays=1..90` — the lookback window. Defaults to 7.

---

## Idempotency

The cycle is safe to re-run. The underlying skills:
- Diagnose reads from `marketing_channel_daily` deterministically.
- Audits are read-only.
- Generate-briefs upserts briefs by content hash (NOT yet — currently inserts; this is a TODO once we see duplicate patterns in production).

For the first few weeks, re-running may insert duplicate briefs if signals are unchanged. Matt reviews and kills duplicates manually via the dashboard. After 30 days of observed patterns, add hash-based dedup to generate-briefs.

---

## What's in the report

For Matt's review, the report makes one thing easy: every brief has a `generation_reason` citing the audit threshold + signal evidence that triggered it. He can trace every recommendation back to the data without opening the dashboard.

The report also surfaces:
- **Voice failures.** If a brief failed `applyBrandVoice`, it persists with status=pending and the violation list. Worth reviewing as a brand drift signal.
- **Channel errors.** Any channel returning `insufficient_data` flags a gap — usually means an ingestor needs attention or a recent OAuth re-auth.
- **Anomaly count.** Cross-channel anomaly density is itself a signal. Spike weeks usually mean a big market event or platform algorithm shift.

---

## Related skills

- `marketing-brain:diagnose-performance` — called per channel.
- `marketing-brain:audit-website`, `audit-ads`, `audit-crm` — three deep audits.
- `marketing-brain:competitor-recon`, `platform-trends` — read by generate-briefs.
- `marketing-brain:generate-briefs` — the synthesis layer this orchestrates.
- `marketing-brain:snapshot-channels` — runs daily; this skill assumes that data is fresh.
