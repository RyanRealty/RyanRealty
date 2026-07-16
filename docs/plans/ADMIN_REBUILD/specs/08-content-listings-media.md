# Spec 08 · Content — Listings Admin, Site Pages, Media, Blog, Geo, Sync

> **Status:** ready to build. Gates coding for the CONTENT destination of the admin rebuild.
> **Derived from:** `00-REASONING-AND-ARCHITECTURE.md` (§4 forced decisions) + `audit-reports/content-geo-media.md` (evidence base).
> **Area owner surface:** the `CONTENT` destination in the target IA (§5): *listings · site pages · media · blog · communities · data health*.
> **Author cross-checked against live code** at commit `d3dd457a`. Where the audit and the live code disagree, this spec cites the code and states the correction (see §6.1 — the blog "unpublish is broken" finding is partially wrong: the live public DAL *does* filter `status`).

---

## 0. Scope, conformance, and what this spec is responsible for

### 0.1 Jobs this destination serves (tie to the core loop, C2)

CONTENT is the "deliverable + public-surface" support arm of the loop. It is **not** on the hot path of respond-to-a-lead; it is the maintenance surface that keeps the public site correct and the listing/market data trustworthy so the response half of the loop has accurate material to send. Its jobs, in priority order:

1. **"Is my MLS data fresh?"** — a one-line, broker-legible answer (§11). This is the only CONTENT job a *broker* (non-superuser) routinely needs.
2. **"Publish / unpublish a blog post or guide"** — SEO content that feeds organic lead flow (§6, §7).
3. **"Fix / curate one listing's public presentation"** — photos, owner-photo suppression, an internal note (§5). Superuser.
4. **"Flag a community as resort"** — the one real taxonomy control that restyles public community pages (§9). Superuser.
5. **"Get the right photo onto a place/banner"** — one media job, end to end (§10). Superuser.
6. **"Edit site branding / pages"** — collapsed to the handful of controls that a public page actually reads (§8). Superuser.

### 0.2 Architectural conformance (every decision below inherits these)

| Arch decision | How this spec applies it |
|---|---|
| **§4.4 one auth primitive, in-body** | Every server action and route handler in this domain calls `requireAdmin(capability)` **in its own body** — the layout gate is necessary but not sufficient (actions are independently-invocable POSTs). Closes the §0.1 CRITICAL. |
| **§4.4 capability map == nav** | The CONTENT nav + tabs are generated from the same capability map the guards enforce. A role without `content.geo.manage` never sees the Communities tab *and* the action refuses it. No dead-ends. |
| **§4.2 optimistic + idempotent** | Every mutation (photo add/delete/reorder, blog save, resort toggle, banner apply, sync trigger) returns the changed entity, carries an `idempotency_key` where a double-fire has a cost, and patches local state — no `router.refresh()` page fan-out. |
| **§4.3 one responsive tree** | Delete every `md:hidden` twin (listings browser, listing editor photos, settings). One container-query-driven component per surface, authored mobile-first. |
| **§4.5 one definition per number** | The sync "freshness" verdict resolves through one DAL definition (`getSyncFreshness`), rendered identically everywhere it appears. No hand-rolled count fan-outs on the hot path. |
| **§4.6 cached DAL + streaming** | Reference/aggregate reads (`getSyncFreshness`, banner-missing counts, listing counts) go through `unstable_cache` with tags; hot pages stream the shell and suspend data regions. Kill the public-site chrome/tracking bundle on `/admin/**`. |
| **§4.7 one canonical surface per concept** | ONE media library (kills 3 disconnected banner/imagery surfaces). ONE communities control (delete `geo_places`). ONE listings editor. Delete the accretion (§13). |
| **§8 done == round trip proven** | Every feature carries writer→store→reader→outcome acceptance criteria (§14). No placebo ships (RC6). |

### 0.3 Cross-spec seams (owned elsewhere; this spec consumes the contract)

- **`requireAdmin(capability)` + capability map + generated nav** — defined by the **Shell/IA + Auth** spec (foundation step, §7.1). This spec *lists the capabilities it needs* (§1.2) and *calls the guard*; it does not define the primitive.
- **Optimistic/idempotent mutation primitive** (`useOptimisticAction` client hook + server `idempotency_key` contract) — defined by the **Foundation** spec. This spec *uses* it.
- **CMA/BPO send + person workspace** — the send-center + person-workspace specs. A listing's "send this to a lead" is *not* in CONTENT; CONTENT stops at the public surface.
- **Metric layer** (`getLeadIntake` et al.) — analytics spec. The sync-freshness number is a CONTENT-local metric but follows the same one-definition rule.

---

## 1. Content foundation (applies to every § 4–11 feature)

### 1.1 The guarded mutation pattern — fixes the §0.1 CRITICAL

**Problem (verified):** Next.js server actions compile to public POST endpoints. The `(protected)` and per-route layouts gate *page rendering* only. Actions across this domain do service-role writes with **no in-body auth**: `saveBlogPost`/`deleteBlogPost`/`getAdminBlogPosts` (`app/actions/blog.ts:192-265`), `saveGuide`/`deleteGuide`/`getAdminGuides` (`app/actions/guides.ts:178-224`), `updatePageContent` (`app/actions/site-pages.ts:35-72`), the six `brokerage.ts` writers (`app/actions/brokerage.ts:63-240`), `geo-places.ts` writers, `subdivision-flags.ts` `setSubdivisionResort`/seed, `area-guide-upload.ts` uploaders. An unauthenticated caller can publish arbitrary HTML to the public site, flip resort flags, and upload files to public buckets.

**Fix — one shape, mechanically enforced.** Every mutating server action in `app/actions/{blog,guides,site-pages,brokerage,subdivision-flags,area-guide-upload,banners,asset-curation,admin-listing-detail}.ts` (and any new action file this spec creates) begins:

```ts
'use server'
import { requireAdmin } from '@/lib/auth/guards'   // NEW: throwing variant, see below

export async function saveBlogPost(input: SaveBlogInput): Promise<ActionResult<BlogPost>> {
  const ctx = await requireAdmin('content.blog.manage')   // throws AuthzError → caught by action-result wrapper
  // ...service-role write...
  await logAdminAction(ctx, { action_type: 'blog.save', resource_type: 'blog_post', resource_id: post.id })
  return ok(post)
}
```

