# Audit — Listings Admin + Content/Site Management Domain

Auditor scope: `app/admin/(protected)/{listings,geo,media,banners,photos,stock-photos,resort-communities,guides,search,query-builder,blog,site-pages,sync,spark-status,users,settings,people,help,operations,optimization}` plus their server actions and DAL paths. All file paths absolute under `/Users/matthewryan/RyanRealty/`.

---

## 0. Domain-wide findings (read these first)

### 0.1 CRITICAL — Unauthenticated service-role server actions across the whole content domain

Next.js server actions are public POST endpoints. The layout-level superuser gates (`listings/layout.tsx`, `geo/layout.tsx`, `sync/layout.tsx`, etc.) protect the *pages*, not the actions. Some actions in this domain check the session internally (the listing editor's `requireSuperuser()` in `app/actions/admin-listing-detail.ts:36-43`, `curateAssets`'s `requireAdmin()` in `app/actions/asset-curation.ts:28-33`, `requireAdminAccessForMedia()` in `app/actions/admin-media.ts:118-127`, `listPlatformUsersForAdmin` in `app/actions/admin-roles.ts:130-133`). **The rest perform service-role writes with no auth check at all:**

| Action | File:line | What an unauthenticated caller can do |
|---|---|---|
| `saveBlogPost` | `app/actions/blog.ts:209-254` | Create/overwrite any post on the public blog (`blog_posts`), publish arbitrary HTML |
| `deleteBlogPost` | `app/actions/blog.ts:256-265` | Delete any blog post |
| `getAdminBlogPosts` | `app/actions/blog.ts:192-207` | Read all drafts (service role) |
| `saveGuide` | `app/actions/guides.ts:189-215` | Create/overwrite public SEO guides (`guides`), publish arbitrary HTML |
| `deleteGuide` | `app/actions/guides.ts:218-224` | Delete guides |
| `getAdminGuides` | `app/actions/guides.ts:178-186` | Read all guide drafts |
| `updatePageContent` | `app/actions/site-pages.ts:35-72` | Write `site_pages` (writes first, audit-logs only if a session happens to exist) |
| `updateBrokerageLogoUrl` / `uploadBrokerageLogo` / `updateBrokerageHeroMedia` / `updateBrokerageTeamImageUrl` / `uploadBrokerageHeroImage` / `uploadBrokerageHeroVideo` | `app/actions/brokerage.ts:63-240` | Replace the brokerage logo used in PDF exports, upload arbitrary files to public buckets. Comments say "admin only" — comment, not code |
| `createGeoPlace` / `updateGeoPlace` / `ensureGeoPlacesFromListings` | `app/actions/geo-places.ts:53-198` | Pollute `geo_places` (audit log runs *after* the write, with empty email if no session) |
| `setSubdivisionResort` / `seedResortCommunitiesFromDefaultList` | `app/actions/subdivision-flags.ts:64-95,179-185` | Flip `is_resort` flags that change how PUBLIC community pages render (`app/communities/[slug]/page.tsx` consumes `is_resort`), plus trigger banner generation + `communities` row inserts |
| `getAreaGuideEntityMapping` / `uploadAreaGuideFolder` | `app/actions/area-guide-upload.ts:148,241` | Upload arbitrary files to the public area-guides bucket AND create `cities` / `neighborhoods` / `communities` rows (`insertHeroEntityRow`, line 212-231) |

**Impact chain to stored XSS on the public site:** `saveBlogPost` (no auth) → `blog_posts.content` → `app/blog/[slug]/page.tsx:146,247` renders `post.content` via `dangerouslySetInnerHTML` with **no sanitization**. Same for guides: `saveGuide` (no auth) → `app/guides/[slug]/page.tsx:164` `dangerouslySetInnerHTML={{ __html: guide.content_html }}` — note `app/reports/[slug]/page.tsx:169` DOES call `sanitizeHtml(...)`; guides and blog do not. Middleware (`middleware.ts`) is rate-limiting only, no auth.

The rebuild must standardize one guarded mutation pattern (the `requireSuperuser()` shape already used in `admin-listing-detail.ts`) and sanitize all CMS HTML at render.

### 0.2 CRITICAL — The listing editor writes to MLS-synced columns; edits silently revert

See §2 for detail. `ListPrice`, `StandardStatus`, and `details.PublicRemarks` are edited in place on the `listings` row (`lib/data/admin/listingEdit.ts:67-83`), and the delta sync rebuilds those exact fields from Spark (`app/api/cron/sync-delta/route.ts:276-283` builds `cleanRow` from `sparkToListingRow`, upserts on `ListNumber` at `lib/data/sync/syncWrites.ts:105-114`; `lib/listing-mapper.ts:402+` produces a fresh `details` payload — zero occurrences of `admin_overrides` or merge logic in the mapper). Every "save" survives only until the listing next changes in the MLS. The `details.admin_overrides` blob (admin notes, marketing headline, featured flag) is wiped by the same overwrite — and has **zero readers anyway** (repo-wide grep for `admin_overrides`/`marketing_headline` matches only the editor itself).

### 0.3 CRITICAL — Placebo editors: forms that save to nothing anyone reads

- **Site pages** (§8): only `site_pages.title` for `contact` is consumed anywhere (`app/contact/page.tsx:75,89`). The About/Sell body-HTML editors and the Contact body editor write dead data while the UI says "Changes appear on the live site immediately" (`SitePagesList.tsx:16`).
- **Homepage hero video/image + team image** (§8): `getBrokerageSettings` consumers are `app/team/[slug]/page.tsx:72,198` (uses `.name` only) and the PDF export routes (`app/api/pdf/report/route.ts:33,63` — uses `.logo_url`). **Nothing reads `hero_video_url`, `hero_image_url`, or `team_image_url`** since the homepage rebuild. The form says "Homepage will update shortly." (`HeroMediaForm.tsx:36`).
- **Listing "Featured" + "Marketing headline"** (§2): zero consumers.
- **Geography hierarchy** (§3): the entire `geo_places` table has exactly one consumer — the admin page that edits it (`grep -rln geo_places` outside admin = only `app/actions/geo-places.ts`).

