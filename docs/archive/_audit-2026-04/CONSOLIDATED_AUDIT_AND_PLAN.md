# Ryan Realty — Consolidated Audit & Improvement Plan

**Generated**: 2026-04-02
**Scope**: Cross-reference of all planning documents, codebase audit, contradiction resolution, consolidation opportunities, and gap analysis
**Documents reviewed**: `CLAUDE.md`, `docs/plans/master-plan.md`, `docs/plans/PRODUCT_SPEC_V2.md`, `docs/NEXT_SESSION_BRIEF.md`, `docs/plans/phase-0-brief.md` through `phase-3-brief.md`, `docs/plans/task-registry.json`, `docs/plans/continuous-improvement.md`, `docs/plans/USER_JOURNEYS.md`, `docs/FEATURES.md`, `docs/LAUNCH_CHECKLIST.md`, `docs/WHAT_I_NEED_TO_COMPLETE.md`, `docs/DOCUMENTATION_INDEX.md`, `CHANGELOG.md`

---

## Part 1: Document Contradictions

These are places where planning documents contradict each other or where the documents contradict the actual state of the code.

### C-1: Task Registry Says 100% Complete — Code Says Otherwise

**The contradiction**: `docs/plans/task-registry.json` (v2.0, 2026-03-30) marks all 36 tasks as `"status": "complete"`, and `docs/plans/continuous-improvement.md` confirms "36/36 complete, 0 open." However, `PRODUCT_SPEC_V2.md` (also dated 2026-03-30) lists the same features with `❌ MISSING` and `⚠️ PARTIAL` markers that contradict the registry.

**Specific conflicts**:

| Task ID | Registry Status | PRODUCT_SPEC_V2 Status | Actual Code |
|---------|----------------|------------------------|-------------|
| T1-001 (sitemap) | complete | `❌ BROKEN — Returns 404` (line 206) | `app/sitemap.ts` exists with `fetchAllRows()` pagination. PR #15 fixed this. The spec was not updated. |
| T1-004 (AI crawlers) | complete | `❌ MISSING` (line 211) | `app/robots.ts` exists. Need to verify it allows GPTBot et al. |
| T2-001 (draw-on-map) | complete | `❌ MISSING` (line 262) | `SearchMapClustered.tsx` has polygon drawing code. Component exists but spec says missing. |
| T2-002 (Walk Score) | complete | `❌ MISSING` (line 263) | `components/listing/WalkScore.tsx` exists. |
| T2-003 (Schools) | complete | `❌ MISSING` (line 264) | Needs verification — no `SchoolInfo.tsx` or similar found in a prior search. |
| T3-001 (Tax history) | complete | Listed as missing (line 268) | `components/listing/TaxHistory.tsx` exists per NEXT_SESSION_BRIEF line 71. |
| T3-002 (Climate risk) | complete | Listed as missing (line 269) | `components/listing/ClimateRisk.tsx` exists. |
| T3-004 (Speed-to-lead) | complete | Listed as missing (line 272) | `app/actions/auto-response.ts` exists. |
| T3-005 (Lead scoring) | complete | Listed as missing (line 273) | `lib/lead-scoring.ts` exists with tests. |
| T3-006 (Shared collections) | complete | Listed as missing (line 274) | `shared_collections` table was *dropped* in migration `20260330100006_drop_unused_tables.sql` as "created but never wired." |
| T3-007 (Notes on homes) | complete | Listed as missing (line 275) | Needs verification. |

**Resolution**: The task registry was updated *after* implementation work, but `PRODUCT_SPEC_V2.md` was never synced with the registry. **The spec's "missing" markers are stale.** However, T3-006 (shared collections) deserves scrutiny — if the table was dropped as unused, the feature isn't actually complete regardless of what the registry says.

**Action required**:
1. Update `PRODUCT_SPEC_V2.md` Section 3 tables to reflect current reality.
2. Audit T3-006 (shared collections) and T3-007 (notes on homes) — verify they actually work end-to-end.
3. Add a `lastVerified` date field to each task in `task-registry.json`.

---

### C-2: Master Plan Says Phase 0 Is Current — Everything Else Says All Phases Done