- **`requireAdmin(capability)`** is added to `lib/auth/guards.ts` alongside the existing `getAdminContext()` / `requireAdminOr403()` (both already present and correct — `lib/auth/guards.ts:26-55`). It resolves the verified-session→email→role chain (never trusts input), checks the role against the capability map (§1.2), and **throws `AuthzError`** on failure (server actions can't return a `Response`; they throw, and the client mutation wrapper renders a permission-denied toast). Route handlers keep using `requireAdminOr403()`/`requireSuperuserOr403()` which already exist.
- **Reads of sensitive/service-role data get the same guard.** `getAdminBlogPosts`/`getAdminGuides` (they return unpublished drafts via the service role) call `requireAdmin('content.blog.manage')` / `'content.guides.manage'`.
- **Audit every mutation.** After the write, `logAdminAction(ctx, {...})` inserts into the existing `admin_actions` table (`admin_email, role, action_type, resource_type, resource_id, details, created_at` — schema verified). The current `site-pages.ts`/`geo-places.ts` bug where the audit runs *after* the write *with an empty email if no session* disappears — the guard runs first and there is always a `ctx.email`.

**Mechanical gate (§4.4).** Add `ci:content-authz` (a `scripts/check-content-authz.mjs`, wired into `ci:gates`) that AST-walks `app/actions/**/*.ts` and fails the build if any exported `async function` performs a `.from(...).{insert,update,upsert,delete}` or a storage `.upload/.remove` without a lexically-preceding `requireAdmin(` / `requireSuperuser(` call in the same function body. This is the enforcement-over-prose posture (CLAUDE.md "gates not prose") specialized to this domain's failure mode.

### 1.2 CONTENT capability map (consumed by the generated nav + every guard)

Roles are the existing three: `superuser | broker | report_viewer` (verified `app/actions/admin-roles.ts:11`). Capabilities this spec introduces (registered in the shared capability map owned by the Shell/IA spec):

| Capability | superuser | broker | report_viewer | Governs |
|---|:--:|:--:|:--:|---|
| `content.listings.view` | ✓ | ✓ | — | Browse listings, CSV export |
| `content.listings.edit` | ✓ | — | — | Listing overrides, photo curation, media suppression |
| `content.blog.manage` | ✓ | ✓ | — | Blog CRUD + publish |
| `content.guides.manage` | ✓ | ✓ | — | Guides CRUD + publish |
| `content.site.manage` | ✓ | — | — | Branding, site-page copy |
| `content.geo.manage` | ✓ | — | — | Resort/community flags, area-guide media |
| `content.media.manage` | ✓ | — | — | Media library, banners, stock, asset curation |
| `content.sync.view` | ✓ | ✓ | — | Read data-freshness answer |
| `content.sync.operate` | ✓ | — | — | Trigger sync, pause/abort, backfill |

**Resolution of the audit's role-mismatch bugs:** the media actions were "any admin role" while the page gated superuser (`content-geo-media.md §6.1`), and photo curation was open to `report_viewer` who could flip public imagery (`§6.2.1`). The capability map makes page-visibility and action-permission the same fact: `content.media.manage` is superuser-only, enforced in both the nav and every `admin-media.ts`/`asset-curation.ts` action.

### 1.3 CMS HTML sanitization — the stored-XSS half of the §0.1 CRITICAL

**Problem (verified):** `saveBlogPost` (once guarded, still authored-HTML) → `blog_posts.content` → `app/blog/[slug]/page.tsx:157,247` `dangerouslySetInnerHTML` with **no sanitization**. Same for guides → `app/guides/[slug]/page.tsx:164`. The reports page already sanitizes (it imports `sanitizeHtml`); blog + guides do not.

**Fix — sanitize at render, server-side, using the existing DOM-free sanitizer.** `lib/sanitize.ts` already exports `sanitizeHtml(html)` (strips `<script>/<style>/object/embed/form`, inline `on*=` handlers, `javascript:`/`vbscript:`/`data:` URIs, iframes) and `sanitizeHtmlWithEmbeds(html)` (same but keeps `<iframe>` for video). It is DOM-free by design (jsdom fails to bundle on Vercel — see the file header) so it runs in the serverless runtime.

- `app/blog/[slug]/page.tsx` — wrap the body: `dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithEmbeds(post.content) }}` (blog posts legitimately embed listing/video iframes). The JSON-LD script blocks stay as-is (they render `JSON.stringify(...)`, not user HTML).
- `app/guides/[slug]/page.tsx:164` — `sanitizeHtmlWithEmbeds(guide.content_html)`.
- Sanitize on **render**, not on save, so already-stored rows are covered without a backfill and the stored source stays inspectable. (Defense-in-depth: the guarded action + sanitized render together close the path.)

**Mechanical gate:** extend the existing brand/route gates with a check that any `dangerouslySetInnerHTML` under `app/{blog,guides,reports,area-guides}/**` whose payload is a DB column (not `JSON.stringify`) is wrapped in a `sanitizeHtml*` call. (Repo already has `check-*.mjs` scaffolding; this is one more.)

---

## 2. Data model (all changes additive + back-compatible)

No existing column is dropped in the first pass (RC-safe: back-compatible). Dead columns/tables are removed only after their UI is gone and a follow-up migration confirms zero readers.

### 2.1 New table — `listing_admin_overrides` (durable, sync-proof listing edits)

The core fix for the §0.2/§5 placebo listing editor. A separate table the MLS sync **never touches**, keyed to the listing, that named readers consult.

```sql
-- migration: 2026xxxx_listing_admin_overrides.sql  (additive)
create table if not exists public.listing_admin_overrides (
  listing_key        text primary key,              -- references listings.ListingKey (canonical)
  admin_notes        text,                           -- INTERNAL ONLY, never public
  featured           boolean not null default false, -- merchandising flag (reader = §5.4 open question)
  marketing_headline text,                           -- optional public headline (reader = §5.4 open question)
  updated_by         text,                           -- admin_email from the guard
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
-- RLS: locked; service-role only (same posture as listings). Reads go through DAL.
create index if not exists listing_admin_overrides_featured_idx
  on public.listing_admin_overrides (featured) where featured = true;
```

- **Sync never writes it.** `sparkToListingRow` / `syncWrites.upsertListingRows` operate only on `listings` (verified `lib/data/sync/syncWrites.ts:104-115` upserts on `ListNumber`; the mapper produces `details` wholesale — `lib/listing-mapper.ts:531`). This table is out of the sync's blast radius by construction, the same way `media_suppressed` (own column) and `listing_photos` (own table) already survive.
- **`admin_notes`** has a guaranteed reader from day one: the listings browser (a "has-note" indicator) and the editor. It is internal-only — never rendered on any public surface.
- **`featured` + `marketing_headline`** are built **only if** their public reader is built (§5.4 open question). RC6 discipline: no column ships to the UI without a live reader. If Matt declines the homepage featured rail and the public headline, these two columns are dropped from the migration and the editor omits them.

### 2.2 New table — `listing_photo_source` marker (make MLS-photo curation real)

**Problem (verified §5):** `getListingPhotos` is 3-tier (`listing_photos` → `details->Photos` MLS payload → `PhotoURL`, per `lib/data/listings/getListingPhotos.ts` header). For MLS-sourced listings `listing_photos` is empty, so tier-2 wins and the editor shows "No listing photos found" while the public page shows 40 MLS photos — deleting/reordering one MLS photo is impossible.

**Fix — no new table; a "Detach from MLS photos" action** (§5.3) that copies the current tier-2 MLS photo set into `listing_photos` rows (existing table, existing `appendListingPhoto`), after which tier-1 wins and per-photo curate/delete/reorder/hero works. A `source='mls_detached'` value in the existing `listing_photos.source` column marks these so a future sync-aware reconcile can offer "re-sync photos from MLS" (discard local curation). No schema change required — `listing_photos.source` already exists (verified snapshot).

### 2.3 Tables/columns to DELETE (after UI removal, in the §7 delete pass)

| Object | Why | Follow-up migration |
|---|---|---|
| `geo_places` (whole table) | Zero consumers repo-wide except its own admin action (§9.1); parallel dead taxonomy | `drop table geo_places` after `/admin/geo` UI removed |
| `brokerage_settings.hero_video_url`, `hero_image_url`, `team_image_url` | Zero readers since homepage rebuild (heroes are code-baked per `feedback_hero_video_default`) | drop the three columns after `HeroMediaForm`/`TeamImageForm` removed |
| `site_pages` rows for `about`/`sell` (+ `body_html` usage) | `body_html` read by nobody; only `contact` title consumed (`app/contact/page.tsx:75,89`) | keep the `contact` row; the generic page-body editor is deleted, not the table |

`brokerage_settings.logo_url` is **kept** — it has a real reader (PDF exports: `app/api/pdf/report/route.ts:33,63`, `app/api/reports/export/route.ts:73`).

### 2.4 Existing tables kept as source of truth

- **`listings`** (MLS-authoritative) — read-only for price/status/remarks (§5.1 decision).
- **`listing_photos`** / **`listing_videos`** — durable per-listing media curation.
- **`listings.media_suppressed`** — the owner-photo suppression flag; own column, sync-proof (verified: absent from mapper).
- **`subdivision_flags`** (`entity_key, is_resort`) + **`communities`** — the real community taxonomy (§9). Reader: `getResortEntityKeysFromFlags` → public community pages.
- **`blog_posts`** (`status` default `'draft'`, `published_at`, `scheduled_at`, `author_broker_id`) — the live public blog.
- **`guides`** (`status` default `'draft'`, `published_at`, `content_html`, `city`) — the live public guides.
- **`asset_library`** — the curated photo/video pool (§10 media curation).
- **`page_images`** — per-place hero/gallery images (§9 area-guide upload target).
- **`admin_actions`** — the audit ledger for §1.1.

---

## 3. IA placement (CONTENT destination)

CONTENT is one of the eight destinations (§5). Its internal shape — reached in one hop, generated from the capability map:

```
CONTENT
├─ Listings          content.listings.view   — browse/search/export; open one to edit (edit gated content.listings.edit)
├─ Blog              content.blog.manage      — list + editor
├─ Guides            content.guides.manage    — list + editor  (NO LONGER an orphan; §7.1 fix)
├─ Communities       content.geo.manage       — resort/master-plan flags (was /admin/geo/resort-communities)
├─ Media             content.media.manage     — ONE library: files · curation · banners · stock (§10)
├─ Site              content.site.manage       — logo + the handful of real page-copy controls (§8)
└─ Data health       content.sync.view         — freshness answer (broker) + Advanced cockpit (superuser, content.sync.operate)
```

A `broker` sees **Listings · Blog · Guides · Data health** (their capabilities); a `superuser` sees all seven; `report_viewer` sees none of CONTENT (it is a maintenance surface, not a reporting one). Because the nav is generated from the map, a broker never sees a Communities tab that would deny them — killing the RC5 dead-end class in this domain.

---

## 4. Feature — Listings browser (`/admin/listings`)

### 4.1 Purpose & keep/rebuild/delete

**Job:** find one listing fast (address / MLS / key), keyword-search remarks (public + the guarded private remarks), facet by status, export a filtered CSV. Verdict from audit: **works** with two real bugs. **Keep the core, fix the bugs, collapse the twin trees.**

- **KEEP:** `getAdminListingsPage` + `getListingTiles`/`getListingTilesCount` against `listing_tile_mv` (`app/actions/admin-listings.ts:11-71`); `searchAdminRemarksPage` → `searchAdminListingsRemarks` (guarded by `getAdminContext()` at `admin-listings.ts:86-88` — correct); the merged CSV export panel (`runQueryBuilderSearch`, 500-row cap, good empty/loading/error states).
- **REBUILD:** the `md:hidden` card list + `hidden md:block` table (`page.tsx:256-306` / `309-380`) → **one** responsive `<ListingsResults>` that renders rows as cards on narrow containers and a table on wide ones via a container query, authored once.
- **DELETE:** dead `SELECT` const + `void SELECT` (`admin-listings.ts:6-7,22`); the `Input type="checkbox"` → design-system `<Checkbox>` (`page.tsx:167`).

### 4.2 Fixes (each a named audit defect)

1. **Remarks-mode pagination drops the mode** (§1.1). `pageHref()` (`page.tsx:66-73`) omits `remarks`. Fix: `pageHref`/`statusHref` carry the full query state (`page, search, status, remarks`). Round trip: search remarks → page 2 stays in remarks mode.
2. **Render `privateOnlyKeys`** (§1.3). `searchAdminRemarksPage` already returns which rows matched *only* private remarks (`admin-listings.ts:115-117`). Show a small "private match" badge on those rows so the operator knows why a listing surfaced. (Data path already built; just consume it.)
3. **DOM consistency** (§1.6). Use `CumulativeDaysOnMarket` from the MV (matches the public site) rather than recomputing from `OnMarketDate` at render (`page.tsx:42-48`), so the admin DOM equals the public DOM for relisted properties. (§C4: the same number everywhere.)
4. **Stale-source honesty** (§1.2). The list reads `listing_tile_mv`; the editor reads live `listings`. `listing_tile_mv` has gone 8 days stale silently before (`reference_mv_refresh_timeout_incident`). Render a small "MV refreshed <relative time>" stamp sourced from the same `getSyncFreshness` metric (§11) so the operator can trust or distrust the list. This is a §C4 integrity affordance, not decoration.

### 4.3 States, responsive, performance, acceptance

- **States:** empty (no listings / no match — clear copy, not a blank table), loading (streamed skeleton rows via `<Suspense>`, §4.6), populated, error (query failed — retry, not a silent zero), permission-denied (broker without `content.listings.view` never reaches it; nav-generated).
- **Responsive:** one tree; cards ≤ container `sm`, table above. Search box present at every width (the old desktop tree lacked it — `crm-people.md` parity bug class).
- **Performance:** the page streams its chrome; results suspend. Counts come from the cached `getListingTilesCount`, not a live fan-out per keystroke. Search input debounced 300 ms before it navigates.
- **Acceptance (writer→store→reader→outcome):**
  - [ ] Search "Awbrey" → results render < 1 s (cached MV read); tap a row → listing editor opens (1 search + 1 tap).
  - [ ] Remarks search with > 50 matches → "Next" stays in remarks mode and returns page 2 of remarks matches (not an address search).
  - [ ] A row that matched only private remarks shows the "private match" badge.
  - [ ] CSV export: expand panel → 3 filters → Run → Download → file has the filtered rows; > 500 shows the "download for full set is capped" hint.
  - [ ] Same listing's DOM equals the public listing page's DOM.

---

## 5. Feature — Listing detail + editor (`/admin/listings/[listingKey]`)

**This is the domain's headline decision.** Audit verdict: **broken for its core promise** — price/status/remarks edits silently revert on the next MLS sync (§0.2 CRITICAL), and featured/headline/notes have zero readers (§0.3).

### 5.1 THE DESIGN DECISION (hybrid; both halves of the prompt's OR, applied to the right fields)

The prompt asks: *a real `admin_overrides` layer the sync respects + reader consults, OR remove the fields the sync reverts.* **The correct answer is field-by-field, because the two field classes have opposite correct treatments:**

**(A) MLS-authoritative fields — `ListPrice`, `StandardStatus`, `details.PublicRemarks` → REMOVE the editors. Render read-only.**

- **Why remove, not override:** these are MLS-owned. A broker-typed *override* of the list price that then diverges from what the MLS carries is not a feature — it is a **§C4 data-accuracy / compliance violation** (a wrong price on `ryan-realty.com` next to the MLS-true price is exactly the "publishing inaccurate data is a license risk" case in CLAUDE.md §0). The current editor doesn't even achieve the override — it writes `listings.ListPrice` in place and the delta sync overwrites it on the next change of that listing (verified: `sync-delta/route.ts:276-283` builds `cleanRow` from `sparkToListingRow`, upserts on `ListNumber`; `details` replaced wholesale by `lib/listing-mapper.ts:531` with no merge). So today it is a silent-revert illusion **and** a divergence risk. Removing the fields kills both.
- **What the editor shows instead:** these three fields render **read-only**, labeled *"From MLS · last synced &lt;relative time&gt;"* (freshness from §11's metric). If a price looks wrong, the fix is a resync, not a hand-edit. There is no keyboard path to a wrong public price.

**(B) Broker-owned, non-MLS data — via the durable `listing_admin_overrides` table (§2.1), which the sync never touches and named readers consult.**

- **`admin_notes`** (internal only) — kept, always has a reader (§5.4a).
- **`featured`, `marketing_headline`** — kept **only if their public reader is built** (§5.4 open question). RC6: no placebo.
- **`media_suppressed`** — kept as-is (own column, already sync-proof, the one genuinely durable control the audit praises).
- **`listing_photos` curation** — kept, made real for MLS listings via §5.3.

### 5.2 Editor fixes (each a named audit defect)

1. **Remove filter-string interpolation** (§2.1). `updateAdminListingMediaSuppressed`'s `.or(\`"ListingKey".eq.${key},"ListNumber".eq.${key}\`)` (`admin-listing-detail.ts:240`) breaks on a key containing `,`/`)`. Fix: resolve the canonical `ListingKey` once (there is already `resolveCanonicalListingKey` in the DAL) and use a single `.eq('ListingKey', canonicalKey)`; never interpolate a URL param into a PostgREST filter string.
2. **No silent no-op writes** (§2.2). Today if the row is found by `ListNumber` but `ListingKey` is null, `.eq('ListingKey', key)` matches 0 rows and returns "saved" (`listingEdit.ts:81`). Fix: every override write goes to `listing_admin_overrides` keyed by the **resolved canonical key**, and the action returns the persisted row; a 0-row write is an error surfaced to the user, never a success toast.
3. **No fake `ModificationTimestamp`** (§2.3). Overrides live in their own table with their own `updated_at`; the editor stops stamping `listings.ModificationTimestamp = now()` (which corrupted "last modified" + any freshness logic).
4. **Atomic hero + transactional reorder** (§2.4, §2.5). `setListingHeroPhoto` (reset-all-then-set-one) and `reorderListingPhotos` (N sequential updates) become single RPCs (a `plpgsql` function per op, or a single `update ... case` statement) so a mid-operation failure can't leave no-hero or a half-applied order. On error the client **reverts** the optimistic state (today it leaves the optimistic order on screen — `AdminListingEditor.tsx:156-178`).
5. **Drop the per-view count fan-out** (§2.6). `getAdminSyncCounts()` runs ~15 exact-count queries over the 589K-row table on **every** detail view to render a two-number vanity card (`page.tsx:38,76-81`). Delete that card. If a freshness number is wanted here, read the cached `getSyncFreshness` (§11), not a live fan-out.
6. **Design-system dialogs** (§2.8). Photo delete + suppression toggle use `window.confirm` — replace with `<Dialog>`/`<AlertDialog>`. After a photo mutation, patch local state from the action's returned row (optimistic, §4.2) rather than refetching the whole editable payload (`refreshPhotosFromServer`).

### 5.3 Make MLS-photo curation real ("Detach from MLS photos")

For a listing whose photos come from tier-2 MLS payload (empty `listing_photos`), the editor shows the live photo set with a single action: **"Curate these photos"** → copies the current MLS photo URLs into `listing_photos` rows (`source='mls_detached'`, existing `appendListingPhoto`), after which per-photo delete/reorder/set-hero work (tier-1 now wins). A companion **"Reset to MLS photos"** deletes the local `listing_photos` rows (discard curation, fall back to tier-2). This turns the audit's "deleting one photo out of an MLS set is impossible" (§2 row 7) into a two-state, reversible, explicit flow.

### 5.4 Open-question-gated fields (RC6-safe)

- **(a) `admin_notes`** — build now. Reader: listings browser "has-note" dot + the editor. Internal only.
- **(b) `featured` + `marketing_headline`** — build the columns + editor controls **only** with their reader:
  - `featured` reader = a `getFeaturedListings()` DAL feeding a homepage/`/homes-for-sale` "Featured" rail.
  - `marketing_headline` reader = the public listing detail page H-slot (brand-voice: broker-written listing remarks are exempt from the voice gate, so a broker headline is allowed).
  - If Matt declines either, that column is dropped from the §2.1 migration and its control is not built. **See §15 Q1.**

### 5.5 States, responsive, edge cases, acceptance

- **States:** loading (streamed; the editor chrome paints instantly, photo grid + override form suspend), populated, pending/optimistic (photo add shows a "uploading" tile; note-save shows a saving pill), success (inline, not a toast that the next action clobbers), partial (reorder failed mid-list → revert + error), error, permission-denied (non-superuser: the row is not reachable; `content.listings.edit` guards both nav and action).
- **Responsive:** one photo-grid tree (delete the `md:hidden` card/table twin at `AdminListingEditor.tsx:353-511`); drag-reorder on pointer + a "move up/down" affordance for touch.
- **Edge cases (exhaustive):**
  - *Listing has no `ListingKey`, only `ListNumber`* → canonical-key resolver returns the ListNumber-derived key; override writes to that key; no silent 0-row write.
  - *MLS sync overwrites the listing mid-edit* → price/status/remarks are read-only so there's nothing to lose; `admin_notes`/photos live outside the sync's tables, so they survive. The read-only price simply shows the new synced value.
  - *Concurrent superuser edits the same note* → `listing_admin_overrides` write is last-writer-wins on a single row; `updated_by`/`updated_at` record who/when; the editor shows "edited by X <time>" so the second editor sees they overwrote.
  - *Duplicate submit of a photo-add* → `idempotency_key` on the append makes the second POST a no-op returning the first result (§4.2).
  - *Detach-from-MLS run twice* → second run is a no-op if `listing_photos` already has `mls_detached` rows for the key (guard on existing rows).
  - *Key with `,`/`)` in it* → single `.eq` on the resolved key; no filter-string break.
  - *Suppression toggled on a listing that renders from tier-2* → `media_suppressed` gates all three photo getters + detail `photoUrl` regardless of tier (verified `reference_listing_media_suppression`), so suppression works even without local photos.
- **Acceptance (writer→store→reader→outcome):**
  - [ ] Price/status/remarks render read-only with a "from MLS · synced <time>" label; there is **no** input that writes them.
  - [ ] Add an `admin_note` → reload → note persists → trigger a delta sync of that listing → note **still** persists (proves sync-proof).
  - [ ] Suppress owner photos → public listing page hides photos (2 clicks + Dialog confirm).
  - [ ] "Curate these photos" on an MLS listing → photos appear as tier-1 rows → delete one → public page shows the reduced set.
  - [ ] Set hero → a mid-op DB failure (injected in test) leaves the **previous** hero intact, not zero heroes.
  - [ ] No detail view issues the 15-count fan-out (network panel shows the count queries gone).

---

## 6. Feature — Blog (`/admin/blog`)

**Audit verdict:** partial — list/create/edit run; unpublish, authorship, slug-rename broken; stored-XSS door. **Correction after code cross-check:** the audit's "Draft doesn't unpublish" is **partially wrong**. The live public readers **do** filter `status`: `getPublishedBlogPosts` uses `.eq('status','published').not('published_at','is',null)` (`lib/data/blog/getPublishedBlogPosts.ts:77-78`) and `getBlogPostBySlug` uses `.eq('status','published')` (`lib/data/blog/getBlogPostBySlug.ts:61`). So flipping to Draft and saving **does** remove the post from the public site. The real bug is that the **admin list badge derives from `published_at`, not `status`** (`page.tsx:99,435`), so the admin sees "Published" after choosing Draft — the Select looks like a decoy even though it works. Fix the badge, and status becomes the honest switch.

### 6.1 Keep / rebuild / delete

- **KEEP:** `blog_posts` as the live public blog (`blog-publish-path` memory confirms `/blog` is canonical, not AgentFire); the public DAL readers (`lib/data/blog/*` — correct); the `saveBlogPost`/`deleteBlogPost` action shells (rebuild their bodies).
- **REBUILD:** the editor page (`blog/page.tsx`, 488 lines, fully client) and the save semantics.
- **DELETE:** none in blog itself, but see §7.1 for the ~150 lines of dead duplicate guide readers (same anti-pattern lives in `guides.ts`, not `blog.ts`).

### 6.2 Fixes

1. **Guard + audit** every action (§1.1) — `content.blog.manage`.
2. **Badge on `status`, not `published_at`** — the admin list shows Draft/Published/Scheduled from the `status` column; the Select becomes the real control.
3. **Clean publish semantics.** `status` is the switch. `published_at` is set **once**, when a post first goes `published` (and left thereafter, so re-editing a live post doesn't churn its date). `scheduled_at` + `status='scheduled'` drives a scheduled publish (a cron already runs the blog cadence per `blog_settings`; the scheduled-publish sweep flips `scheduled → published` at `scheduled_at`). Draft: `status='draft'`, post disappears from public (proven by the DAL filter).
4. **Preserve the author byline** (§7.1.2). Add an **Author** `<Select>` (brokers from `getBrokers`) to the form; carry `authorBrokerId` through save; on edit, pre-fill it from the existing `author_broker_id`. Today edit nulls the byline because the field isn't carried. The public byline (name/photo/slug) resolves from `author_broker_id` (`blog.ts:80-95`).
5. **Fix slug rename / overwrite hazard** (§7.1.3). Stop upserting `onConflict:'slug'` while carrying an `id`. Instead: **new post** → plain `insert` (unique-slug violation → friendly "slug taken" error, not a silent overwrite of someone else's post); **edit** → `update ... where id = :id` (a slug change is just a column update on that id, no PK collision). This removes both the "rename errors" and "typing an existing slug silently overwrites that other post" bugs.
6. **Sanitize on render** (§1.3) + a **live preview** pane (sanitized) beside the HTML textarea so the author sees the rendered result before publish (the audit's "no preview at any point").
7. **Revalidate the post's own URL.** After save, `revalidatePath('/blog')` **and** `revalidatePath('/blog/' + slug)` (today only the index is revalidated — `blog.ts:249-251`, so an edited post stays stale on its own URL).
8. **Don't ship the whole corpus to the client** (perf, §7.1). `getAdminBlogPosts` currently returns full `content` of every post (500-row limit) to render a 6-item list. Split: the list view selects `id,title,slug,status,published_at,category,author_broker_id` only; the editor lazy-loads one post's `content` when opened.
9. **Design-system delete** (`<AlertDialog>`, not `window.confirm`+`alert`).

### 6.3 States, responsive, edge cases, acceptance

- **States:** empty (no posts — "Write your first post" CTA), loading (streamed list skeleton), populated, pending/optimistic (Save shows a saving pill; the row's badge updates optimistically), success, error (slug taken, DB error — inline), permission-denied (nav-generated; broker has the cap, report_viewer doesn't).
- **Responsive:** one form tree, mobile-first; the raw-HTML textarea + preview stack vertically on narrow, split on wide. (The audit calls an 11-field raw-HTML form on a phone "hostile" — the mobile-first rebuild groups fields into a short scrollable form with the preview one tap away.)
- **Edge cases:**
  - *Flip to Draft on a live post* → `status='draft'` → post gone from `/blog` and `/blog/[slug]` (404/hidden) → admin badge shows "Draft" (both now honest).
  - *Edit a live post's body* → `published_at` unchanged (no date churn) → `/blog/[slug]` revalidated → new body live.
  - *Type an existing slug on a new post* → unique violation → "slug already in use" → the other post is untouched.
  - *Rename a slug* → `update where id` succeeds → old URL 404s (expected), new URL live; (optional 301 map is out of scope — note in §15 if SEO redirect wanted).
  - *Schedule for a past time* → the sweep publishes on next run; the form warns if `scheduled_at` is in the past.
  - *Unsanitized `<script>` in body HTML* → stored as-is, stripped at render by `sanitizeHtmlWithEmbeds` → no execution.
  - *Session expires mid-edit* → the guarded save throws AuthzError → the mutation wrapper shows "session expired, sign in" and preserves the unsaved draft in the form (no data loss).
- **Acceptance:**
  - [ ] New post → Publish → appears on `/blog` and `/blog/[slug]` within one revalidate.
  - [ ] Edit that post → Draft → Save → gone from both public URLs; admin badge reads "Draft".
  - [ ] Edit an authored post's body → byline (name + photo) unchanged on the public page.
  - [ ] Paste `<img src=x onerror=alert(1)>` into the body → public render has no `onerror`.
  - [ ] The admin list network response does not contain post bodies.

---

## 7. Feature — Guides (`/admin/guides`)

**Audit verdict:** partial/orphaned — not in nav, dead duplicate DAL, and a **public/admin source-of-truth split** (the public DAL synthesizes ~12 "guides" from `market_stats_cache` when the table is empty; admin can't see or edit them). Plus the §0.1 unauthenticated actions + unsanitized render.

### 7.1 Fixes / keep / rebuild / delete

1. **Put it in the nav** (§7.2.1) — Guides is a first-class CONTENT tab (`content.guides.manage`), no longer reachable only from a collapsed dashboard panel (`DashboardContentStatusPanel.tsx:53`).
2. **Guard + audit** every action (§1.1); **sanitize** `guide.content_html` at render (§1.3, `app/guides/[slug]/page.tsx:164`).
3. **DELETE the ~150 lines of dead duplicate readers** in `app/actions/guides.ts` (`getPublishedGuides`/`getGuideBySlug`/`getGuidesByCity`/`getGeneratedGuidesFromStats` — zero importers; public pages import from `@/lib/data`; the two copies have already diverged, §7.2.3). The canonical readers are `lib/data/guides/getGuides.ts` (verified in DAL index). Also delete the vestigial `void supabase` + dead `error` const (`guides.ts:96-103`).
4. **Resolve the source-of-truth split — REMOVE the synthesized fallback** (`lib/data/guides/getGuides.ts:106-125`, the `market_stats_cache`-derived pseudo-guides). **Rationale (§C4 / §0):** those synthesized guides ship market claims (medians, trends) sourced from a cache row **with no verification trace** — a data-accuracy exposure on the public site. After removal, `/area-guides` renders only real `guides` rows, so admin and public agree about what exists (the audit's "admin shows 'No guides yet' while /area-guides lists a dozen" split disappears). If Matt wants generated area guides, they get built through the verified market-report/blog producer path (with a citation trace), not synthesized silently at read time. **See §15 Q2.**
5. **Fix `published_at` churn** (§7.2). Same clean semantics as blog (§6.2.3): set `published_at` once on first publish; stop resetting to `now()` on every published save (`guides.ts:210`).
6. **Fix slug-rename hazard** — same insert/update split as blog (§6.2.5).
7. **Unify the editor with blog.** Guides and blog are the same shape (title, slug, HTML body, status, publish, SEO). Build **one** `<ContentEditor>` component parameterized by content-type (`blog_posts` vs `guides`), one save-semantics helper, one preview, one sanitizer. This is §4.7 (one canonical surface per concept) applied within CONTENT — two content types, one editor, not two divergent 400-line pages.

### 7.2 States, edge cases, acceptance

- **States/responsive:** identical to blog (§6.3) — they share the component.
- **Edge cases:** *table empty after fallback removal* → `/area-guides` shows an honest empty/curated state, not synthesized prose; *a guide's `city` doesn't match a real city* → still renders (city is a free-text tag), but the editor offers a `<Select>` of known cities to avoid typos.
- **Acceptance:**
  - [ ] Create a guide → Publish → visible at `/guides/[slug]` (sanitized) and listed on `/area-guides`; admin list shows it.
  - [ ] `/area-guides` shows **only** rows that exist in `guides` (no synthesized entries the admin can't edit).
  - [ ] Editing a published guide does not change its `published_at`.
  - [ ] `grep app/actions/guides.ts` for `getPublishedGuides` returns nothing (dead dupes gone).

---

## 8. Feature — Site (branding + page copy) (`/admin/site-pages` → CONTENT ▸ Site)

**Audit verdict:** dead-in-effect — four CRUD forms over mostly-unconsumed columns, every one reporting success for a write with no visible effect (the single largest trust-destroyer, §0.3). **Decision: collapse to only the controls a public surface actually reads; delete the placebos.**

### 8.1 Per-surface keep/delete (verified consumers)

| Current form | Verified reader | Decision |
|---|---|---|
| Site logo → `brokerage_settings.logo_url` | PDF exports (`app/api/pdf/report/route.ts:33,63`; `app/api/reports/export/route.ts:73`) | **KEEP** — relabel "Logo (used on PDF exports)" so the effect is honest. Guard + audit. |
| Homepage hero video/image → `hero_video_url`/`hero_image_url` | **nobody** (heroes are code-baked, `feedback_hero_video_default`) | **DELETE** the `HeroMediaForm` + the three columns (§2.3). |
| Team image → `team_image_url` | **nobody** | **DELETE** the `TeamImageForm`. |
| Page content (About/Sell body_html) → `site_pages.body_html` | **nobody** | **DELETE** the generic body editor. |
| Page content (Contact title) → `site_pages.title` for `contact` | `/contact` reads title only (`app/contact/page.tsx:75,89`) | **KEEP** a tiny purpose-built "Contact page heading" field wired to that one consumed value. |

- **No more success toasts for no-op writes.** Every remaining Site control reports success only for a value a public page reads. `updatePageContent`'s revalidation of `/about`/`/sell`/`/` (pages that don't read the data — `site-pages.ts:68-71`) is removed with the editors.
- **Dirty-check** on the logo/contact editors (the audit notes `SitePageEditor` loses unsaved work with no dirty-check).
- **Uploads don't create buckets on the fly** (`brokerage.ts:82-85`) — buckets are provisioned by migration; the action fails loudly if a bucket is missing rather than creating one implicitly.

### 8.2 States, acceptance

- **States:** loading, populated, pending/optimistic (logo upload shows progress), success (only when a reader will reflect it), error, permission-denied (`content.site.manage`, superuser-only).
- **Acceptance:**
  - [ ] Upload a new logo → generate a PDF report → the new logo appears in the PDF (proves the one real reader).
  - [ ] There is **no** homepage-hero or team-image form anywhere (deleted).
  - [ ] Edit the contact heading → `/contact` shows the new heading.
  - [ ] No Site control shows a success message for a value no page reads.

---

## 9. Feature — Communities (resort flags) + geo deletion + area-guide upload

### 9.1 DELETE `/admin/geo` (the `geo_places` hierarchy editor)

**Audit verdict:** dead — the entire `geo_places` table has zero consumers repo-wide except its own admin action (`grep -rln geo_places` outside `app/actions/geo-places.ts` = nothing; confirmed against DAL index — `geo_places` is not referenced by any `lib/data/**` function). It maintains a parallel taxonomy the site never reads; the real taxonomy is `subdivision_flags` + `communities` + `data/resort-communities.json` + `neighborhood_subdivisions`.

- **DELETE** `app/admin/(protected)/geo/page.tsx`, `NeighborhoodForm.tsx`, `AssignCommunity.tsx`, `EnsureGeoButton.tsx`, and `app/actions/geo-places.ts` (all of it — `createGeoPlace`/`updateGeoPlace`/`ensureGeoPlacesFromListings`/`listGeoPlaces`). Then drop the `geo_places` table (§2.3). This also erases the §0.1 unauthenticated geo actions and the CITY_CAP=12 unreachable-cities bug and the N+1 seeding — by deletion, the cleanest fix.

### 9.2 KEEP + fix Communities (resort/master-plan flags) — the real taxonomy control

**Audit verdict:** the best surface in the domain, wired end-to-end to public community pages via `getResortEntityKeysFromFlags`. Becomes **CONTENT ▸ Communities**.

- **KEEP:** `listSubdivisionsWithFlags()` (three-source merge + canonical-city normalization incl. the Crosswater dual-city fix, `subdivision-flags.ts:103-173`); `upsertSubdivisionResortFlag` + resort backfill; the public read path.
- **Fixes:**
  1. **Guard + audit** `setSubdivisionResort`/seed (§1.1, `content.geo.manage`) — closes the §0.1 hole where an unauthenticated caller could restyle public community pages.
  2. **Surface backfill failures** (§4.5). `backfillResortCommunityData` failures are swallowed to Sentry (`subdivision-flags.ts:75-80`) — the flag flips but the community page can render without hero/content and the admin never learns. Fix: the toggle action returns `{ flag_ok, backfill_ok, backfill_error }`; the UI shows a warning row ("flag set, but banner/content generation failed — retry") instead of a silent success.
  3. **Real failure feedback** on `SeedResortButton` (ignores `result.ok===false` today) and `ResortCommunityToggle` (reverts silently) — both show inline error text.
  4. **Stop the full-table fetch per toggle** (§4.4, §4.2). Today each toggle does optimistic-set + `router.refresh()`, which re-runs `listSubdivisionsWithFlags()` (the whole snapshot + all flags) — for every switch flip. Fix: the toggle returns just the changed flag row; the client patches that one row (§4.2 optimistic). The full-table read stays cached (`unstable_cache`, tag `subdivision_flags`) and is invalidated only by a mutation, not re-run per interaction.
- **KEEP** the good mobile fork behavior but as **one** responsive tree (cards ≤ `sm`, table above), not `md:hidden` twins.

### 9.3 Fix area-guide upload (`/admin/geo/area-guide-upload` → CONTENT ▸ Communities ▸ Media)

**Audit verdict:** broken for anything but a tiny photo folder — a whole place's files go through a single server-action FormData, and `next.config` caps `serverActions.bodySizeLimit` at **4mb** (verified `next.config.ts:224`); one MP4 or a folder of hero JPEGs aborts with an opaque body-size error.

- **REBUILD the transport: direct-to-storage signed uploads.** The client requests a signed upload URL per file from a guarded route (`content.geo.manage`), uploads each file **directly to Supabase Storage** (bypassing the 4mb server-action limit entirely), then calls a small guarded action to record `page_images` rows / hero fields for the successfully-uploaded files. This is the standard large-file pattern and the only way videos ever fit.
- **Per-file progress + resumable** — the loop no longer stops-and-discards on first failure (§5.3); each file has its own progress + retry.
- **No silent taxonomy creation.** `uploadAreaGuideFolder` currently can create `cities`/`neighborhoods`/`communities` rows as a side effect (`area-guide-upload.ts:212-231`). The rebuild **maps to existing** entities via a `<Select>`; creating a new place is an explicit, separate, confirmed action — not a hidden consequence of an upload.
- **Revalidate the affected place pages** after upload (today it just says "refresh the site").
- **Design-system** modal/table/buttons (replace the hand-rolled `div fixed inset-0`).
- **iOS note:** `webkitdirectory` folder-pick doesn't work on iOS Safari; the rebuild supports multi-file pick (works on iOS) in addition to folder pick, with a clear note when folder-pick is unavailable — so the surface isn't silently desktop-only.

### 9.4 States, acceptance

- **Acceptance:**
  - [ ] Flag a subdivision resort → the public `/communities/[slug]` page renders the resort treatment (hero + amenities + schema); if backfill fails, the admin sees a warning, not a success.
  - [ ] `/admin/geo` (geo_places editor) returns 404 (deleted); `grep geo_places` in `lib/` and `app/` (excluding the migration) returns nothing.
  - [ ] Upload a 60 MB drone MP4 to a place → it lands in storage + a `page_images`/hero row → the place page shows it. (Proves the 4mb cap is gone.)
  - [ ] Toggling five flags in a row issues five single-row writes, not five full-table refetches.

---

## 10. Feature — Media library (ONE surface) (`/admin/media*` → CONTENT ▸ Media)

**Audit verdict:** four disconnected surfaces (Library / Photo curation / Banners / Stock photos) that never complete the actual job — *"this place needs this photo."* Two real actions exist with **no UI consumer** (`refreshPlaceBanner`, `setPlaceBannerFromPhoto` — `app/actions/banners.ts:201`). **Decision (§4.7): ONE media library with the job wired end to end; kill the disconnected surfaces.**

### 10.1 Unified structure — one page, four modes, one shared "apply to place" flow

```
CONTENT ▸ Media
├─ Files       (was Library)      browse/upload/delete storage files, usage-reference tracking, force-unlink
├─ Curation    (was Photos)       approve/reject asset_library → flips live site imagery (updateTag(cacheTag.assets))
├─ Banners     (was Banners)      places missing hero banners → generate (bulk OR per-place)
└─ Find photo  (was Stock)        search Shutterstock/Pexels/Unsplash → PICK → apply to a place  ← the missing back half
```

- **KEEP the working cores:** `admin-media.ts` (Files — properly guarded, usage map, audit), `asset-curation.ts` `curateAssets` (Curation — guarded, validated, tag-revalidated, works end-to-end), `listMissingBanners` (cached 5 min) + `generateAllMissingBanners` (Banners).
- **WIRE the dead back-half of Stock → the whole point of the surface.** "Find photo" search results each get an **"Use for place…"** action → a place `<Select>` → calls the **existing** `setPlaceBannerFromPhoto` (`banners.ts:201`, currently has no UI). Picking a photo now *does something*. This completes the "place needs this photo" job in one surface.
- **WIRE per-place banner generation.** The existing `refreshPlaceBanner` (no UI consumer today) becomes the "Generate this one" button on each row of the Banners "missing" list — fixing the audit's "no way to generate ONE place's banner from here."
- **Cross-link the modes:** a place shown as "missing banner" links to "Find photo" pre-filtered to that place; a curated asset links to where it's used. One flow, not four islands.

### 10.2 Fixes

1. **One capability, correctly gated** (§1.2). All four modes require `content.media.manage` (superuser). This closes the two role bugs: Files actions were "any admin role" while the page gated superuser; Curation was open to `report_viewer` who could flip public imagery (§6.2.1). Nav + action agree now.
2. **Debounce Files search** — today each keystroke fires a full server round-trip that re-lists the bucket AND rebuilds the usage map (`AdminMediaManager.tsx:98-114`). 300 ms debounce; the usage map is cached (`unstable_cache`, tag per scope) and not rebuilt per keystroke.
3. **No external API calls on tab mount** — Stock fires three external search GETs on mount with a default query (`StockPhotosPicker.tsx:213-215`), burning quota every open. Fix: search runs only on an explicit submit; the tab opens empty with a prompt.
4. **Force-unlink is per-action, not a global mode** — the current global checkbox (`AdminMediaManager.tsx:263-272`) is a footgun; make it a per-delete confirmation ("this file is referenced by X — delete anyway?").
5. **No env-var leakage to the UI** — Stock error text ("Check SHUTTERSTOCK_* env vars", `lines 336/358/386`) and Banners dev-doc copy ("Set UNSPLASH_ACCESS_KEY in .env.local…", `banners/page.tsx:26-29`) are replaced with broker-legible copy. Missing config surfaces as "photo search is unavailable — contact support," logged server-side.
6. **Bulk generate resilience** — `generateAllMissingBanners` is a single long server action with no per-item progress that loses everything on a Vercel timeout. Chunk it (reuse the bulk-job framework the arch keeps, §3) with per-place progress + resume; or cap per invocation and show "N of M generated, run again for the rest."
7. **Design-system delete** (`<AlertDialog>` not `window.confirm`); one message slot that isn't clobbered by the next search refresh.
8. **DAL-boundary fix:** Curation currently queries `asset_library` with `createServiceClient()` **in the page component** (`media/photos/page.tsx:29-56`) — a G1 boundary violation surviving via the service client. Move the read into a `lib/data/media/getCurationQueue.ts` DAL function.

### 10.3 States, edge cases, acceptance

- **States:** empty (no files / no missing banners — "all places have banners" is a *good* empty state, say so), loading (streamed), populated, pending/optimistic (approve flips the tile immediately; apply-to-place shows "applying"), success, partial (bulk generate: "40 of 52 done"), error (external API down — degrade the "Find photo" mode, keep the others working), over-limit (external quota exhausted — clear message, not a stack trace), permission-denied (nav-generated).
- **Edge cases:**
  - *Delete a file referenced elsewhere* → per-action force-unlink confirm; the usage map warns even for references outside its queries (label "usage detection is best-effort" so "Unused" doesn't invite blind deletion — audit §6.1.4).
  - *Apply a stock photo to a place, then the place gets a real listing hero* → the banner is a place-level asset, independent of listing photos; no collision.
  - *Approve an asset while a sync is mid-flight* → `curateAssets` writes `asset_library` + `updateTag(cacheTag.assets)`; independent of the listings sync.
  - *External search returns a photo whose license disallows use* → the "Find photo" result shows the source + license note; applying records the source in `page_images.source`/`photographer_*` (existing columns) for attribution.
- **Acceptance:**
  - [ ] "Find photo" → search → pick a result → "Use for place: Tumalo" → the Tumalo community/area page shows that banner (proves the previously-dead `setPlaceBannerFromPhoto` is wired).
  - [ ] Banners "missing" list → "Generate this one" on a single row → that place's banner appears (proves `refreshPlaceBanner` is wired).
  - [ ] Approve an `asset_library` photo → the live site imagery updates (tag revalidation).
  - [ ] Opening the Media tab issues **zero** external API calls until a search is submitted.
  - [ ] A `report_viewer` cannot reach any Media mode (nav + action both refuse).

---

## 11. Feature — Data health (sync) (`/admin/sync*` → CONTENT ▸ Data health)

**Audit verdict:** works as an engineer console, wrong artifact for a broker admin, heavy (5s/30s/180s pollers with no visibility-pause/backoff, browser-driven sync loops, 378 lines of dead components). **Decision: a broker-legible freshness answer on top; the engineer cockpit behind an Advanced disclosure; kill the dead weight and the runaway poll.**

### 11.1 The broker-facing answer (the actual job)

The job is *"is my MLS data fresh?"* — today the answer is buried among ~40 stats. The rebuild leads with **one metric, one definition** (§4.5):

- **`getSyncFreshness()`** — a single cached DAL function (`lib/data/sync/getSyncFreshness.ts`, `unstable_cache` tag `sync_freshness`, short TTL) that reads `sync_cursor` (last delta `updated_at`, `run_started_at`, `paused`, `abort_requested`) + the `listing_tile_mv` refresh time (the `reference_mv_refresh_timeout_incident` staleness source) and returns a **verdict**: `{ fresh: boolean, lastDeltaAt, mvRefreshedAt, minutesStale, message }`. Thresholds are defined **once** here (e.g. fresh if last delta < 30 min AND MV < 2 h). This is the same number rendered on the listings browser stamp (§4.2.4) — one definition, everywhere.
- The Data-health top card shows: **"MLS data: fresh — last synced 8 minutes ago"** (or **"stale — last synced 3 days ago, [Resync]"**). A broker with `content.sync.view` sees exactly this and nothing else. Green/amber/red, one sentence.

### 11.2 The Advanced cockpit (superuser, `content.sync.operate`)

Everything the current page shows (terminal-history finalization, live yield, backfill health, the seven triggers) moves behind an **"Advanced"** disclosure, superuser-only. Kept because the pipeline genuinely needs an operator surface — but it is not what loads first, and it never gates the broker's freshness answer.

- **Fix the runaway pollers** (§9.1). The 5s-forever `/api/admin/sync/live` poll, the 180s Spark probe, and the 30s heavy poll all become **visibility-aware** (pause when the tab is hidden — `document.visibilityState`), **backoff** on error, and consolidate to a **single status endpoint** the Advanced panel subscribes to only while open. An idle tab stops issuing ~12 req/min into 589K-row count queries. (Prefer one SSE/stream over three independent `setInterval`s.)
- **Keep the crons as the source of truth for sync progress**; the browser-driven loops (`SyncSmart`, `SyncHistoryButtons.runLoop`) are demoted to explicit superuser "run one chunk now" overrides with a clear split-brain guard (the existing 120s heartbeat `runInProgress` check) and a warning that closing the tab abandons a manual run — the crons (`sync-delta`/`sync-full`/`sync-history-terminal` in `vercel.json`) do the work regardless.
- **Broker-legible labels** — the Advanced panel keeps the engineer terms but each has a one-line plain-English help (the existing `HelpProvider` already renders contextual help on admin pages).
- **`finalizedCounts` `Math.max` monotonic-display bug** (§9.4) — a legitimate decrease can never render without a full reload. Fix: display the live value, not `max(prev, live)`.

### 11.3 DELETE the dead sync code (§9.6, 378 lines verified zero-importer)

`SyncButton.tsx` (47), `SyncDataRefreshButton.tsx` (38), `SyncHistoryTable.tsx` (78), `SyncHistoryTest.tsx` (117 — a test component parked in the route dir), `SyncRunLog.tsx` (98). `CronSyncStatus.tsx` is **kept** (imported by `components/admin/DashboardSyncPanel.tsx:4`).

### 11.4 `/admin/sync/spark` + `/admin/operations/optimization`

- `/admin/sync/spark` (thin Spark status card, two live calls, works) folds into the Advanced cockpit as a sub-section — one fewer route.
- **`/admin/operations/optimization` is DEAD** (§10): the cron that writes `optimization_runs` (`/api/cron/optimization-loop`) is **not scheduled** in `vercel.json` (verified). The page permanently shows "No runs recorded yet." **Decision: DELETE the route** (and the operations "optimization" tab). If Matt wants the optimization loop, scheduling the cron is a separate, explicit decision — until then, no placebo page (RC6). **See §15 Q3.**

### 11.5 States, acceptance

- **Acceptance:**
  - [ ] Data-health top card answers "is my data fresh?" in one sentence for a `content.sync.view` broker, no Advanced panel visible.
  - [ ] `getSyncFreshness` renders the identical verdict on the Data-health card and the listings-browser stamp (one definition).
  - [ ] Backgrounding the tab stops the pollers (network panel quiet); foregrounding resumes.
  - [ ] The five dead sync components are gone (`grep` for their imports returns nothing).
  - [ ] `/admin/operations/optimization` returns 404 (or the tab is gone) until its cron is scheduled.

---

## 12. Route map — keep / merge / delete

| Current route | Disposition | Target |
|---|---|---|
| `/admin/listings` | **KEEP** (fix §4) | CONTENT ▸ Listings |
| `/admin/listings/[listingKey]` | **KEEP** (rebuild editor §5) | CONTENT ▸ Listings ▸ detail |
| `/admin/blog` | **KEEP** (rebuild §6) | CONTENT ▸ Blog |
| `/admin/guides` | **KEEP** (fix + un-orphan §7) | CONTENT ▸ Guides |
| `/admin/geo` | **DELETE** (dead `geo_places` §9.1) | — |
| `/admin/geo/resort-communities` | **KEEP** (fix §9.2) | CONTENT ▸ Communities |
| `/admin/geo/area-guide-upload` | **KEEP** (rebuild transport §9.3) | CONTENT ▸ Communities ▸ Media |
| `/admin/media` (+ `/photos` `/banners` `/stock-photos`) | **MERGE** into one (§10) | CONTENT ▸ Media (4 modes) |
| `/admin/site-pages` | **KEEP, gut to real controls** (§8) | CONTENT ▸ Site |
| `/admin/sync` (+ `/sync/spark`) | **KEEP, reframe** (§11) | CONTENT ▸ Data health (+ Advanced) |
| `/admin/operations/optimization` | **DELETE** (dead cron §11.4) | — |
| `/admin/users` | out of this spec's rebuild scope | (settings/team spec) — noted §16 |
| `/admin/settings` | out of scope (settings spec) | — |
| `/admin/operations` | out of scope (dashboard/analytics spec) | — |
| `/admin/banners` `/photos` `/stock-photos` `/resort-communities` `/search` `/query-builder` `/spark-status` `/optimization` `/people` `/people/[legacyId]` | **KEEP as redirects** (already pure redirects, verified) — or drop once nav no longer references them | → their §-merged targets |

---

## 13. Deletion inventory (dead/placebo/duplicate surfaces this spec removes)

1. `geo_places` table + `/admin/geo` UI + `app/actions/geo-places.ts` (dead taxonomy, §9.1).
2. `brokerage_settings.hero_video_url` / `hero_image_url` / `team_image_url` + `HeroMediaForm` + `TeamImageForm` (zero readers, §8).
3. `site_pages.body_html` editors for About/Sell (zero readers, §8).
4. `details.admin_overrides.{featured, marketing_headline, admin_notes}` write path in `listings.details` (replaced by the durable `listing_admin_overrides` table, §5) — the in-`details` blob is abandoned (sync wipes it anyway).
5. The 5 dead sync components (378 lines, §11.3).
6. ~150 lines of dead duplicate guide readers in `app/actions/guides.ts` (§7.1.3).
7. The synthesized `market_stats_cache` guide fallback (`getGuides.ts:106-125`) — data-accuracy hazard (§7.1.4).
8. `/admin/operations/optimization` route (dead cron, §11.4).
9. Editable `ListPrice` / `StandardStatus` / `PublicRemarks` inputs in the listing editor (MLS-authoritative, §5.1) — rendered read-only, not editable.
10. Per-detail-view `getAdminSyncCounts()` fan-out card (§5.2.5).
11. Dead `SELECT` const in `admin-listings.ts`; `void supabase` + dead `error` const in `guides.ts`.
12. The 3 disconnected media surfaces collapse to one (§10) — the *routes* become redirects/tabs, the disconnection is deleted.

Every deletion is preceded by a zero-reader confirmation (grep + DAL-index check) in the delete-pass PR.

---

## 14. Acceptance criteria roll-up (writer→store→reader→outcome, §8)

The domain is "done" when each round trip is proven end to end:

1. **Auth:** an unauthenticated POST to `saveBlogPost`/`saveGuide`/`updatePageContent`/`setSubdivisionResort`/`updateBrokerageLogoUrl`/`uploadAreaGuideFolder` returns 403 and writes nothing (proves §1.1 across the domain). CI gate `ci:content-authz` fails the build if any content mutation lacks the guard.
2. **XSS:** `<img src=x onerror=...>` stored in `blog_posts.content` / `guides.content_html` renders with no event handler on `/blog/[slug]` and `/guides/[slug]` (proves §1.3).
3. **Listing edit durability:** an `admin_note` survives a delta sync of its listing (proves §5.1B sync-proof); a hand path to a wrong public price does not exist (proves §5.1A).
4. **Blog publish loop:** publish → live on both public URLs; draft → gone from both; edit → byline preserved, own URL revalidated (proves §6).
5. **Guides truth:** `/area-guides` lists exactly the `guides` rows the admin can edit — no synthesized ghosts (proves §7).
6. **Site honesty:** the only Site controls that report success are the ones a public page reads (logo→PDF, contact heading→/contact); the placebos are gone (proves §8).
7. **Communities:** flag resort → public page restyles; backfill failure surfaces as a warning (proves §9.2).
8. **Area-guide media:** a 60 MB MP4 uploads and appears on the place page (proves the 4mb cap is bypassed, §9.3).
9. **Media job:** stock-search → pick → "use for place" → the place shows the banner (proves the dead action is wired, §10).
10. **Data freshness:** one sentence answers "is my data fresh?" from a single definition rendered identically here and on the listings list; idle tab stops polling (proves §11).
11. **No twin trees:** `grep -R "md:hidden" app/admin/(protected)/{listings,media}` returns nothing after the responsive collapse.

**Success-flow tap/timing budget (CONTENT-local):** the common broker job here — *"publish a blog post"* — is: Blog → New → title/slug/body/author/publish → Save → preview confirms → live. Target: one screen, no cross-page chase, live within one revalidate. The common superuser job — *"suppress a listing's owner photos"* — is 1 search + 1 tap into the listing + toggle + confirm = ~4 interactions, durable (sync-proof).

---

## 15. Open questions for Matt (real decisions, not defaults I should pick)

1. **Listing `featured` + `marketing_headline` (§5.4b).** Do you want (a) a **"Featured listings" rail** on the homepage / `/homes-for-sale` driven by a broker-set `featured` flag, and/or (b) a broker-written **marketing headline** on the public listing page? If yes to either, I build that column + its reader together. If no, I drop both columns and the editor omits them (keeping only the internal `admin_notes`, which always has a reader). *Default if you don't answer: build `admin_notes` only; leave featured/headline out until there's a real public surface for them.*
2. **Synthesized area guides (§7.1.4).** The public `/area-guides` currently invents ~12 "guides" from `market_stats_cache` at read time — market claims with no verification trace (a §0 data-accuracy exposure). I want to **remove** that and show only real `guides` rows. Confirm — or if you want auto-generated area guides, I'll route them through the verified market-report/blog producer with a citation trace instead of synthesizing them silently.
3. **Optimization loop (§11.4).** `/admin/operations/optimization` is dead because its cron (`/api/cron/optimization-loop`) was never scheduled. I'm **deleting the page**. Do you want the optimization loop scheduled and revived (separate work), or is it abandoned?
4. **Site logo vs code-baked branding (§8).** The logo form's only real reader is PDF exports; the site *header* uses a code asset. Keep the logo swappable (for PDFs) as-is, or also wire the header/site chrome to `brokerage_settings.logo_url` so branding is fully data-driven? *Default: keep it PDF-only and honestly labeled.*
5. **Blog/guide slug-change SEO redirects (§6.2.5).** When a slug is renamed, the old URL 404s. Want me to add a `301` redirect map (old→new slug) to preserve SEO, or is a 404 on rename acceptable (renames are rare)?

---

## 16. Cross-spec dependencies (seams this spec shares)

- **Shell/IA + Auth spec** — owns `requireAdmin(capability)`, the capability map, and nav generation. This spec registers the nine `content.*` capabilities (§1.2) and calls the guard; it cannot ship before the primitive exists (arch §7 step 1).
- **Foundation spec** — owns the optimistic/idempotent mutation client hook + `idempotency_key` server contract (§4.2). Every mutation here uses it.
- **Analytics/metric-layer spec** — the one-definition-per-number doctrine; `getSyncFreshness` (§11) is a CONTENT-local metric that follows it, and the operations/broker dashboards that also show "data freshness" must read the *same* definition (drift risk noted in the operations audit).
- **Send-center + person-workspace specs** — a listing's "send to a lead" lives there, not in CONTENT; CONTENT stops at the public surface. The `listing_photos`/`media_suppressed` curation here feeds what those sends attach.
- **`/admin/users` + `/admin/settings`** — adjacent "people-ish"/settings surfaces in the audit but owned by the settings spec; noted here only so the route map is complete.
```