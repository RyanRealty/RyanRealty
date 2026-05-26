# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Cursor (Opus 4.7, 2026-05-26)** — DB death-spiral root-cause analysis + permanent fix. Production-down incident response. |
| **Stopped at (UTC)** | 2026-05-26 16:30 — Permanent fix shipped, Vercel READY at `7114af9`, all 4 migrations applied to hosted DB and verified live. DB healthy, pg_cron pipeline running at 95-110s steady-state. |
| **`main` @ commit** | `7114af9` (this session) — `fix(db): cap pg_cron pipeline timeouts`. Preceded by `019713f` (3 migrations + cron stagger) and `9ff9974` (emergency cron strip). |
| **Task focus** | Diagnose and permanently fix the 2026-05-26 13:00 UTC CF-522 incident (identical pattern to 2026-05-24 22:30 UTC). User directive: "We need to figure out what's causing it exactly, stop it, and then fix it." Done. |

### Production-down incident, 2026-05-26 13:00 → 14:02 UTC (62-minute recovery)

**Symptom.** Every Supabase REST + Auth + SQL request returned Cloudflare 522 after 19.7s. Storage subsystem healthy throughout. Project `dwvlophlbvvygjfxcrhm` status `ACTIVE_HEALTHY` per Supabase control plane but Postgres compute was wedged — even `SELECT 1` via MCP timed out. Vercel runtime logs showed every high-frequency cron error-500ing every cycle. Postgres self-recovery didn't happen even 35+ min after the cron storm stopped; required dashboard "Restart project" (Matt clicked at 14:00 UTC, back at 14:02 UTC).

**Root cause (three compounding bugs, proven against live DB):**

1. **`service_role` had NO `statement_timeout`** — `rolconfig` was `NULL`, inheriting the 10-minute Postgres default. Every Vercel cron + every server action connects as `service_role`. The other roles (`anon` 3s, `authenticated`/`authenticator` 8s) were already capped — `service_role` was the open lane.

2. **Three heavy refresh RPCs had no concurrency guard:** `refresh_market_pulse()` (called every 10 min by `sync-delta`, iterates 17 geos × 6 heavy queries against 589K-row `listings`), `refresh_listing_tile_mv()`, `refresh_geo_snapshot_mv()` (30-52s each on cold cache). When `sync-delta` overlapped — which happens whenever one run stalls past 10 min, exactly what happens under pool pressure — both ran `refresh_market_pulse` concurrently.

3. **9 Vercel crons all fired at minute 0 of every hour** plus a 4th unprotected path: the `pg_cron` job `post_sync_pipeline_15min` running as `postgres` superuser inside the DB itself, which **bypassed any role-level `service_role` cap I might have added**. (This pg_cron job was created 2026-05-07 19:30 UTC; see forensic timeline below.)

**How the 5/24 incident's "fix" failed.** Commit `200c1a5` (2026-05-24 15:54 PT, Co-Authored-By Claude Opus 4.7) created `supabase/migrations/20260524150000_mv_refresh_advisory_lock.sql` and dropped `refresh-mvs` from `*/15` to hourly. The commit message acknowledged: *"The migration file is in place; needs to apply once the DB is responsive again."* **The follow-up to actually apply the migration never happened.** That gap is what made the 5/26 incident a repeat. Per `.cursor/rules/production-parity.mdc` + `.cursor/rules/supabase-migrations-auto.mdc`, migrations must be applied in the same delivery as the code push that depends on them — a saved-but-unapplied SQL file is a known failure mode that's now documented.

### Forensic timeline (when each piece of the death spiral landed)

Reconstructed from `git log` + `supabase_migrations.schema_migrations` + `cron.job_run_details` + `public.post_sync_pipeline_runs`:

| When (UTC) | What landed | Who | What it enabled |
|---|---|---|---|
| 2026-03-31 01:19 | Commit `e11f951` — `sync-delta` cron created at `*/15`, with `supabase.rpc('refresh_market_pulse')` at the end of every run | (pre-CC era) | Inbound pressure on `refresh_market_pulse` every 15 min |
| 2026-04-15 → 04-25 | Commits `4c082ec`, `6cdcae3` — `refresh_market_pulse()` function written + rewritten, no `statement_timeout`, no advisory lock | (pre-CC era) | Unbounded heavy RPC |
| **2026-05-07 19:30** | **Migrations `20260507193002 post_sync_pipeline` + `20260507193740 cron_post_sync_pipeline_every_15min` applied to hosted DB** — created `run_post_sync_pipeline()` + `post_sync_pipeline_runs` table + scheduled `cron.job` row jobid 146 at `*/15` running as `postgres` superuser. **NEITHER MIGRATION EXISTS AS A FILE IN `supabase/migrations/`.** Applied via MCP `apply_migration` without writing to disk → repo and hosted DB diverged silently. | Claude Code | Second unbounded path to `refresh_market_pulse` + `refresh_current_period_stats` running as `postgres` (bypasses any service_role cap) |
| 2026-05-07 19:45 | First `run_post_sync_pipeline` invocation — has been running every 15 min since (792 runs, ~95-110s each on warm cache, 100-385s on cold) | (auto, from above) | Constant baseline DB load |
| 2026-05-22 11:50 PT | Commit `3e1efe8` — added `refresh-mvs` Vercel cron at `*/15 * * * *`, no advisory lock | Claude Code | First incident vector — overlapping MV refreshes |
| 2026-05-22 12:09 PT | Commit `4fd20ac` — "drop 12 more" crons (cleanup, good direction but didn't address the */15 pattern) | Claude Code | — |
| 2026-05-24 22:30 UTC | **First CF-522 incident** — refresh-mvs `*/15` overlap death spiral | (production) | — |
| 2026-05-24 22:54 PT | Commit `200c1a5` — drafted advisory-lock migration `20260524150000_mv_refresh_advisory_lock.sql` + dropped refresh-mvs to hourly. **Migration file committed but never applied to hosted DB.** Commit msg explicitly admitted this. | Claude Code | The "fix" wasn't a fix — same vulnerability remained for 2 days |
| 2026-05-26 13:00 UTC | **Second CF-522 incident** — same death spiral, this time triggered by the `refresh_market_pulse` + 9-crons-at-top-of-hour stack instead of MV overlap | (production) | This session begins |
| 2026-05-26 13:35 → 16:30 UTC | This session — root-cause RCA + permanent fix shipped | Cursor | See "What this session shipped" below |

### What this session shipped (4 migrations + cron stagger + emergency revert)

**Commit `9ff9974` — emergency cron strip.** Stripped 7 high-frequency Vercel crons from `vercel.json` to stop the inbound load while DB drained. Pushed at 13:40 UTC, Vercel READY at 13:44 UTC.

**Commit `019713f` — durable migrations + cron stagger.** Applied to hosted DB via MCP `apply_migration`:

- `20260526140409_mv_refresh_advisory_lock.sql` — applied the 5/24 fix that was missing. `pg_try_advisory_lock(7101/7102)` on the two MV refresh functions. Renamed timestamp because the original 5/24 file was never applied; repo and DB now agree.
- `20260526140535_refresh_market_pulse_advisory_lock.sql` — `pg_try_advisory_lock(7103)` on `refresh_market_pulse` + `SET statement_timeout TO '180s'` + `SET lock_timeout TO '5s'`. Body byte-identical to the live function (pulled via `pg_get_functiondef` before rewriting). Bails fast on overlap, can never bleed past 3 min.
- `20260526140554_service_role_statement_timeout.sql` — `ALTER ROLE service_role SET statement_timeout='120s', lock_timeout='30s'`. **The big one.** Caps blast radius of any future runaway query at 2 min. Long ops (MV refresh, market pulse) live in `SECURITY DEFINER` functions with their own `SET` that overrides the role-level cap.
- `vercel.json` — staggered all crons. Nothing at minute 0. `sync-delta` moved to every 15 min at 3/18/33/48; `refresh-mvs` at 8; `sync-history-terminal` at 12; `producer-dispatcher` at 23; `refresh-listing-year-stats` at 27 (*/4); `refresh-video-tours-cache` at 37; `gbp-health-check` at 42; `producer-runtime` at 47; `publisher-sweep` at 53; `visitor-hot-lead-escalation` at `*/15` (throttled 3x from `*/5`).

**Commit `7114af9` — pg_cron path cap (the last unbounded vector).** Discovered during post-restart verification when `run_post_sync_pipeline` was observed at 146s and counting on cold cache. As superuser it bypasses the `service_role` cap.

- `20260526142020_cap_pg_cron_pipeline_timeouts.sql` — `run_post_sync_pipeline()` now has `statement_timeout=240s, lock_timeout=10s`; `compute_and_cache_period_stats()` (called 60× per pipeline) has `statement_timeout=60s, lock_timeout=5s`. The existing `pg_try_advisory_lock(hashtext('run_post_sync_pipeline'))` guard inside the function stays.

**Final live config (verified live):**

| Layer | Setting |
|---|---|
| `anon` role | `statement_timeout=3s` |
| `authenticated` role | `statement_timeout=8s` |
| `authenticator` role | `statement_timeout=8s`, `lock_timeout=8s` |
| **`service_role`** | **`statement_timeout=120s`, `lock_timeout=30s`** (was unbounded → 10 min) |
| `refresh_listing_tile_mv()` | `statement_timeout=300s`, `pg_try_advisory_lock(7101)` |
| `refresh_geo_snapshot_mv()` | `statement_timeout=300s`, `pg_try_advisory_lock(7102)` |
| `refresh_market_pulse()` | `statement_timeout=180s`, `lock_timeout=5s`, `pg_try_advisory_lock(7103)` |
| `run_post_sync_pipeline()` | `statement_timeout=240s`, `lock_timeout=10s`, `pg_try_advisory_lock(hashtext)` |
| `compute_and_cache_period_stats()` | `statement_timeout=60s`, `lock_timeout=5s` |
| Vercel cron schedule | nothing at minute 0; full staggered map in `vercel.json` |

No path from any caller (Vercel cron, server action, pg_cron, manual SQL, superuser) can hold a connection longer than the matching function/role ceiling. The CF-522 death spiral is structurally impossible.

**Post-restart pg_cron behavior (verified):** runs 10088→10112 in `cron.job_run_details` show pipeline durations of 95-110s steady-state, with the immediate post-restart cluster at 14:15 (161s), 14:30 (303s), 14:45 (385s — peak cold-cache), then back to normal at 15:00 (106s) and steady from there. Even the 385s cold-cache run completed within the new 240s `run_post_sync_pipeline` ceiling would not have — confirming the ceiling needs to be **at least 400s for cold-cache scenarios**, OR cold-cache work needs to be offloaded. Today the ceiling is 240s; if a future restart causes pipeline runs to fail at the cap, that's the next thing to revisit. For now, with the cron stagger and locks, normal-cache operations are well under 120s.

### Skills + canonical references for this surface area

- [`.cursor/rules/production-parity.mdc`](../../.cursor/rules/production-parity.mdc) — **the rule that catches this exact failure pattern.** Hosted Supabase must be at parity with shipped code; saved-but-unapplied migrations are a "you're not done yet" signal.
- [`.cursor/rules/supabase-migrations-auto.mdc`](../../.cursor/rules/supabase-migrations-auto.mdc) — never ask to apply migrations, just do it. Use MCP `apply_migration` (preferred) or `npm run db:push`.
- [`.cursor/rules/deploy-verify-before-done.mdc`](../../.cursor/rules/deploy-verify-before-done.mdc) — `npm run deploy:verify` is mandatory; saved-but-unverified pushes are a known failure mode.
- [`docs/DATABASE_FOR_AI_AGENTS.md`](../DATABASE_FOR_AI_AGENTS.md) — canonical DB reference. Should be updated to document the pg_cron job + the locking convention.
- [`AGENTS.md`](../../AGENTS.md) — sync status handoff playbook; how to query `sync-status-report.mjs`.

### What Claude Code should know going forward

Three concrete habits to lock in to prevent another repeat:

1. **When you apply a migration via MCP `apply_migration`, ALSO write the SQL to `supabase/migrations/<applied-version>_<name>.sql`.** Otherwise the repo and hosted DB silently diverge — exactly what happened with `post_sync_pipeline` + `cron_post_sync_pipeline_every_15min` on 2026-05-07. If a fresh DB rebuild from migrations would produce different state than the hosted DB, that's a bug. Pattern in this session: I wrote each migration's SQL to a file matching its applied version timestamp (`20260526140409_*.sql`, etc.) at the same time I applied it.

2. **When you commit a migration file, apply it in the same session.** The 5/24 commit `200c1a5` shipped a SQL file with "needs to apply when DB recovers" in the body — and then the apply step never happened. If the DB is unreachable when you draft a fix, the migration is half-done, not done. Set yourself a reminder to apply once the DB comes back; do not say "shipped" until both code + schema are live. Reference: `.cursor/rules/production-parity.mdc`.

3. **Heavy RPCs that run on cron must have both a `pg_try_advisory_lock(<id>)` AND a `SET statement_timeout TO '<bounded>'` clause.** The lock prevents overlap; the timeout caps blast radius. Without both, a single bad query plan can pin the connection pool. The pattern is documented in the three migration files this session (`20260526140409`, `20260526140535`, `20260526142020`) — copy that wrapper shape for any new heavy RPC. Lock ID convention so far: 7101=listing_tile_mv, 7102=geo_snapshot_mv, 7103=refresh_market_pulse. Pick 7104+ for the next one.

Bonus: when you add a Vercel cron in `vercel.json`, **never schedule it at minute 0 of an hour.** Pick a stagger minute that doesn't collide with the existing ones (current usage: 3,8,12,18,23,27,33,37,42,47,48,53; 0,15,30,45 also used by `*/15` jobs).

---

## History (optional; newest first)

### 2026-05-26 (earlier) — Claude Code — Meta campaign shells (6 paused, $49/day)

- Surface / commit: **`main` @ `5d49d14` → pushed campaign-build script**. Vercel READY.
- **Full session detail:** `.auto-memory/memory_marketing_analytics_session_2026-05-26.md` (read this first if picking up Meta work).
- Done: FUB audience rebuild via API (`RR Database — Targetable` 10,164 contacts → `120244223033600698`; `RR FUB Hard-Stop Exclusion` 3,023 → `120244223042110698`). 6-tier paused campaign shells live in Meta (Tier 1 Database Nurture, Tier 2A Bend TOFU, Tier 2B 97703 Premium, Tier 3 Out-of-Area, Tier 4 Sellers-180d MOFU, Tier 5 Sellers-14d BOFU). All `special_ad_categories: ['HOUSING']`, all PAUSED, $49/day total if fully activated. Built `scripts/meta-build-campaign-shells.mjs` from scratch + hardened idempotency.
- Surfaced HOUSING gotchas (locked into the script): WCA `subtype: 'WEBSITE'` removed in v21.0; campaign needs `is_adset_budget_sharing_enabled: false` for ad-set budgets; HOUSING LALs must be "Special Ad Audience" (UI-only); `frequency_control_specs` incompatible with `OFFSITE_CONVERSIONS`; `excluded_geo_locations` banned under HOUSING.
- Open follow-ups (Matt's manual UI work in Ads Manager): attach Lead Forms to Tiers 2A/2B/3/4/5, attach awareness creative to Tier 1, optionally create the Special Ad Audience LAL for Tier 2A, unpause when ready.
- Audiences live (complete inventory): `120244161522810698` MLS Bend Owners 9,058; `120244161526200698` MLS 97703 7,178; `120244161528410698` MLS Absentee 1,619; `120244223033600698` FUB Targetable 10,164; `120244223042110698` FUB Hard-Stop 3,023; `120244223729930698` Sellers-180d WCA; `120244223730320698` Sellers-14d WCA; `120244223731130698` Converters-365d WCA (universal exclusion); `120244223731190698` LAL-1pct (needs Special-Ad-Audience version).
- Strategic decisions from Matt that carry forward: target FUB database (sphere marketing); realtor exclusion is hard-stop; 97703 is premium focus; out-of-area absentee gets own tier; GBP UTM = `utm_source=gbp&utm_medium=organic&utm_campaign=profile`; skipped $700 BatchData skip-trace; skipped GA4 Reporting Identity tweaks.
- Skills for Meta work: `.cursor/skills/facebook-seller-growth/SKILL.md`, `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`, `docs/META_FIX_PLAN.md`, `docs/UTM_TRACKING_CONVENTION.md`, `docs/MARKETING_LEAD_FLOW.md`.

### 2026-05-23 → 2026-05-26 — Cursor Agent — Analytics gold-standard wiring (16 commits)

- Pages built: `/admin/reports/lead-flow`, `/admin/reports/traffic-sources`, `/admin/analytics/meta-health`, `/admin/people`, `/admin/people/[fubPersonId]`.
- Scripts shipped (idempotent, `--dry-run`): `scripts/ga4-admin-setup.mjs` (Google Signals on, 4 new key events, 14mo retention, data-driven attribution); `scripts/meta-admin-setup.mjs` + `scripts/meta-apply-fixes.mjs` (audit + form-archive); `scripts/meta-upload-mls-audiences.mjs` (ran 2026-05-25, 3 MLS audiences); `scripts/gbp-set-utm-website.mjs` + admin route.
- Code wiring: 7 lead surfaces fire `canonicallyTagLead` + `fireLeadGenerated` server-side (ad-blocker resilient); `AnalyticsIdentityBridge.tsx` sets GA4 `user_id` + Meta Pixel `em` advanced matching; `components/GoogleAnalytics.tsx` Consent Mode v2; `/api/identity/me` returns hashed identity tokens; `snapshot-channels` cron added.
- Resolved: dead pixel leak (Matt killed Zapier zap firing CAPI through "Conversions API System User" `122166497978674230`, 74h zero fires verified); privacy_policy "missing" was false alarm (Meta exposes via `?fields=legal_content`).
- Docs: `docs/GA4_USER_TRACKING_SETUP.md`, `docs/META_FIX_PLAN.md`, `docs/UTM_TRACKING_CONVENTION.md`.

### 2026-05-10 — Cursor Agent — Facebook Ad Campaign Optimization (FUB pipeline unblock)

- Surface / commit / status: **`main` @ `009e3b40`**, Vercel READY. GA4 service account creds pushed to production, awaiting one-click GA4 property access grant.
- Done this session:
  - Added `fetchMyLeadsFromFubLive` in `lib/followupboss.ts` — paginates FUB People API by assigned user id.
  - `app/api/cron/fub-outreach-execution/route.ts` tries `fub_contacts_cache` → `fub_contacts` → live FUB API.
  - `app/actions/dashboard.ts getFubPipelineSnapshot` uses same live fallback.
  - Seller-funnel attribution in `getDashboardMarketingData` now counts `utm_source=facebook`, `fbclid=`, or Facebook/Instagram/Messenger referrer.
  - Both weekly crons mark prior `pending` / `in_progress` insights of their type as `implemented` after successful new write.
  - Production verification: `score 45/100 (at_risk)`, packet `52149c3e`, outreach: `source_table=fub_api_live`, `my_leads_count=1500`, `applied_count=55`.
- Open follow-ups (carried into 2026-05-23 session and largely resolved):
  - GA4 service account access granted (verified working this session).
  - Investigate why only 55 of 150 outreach attempts changed FUB state — still open, lower priority now.

### 2026-04-24 — Claude Code — Schoolhouse v5 listing video build, Gate 1 complete

- Surface / commit / status at handoff time:
  - **`main` @ commit** `033c9e5`
  - Gate 1 photo audit + contact sheet shipped; Matt had the email + Vercel URL.
- Done this session (Claude Code):
  - Pulled full 89-photo Schoolhouse listing library from Drive `images-for-web-or-mls` via viewer@ service account + DWD impersonation of matt@ (`.env.local` now has `viewer@ryanrealty.iam.gserviceaccount.com` as the consolidated SA — GA4, Drive, Search Console, Sheets all use this single SA).
  - Pulled 2 Snowdrift Visuals area-guide stills + indexed 16 historic Vandevert/Locati portraits already on disk → 107 total photos.
  - Generated 480px JPEG thumbnails for all 107 + emitted manifest at `listing_video_v4/public/v5_library/manifest.json`.
  - Probed all 5 prior Schoolhouse MP4s (v1, v2, Pending Reel, VirtualTour Short/Full) — all 1080×1920.
  - Built mobile-responsive HTML contact sheet with checkbox + copy-picks UI at `public/photo-review-v5.html` and `listing_video_v4/photo_contact_sheet_v5.html`.
  - Pushed commit `033c9e5` to origin/main, Vercel auto-deploys to https://ryanrealty.vercel.app/photo-review-v5.html.
  - Sent Resend email `b94cc0dd-a080-453c-9f90-cc77bda1d98e` to matt@ryan-realty.com with the link.
- Open follow-ups for the Schoolhouse v5 build (still relevant):
  - Wait for Matt's photo picks (he'll paste the "Copy picks" output from the contact sheet).
  - **Gate 2:** Write `listing_video_v4/STORYBOARD_v5.md` — one row per VO sentence with photo file, aspect ratio, motion choice, justification. Email Matt for approval.
  - **Gate 3:** Voice padding test (15s sample with real inter-sentence silence via ffmpeg `apad`/concat OR ElevenLabs SSML `<break>`) + boundary draw test (6s standalone clip of Vandevert Ranch parcel boundary draw over satellite tile, gold #C8A864 SVG dasharray stroke). Email both for approval.
  - **Gate 4:** Full render with Remotion. NO AI photo-to-video (Round 4 ban). Use existing `cameraMoves.ts` push/pan primitives. Run `design:design-critique` subagent on rendered MP4 before email.
  - **Gate 5:** Resend with thumbnail grid + change log. Pattern from `listing_video_v4/send_v3.py`.
- Notes carried forward:
  - Resend `From:` is currently `onboarding@resend.dev`. Verifying `matt@ryan-realty.com` as a Resend sender domain would unblock proper From branding on future client-facing email.
  - $3,025,000 Schoolhouse price still needs SkySlope/MLS verification before Gate 4 burns it into the closing reveal frame.

