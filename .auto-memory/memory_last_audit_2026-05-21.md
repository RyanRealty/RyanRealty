# Last Deep Audit — 2026-05-21

**Report:** `out/audits/deep-audit-2026-05-21.md`

**Counts:** 14 critical, 21 degraded, 13 polish = 48 findings total.

**Top critical (highest impact):** Marketing brain loop has never closed end-to-end — 2 executed rows ever, 0 measured, 0 have `published_posts`. The 5-stage Ingest→Decide→Produce→Publish→Measure loop is built but no producer fulfills the measurement-loop contract.

**Quickest wins (all in 1 day combined):**
1. Refresh 3 expired OAuth tokens (YouTube, X, GBP) — 30 min
2. Enable RLS on `cma_deliveries` — 30 min (PII exposure)
3. Fix `detect-expired-listings` table name mismatch — 1 hour
4. Fix `sync_logs` silent failure — 1–2 hours
5. Clear 12 stuck `in_production` rows from 2026-05-18 batch — 2 hours

**Companion docs:**
- `docs/HANDOFF_DEEP_AUDIT_2026-05-21.md` — full 10-pass JSON appendices
- `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md` — pipeline architecture analysis

**Next step:** Matt picks a finding to fix, or runs `/ultrareview` for the code-level bug class this audit doesn't cover (race conditions, N+1, missing awaits, SQL injection — pipeline state was this audit's scope).

**Verification deltas since this morning's audit:** `brokers` (0→3), `communities` (0→1,848), `neighborhoods` (0→13), `boundaries` (0→3,251), `cities` (0→1). Several Pass 7 empty-table findings were partially remediated during the day.