**The contradiction**: `docs/plans/master-plan.md` line 4: `**Current Phase**: Phase 0 (Critical Fixes)`. But `task-registry.json` and `continuous-improvement.md` show 100% completion across all tiers. The CHANGELOG documents work through v1.0.15 covering features from all phases.

**Resolution**: The master plan header was never updated after Phase 0 completed. The canonical status is the task registry (all phases done).

**Action required**: Update `master-plan.md` line 4 to `**Current Phase**: All phases complete. See task-registry.json for status.`

---

### C-3: Master Plan CR-5 Forbids `getCityMarketStats` — Code Still Uses It

**The contradiction**: Master plan CR-5 (line 59-60) states: *"Do NOT use old `getCityMarketStats()` functions."* However, `app/actions/market-stats.ts` still exports and is imported by multiple page files.

**Files still importing legacy functions** (based on grep for `getCityMarketStats|getLiveMarketPulse|getCachedStats`):
- `app/search/[...slug]/page.tsx`
- `app/listing/[listingKey]/page.tsx`
- `app/listings/[listingKey]/page.tsx`
- `app/housing-market/[...slug]/page.tsx`
- `app/communities/[slug]/page.tsx`
- `app/cities/[slug]/page.tsx`

**Resolution**: The new functions (`getLiveMarketPulse`, `getCachedStats`) coexist with the old ones in the same file. Pages may be using a mix of old and new. A full migration was planned in the master plan (Phase 2 switches consumers, Phase 3 deprecates old RPCs) but the status tracking claims all phases are done.

**Action required**:
1. Grep every page for `getCityMarketStats` — if still called, either complete the migration or update the plan to acknowledge it as deferred.
2. If old functions are kept, remove the CR-5 prohibition or add a deprecation notice.

---

### C-4: FEATURES.md Is 13 Months Out of Date

**The contradiction**: `docs/FEATURES.md` header says `Last updated: March 2025`. The codebase is dated April 2026. The document describes a much earlier version of the product — it references `/listings/template`, basic auth flows, and the old `/reports/` routes that have since been redirected to `/housing-market/`.

**Resolution**: This document is unmaintained and misleading. Anyone reading it would get a drastically incomplete picture.

**Action required**: Either rewrite `FEATURES.md` to reflect the current product, or delete it and point readers to `PRODUCT_SPEC_V2.md` + `task-registry.json`.

---

### C-5: Master Plan Defers Sentry to Phase 4 — Sentry Is Already Installed

**The contradiction**: Master plan Gap Mitigation #12 (line 128): *"Defer Sentry to Phase 4; use Vercel Analytics + GA4 until then."* But `@sentry/nextjs` v10.42.0 is in `package.json`, `app/error.tsx` integrates with Sentry, and Sentry instrumentation exists.

**Resolution**: Sentry was added during implementation, ahead of the plan's schedule.

**Action required**: Update Gap #12 to reflect that Sentry is installed and active. Note that the DSN may still need configuration per `PRODUCT_SPEC_V2.md` line 245.

---

### C-6: Master Plan Says Email Alerts Deferred — Cron Job Exists

**The contradiction**: Master plan Gap #21 (line 135): *"Defer email provider integration to Phase 4."* But `app/api/cron/saved-search-alerts/route.ts` exists and `resend` is a production dependency, suggesting saved search email alerts are implemented.

**Resolution**: Email alerts were built using Resend, ahead of the plan. The gap is closed.

**Action required**: Mark Gap #21 as resolved.

---

### C-7: NEXT_SESSION_BRIEF Says 0 Rows in Key Tables — Task Registry Says Features Complete

**The contradiction**: `docs/NEXT_SESSION_BRIEF.md` (dated April 2, 2026) lines 62-65:
- `open_houses` table: **0 rows**
- `listing_agents` table: **0 rows**
- `listing_videos` table: **0 rows**

Yet `task-registry.json` marks video features (T2 tier, implicitly through engagement tasks) as complete, and the master plan Phase 0.3 specifically targets `listing_videos` population.

**Resolution**: The code for these features exists, but the data pipeline hasn't populated the tables. This is a data problem, not a code problem. However, calling these features "complete" when they render empty is misleading.

**Action required**:
1. Add a "data dependency" field to task registry entries.
2. Create a distinct status: `code_complete_awaiting_data` for features that are built but have no data.
3. Document which features are blocked on MLS data availability vs. code.

