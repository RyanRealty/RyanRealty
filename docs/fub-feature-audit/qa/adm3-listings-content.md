# ADM-3: Listings + Content + Geo — Functional QA Report

**Audit date:** 2026-06-26  
**Method:** Read-only code trace (no real data mutated). See `docs/fub-feature-audit/ADMIN_FUNCTIONAL_QA.md` for full safety contract.  
**Pages:** `/admin/listings`, `/admin/listings/[listingKey]`, `/admin/expired-listings`, `/admin/search`, `/admin/geo`, `/admin/geo/area-guide-upload`, `/admin/resort-communities`, `/admin/site-pages`, `/admin/media`, `/admin/photos`, `/admin/banners`, `/admin/stock-photos`, `/admin/blog`, `/admin/guides`, `/admin/producers`, `/admin/producers/[slug]`

---

## Totals

| Classification | Count |
|---|---|
| ✅ Wired and working | 51 |
| ☠️ Dead (exists in UI, does nothing) | 9 |
| 🐞 Broken (wired but buggy) | 8 |
| ❓ Unverified (cannot determine from code) | 4 |
| **Total interactive elements traced** | **72** |

| Severity | Count |
|---|---|
| P0 — Ship-blocker / data-loss / wrong site | 3 |
| P1 — Major gap (feature essentially non-functional) | 4 |
| P2 — Significant bug / missing capability | 11 |
| P3 — Minor / polish | 3 |

---

## P0 — Ship blockers

### P0-1: Banner "Generate missing banners" button generates zero banners

**Page:** `/admin/banners`  
**Element:** "Generate missing banners" button  
**File:** `app/admin/(protected)/banners/GenerateBannersButton.tsx:13`, `app/actions/banners.ts:328`  
**Classification:** 🐞 Broken  

`generateAndStoreBanner(entity)` calls `getOrCreatePlaceBanner()`. Inside that function at line 98, `void searchQuery` silently discards the search query, then does only a DB read-back. For any entity with no existing banner row, it returns `{url: null}`, and the caller reports `{ok: false, error: 'No photo found. Set UNSPLASH_ACCESS_KEY in .env.local.'}` — even though `UNSPLASH_ACCESS_KEY` is set and `downloadAndStoreBanner()` is a working function used by `refreshPlaceBanner`.

**Fix:** In `app/actions/banners.ts` around line 328, replace the `getOrCreatePlaceBanner()` call with: `fetchPlacePhoto(searchQuery)` → `downloadAndStoreBanner(entityType, entityKey, photo.url, photo.attribution)`. This is the exact pattern already used in `refreshPlaceBanner` at line 248.  
**Severity:** P0 (core banner automation is fully broken; every "Generate" attempt silently produces nothing)

---

### P0-2: Area guide upload succeeds in Storage but never writes to DB

**Page:** `/admin/geo/area-guide-upload`  
**Element:** Upload form / Save button  
**File:** `app/admin/(protected)/geo/area-guide-upload/` + `lib/data/cities/getCityMetadata.ts`  
**Classification:** 🐞 Broken  

The Storage write (photos → `community-media` bucket) uses `createServiceClient()` and succeeds. But the four subsequent DB writes — `updateHeroEntityById()`, `insertHeroEntityRow()`, `getPageImageUrlsForPage()`, `insertPageImageRow()` — all call `supabaseAnon()` (anon key, no session). The `communities`, `cities`, `neighborhoods`, and `page_images` tables require `is_super_admin()` for mutations. The anon key can never pass that RLS policy. All DB writes are silently blocked. The action still returns `{ ok: true }`, so the admin sees a success toast.

**Net effect:** `hero_image_url` / `hero_video_url` never update; no `page_images` rows are ever inserted; site hero images remain permanently stale regardless of how many uploads are performed.

**Fix:** Replace `supabaseAnon()` with `createServiceClient()` in those four functions in `lib/data/cities/getCityMetadata.ts`. They are admin-only write paths and must use the service role key.  
**Severity:** P0 (silently does nothing, misleads admin with success toast)

---

### P0-3: Blog posts may go to a Supabase silo that is never publicly rendered

