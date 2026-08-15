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
- Nextdoor/Pinterest: **corrected in INT close pass below** (earlier “no client keys” was wrong for Nextdoor).
- FUB: `FOLLOWUPBOSS_API_KEY` present (legacy residue, not SoR).
- AdSense: `NEXT_PUBLIC_ADSENSE_CLIENT_ID` present.

### Still not done this pass
- Dual-model adversary
- Full CAP maturity cell close (only path + selective live)
- Hosted ClosePrice migration apply
- Token refresh / reconnect ops for expired socials
- CAP-015 publish class fix

---

## CAP maturity close pass (2026-08-08 ~22:30Z)

**Deliverables**
- `matrix/CAPABILITIES.md` — **full cell rewrite** CAP-001…035 (maturity 0–5 + justification, evidence status, pointers, public risk, broker product?, residual disposition). No CAP dropped.
- `inventories/R-cap-path-proofs.json` — per-CAP `{disk, live, evidence_status, notes}` (replaces boolean-only map).

**Evidence status counts (primary cell status)**

| Status | Count | IDs |
|--------|------:|-----|
| VERIFIED | **6** | CAP-006, 009, 014, 015, 019, 024 |
| PARTIAL | **27** | CAP-001–005, 007–008, 010–013, 016–018, 021–023, 025–032, 034–035 |
| UNKNOWN | **1** | CAP-033 (Grok memory external; disk=false) |
| BLOCKED_MATT | **1** | CAP-020 (newsletter first cohort / send ops) |

**Maturity snapshot (integer scores used in matrix)**
- **4:** 001, 003, 006, 024, 028, 029
- **3:** 002, 004, 005, 007, 008, 009, 010, 011, 013, 014, 015, 016, 018, 020, 021, 023, 025, 026, 027, 031, 032, 034
- **2:** 012, 017, 019, 022, 030, 033, 035
- **1 / 0:** none

**VERIFIED cell anchors (why not PARTIAL)**
- **006** — live pulse/cache + methodology v3 stamp (prior EVIDENCE-LOG + M-live)
- **009** — stage dist exact census (P-crm-stage-dist + 22978 people)
- **014** — expired processor via sync-delta intentional; count 248; FSBO cron scheduled
- **015** — brain status census + measurement-loop code class (measured=0 explained)
- **019** — auth table token_expiry probe (TikTok only VALID)
- **024** — 143 v2 import; 27 without all REDIRECT_STUB (Q-admin classified)

**Residuals still BLOCKED_MATT (not false DONE)** even when cell is PARTIAL
- CAP-002 F7 MV window
- CAP-018 ad spend / campaign mutation
- CAP-020 first newsletter cohort
- DNS cutover (CAP-001 ops) as ops residual

**Rules applied**
- Prefer UNKNOWN (CAP-033) over inventing VERIFIED
- Did **not** edit `app/admin/**/crm/inbox/**` or parallel dirty admin paths
- Live fields null where no probe this pass; disk true for all except CAP-033

**Still open after this close (not CAP cell coverage)**
- Dual-model adversary PASS
- Hosted ClosePrice migration apply
- CAP-015 publish/measure **fix** (diagnosed only)
- Social token reconnect ops
- ADVANCEMENT_PLAN v0.1 → v1 after adversary

---

## INT matrix close pass INT-001…037 (2026-08-08 ~21:30Z Grok)

**Deliverable:** `matrix/INTEGRATIONS.md` fully filled (env names · code pointer · live signal · authority · health · disposition · owner_loop). No secrets logged.

### Env inventory
- `inventories/D-env-keys.txt` = **117** key names (local `.env.local` extract).
- Primary credentials mapped to INT-001…036.
- Leftovers/flags → **INT-037 OTHER/tooling** table: `CRM_SMS_ALERTS`, `LEAD_SMS_IMESSAGE_FALLBACK`, `TC_FORMS_INGEST_SECRET`, `NEXT_PUBLIC_SITE_URL`, `CURSOR_API_KEY`, `VERTEX_*`, `GCP_USER_REFRESH_TOKEN`, FUB residue keys, Ellen voice id, etc.

### Correction vs prior log
- **Nextdoor:** `NEXTDOOR_CLIENT_ID/SECRET/REDIRECT_URI` **ARE** in D-env-keys (prior “no client keys” wrong). Auth still **n=0** → still **PARK**.
- **Pinterest:** still **no** `PINTEREST_CLIENT_*` in env; code requires them (`lib/pinterest.ts`) → **PARK**.
- **Threads:** client keys present; `threads_auth` n=0 → **PARK** with written disposition.

