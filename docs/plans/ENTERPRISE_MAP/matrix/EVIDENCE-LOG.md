# Evidence log (append-only)

Claims that left SEED. Date UTC.

## 2026-08-08

### CAP-006 stats engine methodology
- `market_stats_cache` methodology_version: v3-2026-05-07 = **12920**; v4-2026-05-15 = **0**; v1-pre-fix = **70**
- `market_pulse_live` sample 5/5 rows methodology_version = v3-2026-05-07
- **VERIFIED:** served stamp is v3, not v4 definition

### CAP-009 CRM people stages
- Column `stage` exists (schema snapshot + REST)
- Counts (exact match CRM_STAGES subset): Nurture **20371**, Sphere **2338**, Trash **217**, Past Client **32**, Active Client **12**, Lead **7**; sum = total **22977**
- Stages defined in code but **zero rows**: Seller Prospect, A/B/C temperature, Engaged, Closed, Pending, Vendor, Archive, Real Estate Agent, Renter, etc.
- **VERIFIED distribution**; **GAP:** journey model underuses stage vocabulary (almost all Nurture)

### CAP-011 / CAP-024 / CAP-025 admin v2
- page.tsx under app/admin: **170** total
- Import `@/components/admin/v2` or path: **143** with, **27** without
- Without list: `inventories/Q-admin-without-v2-import.txt` (includes console/*, legacy expireds/fsbos, deals, performance, redirect-ish roots)
- Token-gate narrative (~111) is stricter than import census — two different questions
- **VERIFIED import census**; token-gate path list still SEED

### CAP-014 expired detection
- `lib/expired-listing-processor.ts`: canonical trigger **sync-delta** every ~10m; `detect-expired-listings` **manual/ad-hoc only** (not on Vercel schedule) — code comment 2026-05-22
- 108 repo file refs to detect-expired-listings name
- expired_listings count **247**
- **VERIFIED:** not a dark production bug by absence from vercel.json alone

### CAP-015 brain queue
- totals 651; pending 1; in_production 91; ready **396**; approved 0; executed 90; measured **0**; killed 73
- **VERIFIED** snapshot 2026-08-08

### CAP-012 TC
- tc_deals count **33**
- **VERIFIED** row presence; maturity still PARTIAL

### INT snapshot fan-out
- `app/api/cron/snapshot-channels/route.ts` PLATFORMS: ga4, gsc, meta-ads, meta-page, x, linkedin, tiktok, gbp, youtube (**9**)
- **marketing-snapshot-google-ads** exists on disk, **not** in PLATFORMS → **ORPHAN_RELATIVE** VERIFIED
- marketing-snapshot-fub removed 2026-07-09 (comment in route)

### Dark cron refcounts (files mentioning string)
See `inventories/O-dark-cron-refcount.txt` — all NEEDS_PROBE items have **some** refs (not zero-dead-string). Classification still needs call-graph (who invokes HTTP).

### Inventories
- N-registry-rows.tsv: **85** table rows from REGISTRY.md
- N-producer-dirs: **24**
- C-crons-vercel-full.json: **59** scheduled paths
- Migrations: **460**

### Live anchors
listings 594619 · listing_history 3896191 · pulse 45 · cache 12995 · crm_people 22977 · brain 651 · brokers 3 · cmas 266 · expired 247 · boundaries 3312 · tc_deals 33

### Cron call-graph (second pass)
- **weekly-cycle**: intentional HTTP alias for `marketing-weekly-cycle` (both call `runWeeklyCycle`). Scheduled name is `marketing-weekly-cycle` Mon 16:00 UTC. Alias is manual/alt surface — **ALIAS_OK**.
- **marketing-snapshot-google-ads**: file header claims fan-out from snapshot-channels; **PLATFORMS omits google-ads** → header **stale/wrong**; route is **ORPHAN_RELATIVE** until PLATFORMS includes it or header fixed + schedule exists.
- **daily-broker-digest**: templates/docs reference; vercel schedules **broker-agent-digest** instead — likely **SUPERSEDED_BY broker-agent-digest** (confirm parity then delete or redirect).
- **weekly-pipeline-digest**: template says Mon 8am Matt; **not** in vercel.json schedule list — **DARK_SCHEDULE** (code+templates exist, no schedule).
- **refresh-listing-year-stats**: ops via sync-status-report curl guidance; not scheduled — **MANUAL_OPS**.
- **refresh-video-tours-cache**: shared logic with app/actions/video-tours-cache; not scheduled — **MANUAL_OR_TRIGGER**.
- **strategy-revision-check**: listed in scripts/audit-brain.mjs; not scheduled — **PROBE/audit-only**.
- **neighborhood-default-subscriptions**: concept lives in listingAlerts + neighborhoodDefaultSubscriptions data lib; cron dir may be vestigial — **PROBE** (feature may run inside saved-search-alerts).

### Scheduled digests that DO exist (vercel)
marketing-daily-digest, analytics-daily-digest, gbp-monthly-digest, marketing-weekly-cycle, westside-cohort-digest, broker-agent-digest
### S1a closed 2026-08-08 (code)
- Added `google-ads` to `app/api/cron/snapshot-channels/route.ts` PLATFORMS so marketing-snapshot-google-ads is invoked by daily consolidated cron.
- GOOGLE_ADS_* API credentials may still be missing locally (only NEXT_PUBLIC_GOOGLE_ADS_* in example) — ingest may no-op until env set; wiring class fixed.


### CAP-015 measured=0 root cause (code read 2026-08-08)
- `lib/marketing-brain/measurement-loop.ts` `findUnmeasuredCandidates` only selects `status='executed'` with `executor_response` containing extractable **published_posts**.
- It never measures `ready` (396) or `in_production` (91) rows.
- Therefore measured=0 means either: (a) executed rows lack published_posts payload, and/or (b) publish→measure path never completes, and/or (c) windows already measured in another table without flipping action status to measured.
- **Fix class is not “run measurement more often” alone** — it is approve→publish→published_posts→measure status transition completeness.
- Follow-up: sample 90 executed rows for executor_response.published_posts presence (query next session).

### CAP-015 executed sample (2026-08-08)
- Sampled 20 most recent `status=executed` rows: **0/20** have `executor_response.published_posts` (or publishedPosts).
- Therefore measurement-loop has **zero candidates** even among executed — measured=0 is explained.
- Stream S1b fix class: publisher-sweep / producer-runtime must write published_posts shape measurement expects; then optionally flip status to measured.

### PROGRAM Tier-1 re-probe samples (2026-08-08)
- **Bytespider / AEO:** `app/robots.ts` allows Bytespider; `middleware.ts` bot regex still includes `bytespider` (case-insensitive). **STILL CONFLICT** — allow in robots + block in middleware class not closed.
- Other Tier-1 items (beacon price bands, CRM fail-open, sold-homes nav, LP enroll) **not re-verified this pass** — remain on next-session list.

### CAP-015 refined (2026-08-08 later)
- Full stage census file: P-crm-stage-dist.json — 22977 sampled, 6 stages only.
- All 90 executed: ~12 content:*, ~77 comms:* (digests). Only **2** of 90 have `published_to` in a 100-cap sample of executed (effectively content publishes rare in executed set).
- `content_performance` has **6** rows — metrics may land without flipping action `status` to `measured` (loop defers to performance-pull columns; status `measured` may be unused or never written).
- Root causes (class): (1) ready backlog never publishes; (2) most executed are non-content digests; (3) status=measured not populated even when content_performance exists; (4) early check for only `published_posts` key was incomplete — canonical is `published_to`.

### Digest schedule gaps closed in config (2026-08-08)
- **daily-broker-digest** is NOT superseded by broker-agent-digest (different products: per-broker CRM day vs Matt SMS-agent supervision).
- **weekly-pipeline-digest** and **daily-broker-digest** were DARK_SCHEDULE; added to vercel.json at claimed schedules (0 15 * * * and 0 15 * * 1).
- **neighborhood-default-subscriptions** is INTENTIONAL_MANUAL (Matt confirm=1) — not vestigial.

### Scope rule — admin always included (Matt 2026-08-08)
- Parallel Claude Code work on admin/inbox is **concurrent execution**, not exclusion from the enterprise map.
- CAP-011, CAP-024, CAP-025, A-001, inventories B + Q remain mandatory coverage.
- Collision control = do not edit the same dirty files; still inventory, disposition, plan, and re-verify admin.

### Admin 11F / CAP-024-025 re-census (2026-08-08 grind continued)
- Still 170 page.tsx under app/admin; **143** import v2, **27** do not.
- **All 27 are redirect-ish stubs** (<40 lines, call redirect()) — bridges/legacy URLs, not full page shells missing v2.
- Real admin product pages are on v2 barrel import. Token-gate (islands) remains a **separate** question from rule B.
- CAP-024 shell: strengthen to **VERIFIED** for rule B; CAP-025 11F island purity still ACTIVE (inbox parallel).

### PROGRAM Tier-1 re-probes
- **D7 price bands / §0:** Latest migration def `get_beacon_price_bands` (20260401120000) still bands **ListPrice** on rows with StandardStatus LIKE closed. **STILL OPEN** — closed sales banded by list price is license-adjacent.
- **Buyer LP alerts:** `app/lp/buyer-listing-alerts/actions.ts` now creates lead + autoEnroll + **upsertListingAlert** filter sets (comment: funnel gap closed 2026-07-21). Historical "enrolls nobody" claim **likely SUPERSEDED** — re-spot-check live after next LP submit; code path present.
- **CRM scope:** `lib/crm/scope.ts` has scopeBroker + isPersonInScope + tests; requirePersonInScope used widely. Fail-open class **partially mitigated** — entity-scope gate still flags some admin pages (people/[id]). Keep CAP-009 risk but not "unscoped everywhere."
- **Bytespider:** still allow robots + middleware block (prior log).

### Digests (clarified)
- daily-broker-digest ≠ broker-agent-digest (different products). Both intended; daily CRM digest + weekly pipeline now on vercel schedule (prior commit).

### S0 D7 migration authored 2026-08-08
- `supabase/migrations/20260808181843_beacon_price_bands_close_price.sql` — closed sales bands use ClosePrice; active still ListPrice; return keys unchanged.
- Apply via db:push in same delivery as map commit.

### Bytespider alignment (2026-08-08)
- Removed `bytespider` from middleware BAD_BOT_RE so robots.txt Allow for Bytespider is not contradicted by 403 middleware.
- Other scraper bots remain blocked.

### CAP-015 ready sample (2026-08-08)
- Of first 50 ready by created_at: 44 content:cma, few social; of 30 ready inspected: 1 publish_payload, 0 published_to.
- Ready queue is largely **approval backlog for CMAs/ops**, not posts waiting to measure.
- measured=0 class = publish identity + status transition + content_performance linkage for the few content executes.

### Admin without-v2
- All 27 classified redirect stubs (Q-admin-without-v2-classified.txt).

### Resume pass 2026-08-08T20:55Z (Grok session handoff)

**Live anchors refreshed** → `inventories/M-live-db-counts.json`

| Metric | Count |
|--------|------:|
| listings | 594623 |
| crm_people | 22978 |
| marketing_brain_actions | 652 |
| brain ready / executed / measured / in_production | 397 / 90 / **0** / 91 |
| content_performance | 6 |
| tc_deals / skyslope_transactions | 33 / 33 |
| expired_listings | 248 |
| cmas | 267 |
| brokers | 3 |
| market_pulse_live / market_stats_cache | 45 / 12995 |
| email_events | 564 (latest created_at **2026-08-08** — write path live) |
| crm_message | 45299 (latest sample **2026-08-01**) |
| crm_suppressions | 5169 |
| newsletter_subscribers | 5346 |
| newsletters | total 24 (draft 15 / failed 5 / sent 4) |
| crm_sequences | 7 (active 4 / paused 3) |
| crm_sequence_enrollments | 33 |
| crm_sequence_sends | 4 (latest claimed_at 2026-07-18) |
| meta_audience_log | 64 (latest ran_at **2026-06-23** — stale) |

### CAP path proofs (disk)
- Regenerated `inventories/R-cap-path-proofs.json`: CAP-001…035 all **disk_signal true** except **CAP-033** (Grok memory external).
- This is **path/existence evidence**, not maturity VERIFIED for every CAP.
- CAP-002 public surface includes `search` route inventory row; homes-for-sale may be rewrite-backed (0 literal inventory path).
- CAP-008: `app/lp/*` dirs present (sell-your-home, buyer-listing-alerts, fsbo, expired-listing, …).
- CAP-010: `app/api/cron/crm-sequence-engine` present + live enrollments/sends tables.
- CAP-017: Remotion under `listing_video_v4/` (productization still low).
- CAP-031: snapshot-channels PLATFORMS includes **google-ads** (prior orphan fix still on disk).

### INT social token health (auth tables — no secrets logged)
| Table | Rows | Token state (expires_at vs 2026-08-08 ~20:55Z) |
|-------|-----:|-----------------------------------------------|
| linkedin_auth | 1 | **EXPIRED** (2026-07-09) |
| tiktok_auth | 1 | **VALID** until 2026-08-09 12:01Z |
| x_auth | 1 | **EXPIRED** (2026-08-08 14:01Z) |
| youtube_auth | 1 | **EXPIRED** (2026-08-08 13:01Z) |
| google_business_profile_auth | 1 | **EXPIRED** (2026-08-08 13:01Z) |
| threads_auth | 0 | NOT_CONNECTED |
| nextdoor_auth | 0 | NOT_CONNECTED |
| pinterest_auth | 0 | NOT_CONNECTED |
| broker_gcal_tokens | 0 | EMPTY |

**VERIFIED class:** multi-social is not “connected once forever” — most tokens expired or never connected. CAP-019 health is **red/amber**, not green.

### INT-017 SkySlope live
- `skyslope_transactions` count **33** (matches tc_deals).
- Sample `synced_at` **2026-06-10** — mirror freshness **STALE** relative to “today”; needs sync-health Sense, not just row presence.

### INT-007 Meta audience ops
- `meta_audience_log` last LIVE run **2026-06-23** (add received 13883). Heartbeat **stale** (~7 weeks).

### INT-005 / CAP-010 email measurement
- `email_events` **564** rows; latest **2026-08-08** → Resend/webhook path still receiving events.
- Sequence sends sparse (4 rows; last claim July 18) vs 33 enrollments mostly stopped/paused — engine present but low active throughput.

### CAP-015 reconfirm
- measured **0** exact filter; ready **397** — prior class diagnosis holds.

### CAP-029 Bytespider re-check
- middleware comment: “Bytespider deliberately NOT listed”; `bytespider` appears only in that comment (count=1). Prior fix **still holds**.

### Env key presence (local .env.local, 112 keys) — not live health
- KEY_PRESENT (exact name match this pass): Supabase, Spark, Cron, Twilio, Resend, LinkedIn, TikTok, YouTube, X, SkySlope, ElevenLabs, Apify, OpenAI, Anthropic, xAI, Maps, Upstash, Sentry, RentCast, SchoolDigger, NeverBounce, BatchData, Pexels/Unsplash, Replicate/Fal, VAPID, Inngest, Google OAuth.
- Meta: uses `META_CAPI_ACCESS_TOKEN` / `NEXT_PUBLIC_META_PIXEL_ID` (not FACEBOOK_* names).
- GBP: `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` (not GBP_ACCOUNT_ID).
- Threads: `THREADS_CLIENT_ID` present; auth table empty.
- Nextdoor/Pinterest: no client keys found; auth empty.
- FUB: `FOLLOWUPBOSS_API_KEY` present (legacy residue, not SoR).
- AdSense: `NEXT_PUBLIC_ADSENSE_CLIENT_ID` present.

### Still not done this pass
- Dual-model adversary
- Full CAP maturity cell close (only path + selective live)
- Hosted ClosePrice migration apply
- Token refresh / reconnect ops for expired socials
- CAP-015 publish class fix