A broker doing these jobs gets success toasts and no effect. This is the single largest trust-destroyer in the domain.

### 0.4 Consolidation state (2026-07-07/15) is real but half-finished

Top-level `banners`, `photos`, `stock-photos`, `resort-communities`, `search`, `query-builder`, `spark-status`, `optimization`, `people`, `people/[legacyId]` are all pure redirects (each file ~9-27 lines, verified). Good. But `guides` was left as a live page reachable only from a collapsed dashboard panel (`components/admin/DashboardContentStatusPanel.tsx:53`) — it is not in `buildAdminNav` (`app/components/admin/admin-nav.ts` has no `/admin/guides` entry). And ~378 lines of dead sync components remain (§9.6).

---

## 1. `/admin/listings` — Listings browser

**Files:** `app/admin/(protected)/listings/page.tsx` (417), `ListingsCsvExport.tsx` (368), `layout.tsx` (16). Superuser-gated via layout.

**Purpose:** browse the full statewide feed, search by address/MLS/key, keyword-search remarks (public + private), status facets, CSV export.

**Data path:** server component → `getAdminListingsPage` (`app/actions/admin-listings.ts:11-71`) → `getListingTiles` + `getListingTilesCount` DAL against **`listing_tile_mv`** (scope `'all'`, sort newest). Remarks mode → `searchAdminRemarksPage` (`admin-listings.ts:81-119`) → `searchAdminListingsRemarks` DAL (service-role read incl. `private_remarks`, correctly guarded by `getAdminContext()` at line 86-88).

**Works?** Yes, fundamentally. Pagination totals fixed (P2-1 note at line 25), beds/baths mapping fixed (P2-2, line 54). Search, facets, mobile card list, desktop table all render.

**Defects:**
1. **Remarks-mode pagination silently drops remarks mode.** `pageHref()` (`page.tsx:66-73`) builds only `page`, `search`, `status` — never `remarks`. In remarks mode with >50 results, clicking "Next" re-runs a plain address search on page 2. Same for the status facet links (`statusHref`, lines 58-64), though that is arguably intended.
2. **List reads the MV; the editor reads the live table.** `admin-listings.ts:23` ("via listing_tile_mv"). Per project memory, `listing_tile_mv` has previously gone 8 days stale silently. List price/status can disagree with the detail page and with what an admin just edited (edit → back to list → old value). No staleness indicator on the page.
3. `privateOnlyKeys` returned by `searchAdminRemarksPage` (line 115-117) is never consumed — the UI cannot show which rows matched only *private* remarks, though the data path was built for it.
4. Dead code: `SELECT` constant + `void SELECT` (`admin-listings.ts:6-7,22`).
5. The remarks checkbox renders a design-system `Input type="checkbox"` (`page.tsx:167`) instead of `Checkbox` — component-mapping violation.
6. `daysOnMarket` computed from `OnMarketDate` at render (`page.tsx:42-48`) while the MV carries `CumulativeDaysOnMarket` — DOM here can disagree with the public site's DOM figure for relisted properties.

**CSV export panel** (merged query-builder): collapsible at the bottom of the page, `runQueryBuilderSearch` (`app/actions/query-builder.ts`) capped at 500 rows. Loading skeleton, error card, empty state all present — one of the better-behaved client components. Mobile preview cards cap at 6 rows with "download for full set" hint.

**Mobile story:** duplicated markup — `md:hidden` card list (lines 256-306) + `hidden md:block` table (lines 309-380). Feature parity is complete but every column change must be made twice.

**Job cost:** find + open a listing = 1 search + 1 tap (good). Export a filtered CSV = expand panel + 5-7 fields + Run + Download = ~9 interactions.

**Verdict: works**, with a broken pagination path in remarks mode and a stale-source-of-truth risk.

---

## 2. `/admin/listings/[listingKey]` — Listing detail + editor

**Files:** `[listingKey]/page.tsx` (107), `AdminListingEditor.tsx` (516). Server actions: `app/actions/admin-listing-detail.ts` (257). DAL: `lib/data/admin/listingEdit.ts` (187). Superuser-gated in page (lines 27-31) AND per-action (`requireSuperuser`, the correct pattern).

**Purpose:** view one listing, edit price/status/remarks/notes/headline/featured, toggle media suppression, manage photos (add URL, delete, reorder, set hero).

**Data path (read):** `getListingsByKeys` + `getAdminSyncCounts` + `getAdminListingEditableData` in parallel (`page.tsx:37-41`). Editable data = live `listings` row by ListingKey-then-ListNumber (`listingEdit.ts:40-64`) + `listing_photos` rows.

**Data path (write):** `updateAdminListingEditableData` → `updateAdminEditableListingRow` → `.update({ListPrice, StandardStatus, details, ModificationTimestamp: now()}).eq('ListingKey', key)` (`listingEdit.ts:73-82`).

### What can actually be edited, and what happens on next sync

| Field | Written to | Read by anyone? | Survives next MLS sync of this listing? |
|---|---|---|---|
| List price | `listings.ListPrice` | public site, MVs | **NO** — `sync-delta/route.ts:276-283` upserts the Spark value |
| Standard status | `listings.StandardStatus` | public site, MVs | **NO** |
| Public remarks | `listings.details.PublicRemarks` | public listing page | **NO** — `details` replaced wholesale by mapper output (`lib/listing-mapper.ts:402+`, no merge) |
| Admin notes | `details.admin_overrides.admin_notes` | **NOBODY** | NO |
| Marketing headline | `details.admin_overrides.marketing_headline` | **NOBODY** | NO |
| Featured flag | `details.admin_overrides.featured` | **NOBODY** | NO |
| Media suppressed | `listings.media_suppressed` (own column) | `getListingPhotos` 3-tier fallback + detail photoUrl | **YES** — column absent from mapper (0 grep hits), upsert leaves it intact. The one genuinely sync-proof control, as the reference memo says |
| Photos (add/delete/reorder/hero) | `listing_photos` table | Tier 1 of `getListingPhotos` (`lib/data/listings/getListingPhotos.ts` header: tier 1 = `listing_photos`, tier 2 = `details->Photos` MLS payload, tier 3 = `PhotoURL`) | YES (separate table) — BUT tier-1 only wins when rows exist; most MLS listings render from tier 2, so deleting one photo out of an MLS set is impossible from here (the table is empty for them; the UI shows "No listing photos found" while the public page shows 40 MLS photos) |