---

### C-8: Programmatic Filter Pages — Planned in Phase 3 But Config File Missing

**The contradiction**: Master plan Phase 3.3 specs ~120-170 programmatic filter pages (e.g., `/search/bend/under-300k`). `PRODUCT_SPEC_V2.md` line 204 says: *"Route handling exists in search page but `lib/filter-pages.ts` config MISSING."* Task T2-008 in registry says "Programmatic filter pages config" is complete.

**Code reality**: Grepping for `filter-pages|filterPages` in lib/ returns **zero files**. The only mention is in `task-registry.json` itself.

**Resolution**: The task was marked complete but the config file doesn't exist. The search page's `[...slug]` catch-all can handle these routes dynamically, so the "config" may have been implemented as slug-parsing logic rather than a discrete file. Needs verification.

**Action required**: Either create `lib/filter-pages.ts` with the 17 filter types and page configs as planned, or document that the approach changed and filter pages are handled purely through slug parsing.

---

### C-9: SMS Alerts — Task Complete But Schema Missing

**The contradiction**: Task T4-007 (Instant property alert SMS) is marked complete. However:
- `app/actions/sms-alerts.ts` references `sms_enabled` and `sms_phone` columns that don't exist in any migration.
- Code gracefully catches the column-missing error (line 43-45) and returns "SMS alerts are being set up."
- Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) are not in `lib/env.ts` validation.

**Resolution**: This is a stub, not a complete feature. The task should be marked as code-scaffolded but not functional.

**Action required**:
1. Create migration adding `sms_enabled` and `sms_phone` to `saved_searches`.
2. Add Twilio credentials to `lib/env.ts` and `docs/LAUNCH_CHECKLIST.md`.
3. Update task registry status honestly.

---

### C-10: `/reports/` Route — Conflicting Redirect Targets

**The contradiction**: Master plan CR-7 (line 66) says `/reports/` will redirect to `/housing-market/reports/`. But `next.config.ts` redirects are: `/reports` → `/housing-market`. The sub-path `/reports/:slug` redirects to `/housing-market/reports/:slug`.

**Resolution**: The base `/reports/` redirects to the housing-market hub (not `/housing-market/reports/`). This may be intentional, but it contradicts CR-7's specific wording.

**Action required**: Clarify whether `/reports/` should go to `/housing-market/` (hub) or `/housing-market/reports/` (reports index). Update CR-7 to match `next.config.ts`.

---

## Part 2: Code Consolidation Opportunities

### D-1: Duplicate Property Type Functions (CRITICAL)

**Files**: `lib/property-type.ts` and `lib/property-type-labels.ts`

Both export a `getPropertyTypeLabel()` function. One maps MLS codes (SFR → "Single Family Residential"), the other maps raw text to categories. These should be a single module.

**Action**: Merge into `lib/property-type.ts`. Export both `getPropertyTypeLabel()` (for display) and `getPropertyTypeCategory()` (for filtering). Delete `property-type-labels.ts`.

---

### D-2: Duplicate Slug Functions (HIGH)

**Files**: `lib/slug.ts` exports `slugify()`. `lib/listing-processor.ts` has an identical `toSlug()`.

Both do: `.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')`

**Action**: Remove `toSlug()` from `listing-processor.ts`, import `slugify` from `lib/slug.ts`.

---

### D-3: Duplicate PDF Template Code (HIGH)

**Files**: `lib/pdf/cma-pdf.tsx`, `lib/pdf/listing-pdf.tsx`, `lib/pdf/comparison-pdf.tsx`, `lib/pdf/report-pdf.tsx`

All share: identical navy bar style (`#102742`), identical `logoText` styling, identical `formatPrice()` function, identical footer layout.

**Action**: Create `lib/pdf/shared.ts` with:
- `pdfStyles` (shared StyleSheet)
- `PDFHeader` component
- `PDFFooter` component
- `formatPrice()`, `formatDate()` formatters

Estimated reduction: ~200 lines.

---

### D-4: Duplicate Listing Tile Sections (HIGH)

**Files**: `components/home/FeaturedListings.tsx`, `components/home/JustListed.tsx`, `components/home/TrendingListings.tsx`

