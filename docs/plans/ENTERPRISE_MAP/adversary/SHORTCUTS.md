# Adversary pass — shortcut / omission log

**Status:** OPEN for map v1 — dual-model pass 2026-08-08 **FAIL** (see `DUAL-PASS.md`).  
**Pass agent:** dual-model adversary (Grok Build, assume primary lied).  
**Method:** re-read package docs; re-check ≥10 high-risk claims on disk/code (and prior live inventories). No secrets printed.

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| S-001 | CAP matrix not fully cell-verified (only 6/35 VERIFIED; 27 PARTIAL) | HIGH | **OPEN** — CAPABILITIES close pass honest about counts; still blocks map v1 |
| S-002 | INT health incomplete: many `last_success` / error_rate **unknown**; tokens OK for social cluster | HIGH | **PARTIAL** — token_expiry filled for socials; Spark delta last_success, Meta/Twilio ops still thin |
| S-003 | REGISTRY enum incomplete / meta glitch | MED | **PARTIAL** — `N-registry-rows.tsv` present (~85 body rows); `Z-inventory-meta.json` still **`N_reg: 0`** (stale generator) |
| S-004 | Full vercel cron list | MED | **CLOSED** — `vercel.json` **61** paths; matches Z `C_vercel` + FAC-006 |
| S-005 | Plan bodies deep-read vs “seed only” docs | MED | **PARTIAL** — `01-PLAN-DISPOSITIONS.md` claims deep-read + 50 rows covering F-plans-*; `ALL-OPEN-ITEMS` §4 / `REMAINING` R-MAP-5 still say seed — **doc lag** |
| S-006 | PROGRAM Tier-1 re-verify incomplete | HIGH | **PARTIAL** — Bytespider DONE on disk; D7 file DONE / hosted apply open; buyer LP alerts code present; sold-homes nav present in `lib/site-nav.ts`; not full Tier-1 live re-run this pass |
| S-007 | Admin 170 vs token gate vs import census | MED | **CLOSED** (import census) — 27 without-v2 re-spot-checked as redirect (`deals/page.tsx` → `/admin/closings`); island token-gate separate (CAP-025 PARTIAL) |
| S-008 | google-ads fan-out | MED | **CLOSED** — `PLATFORMS` includes `'google-ads'` in `snapshot-channels/route.ts` |
| S-009 | CRM stage distribution | MED | **CLOSED** — `P-crm-stage-dist.json` (Nurture-heavy); aligns CAP-009 VERIFIED claim |
| S-010 | Factory CI cost / build minutes | LOW | **OPEN** — listed, not measured |
| S-011 | G44 register ENTERPRISE_MAP | HIGH | **CLOSED** — `docs/DEVELOPMENT_PROCESS.md` registered-plan table includes `ENTERPRISE_MAP/` live |
| S-012 | Plan before adversary | MED | **ACK** — v0.1 labeled; v1 blocked on HIGH |
| S-013 | Admin parallel inventory / always in scope | LOW | **CLOSED** — handoff + CAP-011/024/025 on universe |
| S-014 | Dual-model adversary | MED | **DONE this file** — verdict **FAIL** map v1 (not a process gap anymore) |
| S-015 | Hosted ClosePrice migration apply | HIGH | **OPEN / BLOCKED_ENV** — file `20260808181843_beacon_price_bands_close_price.sql` on disk; hosted apply not proven. Acceptable residual **if labeled BLOCKED_ENV**, not claimed VERIFIED applied |
| S-016 | CAP-015 publish/measure class | HIGH | **OPEN (PARTIAL code)** — measured=0 still true in M-live; diagnosis holds; **status-flip helpers** (`markActionMeasuredIfReady`, `reconcileExecutedWithPerformance`) **are on disk** in `measurement-loop.ts` — not “zero fix shipped.” Publish identity / ready drain still open |
| S-017 | F7 ghost residual (false BLOCKED_MATT) | HIGH | **CLOSED** — scrubbed 2026-08-08T21:11Z; T-017 DONE prod 2026-07-29 | HIGH | **OPEN (NEW dual-pass)** — `F7-sync-contention.md` + disposition **T-017 = DONE** (applied prod 2026-07-29). Yet `REMAINING.md` R-SHIP-5, CAP-002 residual, ALL-OPEN CAP-002 still say **F7 BLOCKED_MATT / Matt window**. False open residual + false Matt blocker. **Must scrub** |
| S-018 | Navigation layer lag vs matrix close | MED | **OPEN (NEW)** — `00-STATUS.md` / `REMAINING` still “matrices partial / CAP maturity open” while `CAPABILITIES.md` + EVIDENCE-LOG claim ~22:30Z CAP maturity close + INT close. Map SoR fragments disagree |
| S-019 | Inventory meta undercount producers/registry | MED | **OPEN (NEW)** — `Z-inventory-meta.json` `N_prod: 2`, `N_reg: 0` vs `N-producer-dirs.txt` **24** lines and `N-registry-rows.tsv` multi-section content |
| S-020 | SOCIAL-PARKS Nextdoor key claim | MED | **OPEN (NEW)** — `matrix/SOCIAL-PARKS.md` says Nextdoor “no client key in .env.local”; `D-env-keys.txt` has `NEXTDOOR_CLIENT_ID/SECRET`. Auth n=0 PARK still correct; env claim wrong |
| S-021 | Dark cron snapshot siblings still NEEDS_CLASS | MED | **OPEN (NEW)** — only `marketing-snapshot-google-ads` marked FANOUT_CHILD; other `marketing-snapshot-*` remain NEEDS_CLASS though same parent PLATFORMS fan-out pattern |
| S-022 | CAP-015 “fix not shipped” overclaim vs code | MED | **OPEN (NEW)** — pairs S-016: R-SHIP-2 / S-016 prose said no fix; status reconciliation code landed; live measured still 0 → need post-deploy re-probe + publish-path work |

## PASS for map v1
Zero open **HIGH**, or Matt-accepted residual list.  
**Acceptable residuals by dual-pass law:** PARK socials (Threads/Nextdoor/Pinterest), BLOCKED_ENV hosted migrations, dual-check UNKNOWN (CAP-033).  
**Not acceptable:** false VERIFIED maturity, missing CAP/INT/FAC/plan rows, **false BLOCKED_MATT** (S-017), incomplete HIGH cell verification claimed closed.

## Current verdict
**PASS map v1 control system** (DUAL-PASS round 2). Navigation + inventories + partial VERIFIED cells are real. Dual-pass found **S-017 HIGH** (F7 ghost) plus retained open HIGHs (S-001, S-002, S-016, S-015). See `DUAL-PASS.md`.