**Additional defects:**
1. **Filter-string interpolation** in `updateAdminListingMediaSuppressed`: `.or(\`"ListingKey".eq.${key},"ListNumber".eq.${key}\`)` (`admin-listing-detail.ts:240`) — a key containing `,` or `)` breaks/alters the PostgREST filter. Superuser-only, but keys come from a URL param.
2. **Silent no-op edit path:** if the row was found by `ListNumber` and `ListingKey` is null, `key` resolves to the ListNumber but the update matcher is `.eq('ListingKey', key)` (`listingEdit.ts:81`) — matches 0 rows, returns no error, UI says "Listing changes saved."
3. **Fake ModificationTimestamp:** every save stamps `ModificationTimestamp: now()` (`listingEdit.ts:79`), corrupting the "Last modified" display and any freshness logic that reads the DB column (Spark cursor is unaffected; it uses Spark-side timestamps).
4. **Non-atomic hero:** `setListingHeroPhoto` = reset-all then set-one, two statements, no transaction (`listingEdit.ts:150-167`) — a failure between them leaves no hero.
5. **N sequential updates for reorder** (`listingEdit.ts:170-186`), no transaction; failure mid-loop leaves a half-applied order; the client already optimistically reordered (`AdminListingEditor.tsx:156-178`) and only shows the error text without reverting.
6. `getAdminSyncCounts()` runs on **every** detail view (`page.tsx:38`) to render a two-number "Database summary" card (`page.tsx:76-81`). That action fans out to ~15 exact-count queries over the 589K-row table (`app/actions/listings.ts:1762+`). Pure page-load tax on the hottest admin route.
7. Free-text `StandardStatus` input (`AdminListingEditor.tsx:202-209`, placeholder "Active, Pending, Closed...") — no enum validation, typo puts a garbage status on the public site until the next sync reverts it.
8. Photo mutations use `window.confirm` (delete at line 123, suppression at line 306) — no design-system Dialog; and after each mutation the client refetches the entire editable payload (`refreshPhotosFromServer`, line 48-53).

**Mobile story:** duplicated card/table markup for photos (lines 353-428 vs 430-511) — parity ok, double-maintenance.

**Verdict: broken for its core promise.** The only durable controls are media suppression and photo curation on listings we own. Price/status/remarks editing is an illusion that will produce a compliance problem (edited price silently reverts). The featured/headline/notes fields are decoration.

---

## 3. `/admin/geo` — Geography & neighborhoods

**Files:** `geo/page.tsx` (139), `layout.tsx` (35, superuser gate + tabs), `NeighborhoodForm.tsx` (85), `AssignCommunity.tsx` (78), `EnsureGeoButton.tsx` (42). Action: `app/actions/geo-places.ts` (198).

**Purpose:** maintain a Country → State → City → Neighborhood → Community hierarchy in `geo_places`; seed from listings; create neighborhoods; re-parent communities.

**Works?** Mechanically yes — the reads/writes execute. **But the table is dead**: no public page, DAL function, MV, or cron reads `geo_places` (only consumer repo-wide is `app/actions/geo-places.ts` itself). The real community taxonomy the site uses is `data/resort-communities.json` + `subdivision_flags` + `communities` + `neighborhood_subdivisions` (per CLAUDE.md and `lib/data/communities/registry.ts`). This page maintains a parallel taxonomy nobody consumes.

**Defects:**
1. **Whole surface is a dead-end** (above). Creating "West Side" neighborhood here changes nothing anywhere.
2. **No auth on any of its actions** (§0.1). `listGeoPlaces` also service-role reads with zero check (`geo-places.ts:34-48`).
3. **City cap 12 with no escape:** `CITY_CAP = 12` (`page.tsx:12`), only the first 12 alphabetical cities render as links (line 86); "Showing 12 of N" (line 98). Cities 13+ can never be selected from the UI — their neighborhoods are unreachable.
4. **N+1 seeding:** `ensureGeoPlacesFromListings` does a per-city existence check + insert, then per-city `getSubdivisionsInCity` + per-subdivision check/insert (`geo-places.ts:162-196`) — the page comment admits it previously timed the page out (`page.tsx:22-26`).
5. `AssignCommunity` declares `cities` prop and never uses it (`AssignCommunity.tsx:10-17`); its `handleAssign` ignores the result — `updateGeoPlace` failure is silently swallowed (line 27, no `.ok` check), no error state at all.
6. Raw `<select>` elements (`NeighborhoodForm.tsx:54-62`, `AssignCommunity.tsx:43-65`) — design-system violation (`Select` mandated).
7. 4 sequential awaited `listGeoPlaces` calls per render (`page.tsx:27-34`) — a waterfall on a force-dynamic page; and the "communities" fetch pulls ALL communities then filters in JS (line 34-35).

**Mobile story:** no fork; wrap-chips work on phones; tap targets ok (`min-h-10`).

**Verdict: dead** (functioning UI over unconsumed data). Rebuild should delete it or converge it with the real registry.

---

## 4. `/admin/geo/resort-communities` — Resort & master plan flags

**Files:** `geo/resort-communities/page.tsx` (350), `ResortCommunityToggle.tsx` (47), `SeedResortButton.tsx` (32). Action: `app/actions/subdivision-flags.ts` (185). Top-level `/admin/resort-communities` = query-preserving redirect (verified).

**Purpose:** flag city:subdivision pairs as resort/master-plan; flagged communities get the full amenity/resort treatment + schema on the public community page. This is the REAL taxonomy control (unlike §3).

**Data path:** `listSubdivisionsWithFlags()` merges three sources — `geo_snapshot_mv` snapshots, `subdivision_flags` rows, hardcoded `RESORT_LIST` — then canonical-city normalization (`subdivision-flags.ts:103-173`, incl. the documented Crosswater dual-city fix at lines 146-169). Toggle → `upsertSubdivisionResortFlag` + resort backfill (`communities` row + hero banner + static content, lines 35-58) → public pages read flags via `getResortEntityKeysFromFlags`.

