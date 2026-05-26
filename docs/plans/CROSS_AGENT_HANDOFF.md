# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Claude Code (Opus 4.7, 2026-05-26)** — Ryan Realty website rebuild · Waves 2–4 of `docs/EXECUTION_PLAN.md`. |
| **`main` @ commit** | `e4da62c` — `homepage: full v2 rebuild on the mockup, legacy torn out`. Pushed; Vercel auto-deploy. |
| **Task focus** | Visual rebuild per `design_system/ryan-realty/ui_kits/website/index.html`. Homepage v2 shipped today. 13 other LP routes still on legacy + need their own mockups before code touches them. |

### Rebuild status (countermeasure #5 — never let this block get overwritten)

**Stage:** Wave 2 (visual layer) — section-by-section per mockup. Atoms/composition discipline dropped per Matt's "forget shadcn" + "redo the home page entirely" directive on 2026-05-26. New components live raw in `components/site/` translating the mockup HTML directly.

**Routes shipped:**

| Route | Mockup | Status | Commit |
|---|---|---|---|
| `/` | `design_system/ryan-realty/ui_kits/website/index.html` | **✅ Live** — 8 mockup sections, real data | `e4da62c` |

**Routes blocked on mockup:** `/listing/[listingKey]`, `/cities/[slug]`, `/cities/[slug]/[neighborhoodSlug]`, `/communities/[slug]`, `/zip/[zip]`, `/lp/seller-home-value`, `/lp/buyer-listing-alerts`, `/lp/expired-listing`, `/housing-market/reports/[slug]`, `/search`, `/sell`, `/about`, `/team`. **No code touches an unmocked route — Matt produces mockups via the Claude Design flow first.**

**Components built (`components/site/`):** SiteHeader, SiteFooter, Hero, MarketSnapshot, PriceRangeTiles, OpenHousesGrid, CityGrid, TeamSection, ActivityFeed, CtaDuo, ListingCard. Reusable where the mockups carry the same patterns.

**Legacy still in tree:** `components/home/BrokerageListingsSlider.tsx` (used by `/team`) + `components/home/HomeTileCard.tsx` (used by 5 listings-grid routes). Both go when their consumer routes rebuild.

**Open data-state notes:**
- `OpenHousesGrid` returns null when `getOpenHousesWithListings()` is empty — by design, no empty-state placeholder.
- `ActivityFeed` is static-from-SSR for now; realtime subscription is a follow-up commit.
- Statement-timeout errors on `getListingTiles` in dev are environmental (Supabase pooler under load locally) — production unaffected, sections return null gracefully.

### Countermeasures locked 2026-05-26 (apply on every subsequent session)

1. **Visual gate** — every route commit attaches a rendered screenshot vs the mockup section. SITE_SPEC `[x]` traces reference screenshot file paths, not code constructs. No screenshot, no merge.
2. **Mockup-per-route precondition** — agent refuses to touch a route without a mockup at `design_system/ryan-realty/ui_kits/<route>/index.html`.
3. **Atoms-first, no "deferred" patterns** — Wave 2 components ship complete or not at all. No `[~]` "mitigation" rows in SITE_SPEC.
4. **Delete legacy in the same commit** — when a route is rebuilt, legacy components only it used get `git rm`'d in the same commit. Discipline: directory line-count shrinks.
5. **Resume point in this block** — this Rebuild status table doesn't get overwritten by CF-522 incidents or Meta-ads / SkySlope / FUB concurrent work. Pivots log under "Concurrent work" elsewhere.

### Next-step recommendation (for whoever picks up)

1. Matt produces the next route mockup in the Claude Design project — recommended order: `/listing/[listingKey]` (the Zillow Showcase beater per EXECUTION_PLAN §8) → `/cities/[slug]` → `/communities/[slug]`.
2. Bundle exports via the Anthropic design URL → applied via `codebase-patches/APPLY.md`.
3. Agent rebuilds the route on the new mockup using the existing `components/site/` primitives where they fit; adds new ones where the route needs them. Same atomic / delete-as-replace / screenshot discipline.

### What this session shipped