**Page:** `/admin/blog`  
**Element:** Entire blog authoring workflow  
**File:** `app/actions/blog.ts`  
**Classification:** ❓ UNVERIFIED (architectural risk)  

`app/actions/blog.ts` has zero references to AgentFire, WordPress, or `wp-json`. All posts upsert into Supabase `blog_posts` and are served from the Next.js `/blog` route. `CLAUDE.md` references "SEO blog post (AgentFire WordPress on ryan-realty.com)" as the canonical blog. If ryan-realty.com's live blog is actually hosted on AgentFire/WordPress, every post created in this admin panel is invisible to the public and to search engines.

**Fix:** Confirm the routing authority. If `/blog` is the canonical route (Next.js rendering Supabase data), this is a non-issue. If AgentFire hosts the real blog, a WordPress REST API integration is needed in `blog.ts`.  
**Severity:** P0 if blog is on AgentFire; P3 if Next.js `/blog` is the truth

---

## P1 — Major gaps (feature essentially non-functional)

### P1-1: No edit/delete for existing blog posts

**Page:** `/admin/blog`  
**Element:** PostRow cards — no Edit button, no Delete button  
**File:** `app/admin/(protected)/blog/page.tsx:200–233`  
**Classification:** ☠️ Dead  

`PostRow` renders only a "View" link to `/blog/[slug]`. No edit form, no pre-populated fields, no way to update any existing post. `deleteBlogPost()` exists in `app/actions/blog.ts:250–259` and is fully implemented with a proper Supabase DELETE — but it is never imported or called from the admin page.

**Fix:** Add per-post edit expand/modal pre-populated from the `blog_posts` row, and wire `deleteBlogPost` to a Delete button with two-step confirm. Note: `getAdminBlogPosts()` currently omits the `content` column, so update the query too.  
**Severity:** P1 (content management is create-only; existing posts cannot be revised or removed)

---

### P1-2: No edit/delete for existing guides

**Page:** `/admin/guides`  
**Element:** Existing guides section — read-only list  
**File:** `app/admin/(protected)/guides/page.tsx:73–86`, `app/actions/guides.ts`  
**Classification:** ☠️ Dead  

The existing guides section renders title, slug, and status as plain read-only text. No edit form, no link to an edit route. No `deleteGuide` function exists anywhere in `app/actions/guides.ts`.

**Fix:** Add edit form or `/admin/guides/[id]/edit` page. Implement `deleteGuide` in `app/actions/guides.ts` and wire to UI.  
**Severity:** P1 (guide management is create-only)

---

### P1-3: No delete for existing blog posts (separate from edit gap — action exists but is dead-wired)

(Combined into P1-1 above — the `deleteBlogPost` action exists but has no UI surface.)

---

### P1-4: Media suppression toggle absent from listing editor

**Page:** `/admin/listings/[listingKey]`  
**Element:** `media_suppressed` toggle — no UI exists  
**File:** `app/admin/(protected)/listings/[listingKey]/AdminListingEditor.tsx`  
**Classification:** ☠️ Dead  

The `media_suppressed` column on `listings` gates `getListingPhotos()`, `getListingVideos()`, and `getListingDetail.photoUrl()` across 3 DAL files. Toggling it from `false` to `true` removes the owner's photo from the public site. But `AdminListingEditor.tsx` has zero write surface for this field — no checkbox, no server action, no toggle. Setting it requires raw SQL.

**Fix:** Add a `<Checkbox>` in `AdminListingEditor` wired to a `updateAdminListingMediaSuppressed()` server action with superuser gate and audit log entry.  
**Severity:** P1 (the flag is the designed mechanism per MEMORY.md for owner photo removal; it is inaccessible from the admin)

---

## P2 — Significant bugs and missing capabilities

### P2-1: Pagination on `/admin/listings` is permanently stuck on page 1

**Page:** `/admin/listings`  
**Element:** Pagination — Next button / page total  
**File:** `app/actions/admin-listings.ts` (getAdminListingsPage)  
**Classification:** 🐞 Broken  

`getAdminListingsPage()` uses `tiles.length` as the total, but `getListingTiles` applies `.range(from, from + pageSize - 1)` — so it always returns at most `pageSize` rows. `total` always equals 50 (the page size), the "Next" button never enables, and the admin cannot browse past page 1 of 589K+ listings.