**Works?** Yes — this is one of the few surfaces in the domain wired end-to-end to the public site, with sane search/filter/pagination (in-memory but paginated DOM, `PAGE_SIZE=25`).

**Defects:**
1. **No auth on `setSubdivisionResort` / seed** (§0.1) — an unauthenticated caller can restyle public community pages.
2. **Full-table fetch per request:** `listSubdivisionsWithFlags()` loads every snapshot + every flag on each render (force-dynamic), then filters/paginates in memory (`page.tsx:52-76`). Works at hundreds of rows; the whole-list fetch runs on every search keypress-submit and every page click.
3. **Silent failures:** `SeedResortButton` ignores `result.ok === false` entirely (no message, `SeedResortButton.tsx:13-19`). `ResortCommunityToggle` reverts the switch on failure but shows no error text (`ResortCommunityToggle.tsx:22-29`) — a flaky network looks like a haunted toggle.
4. Toggle does optimistic set + `router.refresh()` per toggle — refreshing re-runs the full-table fetch (see 2) for every single switch flip.
5. `backfillResortCommunityData` failures are swallowed to Sentry (`subdivision-flags.ts:75-80`) — the flag flips but the community page may 404-ish render without hero/content, and the admin never learns.

**Mobile story:** proper fork — cards `md:hidden` with full-width toggle rows, table on desktop. Good parity.

**Duplication:** vs §3 — two "community" editors side by side as tabs, one live (this) and one dead (geo). A broker cannot tell which one matters.

**Verdict: works** (best surface in the domain), with silent-failure and unauthenticated-action caveats.

---

## 5. `/admin/geo/area-guide-upload` — Area Guide media upload

**Files:** `area-guide-upload/page.tsx` (21), `AreaGuideUploadClient.tsx` (229). Action: `app/actions/area-guide-upload.ts` (368).

**Purpose:** bulk-upload photo/video folders per place; auto-map folder names to city/neighborhood/subdivision; write to storage + `page_images` + hero fields.

**Defects:**
1. **Guaranteed to fail on real content:** `uploadAreaGuideFolder` receives ALL files of a place in a single server-action FormData (`AreaGuideUploadClient.tsx:109-118`), and `next.config` caps `serverActions.bodySizeLimit` at **4mb** (`next.config.ts:223-224`). One drone MP4 or a folder of hero JPEGs exceeds that; the upload aborts with an opaque body-size error. Videos (`VIDEO_EXT` includes .mp4/.mov/.mkv) cannot ever fit.
2. **No auth on either action** (§0.1) — and `uploadAreaGuideFolder` can CREATE `cities`/`neighborhoods`/`communities` rows (`area-guide-upload.ts:212-231`).
3. Sequential per-folder upload loop stops on first failure and discards remaining progress state (`AreaGuideUploadClient.tsx:118-124`); no retry, no per-file progress (progress is per-folder count only).
4. Hand-rolled modal (`div fixed inset-0`, lines 166-226), raw `<table>`, raw `<button>` — design-system violations throughout.
5. Success message says "Refresh the site to see changes" — no cache revalidation is triggered for the affected pages in the client path.

**Mobile story:** `webkitdirectory` folder picker does not work on iOS Safari — the page is desktop-only in practice, with no notice.

**Verdict: broken** for anything but a tiny photo folder.

---

## 6. `/admin/media` — Media hub (Library / Photo curation / Banners / Stock photos)

**Files:** `media/layout.tsx` (27, tabs, **no auth of its own** — relies on `(protected)` any-admin gate + per-child gates), `media/page.tsx` (24, superuser inline), `AdminMediaManager.tsx` (470); `media/photos/page.tsx` (78) + `PhotoCurationBoard.tsx` (432); `media/banners/page.tsx` (57) + `GenerateBannersButton.tsx` (50) + `banners/layout.tsx` (superuser); `media/stock-photos/page.tsx` (7) + `StockPhotosPicker.tsx` (519) + `stock-photos/layout.tsx` (13, superuser).

### 6.1 Library tab (`/admin/media`)

**Purpose:** browse/upload/delete storage files across 4 scoped buckets (branding/brokers/banners/reports) with usage-reference tracking; delete blocks when referenced unless force-unlink.

**Data path:** all through `app/actions/admin-media.ts` — properly auth-guarded (any admin role, line 118-127; page gates superuser — a role mismatch: a non-superuser admin can call the actions directly but not see the page).

**Works?** Yes. Reasonable loading skeletons, empty states, per-action messages, audit logging.

**Defects:**
1. **Search fires a full server round-trip per keystroke** — `useEffect` depends on raw `search` with no debounce (`AdminMediaManager.tsx:98-114`); each keystroke re-lists the bucket AND rebuilds the usage map.
2. Force-unlink is a global checkbox that then applies to whatever you delete next (`lines 263-272`) — a mode, not a per-action decision; easy to leave on.
3. `window.confirm` for delete; success/error surfaced through one shared message slot that the next keystroke's refresh can clobber.
4. Usage map coverage is only as good as `getUsageMap(scope)` — files referenced by systems outside its queries will read "Unused" and invite deletion.

### 6.2 Photo curation tab (`/admin/media/photos`)

**Purpose:** approve/reject `asset_library` photos/videos; surface-tag (`hero`/`card`); approving flips live site imagery via `updateTag(cacheTag.assets)`.

**Data path:** page queries `asset_library` directly with `createServiceClient()` **in the page component** (`media/photos/page.tsx:29-56`) — DAL-boundary violation (G1 exists for `.from()` outside `lib/data`; this survives via the service client). Writes via `curateAssets` (`app/actions/asset-curation.ts`) — guarded, validated, tag-revalidated. **Works end-to-end.**

**Defects:**
1. **No role gate:** open to every admin role including `report_viewer` (layout comment says intentionally "any admin role" — `media/layout.tsx:9`), yet approving changes public-site imagery.
2. `apply()` doesn't catch `curateAssets` throws (`PhotoCurationBoard.tsx:82-92`) — a failed bulk approve surfaces as an unhandled transition error (error boundary), selections lost, no inline message.
3. `GEO_FILTERS` hardcoded 16 slugs (`lines 54-58`) — new geo tags never appear in the filter.
4. Four counts + page query run in parallel per navigation (fine), but every approval triggers `router.refresh()` re-running all five queries.

