# Last Deep Audit — 2026-05-21

**Report:** `out/audits/deep-audit-2026-05-21.md`

**Counts:** 13 critical, 21 degraded, 13 polish = 47 findings total. Plus ultrareview shipped 5 critical + 18 high + 10 medium code-level fixes via commit `fc3115c`.

**Top critical (highest impact):** Marketing brain loop has never closed end-to-end — 2 executed rows ever, 0 measured, 0 have `published_posts`. The 5-stage Ingest→Decide→Produce→Publish→Measure loop is built but no producer fulfills the measurement-loop contract.

**Quickest wins remaining after ultrareview (~1 day combined):**
1. Fix the token-heartbeat refresh path (C2) — YT/X/GBP still expired — 2–4 hrs
2. Enable RLS on `cma_deliveries` TABLE (C6 partial — ultrareview closed API route only) — 30 min
3. Fix `detect-expired-listings` table mismatch (C10) — 1 hr
4. Add `processed_meta_leads` dedup table (ultrareview deferral UR-H17) — 30 min
5. Clear 12 stuck `in_production` rows (C5) — 2 hrs

**Ultrareview already SHIPPED in fc3115c (no further action):**
- Regex sanitizer → isomorphic-dompurify (XSS in CMA/blog/guides closed)
- Meta webhook HMAC bypass blocked in production
- 25 cron route auth fail-closed pattern via lib/require-secret.ts
- PostgREST .or() injection fixed in 8 files
- Promise.all error surfacing in 7 files
- CSP header + Secure cookie flag + .catch on void fireGa4Event() + sync-delta delete result check

**Companion docs:**
- `docs/HANDOFF_DEEP_AUDIT_2026-05-21.md` — full 10-pass JSON appendices
- `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md` — pipeline architecture analysis
- Commit `fc3115c` — ultrareview production hardening pass (44 files, 401/401 tests passing, type check clean)

**Next step:** Matt picks one of the 5 remaining quick wins, or kicks off the C1 structural project (close one producer loop end-to-end).

**Verification deltas since this morning's audit:** `brokers` (0→3), `communities` (0→1,848), `neighborhoods` (0→13), `boundaries` (0→3,251), `cities` (0→1). Several Pass 7 empty-table findings were partially remediated during the day. Post-fc3115c verification confirmed: cma_deliveries table RLS still DISABLED, YT/X/GBP still EXPIRED, 12 stuck rows unchanged, sync_logs still 0 rows, 2 executed total unchanged, expired_listings still 0 rows. Ultrareview is code-only; deep-audit ops-state findings are still the operational punch list.