**Fix:** Call `fetchTileCount()` (which already exists) separately for the total; use the dedicated `count` return value.  
**Severity:** P2

---

### P2-2: Beds/baths columns always show `—` on `/admin/listings`

**Page:** `/admin/listings`  
**Element:** Bedrooms and Bathrooms columns  
**File:** `app/actions/admin-listings.ts` row-mapping  
**Classification:** 🐞 Broken  

The row-mapping for `AdminListingRow` omits `BedroomsTotal: t.beds` and `BathroomsTotal: t.baths`. The `as unknown as AdminListingRow[]` cast hides the TypeScript error. Both columns render `—` for every listing.

**Fix:** Add the two fields to the row-mapping object in `app/actions/admin-listings.ts`.  
**Severity:** P2

---

### P2-3: Expired listing save silently drops errors

**Page:** `/admin/expired-listings`  
**Element:** Save contact button (ExpiredListingRow)  
**File:** `app/admin/(protected)/expired-listings/ExpiredListingRow.tsx` (handleSave)  
**Classification:** 🐞 Broken  

`handleSave()` calls `updateExpiredListingContact()`, checks `res.ok`, but when `!res.ok` nothing happens — no error state is set, no feedback appears. The form re-enables silently and the save is lost.

**Fix:** Add an `error` state to the contact editor hook, set it on failure, render below the Cancel button.  
**Severity:** P2

---

### P2-4: `/admin/search` accessible to non-superuser admin roles

**Page:** `/admin/search`  
**Element:** Page-level auth guard  
**File:** `app/admin/(protected)/search/page.tsx`  
**Classification:** 🐞 Broken  

Every other listing admin page guards to `superuser` role. `/admin/search` only requires a non-null `adminRole`. Any admin-role holder can see all broker emails and admin user email/role mappings.

**Fix:** Add a `superuser` check consistent with adjacent pages, or explicitly document the intentional relaxed scope.  
**Severity:** P2

---

### P2-5: Seed resort communities gives zero user feedback

**Page:** `/admin/resort-communities`  
**Element:** "Seed resort communities" button  
**File:** `app/admin/(protected)/resort-communities/SeedResortButton.tsx:13`  
**Classification:** 🐞 Broken (UX)  

The DB write is correct — service-role UPSERT into `subdivision_flags`. The bug is UI-only: `SeedResortButton` has no `useState` for a result message and discards `result.count`. Success and failure are both silent. If the seed ran 0 rows, there is no way to know.

**Fix:** Add `useState<string | null>` for a result message. Display "Seeded N communities" on success, error text on failure. `EnsureGeoButton` on `/admin/geo` already implements this pattern — copy it.  
**Severity:** P2

---

### P2-6: "Reports" media scope shows all assets as Unused

**Page:** `/admin/media`  
**Element:** Reports scope tab — usage labels  
**File:** `app/actions/admin-media.ts:176` (getUsageMap)  
**Classification:** 🐞 Broken  

`getUsageMap()` handles `branding`, `brokers`, and `banners` scopes with DB lookups. The `reports` scope has no branch — the function returns an empty `usageMap` for all files in the `reports` bucket. Every reports asset shows "Unused" regardless of actual DB references.

**Fix:** Add a `reports` branch in `getUsageMap()` querying whatever table stores report image references.  
**Severity:** P2

---

### P2-7: Stock photo picker is browse-only — no "Save" action

**Page:** `/admin/stock-photos`  
**Element:** Per-photo card — no save/use action  
**File:** `app/admin/(protected)/stock-photos/StockPhotosPicker.tsx`  
**Classification:** ☠️ Dead  

The page is browse-only. No button saves a found stock photo to Storage, the `asset_library`, or `banner_images`. `PhotoCard` components have no action CTA. The workflow requires the user to note a code (S-123, P1, U2) then manually do something else with it. Server actions `setPlaceBannerFromPhoto()` and `uploadAdminMedia()` exist and work, but no UI wires to them.

**Fix:** Add per-card "Save as banner" or "Add to library" buttons that call the appropriate server action.  
**Severity:** P2

---

### P2-8: Blog status field is a free-text Input (not a Select)