**Mobile story:** good — Select for geo on mobile vs chips on desktop, 44px targets, skeletons during nav.

### 6.3 Banners tab (`/admin/media/banners`)

**Purpose:** count/list places missing hero banners; one button generates all missing via Unsplash.

**Data path:** `listMissingBanners()` (scans listings per city — cached 5 min via `unstable_cache`, `banners/page.tsx:14-18`) → `generateAllMissingBanners` server action passed INTO the client button as a prop (`page.tsx:49`).

**Defects:**
1. **The page copy is developer documentation** shown to a broker: "Set `UNSPLASH_ACCESS_KEY` in .env.local (and in Vercel...)... Create a **public** Storage bucket named `banners` in Supabase Dashboard → Storage" (`page.tsx:26-29`). Ends with "Back to Sync" (line 53) — a leftover of the pre-consolidation IA.
2. Generate-all is a single long-running server action with no per-item progress; the result block appears only at the end (`GenerateBannersButton.tsx:13-22`); a Vercel function timeout mid-run loses everything silently.
3. The list shows only the first 20 missing; no way to generate ONE place's banner from here (that path exists only via the resort toggle backfill or `refreshPlaceBanner`, which no UI calls — grep: `refreshPlaceBanner` has no client consumer).

### 6.4 Stock photos tab (`/admin/media/stock-photos`)

**Purpose:** one query across Shutterstock/Pexels/Unsplash; preview grid; "HTML review" opens a printable blob page.

**Data path:** three `/api/admin/stock/*/search` GETs (admin-session-guarded routes) fired in parallel — **on mount, with a default query** (`StockPhotosPicker.tsx:213-215`), i.e., three external API calls burn quota every time the tab is opened.

**Defects:**
1. **Picking does nothing.** The instructions say "Pick by code (S-…, P1, U1)" — there is no action attached to a photo: no "use as banner for X", no save, no copy-URL. The workflow's back half (applying a chosen photo to a place) doesn't exist in the UI; it's a research toy whose output is a code you tell an agent later. Disconnected from `setPlaceBannerFromPhoto` (`app/actions/banners.ts:201`), which exists and has **no UI consumer** (grep only finds the action).
2. Error text leaks env-var names to the UI ("Check SHUTTERSTOCK_* env vars", `lines 336,358,386`).

**Duplication (media):** three separate surfaces touch banner imagery — Library's `banners` scope (raw files), Banners tab (missing/generate), Stock photos (search) — with no links between them and no shared flow that completes the actual job: "this place needs this photo."

**Verdict:** Library **works**, Curation **works**, Banners **partial** (bulk-only, dev-facing), Stock photos **stub** (search without apply).

---

## 7. `/admin/blog` + `/admin/guides` — Content editors

### 7.1 Blog (`blog/page.tsx`, 488 lines; `app/actions/blog.ts`, 265)

**Purpose:** CRUD for `blog_posts`, the live public blog (Supabase-backed `/blog`, per the blog-publish-path memory; the P0-3 comment at `page.tsx:24-27` confirms `/blog` is canonical, not AgentFire).

**Data path:** fully client-side page ('use client'); `getAdminBlogPosts()` from `useEffect` (500-row fetch incl. full `content` of every post — the entire blog corpus ships to the browser to render a 6-item list); `saveBlogPost` upsert `onConflict: 'slug'`; `deleteBlogPost`.

**Defects (beyond the §0.1 missing auth):**
1. **"Draft" doesn't unpublish.** Publishing truth on the public site is `published_at IS NOT NULL` (`blog.ts:72,138,156`; the `status` column is never filtered on). Save computes `published_at: input.publishedAt || (status === 'published' ? now : null)` (`blog.ts:238`). The edit form pre-fills `publishedAt` from the existing post (`page.tsx:100`), so flipping status → Draft and saving keeps the old `published_at` → the post **stays live** while the admin list shows "Draft"... actually the list badge derives from `published_at` too (`page.tsx:99,435`), so the admin sees "Published" after having chosen Draft — the status Select is a decoy either way.
2. **Editing strips the author.** The edit form never carries `authorBrokerId`; save writes `author_broker_id: input.authorBrokerId || null` (`blog.ts:240`) — any edit of an authored post nulls the public byline (author name/photo/slug come from `author_broker_id`, `blog.ts:80-95`). There is also NO author field in the UI at all — posts can't be attributed from this screen.
3. **Slug rename is broken/dangerous.** Upsert conflicts on `slug` while carrying the old `id` (`blog.ts:242,244`): renaming a slug attempts an INSERT with an existing PK → error; typing an EXISTING slug on a "new" post silently overwrites that other post.
4. Raw-HTML `Textarea` as the only authoring surface (`page.tsx:328-338`): no preview, no image upload (hero is a URL field), no sanitization anywhere (§0.1 XSS), `publishedAt` is a hand-typed ISO string with no validation (`page.tsx:298-305`).
5. Every save `revalidatePath('/blog')` only — the individual post page `/blog/[slug]` is not revalidated (`blog.ts:249-251`), so an edited post can stay stale on its own URL while the index updates.
6. Loading state is a text "Loading…" card; delete uses `window.confirm` + `alert()` (`page.tsx:143-153`).

**Mobile story:** no fork; the `<details>`-based form works but an 11-field form with a raw HTML textarea on a phone is hostile.

**Verdict: partial** — list/create/edit runs, but unpublish, authorship, and slug-rename are all broken semantics, and the whole thing is a stored-XSS door.

### 7.2 Guides (`guides/page.tsx`, 355; `app/actions/guides.ts`, 224)

Same architecture and the same defect family: unauthenticated `saveGuide`/`deleteGuide` (§0.1); slug-conflict upsert with same rename hazard (`guides.ts:203-212` — here `id` is only included via payload when set, same PK problem); `published_at` reset to `now()` on every published save (line 210) so guide dates churn; raw HTML textarea; unsanitized render at `/guides/[slug]` (§0.1).

