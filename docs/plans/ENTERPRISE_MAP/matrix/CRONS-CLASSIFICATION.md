# Cron classification (regenerated 2026-08-08T21:07Z)

| Class | Count | Notes |
|-------|------:|-------|
| On disk `app/api/cron/*` | 80 | inventories/C-crons-on-disk.txt |
| Scheduled in vercel.json | 61 | inventories/C-crons-vercel-full.json |
| Dark (disk not first-segment scheduled) | 19 | inventories/C-crons-dark.txt + O-dark-cron-refcount.txt |

## Dark list disposition

- `detect-expired-listings` — INTENTIONAL_MANUAL — sync-delta is production path
- `marketing-snapshot-ga4` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-gbp` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-google-ads` — FANOUT_CHILD via snapshot-channels (google-ads in PLATFORMS) — OK
- `marketing-snapshot-gsc` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-linkedin` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-meta-ads` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-meta-page` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-tiktok` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-x` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `marketing-snapshot-youtube` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `neighborhood-default-subscriptions` — INTENTIONAL_MANUAL (Matt confirm)
- `refresh-listing-year-stats` — MANUAL_OPS
- `refresh-video-tours-cache` — MANUAL_OR_TRIGGER after video write
- `start-sync` — OPS_MANUAL multi-lane
- `strategy-revision-check` — AUDIT_ONLY
- `sync-parity` — OPS_MANUAL
- `sync-verify-full-history` — NEEDS_CLASS — see O-dark-cron-refcount; default PROBE not delete
- `weekly-cycle` — ALIAS of marketing-weekly-cycle — OK