All three: map over listings, calculate monthly payment, render `TilesSliderItem` → `HomeTileCard` with identical prop structures.

**Action**: Create `components/home/ListingTilesSection.tsx` that accepts `listings`, `title`, `headerRight?`, `trackingCategory?`. All three files become thin wrappers (~15 lines each instead of ~100).

Estimated reduction: ~200 lines.

---

### D-5: Content Normalization Duplication (MEDIUM)

**Files**: `lib/city-content.ts` and `lib/community-content.ts`

Both implement identical `normalizeKey()` functions (`name.trim().toLowerCase()`), similar content record structures, and similar lookup patterns.

**Action**: Extract `lib/content-lookup.ts` with a generic `ContentStore<T>` class that handles normalization, lookup, and fallback. Both city and community content become instances.

---

### D-6: Supabase Client Re-initialization (MEDIUM)

**Files**: `lib/activity-tracker.ts` creates its own Supabase client with raw `createClient()` instead of using `lib/supabase/server.ts` or `lib/supabase/service.ts`.

Similarly, `app/api/admin/sync/live/route.ts` manually creates a service client instead of using `createServiceClient()`.

**Action**: Replace both with imports from the existing Supabase factory modules.

---

### D-7: Tracking/Analytics Event Fragmentation (MEDIUM)

**Files**: `lib/tracking.ts` (GA4), `lib/meta-pixel.ts` (Meta client), `lib/meta-capi.ts` (Meta server), `lib/activity-tracker.ts` (DB), `lib/cta-tracking.ts` (combined), `lib/lead-scoring.ts` (scoring), `lib/visitor.ts` (cookies)

Events are fired individually to each platform. Adding a new event means touching 3-4 files.

**Action**: Create `lib/event-bus.ts` — a central dispatcher. Components call `emitEvent('listing_view', payload)` once; the bus routes to GA4, Meta Pixel, activity tracker, and lead scoring automatically. This is a larger refactor but would dramatically simplify future event additions.

---

### D-8: Admin Pages — Raw HTML vs shadcn/ui (per CLAUDE.md)

**Files violating CLAUDE.md**:
- `app/admin/(protected)/listings/page.tsx` — raw `<select>` (line 62)
- `app/admin/(protected)/geo/AssignCommunity.tsx` — raw `<select>` (lines 44, 57)
- `app/admin/(protected)/geo/NeighborhoodForm.tsx` — raw `<select>` (line 54)
- `app/admin/(protected)/geo/area-guide-upload/AreaGuideUploadClient.tsx` — raw `<input>`, `<button>`, `<table>` (lines 147, 157, 178, 204, 212)
- `app/admin/(protected)/reports/CityReportSection.tsx` — raw `<select>` (lines 180, 203, 216, 242, 267)
- `app/admin/(protected)/reports/custom/CustomReportBuilder.tsx` — raw `<select>` (lines 211, 225, 274)
- `components/admin/AdminUsersList.tsx` — raw `<select>` (lines 97, 113)
- `components/admin/AdminBrokerForm.tsx` — raw `<select>` (lines 724, 879, 965)

**Action**: Replace all raw HTML form elements with their shadcn/ui equivalents (`Select`, `Input`, `Button`, `Table`). Use `cn()` for conditional classes throughout. This is mandated by CLAUDE.md.

---

### D-9: Template Literal className Concatenation

**~30+ files** use `` className={`... ${condition ? 'a' : 'b'}`} `` instead of `cn()`. Concentrated in:
- Admin sync pages (SyncTerminalYearlyBreakdown, SyncHistoryStatus, SyncHeavyStatusSections, SyncButton, SyncLiveStatusAndTerminal, SyncStatus, FullSync)
- Admin site-page editors (SiteLogoForm, TeamImageForm, HeroMediaForm, SitePageEditor)
- Public pages (blog/page.tsx, search/[...slug]/page.tsx)
- Admin broker forms (AdminBrokerForm, AdminBrokerCreateForm, AdminSidebar)

**Action**: Replace all instances with `cn()` from `@/lib/utils`. This is a mechanical find-and-replace that can be done file by file.

---

## Part 3: Feature Gaps — Planned But Unspecced or Unimplemented

### G-1: Blog Scheduled Publishing (Infrastructure Without Execution)