**Unique defects:**
1. **Not in the nav** — reachable only via the collapsed "Content status" panel link (`DashboardContentStatusPanel.tsx:53`). An orphan editor.
2. **Admin and public disagree about what exists.** Public `getPublishedGuides`/`getGuideBySlug` fall back to ~12 **synthesized** "guides" generated from `market_stats_cache` when the table is empty (`lib/data/guides/getGuides.ts:130+`; duplicated older copy in `app/actions/guides.ts:100-125`). Admin shows "No guides yet" while `/area-guides` lists a dozen live articles the admin cannot edit, delete, or even see. §0 data-accuracy exposure: the generated prose ships market claims sourced from a cache row without a verification trace.
3. **~150 lines of dead duplicate DAL:** `app/actions/guides.ts` `getPublishedGuides`/`getGuideBySlug`/`getGuidesByCity`/`getGeneratedGuidesFromStats` have zero importers (public pages import from `@/lib/data`); the two copies have already diverged (the DAL copy fixed generated-timestamp and failed-query fallback; the action copy still has the old behavior + a vestigial `void supabase` and dead `error` const, `guides.ts:96-103`).

**Verdict: partial/orphaned**, with a public/admin source-of-truth split.

---

## 8. `/admin/site-pages` — Site branding + page content

**Files:** `site-pages/page.tsx` (51, superuser inline), `SiteLogoForm.tsx` (134), `HeroMediaForm.tsx` (162), `TeamImageForm.tsx` (122), `SitePagesList.tsx` (45), `SitePageEditor.tsx` (133). Actions: `app/actions/site-pages.ts`, `app/actions/brokerage.ts`.

**Purpose (claimed):** "Logo, branding, hero media, and editable content for public pages."

**What it actually controls (verified consumers):**

| Form | Writes | Actually consumed by |
|---|---|---|
| Site logo | `brokerage_settings.logo_url` | PDF report exports only (`app/api/pdf/report/route.ts:33,63`, `app/api/reports/export/route.ts:73`). The site header does NOT read it |
| Homepage hero video/image | `brokerage_settings.hero_video_url/hero_image_url` | **Nothing** (grep across app/components/lib: only the admin page + team page which uses `.name`) |
| Team image | `brokerage_settings.team_image_url` | **Nothing** |
| Page content (About/Sell/Contact title+body HTML) | `site_pages` | `/contact` reads the **title only** (`app/contact/page.tsx:75,89`). About and Sell read nothing. `body_html` read by nobody |

Every form reports success ("Hero video and image URLs saved. Homepage will update shortly.", `HeroMediaForm.tsx:36`; "Saved. View the page to see changes.", `SitePageEditor.tsx:50`) for writes with no effect. `updatePageContent` even revalidates `/about`, `/sell`, `/contact`, `/` (`site-pages.ts:68-71`) — revalidating pages that don't read the data.

**Other defects:** `updatePageContent` unauthenticated (§0.1); `SitePageEditor` loses unsaved work with no dirty-check on Close/Cancel; upload paths create buckets on the fly (`brokerage.ts:82-85`).

**Verdict: dead-in-effect** (a working CRUD over four mostly-unconsumed columns). Either wire the homepage/header to `brokerage_settings` + render `site_pages.body_html` somewhere, or delete the surface. Rebuild note: hero-video-default memory says heroes are now built into page code — this admin surface was never migrated or retired.

---

## 9. `/admin/sync` (+ `/admin/sync/spark`) — System health

**Files:** `sync/page.tsx` (71), `layout.tsx` (35, superuser + tabs), `SyncLiveStatusAndTerminal.tsx` (476), `SyncHeavyStatusSections.tsx` (262), `SyncPageAdvanced.tsx` (56), `SyncSmart.tsx` (341), `SyncHistoryButtons.tsx` (204), `RefreshActivePendingButton.tsx` (133), `TriggerDeltaSyncButton.tsx` (45), `SyncSinceDateButton.tsx` (82), `BackfillHealthPanel.tsx` (448), `spark/page.tsx` (47). Plus 5 orphans (§9.6).

**Purpose:** operator cockpit for the Spark→Supabase pipeline: live cursor status, terminal-history finalization progress, Spark-vs-DB reconciliation, backfill health, and ~7 distinct manual sync triggers.

### 9.1 Data paths
- SSR: `getSyncStatus()` + `getTotalListingsRows()` (`page.tsx:11-14`).
- Client poll #1: `/api/admin/sync/live` **every 5 s forever** (`SyncLiveStatusAndTerminal.tsx:61,171`).
- Client poll #2: `/api/admin/sync/history-yield` every 180 s — a live **Spark API probe** (`lines 62,182-194`).
- Client poll #3: `/api/admin/sync-heavy` every 30 s — status breakdown + Spark counts (`SyncHeavyStatusSections.tsx:60-62`).
- BackfillHealthPanel: `/api/admin/sync/backfill-health` (`line 135`).
- Controls: `/api/admin/sync/terminal-control` POST; server actions `runOneSyncChunk`, `startRefreshActivePending`, `runDeltaSyncSince`, `syncListingHistory`; `/api/admin/sync/delta` POST.

An idle open tab issues ~12 requests/min into count queries over a 589K-row table plus periodic Spark probes. Two of the three pollers never back off and never pause when the tab is hidden.

### 9.2 Browser-driven sync loops
`SyncSmart` (`SyncSmart.tsx:43+`) and `SyncHistoryButtons` (`runLoop`, lines 45-80+) drive the long-running sync by looping server-action chunk calls **from the browser**. Closing the laptop mid-run abandons the run; the cursor's `runStartedAt` stays set and the page then shows the "Stale marker" warning state (`SyncLiveStatusAndTerminal.tsx:243,359-363`). The crons (`sync-delta` every X min, `sync-full`, `sync-history-terminal` in `vercel.json:16,56,60`) do the same work server-side — the manual loops exist as overrides but create split-brain risk (two writers advancing one cursor; `runInProgress` guards are heartbeat-heuristic, 120 s, `page.tsx:16-20`).