### Live social tokens (reaffirm P-db-probes)
| Platform | Auth rows | State |
|----------|----------:|-------|
| TikTok | 1 | VALID until 2026-08-09 |
| LinkedIn | 1 | EXPIRED 2026-07-09 |
| X | 1 | EXPIRED 2026-08-08 |
| YouTube | 1 | EXPIRED 2026-08-08 |
| GBP | 1 | EXPIRED 2026-08-08 |
| Threads / Nextdoor / Pinterest | 0 | NOT_CONNECTED |
| broker_gcal_tokens | 0 | EMPTY |

### Other live signals used
- listings 594623 · email_events 564 latest 2026-08-08 · meta_audience_log last LIVE 2026-06-23 · skyslope_transactions 33 synced_at sample 2026-06-10 · crm_message 45299 · FUB = native shim only (`lib/followupboss.ts` sendEvent → ensureNativeLead)
- Inngest: `lib/inngest.ts` is thin optional HTTP emit; **not** a job runner — disposition **PARK**
- RentCast/SchoolDigger: keys present; little/no active product call-path → **PARK** optional

### Health counts (37)
| green | amber | red | dark | unknown |
|------:|------:|----:|-----:|--------:|
| 9 | 10 | 4 | 6 | 8 |

**green:** 001, 003, 005, 019, 020, 022, 024, 025, 030  
**red:** 009 GBP, 010 LinkedIn, 012 YouTube, 013 X  
**dark PARK-adjacent:** 014 Threads, 015 Nextdoor, 016 Pinterest, 018 FUB, 027 RentCast, 028 SchoolDigger  

### Explicit PARK list
1. **INT-014 Threads** — keys only; never connected; no cadence  
2. **INT-015 Nextdoor** — keys present; never OAuth; park until Matt prioritizes  
3. **INT-016 Pinterest** — no client env; auth empty; library only  
4. **INT-027 RentCast** — HUD FMR preferred; key residue  
5. **INT-028 SchoolDigger** — static research; API not critical path  
6. **INT-034 Inngest** — optional emit; crons own work  

### Disposition counts
KEEP 22 · FIX 2 (Meta audience, SkySlope sync) · RECONNECT 5 (GBP/LI/YT/X/OAuth) · PARK 6 · LEGACY_RESIDUE 1 (FUB) · TOOLING 1 (037)

### FACTORY FAC-001…017
- Updated `matrix/FACTORY.md` with evidence: 10 GHA workflows (named list), husky behavior (unit+voice pre-commit; marker pre-push), 389 scripts / 271 ci:*, 461 migrations, 61 vercel crons, 19 L-skills paths, deploy:verify script.

### Not done (still open program-wide)
- Dual-model adversary  
- Social RECONNECT ops (Matt OAuth)  
- Meta audience re-run / SkySlope mirror refresh  
- Hosted migration apply  
- CAP-015 publish class fix  

### Plan dispositions deep-read pass
**Date:** 2026-08-08  
**File updated:** `docs/plans/ENTERPRISE_MAP/01-PLAN-DISPOSITIONS.md`  
**Scope:** Every path in `inventories/F-plans-packages.txt` (5 packages) + `F-plans-top.txt` (43 top-level) + 2 process-law rows.

| Status (primary label) | Count |
|------------------------|------:|
| ACTIVE | 10 |
| PARTIAL | 22 |
| DONE | 7 |
| SUPERSEDED | 4 |
| GO_GATED | 2 |
| CANON | 2 |
| PAUSED | 1 |
| ARCHIVE | 2 |
| **Total disposition rows** | **50** |

Notes:
- **P-006** (`ENTERPRISE_MAP/`) corrected: **G44-registered** in `docs/DEVELOPMENT_PROCESS.md` (was seed-stale “not registered”).
- Primary labels only (compound cells like “ACTIVE / PARTIAL rewrite” counted once by first status).
- **Unread / partial body depth:** none of the inventory paths were left without a disposition row. Bodies deep-read for intent + fall-off from plan headers/progress sections; full multi-thousand-line specs (e.g. ADMIN_REBUILD `specs/*`, every PROGRAM audit JSON) not line-by-line — package-level disposition uses README/master/ledger. Plans still **not fully line-read:** ADMIN_REBUILD individual `specs/01–11`, PROGRAM `audits/*` JSON corpus, ADS full creative appendices beyond headers — marked via package/parent status, not orphaned.

### Close-pass ships 2026-08-08T21:20Z (Grok)