**Migration**: `20260401120000_blog_scheduled_publishing.sql` creates `blog_settings` table and `scheduled_at` column on blog posts.

**What's missing**:
- No cron job to check `scheduled_at` and publish posts
- No admin UI to set a scheduled publish date
- No `blog_settings` admin interface

**Action**: Add a `publish-scheduled-posts` check to an existing cron (e.g., `sync-full` post-hook), or create a lightweight `api/cron/publish-scheduled` route. Add a date picker to the blog admin form.

---

### G-2: Event Table Cleanup (Orphaned Function)

**Migration**: `20260330100005_event_table_cleanup.sql` defines `cleanup_old_events()` to prune `listing_views`, `visits`, and `user_events`.

**What's missing**: No cron or scheduled task calls this function. Event tables will grow unbounded.

**Action**: Add a monthly cron that calls `SELECT cleanup_old_events()`, or integrate it into the `sync-full` post-hook.

---

### G-3: Partnership Revenue Dashboard (Tables Without UI)

**Tables**: `partner_programs`, `partner_referrals`, `revenue_events` (migration `20260326152000`).

**What exists**: `app/actions/partnership-revenue.ts` can insert records.

**What's missing**: No admin dashboard to view partner referrals, track revenue, or manage programs.

**Action**: Add a panel to the admin dashboard, or create `app/admin/(protected)/partnerships/page.tsx`.

---

### G-4: Broker External Profile Fields (Collected, Not Displayed)

**Migration**: `20260420120000_broker_external_profile_fields.sql` adds `social_x`, `zillow_id`, `realtor_id`, `yelp_id`, `google_business_id`, `mls_id`.

**What exists**: Admin broker form collects these values.

**What's missing**: Public broker profile pages (`/team/[slug]`) don't display social links, Zillow profiles, or external IDs.

**Action**: Add a "Find [broker] on" section to the broker profile page with icons/links for each populated external profile.

---

### G-5: XAI/Grok Integration (Used, Not Validated)

**Files**: `lib/grok-text.ts`, `lib/grok-image.ts`, `lib/grok-video.ts`, `app/api/ai/chat/route.ts`, `app/api/ai/generate-text/route.ts`

**What's missing**: `XAI_API_KEY` is not in `lib/env.ts` validation. If the key is missing, AI features will silently fail or throw unhandled errors.

**Action**: Add `XAI_API_KEY` to the optional runtime section of `lib/env.ts`. Add graceful fallback in AI routes when key is absent.

---

### G-6: CRON_SECRET Not Validated

**Usage**: All cron routes check `Authorization: Bearer ${CRON_SECRET}` to prevent unauthorized triggers.

**What's missing**: `CRON_SECRET` is not in `lib/env.ts`. If unset, all crons either fail silently or are unprotected.

**Action**: Add `CRON_SECRET` to `lib/env.ts` required runtime variables.

---

### G-7: Vendor Marketplace (Named, Never Planned)

**Reference**: `PRODUCT_SPEC_V2.md` line 29: *"Vendor marketplace — Local service provider directory (future)"* listed as Revenue Stream #5.

**What exists**: Nothing — no tables, no routes, no components, no phase brief.

**Action**: Either add to Phase 6 backlog with a rough spec, or remove from the revenue streams list until it's actually planned.

---

### G-8: A/B Testing (Permanently Deferred)

**Reference**: Master plan Gap #7 (line 123): *"Defer formal A/B; use GA4 event comparison."*

No A/B framework was ever specced. With 36 tasks "complete" and all phases done, this was never addressed.

**Action**: If A/B testing is still desired, add to a future phase. Otherwise, note it as consciously excluded.

---

### G-9: E2E Testing (46 Journeys, Minimal Test Files)

**Reference**: `docs/plans/USER_JOURNEYS.md` specifies 46+ Playwright test scenarios. Master plan Gap #13 deferred E2E to Phase 4. `package.json` has `test:e2e` scripts.

**What exists**: Playwright is a dev dependency. Some test files exist.

**What's missing**: Comprehensive coverage of the 46 user journeys. No CI pipeline runs E2E tests.

**Action**: Prioritize the Critical/High-priority user journeys (UJ-001 through UJ-018) for Playwright implementation. Add to CI.

---

### G-10: Google Search Console Integration (Backlog, No Spec)