### 9.3 UX for the actual user
This page is written for the engineer who built the pipeline: "Terminal history finalization", "Live history yield", "Effective terminal scope (lookback)", "Run marker is stale", "DB breakdown RPC not available. Apply migrations: npx supabase db push" (`SyncHeavyStatusSections.tsx:179`). Seven overlapping trigger buttons (Smart sync, Refresh active/pending, Trigger delta, Sync-since-date, Active-history, Terminal-history with year range, Start/Stop terminal) with no guidance on which one a broker would ever need. For the "is my data fresh?" job, the answer (last delta sync time) is buried among ~40 stats.

### 9.4 Correctness nits
- `finalizedCounts` merges via `Math.max(prev, live)` (`SyncLiveStatusAndTerminal.tsx:157-162`) — monotonic display; a legitimate decrease (data fix, re-open of finalized rows) can never render without a full page reload.
- Initial render shows all-zero terminal totals for up to 5 s by design (`page.tsx:22-41`) — "Terminal in DB: 0" flashes on every load.
- `SyncHeavyStatusSections` timeout abort sets an "still loading" message but stale `payload` remains rendered with no timestamp (lines 50-56).

### 9.5 `/admin/sync/spark`
Thin status card: `getSparkConnectionStatus()` + `getSparkDataRange()` — two live Spark calls per render, force-dynamic. Works; harmless.

### 9.6 Dead code
Zero importers (verified by exact-path import grep): `SyncButton.tsx` (47), `SyncDataRefreshButton.tsx` (38), `SyncHistoryTable.tsx` (78), `SyncHistoryTest.tsx` (117 — a test component parked in the route dir), `SyncRunLog.tsx` (98). **378 lines dead.** `CronSyncStatus.tsx` survives only because `components/admin/DashboardSyncPanel.tsx:4` (operations page) imports it.

**Mobile story:** none. 10-column tables inside `overflow-x-auto`, `grid lg:grid-cols-4` stat blocks; readable but this is a desktop cockpit and the 5-second polling drains phone batteries.

**Verdict: works** as an engineer console; wrong artifact for a broker-facing admin; heavy.

---

## 10. `/admin/operations` (+ `/optimization`) — Command center

**Files:** `operations/page.tsx` (160), `operations/layout.tsx` (24, tabs, no gate), `operations/optimization/page.tsx` (54) + superuser sub-layout; `/admin/optimization` → redirect (verified).

**Purpose:** the old admin dashboard: 8 collapsible panels (sync health, marketing command center, GA4, leads, content status, notifications, site perf, financial) + summary strip + quick links.

**Data path:** 5 dashboard fetchers batched in one `unstable_cache` (180 s TTL, `page.tsx:33-44`) — the comment records the pre-fix state: "30-45s uncached per render." First cold hit still pays that.

**Defects / duplication:**
1. **Three-homes problem partially fixed:** `/admin` root now redirects to `/admin/broker-dashboard` (`(protected)/page.tsx`, "One home, not three" directive). Operations remains a second, superuser-linked dashboard whose panels (leads, marketing, GA4) overlap the broker dashboard and `/admin/analytics/*` (its own nav section). Same numbers rendered from different fetchers = drift risk.
2. `DashboardPanel` sections are collapsed-by-default except sync — the content-status panel that holds the ONLY nav path to `/admin/guides` is hidden behind a toggle.
3. Cache is global (`unstable_cache` keyed once for all admins) — acceptable since data is Matt-scoped by design, but any admin role can open it (layout has no gate; nav shows it superuser-only — URL access by a broker role works: `operations/layout.tsx` comment says command center "was open to every admin role").

### `/admin/operations/optimization`
Shows the last `optimization_runs` row. **The cron that writes it (`/api/cron/optimization-loop`) is not scheduled** — it exists as a route but is absent from `vercel.json` crons (verified against the full cron list; only `marketing-optimization-report` is scheduled). The page permanently shows "No runs recorded yet. Configure Vercel cron to call /api/cron/optimization-loop." or a months-stale run. **Dead-in-practice.**

**Verdict:** operations **partial** (live data, duplicated purpose), optimization **dead**.

---

## 11. `/admin/users` — Site users

**Files:** `users/page.tsx` (42, superuser inline), `components/admin/AdminUsersList.tsx` (172). Action: `listPlatformUsersForAdmin` (`app/actions/admin-roles.ts:130+`, properly superuser-guarded).

**Purpose (post-2026-07-15 consolidation):** read-only viewer of registered site accounts + engagement counts; role management moved to `/admin/crm/settings/team` (button links there).

**Defects:**
1. **Heavy synchronous scan on every load:** up to 20 pages × 1000 auth users via `supabase.auth.admin.listUsers` (lines 145-153) PLUS up to 20×1000-row paged reads for EACH of `saved_listings`, `saved_searches`, `user_activities` (lines 162-175+), counted in JS. Sequential inside each `countRowsByUser`. No cache, `force-dynamic`. This page will crawl as tables grow — the exact "slow loads" complaint.
2. No pagination/search server-side — everything client-side in `AdminUsersList` after the full fetch.

**Duplication:** the fourth "people-ish" surface (site users here, admin roles at `crm/settings/team`, brokers at `/admin/brokers`, contacts at `/admin/crm`). The consolidation note on the page is honest about it but the split remains a navigation puzzle.

**Verdict: works, slow by construction.**

---

## 12. `/admin/settings` — My settings

**Files:** `settings/page.tsx` (104), `MySettingsForm.tsx` (229, desktop), `MobileSettingsScreen.tsx` (305, < md). Action: `saveBrokerSettingsAction` / `syncGmailSignatureAction` (`app/actions/broker-settings.ts`).

**Purpose:** per-broker notification toggles + email signature (Gmail-synced primary, plain-text fallback).

**Works?** Yes on desktop: toggles save on submit, Gmail sync round-trips with clear messaging, signature precedence explained.