**Page:** `/admin/blog`  
**Element:** Status field in new post form  
**File:** `app/admin/(protected)/blog/page.tsx:122`  
**Classification:** 🐞 Broken  

Status is a raw `<Input>` with `defaultValue='draft'`. Any string can be stored. If the DB has a CHECK constraint, a typo ("Publishd") causes a silent server error. If no constraint, the post never surfaces on `/blog` (which filters `status='published'`).

**Fix:** Replace with `<Select>` offering `draft` / `published` options.  
**Severity:** P2

---

### P2-9: Guide status field is a free-text Input (DB will throw on bad value)

**Page:** `/admin/guides`  
**Element:** Status field in new guide form  
**File:** `app/admin/(protected)/guides/page.tsx:62`  
**Classification:** 🐞 Broken  

Status is a raw `<Input>`. The `guides` table has a Postgres CHECK constraint: `status IN ('draft','published','archived')`. A typo causes the DB to throw, the error propagates as an uncaught exception in the server action, and Next.js renders a generic error page with no user-friendly feedback.

**Fix:** Replace with `<Select>` for `draft` / `published` / `archived`. Handle DB constraint errors gracefully.  
**Severity:** P2

---

### P2-10: Producer catalog SKILL.md file tracing risk on Vercel

**Page:** `/admin/producers`, `/admin/producers/[slug]`  
**Element:** `getAllProducers()` file-system scan  
**File:** `lib/producer-catalog.ts:149–156`  
**Classification:** ❓ UNVERIFIED  

`REPO_ROOT = path.resolve(__dirname, '..')` is correct at build time when `generateStaticParams()` runs and all `[slug]` pages are rendered statically. However, if the producers list page ever runs in a cold-start serverless context after a cache miss, `SKILL.md` files are not present in the Vercel function bundle unless `outputFileTracingIncludes` covers them. `next.config.ts` does not include the SKILL.md directories.

**Fix (safe):** Change `REPO_ROOT` to use `process.cwd()` in `lib/producer-catalog.ts`, OR add the skill directories to `outputFileTracingIncludes` in `next.config.ts`.  
**Severity:** P2 (potential cold-start failure in production; unverified without Vercel build trace)

---

### P2-11: "Run producer" button does not exist on producer detail page

**Page:** `/admin/producers/[slug]`  
**Element:** Absent "Run producer now" button  
**File:** `app/admin/(protected)/producers/[slug]/page.tsx`  
**Classification:** ☠️ Dead (missing feature)  

The producer detail page shows SKILL.md content and a change-request form only. The "Run producer now" button lives on `/admin/approval-queue` and requires a pre-existing `marketing_brain_actions` row — it triggers that row's execution, not a producer by slug. There is no way to trigger a producer from the catalog page.

**Fix:** Add a "Create action row for this producer" quick-start form on the detail page, or document the workflow: producer must first have a pending action row in the approval queue.  
**Severity:** P2

---

## P3 — Minor / polish

### P3-1: Broker result links in `/admin/search` unverified

**Page:** `/admin/search`  
**Element:** Broker row links → `/admin/brokers/edit?id=${row.id}`  
**Classification:** ❓ UNVERIFIED  

That route was outside audit scope. Link destination is plausible but not confirmed.  
**Severity:** P3

---

### P3-2: Producer placeholder image missing

**Page:** `/admin/producers`  
**Element:** ProducerCard and ExamplesGallery fallback image  
**File:** `app/admin/(protected)/producers/_components/ProducerCard.tsx:22`, `ExamplesGallery.tsx:22`  
**Classification:** 🐞 Broken  

Both components reference `/admin/producers/_placeholder.png` as a fallback for producers with no `example_outputs` frontmatter. The `public/admin/producers/` directory does not exist. Next.js `<Image>` shows a broken image for every producer without examples.

**Fix:** Create `public/admin/producers/` and add a `_placeholder.png` (simple gray tile), or change the fallback to a valid existing asset path.  
**Severity:** P3

---

### P3-3: Per-banner individual delete/regenerate/replace absent

**Page:** `/admin/banners`  
**Element:** Per-entity banner controls  
**File:** `app/admin/(protected)/banners/page.tsx`  
**Classification:** ☠️ Dead  