#### CAP-015 measured status class fix
- `lib/marketing-brain/measurement-loop.ts`: after successful `persistMeasurement`, call `markActionMeasuredIfReady`.
- Added `reconcileExecutedWithPerformance` so historical `content_performance` rows flip parent `marketing_brain_actions.status` from `executed` → `measured`.
- Root cause: status vocabulary included `measured` but no writer set it (Sense always 0).
- Residual still open: executed content rows without `published_to` still cannot enter measurement candidates; ready≈397 backlog is CMA/ops not auto-publishable without product policy.

#### CAP-009 / entity-scope
- `app/admin/(protected)/people/[id]/tools/page.tsx`: explicit `requirePersonInScope` after `getCrmAccess` (only-path parity with mutations).
- Portal page already had scopeBroker/isPersonInScope.

#### Fleet start ritual (MAP-022 / FAC-012)
- `Claude.md` and `Agents.md` now require ENTERPRISE_MAP SESSION_HANDOFF + CROSS_AGENT_HANDOFF before subject tunnels.

#### Inventories regenerated
- See `inventories/Z-inventory-meta.json` (A=296, B=170, C disk 80 / vercel 61 / dark 19, D=117, E=10, K=461, H ci=271, Q 143/27).

#### Social parks
- `matrix/SOCIAL-PARKS.md` — Threads/Nextdoor/Pinterest PARKED; LI/X/YT/GBP RECONNECT; TikTok KEEP.

#### Plan v1
- `synthesis/ADVANCEMENT_PLAN.md` stamped v1 with streams S0–S6 and Matt gates.


### Dual-pass remediation 2026-08-08T21:11Z
- **S-017 CLOSED:** F7 is DONE in production (T-017 / migrations listing_search_mv_* 2026-07-30+). Scrubbed false BLOCKED_MATT F7 window from open lists.
- **Z-inventory-meta** N_prod/N_reg corrected.
- Map v1 redefined as control-system close (not all CAP maturity 5). Dual-pass **PASS (control system)** with product HIGH residuals listed.

### Token liveness correction 2026-08-15 (Matt directive: no reconnect asks)

**Claim corrected:** the 2026-08-08 close read `expires_at` alone and called INT-009/010/012/013 red "RECONNECT (Matt OAuth)". Wrong for three of four. Verified 2026-08-15:

- Scheduled `token-heartbeat` (12:00 UTC daily) ran 2026-08-15T12:00:03Z — `sync_logs` cycle: meta 200, youtube 200, x 200, google_business_profile 200, tiktok 200; linkedin 500; threads/pinterest/nextdoor 204 (not connected, parked).
- Refresh tokens on file (presence check, no values): tiktok_auth len 72 · youtube_auth len 103 · x_auth len 91 · google_business_profile_auth len 103 · **linkedin_auth NULL**.
- Live on-demand trigger (prod endpoint, CRON_SECRET) at ~18:09Z: HTTP 207 ok=5/skipped=3/failed=1(linkedin). `expires_at` moved: youtube 13:00Z → 19:09:09Z, gbp 13:00Z → 19:09:09Z, x 14:00Z → 20:09:10Z. TikTok already fresh to 2026-08-16T12:00:02Z (refreshed by the noon run). Meta page token verified: Page "Ryan Realty Bend" (138563319329985).
- Short `expires_at` = provider TTL design (Google 1h, X 2h, TikTok 24h). Liveness authority is the heartbeat sync_logs, never expires_at alone.
- LinkedIn: lib has full refresh logic (`lib/linkedin.ts` refreshLinkedInToken) but the provider issued no refresh token at grant time → cannot self-renew → **PARKED per Matt 2026-08-15**. Heartbeat will log linkedin 500 daily while parked; expected, not a defect.
- Check added: `lib/data/loop/signals.ts` TokenHealth now carries `refreshTokenPresent` and statuses `auto-refresh` / `needs-reauth` (replaces the misleading `expired`). Escape recorded in `process_escape_ledger`.
- Cells corrected: INTEGRATIONS INT-009/010/011/012/013/035 + health counts (red 4 → 0, green 9 → 13, dark 6 → 7) + dispositions (RECONNECT 5 → 0, PARK 6 → 7, KEEP 22 → 26); SOCIAL-PARKS; CAP-019; ALL-OPEN §1/§2/§8; ADVANCEMENT_PLAN S5/§4/§6; SESSION_HANDOFF highlights + step 4; REMAINING; DUAL-PASS residual row; VERSION-1 (M-list has no OAuth move); COMPANY_SCOREBOARD §0.