- **Verified the smart list API limitation against live FUB.** `GET /v1/smartLists/{id}?fields=<conditions|criteria|filters|rules|filter|query|definition|segments|tags>` all return HTTP 400 "Invalid field(s) in the fields parameter". None of those filter-shaped fields exist on the endpoint. The existing `scripts/westside-bend-fub-smart-lists.mjs --apply` PUT gets 200 but the conditions never persist. `GET /v1/people?smartListId=N` always returns 13,278 (full DB) regardless of N. Matches prior finding in `docs/FUB_CLEANUP_FINAL_2026-05-17.md` ("POST /v1/smartLists returns 500 — undocumented schema issue. Smart lists also have to be built in the UI").
- **Tag-count audit of `out/westside-bend-merge/05-fub-import.csv` (7,765 rows).** Captured every unique tag's count so the runbook can give Matt expected counts to verify against post-import. Top tags: `import:westside-2026-05` = 7,765, `area:bend-westside` = 7,765, `equity:high` = 3,832, `seller-score:warm` = 3,023, `seller-score:cool` = 2,541, `seller-score:hot` = 340, `geo:out-of-state` = 813, `lifecycle:rate-locked` = 990, `contact:needs-enrichment` = 4,993, `industry:realtor` = 240.
- **Drafted [`docs/broker-runbooks/westside-fub-smart-lists-setup.md`](../broker-runbooks/westside-fub-smart-lists-setup.md).** Models the existing `neighborhood-lists-finalize.md` format Matt already knows. Three tiers (immediate / industry / post-BatchData), per-list flow at ~60s each, mandatory 8-rule realtor + compliance exclude group (7 tag excludes + 1 stage exclude), expected count column, post-wiring verification step, sharing + collection setup. Not committed.

### Next-step recommendation (for whoever picks up)

1. Matt reviews `docs/broker-runbooks/westside-fub-smart-lists-setup.md`. If approved → commit + ship.
2. Matt or Rebecca works the runbook in FUB UI (~20 min). Sharing flip + collection grouping at the end.
3. Independently, Matt decides on BatchData funding. If yes → run `node --env-file=.env.local scripts/westside-bend-enrich-batchdata.mjs --apply` → rebuild import CSV → re-surface for import.
4. Test contact id 22101 ("Westside ImportTest") still in FUB. Ask Matt before deleting.
5. CRM import is still gated on Matt's explicit "import" / "push" / "ship it" before either CSV upload OR `scripts/westside-bend-fub-push.mjs --apply` can run.

### Skills + canonical references for this surface area

- [`out/westside-bend-merge/STRATEGY.md`](../../out/westside-bend-merge/STRATEGY.md) — pipeline strategy
- [`out/westside-bend-merge/research-03-fub-taxonomy.md`](../../out/westside-bend-merge/research-03-fub-taxonomy.md) — tag taxonomy decisions
- [`docs/FUB_SMART_LISTS_STARTER_PACK.md`](../FUB_SMART_LISTS_STARTER_PACK.md) — earlier list inventory + the mandatory-realtor-exclude rule (Matt 2026-05-17 directive)
- [`docs/FUB_CLEANUP_FINAL_2026-05-17.md`](../FUB_CLEANUP_FINAL_2026-05-17.md) — prior finding that smart list API doesn't support filters
- [`docs/broker-runbooks/neighborhood-lists-finalize.md`](../broker-runbooks/neighborhood-lists-finalize.md) — the format pattern Matt knows
- [`scripts/westside-bend-fub-smart-lists.mjs`](../../scripts/westside-bend-fub-smart-lists.mjs) — provision script (creates shells fine, filters silently drop — see runbook for the why)

---

## History (optional; newest first)

### 2026-05-26 — Cursor (Opus 4.7) — DB death-spiral RCA + permanent fix (CF-522 #2)

- Surface / commits: `9ff9974` (emergency cron strip), `019713f` (3 migrations + cron stagger), `7114af9` (pg_cron path cap). All live, Vercel READY, DB healthy at 95-110s steady-state pipeline runs.
- **Incident:** 2026-05-26 13:00–14:02 UTC. Every Supabase REST/Auth/SQL request returned CF-522 after 19.7s. Required dashboard "Restart project" to recover. Identical pattern to 2026-05-24 22:30 UTC.
- **Root cause:** (1) `service_role` had no `statement_timeout`, inheriting 10-minute Postgres default; (2) `refresh_market_pulse()` + 2 MV refresh RPCs had no advisory lock so overlapping `sync-delta` runs piled on the connection pool; (3) 9 Vercel crons all fired at minute 0 + the `post_sync_pipeline_15min` pg_cron job ran as `postgres` superuser, bypassing any role-level cap.
- **Fix applied to hosted DB:** advisory locks `7101/7102/7103/hashtext` on the four heavy RPCs, `statement_timeout=120s/lock_timeout=30s` on `service_role`, `statement_timeout=240s` on `run_post_sync_pipeline()`, all Vercel crons staggered (nothing at minute 0). Full live config table + forensic timeline + "what Claude Code should know going forward" lived in this Current block from 2026-05-26 13:35–16:30 UTC — see commit `7114af9` body + the 4 migration files in `supabase/migrations/` (`20260526140409`, `20260526140535`, `20260526140554`, `20260526142020`) for the durable record.
- **Lesson locked in `.cursor/rules/production-parity.mdc` + `.cursor/rules/supabase-migrations-auto.mdc`:** the 5/24 commit `200c1a5` shipped a SQL file with "needs to apply when DB recovers" in the body — and then never got applied, which made 5/26 a repeat. Migrations must be applied in the same delivery as the code that depends on them; saved-but-unapplied SQL is a known failure mode.

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

