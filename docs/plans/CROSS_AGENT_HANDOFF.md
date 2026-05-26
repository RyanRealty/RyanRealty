# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Claude Code (Opus, 2026-05-26)** — Picked up Cursor agent's marketing pipeline build. Ran FUB audience rebuild + shipped the 6 paused campaign shells with proper HOUSING Special Ad Category compliance. |
| **Stopped at (UTC)** | 2026-05-26 13:55 — 6 paused campaign shells live in Meta, all HOUSING-compliant, all $49/day total if fully activated. Awaiting Matt to attach creative + Lead Forms in Ads Manager. |
| **`main` @ commit** | `5d49d14` at pickup (Cursor agent's last). New commit pending push for `scripts/meta-build-campaign-shells.mjs` + this handoff. |
| **Task focus** | Execute Cursor agent's two pending Meta tasks: (B) FUB audience rebuild via API, (A) build 6-tier paused campaign shells with audience targeting + HOUSING constraints. |

### Done this session (Claude Code) — Meta campaign infrastructure

**FUB audience rebuild (Task B — script existed, ran live):**
- `RR Database — Targetable (no realtors/compliance/test)` → `120244223033600698` — 10,164 contacts, 27,455 PII records pushed
- `RR FUB Hard-Stop Exclusion (realtors+compliance+test)` → `120244223042110698` — 3,023 contacts, 6,553 PII records pushed

**6-tier campaign shells built (Task A — wrote `scripts/meta-build-campaign-shells.mjs` from scratch):**

| Tier | Campaign ID | Ad Set ID | Daily | Objective / Goal |
|---|---|---|---|---|
| Tier 1 — Database Nurture (Sphere) | `120244223736960698` | `120244224327800698` | $12 | OUTCOME_AWARENESS / REACH |
| Tier 2A — Bend Resident TOFU | `120244223739790698` | `120244224332950698` | $12 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 2B — West Bend 97703 Premium TOFU | `120244223741480698` | `120244224337020698` | $7 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 3 — Out-of-Area Absentee Owner | `120244223742330698` | `120244224340000698` | $5 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 4 — MOFU Retargeting (Sellers 180d) | `120244223743080698` | `120244224342140698` | $10 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |
| Tier 5 — BOFU Hot (Sellers 14d) | `120244223745230698` | `120244224344090698` | $3 | OUTCOME_LEADS / OFFSITE_CONVERSIONS |

All PAUSED. All `special_ad_categories: ['HOUSING']`. No creative attached. Total $49/day if fully activated.

**Prerequisite audiences created (built into the campaign script):**
- `AUD-CORE-Sellers-180d` → `120244223729930698` — pixel `1546878946032105`, seller-LP URLs, 180d, excludes Lead converters 365d
- `AUD-CORE-Sellers-14d` → `120244223730320698` — same URL filter, 14d window (BOFU hot)
- `AUD-CORE-Converters-365d` → `120244223731130698` — Lead event 365d, universal exclusion
- `AUD-LAL-1pct-Targetable` → `120244223731190698` — standard Lookalike (NOT yet wired into Tier 2A — Meta HOUSING blocks non-Special-Ad-Audience lookalikes; see "Known gaps" below)

**HOUSING Special Ad Category gotchas surfaced + fixed:**
- WCA `subtype: 'WEBSITE'` is removed in Marketing API v21.0 (rule.event_sources infers type)
- Campaign create needs `is_adset_budget_sharing_enabled: false` when using ad-set budgets (not CBO)
- Lookalikes for HOUSING must be created as "Special Ad Audience" flavor (UI-only path — standard `subtype: 'LOOKALIKE'` rejects on ad-set assignment)
- `frequency_control_specs` incompatible with `OFFSITE_CONVERSIONS` optimization goal
- HOUSING bans `excluded_geo_locations` entirely (#2909046) and most detailed-targeting interests (#2909049)
- Meta region keys verified via `/search?type=adgeolocation`: CA=3847, OR=3880, WA=3890

**Script idempotency hardened:** `findAdSet` now uses `effective_status IN [...]` filter (default endpoint hides PAUSED) AND throws on Meta API errors instead of silently returning null (which previously created dupes on rate-limit). 16 duplicate ad sets created during error recovery were programmatically deleted.

### Known gaps + next-up

1. **No creative attached.** Matt needs to (UI in Ads Manager):
   - Create Lead Forms for Tiers 2A/2B/3/4/5 (the Leads tiers) OR website conversion ads, then attach to each ad set
   - Attach awareness creatives (image/video) for Tier 1 (Sphere reach)
2. **Tier 2A runs broad** (geo + exclusions only, no interests / LAL). To layer interests, Matt picks HOUSING-eligible interest IDs in Ads Manager — most real-estate interests are blocked under Special Ad Category. To use the Lookalike, recreate it as a "Special Ad Audience" via the Meta UI (Audiences → Create → Lookalike → check the HOUSING flag).
3. **MLS audience sizes still show floor.** The 3 MLS audiences uploaded 2026-05-25 with name+address-only schema still display 1000-1000 floor. Re-probe 2026-05-28+ when matching settles. (The new FUB Targetable used email+phone hashes — already shows 1,300-1,500 within ~30 min.)
4. **No measurement loop yet.** Once Matt activates a tier, performance flows into `/admin/analytics/meta-health` dashboard. The weekly optimization routine (`docs/marketing/facebook-seller-growth-CLOUD_ROUTINE_PROMPT.md`) reads from there.

### Done previously (Cursor Agent, 2026-05-23 → 2026-05-26) — 16 commits

**Pages built:** `/admin/reports/lead-flow`, `/admin/reports/traffic-sources`, `/admin/analytics/meta-health`, `/admin/people`, `/admin/people/[fubPersonId]`.

**Scripts (all idempotent, --dry-run supported):**
- `scripts/ga4-admin-setup.mjs` — applied: Google Signals ENABLED, 4 new key events, retention 14mo, data-driven attribution
- `scripts/meta-admin-setup.mjs` + `scripts/meta-apply-fixes.mjs` — Meta audit + form-archive (archived "Home Valuation + Notes" with bogus questions)
- `scripts/meta-upload-mls-audiences.mjs` — **RUN 2026-05-25**: pushed 3 audiences from 9,058-owner MLS CSV
- `scripts/meta-rebuild-fub-audiences.mjs` — **NOT RUN** (awaiting green light)
- `scripts/gbp-set-utm-website.mjs` + `/api/admin/gbp/set-website-utm` — GBP Website URL updater (Matt set URL manually via GBP admin)

**Code wiring shipped:**
- 7 lead surfaces fire `canonicallyTagLead` + `fireLeadGenerated` server-side (ad-blocker resilient)
- `AnalyticsIdentityBridge.tsx` — sets GA4 `user_id` + Meta Pixel `em` advanced matching for every identified visitor
- `components/GoogleAnalytics.tsx` — full Consent Mode v2 (gtag('consent','default',{...denied}) + url_passthrough + ads_data_redaction)
- `/api/identity/me` endpoint returns hashed identity tokens
- `snapshot-channels` cron added to vercel.json

**Docs added:** `docs/GA4_USER_TRACKING_SETUP.md`, `docs/META_FIX_PLAN.md`, `docs/UTM_TRACKING_CONVENTION.md`.

**Resolved findings:**
- Dead pixel leak (`590593947302147`) — Matt killed the Zapier zap firing CAPI events through "Conversions API System User" (id 122166497978674230). Verified 74h zero fires.
- Lead-form privacy_policy "missing" was a false alarm — Meta exposes it via `?fields=legal_content` not `?fields=privacy_policy`. Both ACTIVE forms have valid privacy URL.

**Strategic decisions from Matt this session (carry forward):**
- TARGET his FUB database (sphere marketing), don't exclude it
- Realtor exclusion is hard-stop across every tier (same `HARD_STOP_TAGS` as `lib/canonical-lead-tagger.ts`)
- 97703 is the premium focus (West Bend / NW Crossing / Awbrey / Tetherow)
- Out-of-area absentee owners get their own tier
- GBP UTM convention: `utm_source=gbp&utm_medium=organic&utm_campaign=profile` (his choice, NOT `utm_source=google`)
- Skipped $700 BatchData skip-trace enrichment for now (accepts lower MLS audience match rate)
- Skipped GA4 Reporting Identity click + channel grouping override (deemed not blocking)

**Meta state verified via Graph API:**
- 3 new MLS audiences live, displaying `1000-1000` floor (privacy-rounded, sub-1000 actual matches expected for name+address-only schema)
- Page Access Token has `ads_management`, `business_management`, `pages_manage_ads`, plus 25 other scopes (verified via `debug_token`)
- Page is type=PAGE, `expires_at: 0` (never)

### Next agent should (Cursor or Claude Code)

1. `git pull --rebase origin main` and `npm run build` (should be green).
2. **The Meta side is now done** — 6 campaigns + 6 ad sets live and PAUSED. Matt's next move is in Ads Manager (attach creative + Lead Forms, then unpause).
3. **Pre-activation: Matt should verify (UI)** — open each campaign in Ads Manager, confirm targeting matches expectations, and decide whether to wire Tier 2A's Special Ad Audience LAL via UI (see "Known gaps" #2).
4. **Post-activation: weekly cycle** — once any tier is active, run the cloud routine (`docs/marketing/facebook-seller-growth-CLOUD_ROUTINE_PROMPT.md`) weekly. Performance flows into `/admin/analytics/meta-health`.
5. **Audience IDs (complete inventory after this session):**
   - `120244161522810698` — RR MLS — Bend Property Owners (all) 9,058 [from 2026-05-25]
   - `120244161526200698` — RR MLS — 97703 Property Owners 7,178
   - `120244161528410698` — RR MLS — Absentee Owners (Bend area) 1,619
   - `120244223033600698` — RR Database — Targetable 10,164 [new this session]
   - `120244223042110698` — RR FUB Hard-Stop Exclusion 3,023 [new this session]
   - `120244223729930698` — AUD-CORE-Sellers-180d (WCA) [new this session]
   - `120244223730320698` — AUD-CORE-Sellers-14d (WCA) [new this session]
   - `120244223731130698` — AUD-CORE-Converters-365d (WCA, universal exclusion) [new this session]
   - `120244223731190698` — AUD-LAL-1pct-Targetable (standard LAL — needs Special Ad Audience version for HOUSING) [new this session]
   - `120243107433010698` — FUB Suppression (legacy, pre-2026-05-23 — superseded by Hard-Stop above)

### Skills to read (paths)

- **MANDATORY**: `.auto-memory/memory_marketing_analytics_session_2026-05-26.md` (this session's full state)
- `.claude/skills/facebook-seller-growth/SKILL.md` — meta-rules + Cloud Routine prompt
- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` — canonical architecture
- `docs/META_FIX_PLAN.md` — Meta state + what's UI-only
- `docs/UTM_TRACKING_CONVENTION.md` — per-channel UTM spec including GBP
- `docs/MARKETING_LEAD_FLOW.md` — every lead-creation path

---

## History (optional; newest first)

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

