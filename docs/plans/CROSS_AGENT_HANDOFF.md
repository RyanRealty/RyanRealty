# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Claude Code (Opus 4.7, 2026-05-27 — late late session)** — Ryan Realty website rebuild · Wave 2 of `docs/EXECUTION_PLAN.md`. Continuous-execution mode per Matt's 2026-05-27 directive. |
| **`main` @ commit** | `c77cd28` — `feat(wave-2-l3): lift ActivityFeed onto primitives`. Pushed; Vercel auto-deploy. |
| **Task focus** | **Wave 2 Layers 1 + 2 + 3-lift-existing COMPLETE.** Hardened brand-voice + DAL boundary into real ESLint gates. All 8 existing homepage composition blocks now consume Wave 2 Layer 1 primitives (Hero, MarketSnapshot, PriceRangeTiles, OpenHousesGrid, CityGrid, ActivityFeed, CtaDuo, TeamSection). Brand-voice cleanup applied as each block was lifted. Listing detail page still broken on prod (React #310 in legacy showcase components) — fix lands when Wave 2 Layer 4 rebuilds those components. Next step: Wave 2 Layer 3 NEW blocks per plan §9 (HeroBlock unified, NeighborhoodMap, PriceChart, LeadCaptureBlock, BrokerCard, ContentSection, CTABar, BreadcrumbNav, FAQBlock, RelatedAreas, SocialProofBlock, TestimonialBlock), OR jump straight to Wave 2 Layer 4 (listing detail). |

### Today's session log (2026-05-27)

Started at `c7ad24a` (last commit of 2026-05-26). Eleven feature commits + one revert. Direction: forward through `EXECUTION_PLAN.md`.

| Commit | What landed |
|---|---|
| `f37caa3` | wave-0: ESLint Sentry-tracesSampleRate rule, lint-design-tokens retired-font + bgImage hero checks, lib/data/activity + leads stubs |
| `c93bbdd` | analytics: client-side bot filter in GoogleAnalytics.tsx |
| `b68db2c` | analytics: non-US country filter in middleware + GA + ga4-measurement-protocol |
| `b9b7f22` | analytics-ops: orphan Meta + GA4 scripts |
| `990e231` | wave-1.5: listing_detail_mv migration + getListingDetail DAL rewrite + refresh cron extension |
| **`74860bc`** | **revert: rolled back everything above (c7ad24a..HEAD) after the listing detail page kept rendering empty Suspense regions on prod.** MV stays in DB (harmless). The bug was diagnosed as React #310 in legacy `components/listing/showcase/*` — pre-existing, not caused by these commits. |
| `9907796` | wave-1.6: similar_listings_mv migration (75K rows over 7,224 active anchors) + `lib/data/listings/getSimilarListings.ts` + `app/api/cron/refresh-similar-listings/route.ts` (nightly 04:30 UTC) |
| `7bd1ce4` | wave-1.8: re-add activity + leads DAL stubs (5 NotImplementedError throws — signatures locked) |
| `5a02b6e` | wave-1.8: `lib/data/market/getPriceHistory.ts` (reads market_stats_cache, 6h cache window) |
| `cc2ee4e` | wave-2 L1: data primitives — Price/TabularNumber/PercentChange/DaysCount/Eyebrow/MiddleDot |
| `3de449d` | wave-2 L1: typography primitives — DisplayHeading/H1/H2/H3/Body/Caption |
| `e62983a` | wave-2 L1: layout primitives — Container/Section/Stack/Grid |
| `b4ed707` | wave-2 L1: brand primitives — Logo/RyanRealtyMark/JaxMascot + assets at `/public/brand/` |
| `93af50d` | wave-2 L1: CTA primitives — CTAButton/TextLink/IconButton/BadgePill **(Layer 1 complete: 21 primitives)** |
| `041d8f4` | wave-2 L2: MobileNav drawer (shadcn Sheet) + SiteHeader refactor onto new primitives |
| `8aa4475` | wave-2 L2: SiteFooter refactor onto primitives + extend TextLink (tone, weight, tel:/mailto) |
| `b0b8974` | wave-2 L1 fix: Stack primitive defaults to `items-start` to prevent flex-stretch regressions |
| `61f5580` | wave-2 L2: RootProvider consolidates ComparisonProvider + AnalyticsScripts + IdentityBridges + CookieConsentBanner; layout.tsx loses 25-import salad |
| `9a46f2f` | wave-2 L2: MetadataBlock + pageMetadata + lib/site/json-ld typed schema.org builder **(Layer 2 complete)** |

**DB side-effects unreverted (intentional, harmless):**
- `public.listing_detail_mv` materialized view + `refresh_listing_detail_mv()` function still in production. Nothing reads from them now. Will be re-adopted in Wave 3 when the listing detail page rebuilds.
- `public.similar_listings_mv` materialized view + `refresh_similar_listings_mv()` function — actively populated, ready for the new `getSimilarListings` DAL function (already shipped).
- `20260527010000_drop_unused_sync_tables.sql` migration from a parallel session — dropped tables can't be restored from a revert; harmless.

### Wave 1 / Wave 2 status

| Wave step | State |
|---|---|
| 1.1 ILIKE → EQ patch | ✅ pre-existing (page-render path uses `listing_tile_mv.city_lower` via `getListingTiles`) |
| 1.2 5 missing indexes | ✅ pre-existing |
| 1.3 `listing_tile_mv` | ✅ pre-existing; populated; hourly refresh wired |
| 1.4 `geo_snapshot_mv` | ✅ pre-existing; populated; hourly refresh wired |
| 1.5 `listing_detail_mv` | ⚠️ MV exists in DB; code reverted. Re-adopt when Wave 3 page rebuild needs it. |
| 1.6 `similar_listings_mv` | ✅ shipped today (`9907796`) |
| 1.7 MV refresh wiring | ✅ hourly `/api/cron/refresh-mvs` (tile + geo) + nightly `/api/cron/refresh-similar-listings` |
| 1.8 Remaining DAL functions | partial — `getPriceHistory` done; activity + leads stubbed; real implementations land per-page as Wave 3 needs them |
| 1.9 Page-migration to DAL | not yet started |
| **2 Layer 1** atomic primitives | ✅ **COMPLETE.** 21 primitives in `components/site/primitives/`: data (Price, TabularNumber, PercentChange, DaysCount, Eyebrow, MiddleDot), typography (DisplayHeading, H1, H2, H3, Body, Caption), layout (Container, Section, Stack, Grid), brand (Logo, RyanRealtyMark, JaxMascot), CTA (CTAButton, TextLink, IconButton, BadgePill). |
| **2 Layer 2** layout shell | ✅ **COMPLETE.** SiteHeader + MobileNav + SiteFooter refactored onto primitives. RootProvider consolidates analytics + identity + consent (`components/site/providers/`). MetadataBlock + pageMetadata + typed json-ld builder (`components/site/MetadataBlock.tsx`, `lib/site/page-metadata.ts`, `lib/site/json-ld.ts`). Stack primitive hardened to default `items-start`. |
| **2 Layer 3** LP composition | partial — all 8 existing homepage blocks lifted onto Wave 2 Layer 1 primitives + brand-voice cleaned (Hero, MarketSnapshot, PriceRangeTiles, OpenHousesGrid, CityGrid, ActivityFeed, CtaDuo, TeamSection). Remaining: the 12 NEW blocks per plan §9 Layer 3 (HeroBlock unified, NeighborhoodMap, PriceChart, LeadCaptureBlock, BrokerCard, ContentSection, CTABar, BreadcrumbNav, FAQBlock, RelatedAreas, SocialProofBlock, TestimonialBlock). |
| **2 Layer 4** listing detail surface | not yet started — **fixes the React #310 on the broken listing detail page** |
| **Guardrails** | ✅ brand-voice ESLint rule live at `error` level for user-facing JSX (`rr-brand-voice/no-violations`). DAL boundary `no-restricted-syntax` also at `error`. 189 + 51 baseline violations surfaced in `f47cb7e`'s commit body; PR-diff CI gate (`scripts/check-brand-voice.mjs`, `scripts/check-dal-boundary.mjs`) blocks net-new only. |

### Broken on prod right now

**Listing detail page** (`/homes-for-sale/<city>/<community>/<slug>` rewrites to `/listing/[listingKey]/page.tsx`). Symptoms:

- SSR responds 200 fast (~200ms TTFB) with the page shell + footer + correct `<title>` / OG metadata.
- `<main>` contains 5 EMPTY Suspense `<region>` elements that never resolve. The legacy `app/listing/[listingKey]/loading.tsx` skeleton sticks forever in the browser.
- Console error: **React #310 "Rendered more hooks than during the previous render"** in a `useMemo` call inside the bundled client tree.
- Affects every listing key. Older than 2026-05-27 (the revert above proved that).
- Cause is somewhere in `components/listing/showcase/*` or the `useGoogleMapsReady` / ListingDetailMapGoogle code path. Not narrowed further this session.

**Decision locked:** do NOT hunt the bug. Wave 3 deletes the entire legacy detail page tree and rebuilds with Wave 2 components. The plan calls for it. Hunting the useMemo violation is throwaway work.

### Continuous-execution directive (Matt's 2026-05-27 instruction)

> "I want you to work continuously. I also want you to start a new agent as soon as you get to about 90 percent of your context capacity."

Memory entry: [`feedback_continuous_work_and_handoff.md`](../../../.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_continuous_work_and_handoff.md).

Apply: do not ask Matt what to do next. The plan is the answer. Surface a question only when the plan is genuinely ambiguous or when a real-world signal contradicts it. At ~90% context: finish the in-flight commit, refresh THIS doc, spawn a fresh agent.

### Countermeasures locked (apply on every subsequent session)

1. **Brand-voice grep gate** — every drafted string scanned for em-dash, en-dash, semicolon, exclamation, banned words BEFORE it reaches Matt or a commit. Matt should never have to remind the agent.
2. **Verify before moving on** — every fix that affects a user-facing surface gets browser-rendered AND timely-loaded confirmation before "done." SQL EXPLAIN + green CI is necessary but not sufficient. Memory: [`feedback_verify_before_moving_on.md`](../../../.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_verify_before_moving_on.md).
3. **Mockup-per-route precondition** — agent refuses to touch a route without a mockup at `design_system/ryan-realty/ui_kits/<route>/index.html`. (15 mockups already exist for every planned route.)
4. **Delete legacy in the same commit** — when a route is rebuilt on Wave 2 primitives, legacy components only it used get `git rm`'d in the same commit. Directory line-count shrinks.
5. **Resume point in this block** — this Current block does NOT get overwritten by incident notes or concurrent FUB / Meta / SkySlope work. Pivots log under History.
6. **Push directly to main; pull-rebase + stash dance** — `git stash push` + `git pull --rebase origin main` + `git stash pop` + re-stage + commit + push. Don't try to be clever; the parallel changelog-bot commits will land in between.

### Next-step recommendation (for whoever picks up)

**Start here:**

1. **Wave 2 Layer 3 NEW blocks** (the existing 8 are already lifted). Add per plan §9 Layer 3: `<HeroBlock>` (unified version, supersedes Hero), `<NeighborhoodMap>` (dynamic-imported Google Maps with PostGIS polygon overlay), `<PriceChart>` (dynamic-imported recharts), `<LeadCaptureBlock>` (FUB-wired, 4 variants: buyer/seller/expired/inquiry), `<BrokerCard>` (transparent PNG, no rectangular frame), `<ContentSection>`, `<CTABar>`, `<BreadcrumbNav>`, `<FAQBlock>`, `<RelatedAreas>`, `<SocialProofBlock>`, `<TestimonialBlock>`. Each ships as its own commit. Use the lift commits from this session (`45508e5..c77cd28`) as the architecture template — Section + Container + Stack + Eyebrow + H2/Body for the chrome, format primitives (Price/TabularNumber/DaysCount/MiddleDot) for the data.
2. **Wave 2 Layer 4** (listing detail surface) — **THE BIG ONE.** This is where the React #310 bug evaporates because the legacy components get replaced. Build into `components/site/listing-detail/`: `ListingDetailShell`, `ListingVideoEmbed`, `PhotoGallery`, `PriceBlock`, `PropertySpecs`, `DescriptionBlock`, `ListingAgentCard`, `MortgageCalculator`, `SimilarListings` (uses the already-shipped `getSimilarListings` DAL fn), `PropertyHistory`, `OpenHouses`, `NeighborhoodMarketContext` (the Zillow beater), `PriceVsNeighborhoodPill`, `BendLifestylePanel`, `TextMattCTA`, `TransparentCMASummary`, `ClimateRiskBlock`.
3. **Wave 3 route 1**: `/` homepage swap to use the lifted Layer 3 blocks. Audit + delete legacy.
4. **Wave 3 route 2**: `/listing/[listingKey]` swap to Layer 4 components → 5 EMPTY regions become real content → **the broken page is fixed.** Same commit also `git rm`'s `components/listing/showcase/*` per the locked discipline.

**Quick wins available in parallel (independent of Wave 2 progression):**

- Implement the activity + leads DAL stubs (`getRecentActivity`, `subscribeActivity`, `createBuyerLead`, `createSellerLead`, `createExpiredLead`). Existing inline FUB-creation logic in `app/lp/seller-home-value/page.tsx` and `app/lp/expired-listing/page.tsx` is the model — lift to the canonical DAL function, then migrate the page imports.
- Build `getMarketReport(slug)` DAL function (plan §4) — needed by `/housing-market/reports/[slug]`.
- Lift the homepage v2 composition blocks (`MarketSnapshot`, `Hero`, `PriceRangeTiles`, etc.) to use new primitives — small commits, no functional change, just style alignment.

### Key file paths

- Plan source: [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md)
- Mockups: [`design_system/ryan-realty/ui_kits/website/index.html`](../../design_system/ryan-realty/ui_kits/website/index.html) (homepage, locked reference) + 14 other route mockups in the same directory.
- DAL: [`lib/data/`](../../lib/data/) — every new function exported from `lib/data/index.ts`. ESLint + `scripts/check-dal-boundary.mjs` enforce no raw `.from('listings')` outside this dir.
- Primitives: [`components/site/primitives/`](../../components/site/primitives/) (just landed today, 15 components).
- Existing composition blocks: [`components/site/`](../../components/site/) (homepage v2 components from yesterday's session).
- Broken legacy surface: [`components/listing/showcase/`](../../components/listing/showcase/) + [`app/listing/[listingKey]/page.tsx`](../../app/listing/[listingKey]/page.tsx) — DO NOT TOUCH, will be deleted in Wave 3.
- Memory: `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/MEMORY.md`

### What this session shipped (Wave 2 Layer 2 + Layer 3 lift + guardrails)

Layer 2 completion:
- **`8aa4475`** — SiteFooter onto primitives + extend TextLink (tone `primary|on-navy|muted`, weight, tel/mailto handling)
- **`b0b8974`** — Stack primitive defaults to `items-start`; SiteFooter brand column drops the now-redundant override
- **`61f5580`** — RootProvider consolidates ComparisonProvider + AnalyticsScripts + IdentityBridges + CookieConsentBanner
- **`9a46f2f`** — MetadataBlock + pageMetadata + typed json-ld builder

Guardrails (locked enforcement):
- **`f47cb7e`** — `feat(guardrails): brand-voice ESLint rule + DAL boundary flipped to error`. Custom plugin `rr-brand-voice/no-violations` blocks em-dash, en-dash, semicolon, exclamation, and the §6.2 banned-word list inside JSX text + string-literal JSX attribute values. Standalone "—" stays allowed as a data placeholder. 6 valid + 10 invalid RuleTester cases pass. DAL boundary `no-restricted-syntax` flipped from warn to error. Lint now surfaces 189 brand-voice errors across user-facing surfaces + 51 DAL errors in `scripts/` + 1 in `data/` — these are documented in the commit body, not blocking; production builds pass because the gate is per-PR-diff, not per-baseline.

Layer 3 lift-existing run (all 8 homepage composition blocks consume primitives + are brand-voice clean):
- **`45508e5`** — MarketSnapshot: Section/Container/Stack/Eyebrow/H2/Body + Price/TabularNumber/DaysCount; retired ad-hoc fmtMoneyRound1k/fmtInt helpers
- **`3a86684`** — CtaDuo + brand-voice cleanup: "Thinking about selling?" → "Considering a sale?", em-dash retired
- **`ec36e8e`** — TeamSection: Section/Container/Stack/Eyebrow/H2/Body/CTAButton
- **`6f4196f`** — PriceRangeTiles + en-dash cleanup: "$600k – $900k" → "$600k to $900k", "luxury homes" → "larger homes and estates"
- **`aba1c9b`** — CityGrid: Price + TabularNumber + MiddleDot for the per-city stat lines
- **`cb6022f`** — OpenHousesGrid + en-dash cleanup in formatted badge strings (open-house time-range now uses hyphen)
- **`f89f344`** — Hero + em-dash cleanup in lede + photo alt; DisplayHeading owns the H1
- **`c77cd28`** — ActivityFeed: Price + MiddleDot for the activity rows; retired fmtPrice helper

### Earlier session work (pre Layer 2 completion)

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

