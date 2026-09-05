# Last Deep Audit — 2026-09-04

**Report:** `out/audits/deep-audit-2026-09-04.md`  
**Probed:** 2026-09-05 04:13–04:29 UTC · `origin/main` `874e8ad9`  
**Counts:** 2 critical, 22 degraded, 24 polish. Down from 13/21/13 on 2026-05-21 because hourly SKILL producers retired 2026-08-18; Studio is the live path.

**Top critical:** (C1) publisher-sweep omits `executed_at` so measurement-loop / performance-pull never match; 0 `performance_loop_completed` digests ever; 0 real `content_performance` metrics. (C2) loop-sentinel scheduled `*/10` last launch 2026-08-18; skip paths silent; 17 open work nodes.

**Live snapshot:** brain 887 rows — ready 543 (523 CMA), executed 98 (87 daily-digest), measured 2 (empty metrics), approved 0, grok-studio 20 (13 ready / 7 killed). TikTok/Meta/YT/GBP heartbeat OK. X refresh 400 since 2026-08-29 (classifier still says auto-refresh). LinkedIn PARKED. `cma_deliveries` RLS holding (27 vs anon 0) — May C7 CLOSED. `expired_listings` 411. `npm test` 8389/0. `tsc` clean.

**Do not re-open:** May producer Gap 1 as a live outage (0/64 scripts still don’t close rows — expected). YT/GBP “expired” (1h TTL). May 20/21 rogue `card.json` trees (gone).

**Quickest wins:** stamp `executed_at` on sweep; log sentinel skips + confirm Vercel `LOOP_SENTINEL`; X classifier; kill fossil in_production; resolve seller-sequence `%address%`; Matt reviews 13 Studio drafts.

**Pass JSON:** `out/audits/deep-audit-2026-09-04-pass{1-10}.json` (gitignored). Companion: `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md`.
