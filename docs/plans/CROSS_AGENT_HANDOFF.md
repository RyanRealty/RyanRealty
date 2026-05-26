# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Cursor Agent (Claude Opus, 2026-05-23 → 2026-05-26)** — Marketing analytics infrastructure + Meta retargeting audience build. |
| **Stopped at (UTC)** | 2026-05-26 13:05 — 3 MLS Custom Audiences pushed to Meta + dashboards/scripts live. Awaiting Matt's green light to (a) run the FUB-list rebuild and (b) build the 6 campaign shells. |
| **`main` @ commit** | `65fdd91` (Vercel production READY through whole chain). |
| **Task focus** | Wire every lead-capture surface to gold-standard, surface admin dashboards, set GA4 admin baseline via API, build Meta Custom Audiences from MLS export, design 6-tier retargeting campaign structure. |

### Done this session (Cursor Agent) — 16 commits

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

1. `git pull --rebase origin main` (latest commit `65fdd91`).
2. **Read `.auto-memory/memory_marketing_analytics_session_2026-05-26.md`** for the full session memory (audiences, IDs, decisions, designed-but-not-built spec).
3. **Re-probe Meta audience match status** — by now (24-72h after upload) the displayed sizes for the 3 RR MLS audiences should be settled. Run:
   ```bash
   vercel env pull /tmp/.env --environment=production --yes && set -a && source /tmp/.env && set +a
   node -e "fetch('https://graph.facebook.com/v21.0/act_'+process.env.META_AD_ACCOUNT_ID.replace(/^act_/,'')+'/customaudiences?fields=id,name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status&access_token='+process.env.META_PAGE_ACCESS_TOKEN).then(r=>r.json()).then(d=>console.log(JSON.stringify(d.data?.filter(a=>a.name.startsWith('RR MLS')), null, 2)))" && rm /tmp/.env
   ```
4. **Two pending tasks waiting on Matt's "go":**
   - Run `node scripts/meta-rebuild-fub-audiences.mjs` (30 sec) — creates Targetable + Hard-Stop audiences
   - Build the 6 campaign shells per spec in the memory file (~15 min, all via Meta Marketing API: `POST /act_X/campaigns` + `/adsets` with proper `targeting_spec` including the audience IDs in the memory file). Set `special_ad_categories: ['HOUSING']`. All paused, no creative attached.
5. **Audience IDs to reference when building campaigns:**
   - `120244161522810698` — RR MLS — Bend Property Owners (all)
   - `120244161526200698` — RR MLS — 97703 Property Owners
   - `120244161528410698` — RR MLS — Absentee Owners (Bend area)
   - `120243107433010698` — FUB Suppression (existing, pre-this-session)
   - After running rebuild: 2 more audience IDs returned by the script
6. **For new audiences needed for Tier 4/5:** create `AUD-CORE-Sellers-180d` (WCA, URL contains seller LP paths, exclude Lead converters) + `AUD-CORE-Converters-365d` (WCA, Lead event last 365d, used as universal exclusion) + `AUD-LAL-1pct-Targetable` (Special Ad Audience Lookalike of RR Database — Targetable).

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