**Reference**: Master plan Phase 6.1: *"Google Search Console API integration."*

**What exists**: Nothing.

**Action**: Keep in backlog. Spec should include: keyword ranking tracking, crawl error monitoring, index coverage dashboard in admin.

---

## Part 4: Prioritized Action Plan

### Tier 0: Document Hygiene (Do First — 1 Day)

These are zero-code-risk fixes that make all other work clearer:

1. **Update `PRODUCT_SPEC_V2.md`** to remove stale `❌ MISSING` markers for features that now exist (C-1).
2. ~~**Update `master-plan.md`** header to reflect current phase status (C-2).~~ **DONE 2026-04-05** — header updated to "Complete through Phase 6; Data Architecture Optimization in progress".
3. ~~**Update or delete `FEATURES.md`** — it's 13 months stale (C-4).~~ **DONE 2026-04-05** — updated with note about stale routes, corrected route references.
4. **Resolve Gap #12** (Sentry) and **Gap #21** (email alerts) as done (C-5, C-6).
5. **Add `lastVerified` field** to `task-registry.json` entries.
6. **Honestly re-status** T3-006 (shared collections), T3-007 (notes on homes), T4-007 (SMS alerts) — verify end-to-end or downgrade to `code_complete_awaiting_verification` (C-1, C-9).
7. **Clarify CR-7** redirect target to match `next.config.ts` (C-10).
8. **Add data-dependency tracking** for features that depend on MLS table population (C-7).

**Additional documentation work completed 2026-04-05 (Data Architecture Optimization, Phase 0A):**
- `AGENTS.md` Key Architecture Decisions updated with geographic hierarchy, geo_slug format, and data architecture rule reference
- `docs/SEO.md` sitemap and listing structured data sections corrected
- `docs/URL_ARCHITECTURE.md` marked as superseded; active URL spec is in `.cursor/rules/data-architecture.mdc`
- `docs/plans/master-plan.md` Phase 0.1 listing URL spec updated to MLS + address format
- `docs/plans/phase-0-brief.md` Task 0.1 marked as superseded by Data Architecture plan Phase 3
- `docs/GOALS_AND_UI_AUDIT.md` listing detail page checklist updated for new URL format
- `docs/ENTITY_OPTIMIZATION.md` listing structured data note added re: URL alignment
- `docs/FEATURES.md` route references corrected
- `.cursor/rules/data-architecture.mdc` created as the authoritative data architecture rule
- `.cursor/rules/seo-url-guardrails.mdc` updated to MLS + address canonical listing URL contract
- `.cursor/rules/supabase-data-layer.mdc` updated with ClosePrice + percentile-based stats requirements and `geo_slug` format
- `.cursor/rules/master-plan-protocol.mdc` updated for current data architecture optimization phase and constraints

### Tier 1: Quick Wins — Code Consolidation (1-2 Days)

Low-risk, high-value deduplication:

| # | Action | Files | Est. Time |
|---|--------|-------|-----------|
| 1 | Merge `property-type.ts` + `property-type-labels.ts` | 2 files + importers | 30 min |
| 2 | Remove `toSlug()` from `listing-processor.ts` | 1 file | 5 min |
| 3 | Fix `activity-tracker.ts` Supabase client | 1 file | 10 min |
| 4 | Fix sync/live route Supabase client | 1 file | 10 min |
| 5 | Extract shared PDF styles/header/footer | 4 files → 5 files | 1 hour |
| 6 | Create `ListingTilesSection` wrapper | 3 files → 4 files | 1 hour |
| 7 | Extract content lookup utility | 2 files → 3 files | 30 min |

### Tier 2: Design System Compliance (2-3 Days)

Required by CLAUDE.md — these are not optional:

1. **Replace all raw `<select>` in admin** with shadcn `<Select>` (8 files, ~25 instances).
2. **Replace raw `<input>`, `<button>`, `<table>`** in `AreaGuideUploadClient.tsx`.
3. **Replace all template literal classNames** with `cn()` (~30 files).
4. **Replace hardcoded Tailwind colors** (`text-green-600`, `dark:bg-zinc-100`) with semantic tokens.
5. **Centralize brand hex colors** used in OG image routes into `lib/brand-colors.ts`.

