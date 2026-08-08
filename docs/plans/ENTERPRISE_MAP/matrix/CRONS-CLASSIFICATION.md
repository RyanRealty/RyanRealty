# Dark cron classification (closed enough for v0)

On-disk cron dirs whose name is not the first segment of any vercel.json cron path.

| Cron dir | Class | Evidence | Action for Stream S1 |
|----------|-------|----------|----------------------|
| marketing-snapshot-ga4 | FANOUT_CHILD | snapshot-channels PLATFORMS | none |
| marketing-snapshot-gsc | FANOUT_CHILD | same | none |
| marketing-snapshot-meta-ads | FANOUT_CHILD | same | none |
| marketing-snapshot-meta-page | FANOUT_CHILD | same | none |
| marketing-snapshot-x | FANOUT_CHILD | same | none |
| marketing-snapshot-linkedin | FANOUT_CHILD | same | none |
| marketing-snapshot-tiktok | FANOUT_CHILD | same | none |
| marketing-snapshot-gbp | FANOUT_CHILD | same | none |
| marketing-snapshot-youtube | FANOUT_CHILD | same | none |
| marketing-snapshot-google-ads | **FANOUT_CHILD** (fixed 2026-08-08) | Added to PLATFORMS in snapshot-channels | Confirm GOOGLE_ADS_* env in prod for non-no-op |
| detect-expired-listings | INTENTIONAL_MANUAL | expired-listing-processor: sync-delta canonical | none (keep manual) |
| start-sync | MANUAL_OPS | AGENTS.md | none |
| sync-parity | MANUAL_OPS | docs | none |
| sync-verify-full-history | MANUAL_OR_LANE | ops/scripts | document drain path |
| weekly-cycle | ALIAS_OK | aliases marketing-weekly-cycle (scheduled) | none |
| daily-broker-digest | **SCHEDULED 2026-08-08** | Different product from broker-agent-digest; added vercel `0 15 * * *` | monitor first prod sends |
| weekly-pipeline-digest | **SCHEDULED 2026-08-08** | Added vercel `0 15 * * 1` | monitor first Monday send |
| refresh-listing-year-stats | MANUAL_OPS | sync-status-report curl | none or schedule if freshness required |
| refresh-video-tours-cache | MANUAL_OR_ACTION | shared with app action | none or hook after video write |
| strategy-revision-check | AUDIT_ONLY | audit-brain.mjs list | register if product needs or leave audit |
| neighborhood-default-subscriptions | LIKELY_VESTIGIAL | feature in saved-search-alerts + data lib | confirm cron body; delete if empty |

## Counts

| Class | n |
|-------|---|
| FANOUT_CHILD | 9 |
| ORPHAN / fix | 1 |
| INTENTIONAL / MANUAL / ALIAS / OPS | 6 |
| DARK_SCHEDULE / SUPERSEDED? / VESTIGIAL / AUDIT | 5 |