**Defects:**
1. **Mobile is a different product missing the primary feature.** `MobileSettingsScreen` (fixed full-screen modal, own navy header, iOS-style rows) has **no Gmail signature sync** — its "Email signature" sheet edits only the plain-text FALLBACK (`MobileSettingsScreen.tsx:282-302`), which is *ignored whenever a Gmail signature is synced* (per `MySettingsForm.tsx:27-29` precedence). A broker editing their signature on a phone gets a success state and zero effect on outgoing CRM email. No hint of the precedence on mobile.
2. Desktop saves everything on one submit; mobile saves each toggle immediately (two interaction models for the same data).
3. Page queries `brokers` with a raw service client inline (`settings/page.tsx:37-42`) — DAL violation.
4. Desktop form success message sits at the bottom of a long form; toggles give no per-toggle pending state (batch save model).

**Duplication:** "Settings" now means: `/admin/settings` (me), `/admin/crm/settings` (CRM, ~20 sub-pages), `/admin/crm/settings/company` (org), `/admin/crm/settings/team` (roles). Mobile settings screen itself links to two of these — the taxonomy exists only in the owner's head.

**Verdict: works on desktop, partial on mobile** (silent-no-op signature edit).

---

## 13. `/admin/people` + `/admin/people/[legacyId]`

Both are clean redirects into `/admin/crm` (query-preserving; legacy FUB id resolved via `getPersonIdByLegacyId` then 302 to `/admin/crm/{personId}`, falling back to `/admin/crm`). No UI, no fetch beyond the id lookup. **Verdict: works (redirect shims).** The only note: an unknown-but-numeric legacy id silently lands on the contacts list with no "contact not found" context.

---

## 14. `/admin/help` + `/admin/help/[slug]`

Repo-markdown KB (`docs/admin-help/` via `lib/admin-help`), server-loaded, client substring search, grouped by nav area; article page renders through the in-repo markdown converter with scoped typography classes. Also surfaced contextually by `HelpProvider`/`HelpButton` on every admin page (`(protected)/layout.tsx:67`). No mutations. Clean loading-free implementation (data is local). **Verdict: works.** Minor: full article bodies of the entire KB are shipped to the client as lowercase haystacks on the index page (`help/page.tsx:26-33`) — fine at current size, unbounded growth cost later; `dangerouslySetInnerHTML` here is repo-content only (safe source).

---

## 15. Top-level redirect routes (dup check — each verified by reading the file)

| Route | Status |
|---|---|
| `/admin/banners` | redirect → `/admin/media/banners` (drops query) |
| `/admin/photos` | redirect → `/admin/media/photos` (preserves query) |
| `/admin/stock-photos` | redirect → `/admin/media/stock-photos` (drops query) |
| `/admin/resort-communities` | redirect → `/admin/geo/resort-communities` (preserves query) |
| `/admin/search` | redirect → `/admin/listings?search=q` |
| `/admin/query-builder` | redirect → `/admin/listings` (drops nothing; panel merged) |
| `/admin/spark-status` | redirect → `/admin/sync/spark` |
| `/admin/optimization` | redirect → `/admin/operations/optimization` |
| `/admin/people`, `/admin/people/[legacyId]` | redirects → CRM (§13) |
| `/admin/guides` | **NOT a redirect — live orphan page** (§7.2) |

No live duplicates remain at the top level except `guides`.

---

## 16. Cross-cutting scoreboard

### Performance
- Sync page: 5 s + 30 s + 180 s pollers, no visibility-pause, no backoff (§9.1).
- Listing detail: ~15 count queries per view for a vanity card (§2 defect 6).
- `/admin/users`: up to 80 sequential 1000-row fetches per load (§11).
- Media library: server round-trip per search keystroke (§6.1).
- Geo: 4-query waterfall + all-communities fetch per render (§3).
- Resort communities: full-table fetch + in-memory filter per request AND per toggle refresh (§4).
- Blog admin: entire post corpus (incl. bodies) fetched to the client to show 6 rows (§7.1).
- Stock photos: 3 external API calls on every tab mount (§6.4).

### Feedback-state gaps
- `AssignCommunity` swallows failures entirely (§3.5). `SeedResortButton` no failure feedback (§4.3). `ResortCommunityToggle` reverts silently (§4.3). Photo curation bulk actions throw unhandled (§6.2.2). Reorder failure leaves optimistic order on screen (§2.5). `window.confirm`/`alert()` on listings, blog, guides, media deletes.

### Mobile vs desktop forks
- Settings: fully forked component trees; mobile missing Gmail sync (§12.1).
- Listings browser/editor, media manager: duplicated card/table markup (parity, double maintenance).
- Sync, geo, blog, guides, site-pages, banners: desktop-first with no meaningful mobile design; area-guide upload effectively desktop-only (webkitdirectory).

### Dead / orphaned inventory
- `geo_places` + the whole `/admin/geo` hierarchy editor (§3).
- `site_pages.body_html` for all pages; `site_pages` rows for about/sell; `brokerage_settings.hero_video_url/hero_image_url/team_image_url` (§8).
- `details.admin_overrides.{featured, marketing_headline, admin_notes}` (§2).
- 5 sync components, 378 lines (§9.6).
- ~150 lines duplicate public-guide readers in `app/actions/guides.ts` (§7.2.3).
- `/admin/operations/optimization` (cron never scheduled) (§10).
- `refreshPlaceBanner` + `setPlaceBannerFromPhoto` actions with no UI (§6.4.1).
- `privateOnlyKeys` computed but unrendered (§1.3).
- `/admin/guides` orphaned from nav (§7.2.1).

### Jobs-to-be-done cost (counted)
- Fix a listing's public remarks: 4 interactions → **job impossible** (reverts on next sync, no warning).
- Suppress owner photos: 2 clicks + confirm → works (the one durable listing control).
- Publish a blog post: open Marketing → Blog → New post → 11 fields incl. raw HTML + hand-typed ISO date → Save. No preview at any point; verification = open `/blog/slug` yourself.
- Unpublish a blog post: **no working path in the UI** (must clear the ISO date field by hand — undocumented).
- Change the homepage hero: 1 upload + 1 save → **no effect** (placebo).
- Flag a resort community: Geography → Resort tab → search → toggle → works, ~4 interactions, silent on failure.
- Upload area-guide media: select folder → confirm mapping → **fails >4 MB**.
- Answer "is my MLS data fresh?": open System health, locate one of ~40 stats with no headline freshness answer.