### Tier 3: Complete Stub Features (1-2 Weeks)

Features that are partially built but not functional:

1. **SMS alerts**: Create migration for `sms_enabled`/`sms_phone` columns, add Twilio to `env.ts`, test end-to-end.
2. **Blog scheduled publishing**: Add cron job + admin date picker.
3. **Event table cleanup**: Wire the orphaned `cleanup_old_events()` function to a cron.
4. **Programmatic filter pages**: Either create `lib/filter-pages.ts` config or document slug-parsing approach.
5. **Broker external profiles**: Display collected social/platform links on public profile pages.
6. **Partnership revenue dashboard**: Build admin panel for `partner_programs`/`partner_referrals`.

### Tier 4: Architecture Improvements (2-4 Weeks)

Larger refactors that improve long-term maintainability:

1. **Break up oversized components**:
   - `AdminBrokerForm.tsx` (1,338 lines) → split into form sections
   - `SearchFilterBar.tsx` (790 lines) → extract each filter group
   - `SearchMapClustered.tsx` (508 lines) → extract marker/cluster logic
   - `ListingTile.tsx` (395 lines) → extract card variants

2. **Unified event bus** (`lib/event-bus.ts`): Central dispatcher for GA4, Meta Pixel, activity tracking, and lead scoring.

3. **Complete the `getCityMarketStats` → `getCachedStats` migration** per CR-5, or officially rescind the requirement.

4. **Add env validation** for `XAI_API_KEY`, `CRON_SECRET`, and Twilio credentials in `lib/env.ts`.

5. **TypeScript strictness**: Eliminate `as any` casts in `run-year-sync.ts` (7 instances), `area-guide-upload.ts` (3 instances), `sync-spark.ts`, `compare/page.tsx`, and `pdf/comparison/route.ts`. Regenerate Supabase types with `supabase gen types`.

### Tier 5: Testing & Verification (Ongoing)

1. **Implement top 18 Playwright E2E tests** from USER_JOURNEYS.md (UJ-001 through UJ-018).
2. **Add E2E to CI** pipeline.
3. **Verify all "complete" tasks end-to-end** — not just that components exist, but that they render real data. Per NEXT_SESSION_BRIEF Rule #1.
4. **Run `npm run lint:design-tokens`** and fix any remaining violations.

---

## Appendix A: File Reference Index

### Planning Documents (Canonical Authority Order)
1. `docs/plans/PRODUCT_SPEC_V2.md` — What the product must be (vision + gaps)
2. `docs/plans/master-plan.md` — How to build it (phases + ownership)
3. `docs/plans/task-registry.json` — Task-level status tracking
4. `docs/NEXT_SESSION_BRIEF.md` — Operational context + agent rules
5. `docs/plans/phase-{0-3}-brief.md` — Phase execution details
6. `docs/plans/USER_JOURNEYS.md` — E2E test specifications
7. `docs/LAUNCH_CHECKLIST.md` — Production deployment steps
8. `CLAUDE.md` — Design system enforcement rules

### Key Code Files Referenced
- `lib/property-type.ts` + `lib/property-type-labels.ts` — Duplicate property type logic
- `lib/slug.ts` + `lib/listing-processor.ts` — Duplicate slugification
- `lib/pdf/*.tsx` — PDF templates with shared patterns
- `lib/activity-tracker.ts` — Redundant Supabase client
- `lib/tracking.ts`, `lib/meta-pixel.ts`, `lib/cta-tracking.ts` — Fragmented event tracking
- `lib/city-content.ts` + `lib/community-content.ts` — Duplicate content normalization
- `app/actions/sms-alerts.ts` — Stub SMS implementation
- `app/actions/auto-response.ts` — Speed-to-lead (exists, needs verification)
- `components/listing/WalkScore.tsx`, `ClimateRisk.tsx`, `TaxHistory.tsx` — Tier 2/3 features (exist, need data verification)

### Database Gaps
- `shared_collections` — Dropped in migration, feature marked complete
- `sms_enabled`, `sms_phone` — Referenced in code, not in any migration
- `blog_settings` — Created in migration, no application code uses it
- `cleanup_old_events()` — SQL function defined, never called
- `partner_programs`, `partner_referrals`, `revenue_events` — Tables exist, no admin UI