Only the bulk "generate missing" button exists. No per-entity Regenerate, Pick photo, or Delete controls. `setPlaceBannerFromPhoto()` and `refreshPlaceBanner()` server actions exist and work, but no UI exposes them. Individual banner management requires `/admin/media` + manual Storage deletion.

**Fix:** Add per-entity Regenerate and Pick photo buttons (low urgency unless Matt actively curates banners).  
**Severity:** P3

---

## Orchestrator stub (informational)

**Page:** `/admin/producers/[slug]`  
**Element:** EditProducerPanel — "Submit change request" success message  
**File:** `app/admin/(protected)/producers/_components/EditProducerPanel.tsx:77–79`  

The change request row IS written to `public.producer_change_requests` correctly. But the message "The orchestrator will draft a proposal when it next runs" is technically false — the orchestrator skill that polls pending rows and dispatches a subagent to draft the SKILL.md change is a noted TODO (Phase 10.5+ scope). The data is saved; nothing acts on it automatically.

**Fix (cosmetic):** Update the success message to "Change request saved. Matt will manually apply the change via CLAUDE.md skill update." until the orchestrator is built.

---

## Elements confirmed working (sample — full list traced in agent session)

All photo curation on listing editor (add/reorder/hero/delete) · All listing field saves (price, status, headline, notes, featured) · Expired listings pagination and city filter · Admin search form and status facets · Geo "Ensure geo places" and neighborhood create · Resort community Switch toggle (UPSERT correct) · Site-pages logo/hero/team image upload and URL save · SitePageEditor UPSERT to `site_pages` · All media scope tabs, upload, delete, force-unlink, copy-URL · Photo curation board (all approval tabs, bulk approve/reject/intake, surface tags, per-card controls, geo filters, pagination) · Stock photo three-source search (Shutterstock/Pexels/Unsplash), HTML review export · Blog post create + Supabase upsert · Guide create + Supabase upsert · Producer change request form → `producer_change_requests` table · Approval queue "Run producer now" → `/api/admin/run-producer/[id]` (fully wired, cost-capped, status transitions correct)

---

## Recommended fix order

| Pri | ID | Fix |
|---|---|---|
| P0 | P0-1 | `app/actions/banners.ts:328` — replace `getOrCreatePlaceBanner()` call with `fetchPlacePhoto()` → `downloadAndStoreBanner()` |
| P0 | P0-2 | `lib/data/cities/getCityMetadata.ts` — replace `supabaseAnon()` with `createServiceClient()` in 4 write functions |
| P0 | P0-3 | Confirm whether `/blog` (Next.js/Supabase) or AgentFire/WordPress is the canonical public blog |
| P1 | P1-1 | Blog post edit form + delete button + wire `deleteBlogPost` |
| P1 | P1-2 | Guide edit form + delete button + implement `deleteGuide` |
| P1 | P1-4 | Add `media_suppressed` toggle to `AdminListingEditor` + server action |
| P2 | P2-1 | Fix pagination total: use `fetchTileCount()` in `getAdminListingsPage()` |
| P2 | P2-2 | Add `BedroomsTotal`/`BathroomsTotal` to row-mapping in `admin-listings.ts` |
| P2 | P2-3 | Surface save errors in `ExpiredListingRow` |
| P2 | P2-4 | Add superuser guard to `/admin/search` |
| P2 | P2-5 | Add result feedback to `SeedResortButton` |
| P2 | P2-6 | Add `reports` scope branch in `getUsageMap()` |
| P2 | P2-7 | Add "Save as banner" / "Add to library" buttons to `StockPhotosPicker` photo cards |
| P2 | P2-8 | Replace blog status `<Input>` with `<Select>` |
| P2 | P2-9 | Replace guide status `<Input>` with `<Select>` |
| P2 | P2-10 | Fix `REPO_ROOT` in `lib/producer-catalog.ts` or add outputFileTracingIncludes |
| P2 | P2-11 | Add "Create action row" form to `/admin/producers/[slug]` |
| P3 | P3-2 | Create `public/admin/producers/_placeholder.png` |
| P3 | P3-3 | Add per-banner Regenerate/Pick photo controls |
