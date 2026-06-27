# PUB-6 Content + Legal — Audit Findings

**Audited:** 2026-06-26  
**Cluster:** `/blog`, `/blog/[slug]`, `/guides`, `/guides/[slug]`, `/privacy`, `/terms`, `/cookies`, `/dmca`, `/fair-housing`, `/accessibility`, `/data-deletion`, `/offline`, `/dev/components`  
**Dimensions:** A Functional · B Statistics §0 · C SEO · D Indexability · E CRM tracking

---

## Per-page status summary

| Page | A Functional | B Stats §0 | C SEO | D Index | E CRM |
|---|---|---|---|---|---|
| /blog | PASS | PASS* | PASS | PASS | PASS |
| /blog/[slug] | PASS | PASS* | PASS | PASS | PASS |
| /guides | PASS | PASS | PASS | PASS | FAIL |
| /guides/[slug] | PASS | WARN | PASS | PASS | FAIL |
| /privacy | PASS | n/a | PASS | PASS (noindex intentional) | FAIL |
| /terms | PASS | n/a | WARN | PASS (noindex intentional) | FAIL |
| /cookies | PASS | n/a | PASS | PASS (noindex intentional) | FAIL |
| /dmca | PASS | n/a | WARN | PASS (noindex intentional) | FAIL |
| /fair-housing | PASS | n/a | WARN | PASS (noindex intentional) | FAIL |
| /accessibility | PASS | n/a | WARN | PASS (noindex intentional) | FAIL |
| /data-deletion | PASS | n/a | PASS | PASS (noindex intentional) | FAIL |
| /offline | PASS | n/a | PASS (noindex correct) | PASS | n/a |
| /dev/components | PASS | FAIL | PASS (noindex correct) | PASS | FAIL |

---

## Defects

### D1 — /dev/components exposed in production with no auth guard (MEDIUM)

**File:** `app/dev/components/page.tsx:1`  
The `/dev/components` component gallery is a live production URL. It is `noindex, nofollow` in metadata (correct) but it is **not disallowed in `app/robots.ts`** and **has no authentication gate** — no middleware check, no layout-level auth redirect, no `(protected)` route group. Any visitor who discovers the URL (e.g., via a link in a rendered page or developer tools) can access it.

The page stores notes in `localStorage` under key `rr_component_notes_v1` and uses `navigator.clipboard`. It renders live design-system components. No data reads, no writes. Risk is low (internal tool, noindex) but the page should either be removed from the production build or gated behind admin session check, consistent with the `app/admin/(protected)/` pattern used elsewhere.

**Action:** Add `/dev/` to the `disallow` list in `app/robots.ts`, AND either (a) move the route under `app/admin/(protected)/dev/components/` so the existing admin auth middleware covers it, or (b) add a middleware route match for `/dev/` that requires an active session. Preferred: option (a) since the admin group is already wired.

---

### D2 — /dev/components table contains hardcoded market stats (§0 violation, low severity)

**File:** `app/dev/components/ComponentGalleryClient.tsx:279-280`  
The Table component example shows hardcoded figures:
```
Bend: active=542, median=$790,000
Redmond: active=188, median=$475,000
```
These are live-looking numbers in a production-accessible page. The page is `noindex` and is an internal dev tool, not a public deliverable. However per §0 any stat that could be seen by a developer as real must either be clearly labeled "example data" or traced to a source. These figures are NOT labeled as fake/illustrative.

**Action:** Add an `aria-label="Example data"` or a visible comment `/* example */` on the table, or replace with obviously fake values (e.g., "City A / 100 / $500,000").

---

### E1 — /guides (index) and /guides/[slug] have no CRM page-view tracking (MEDIUM)

**File:** `app/guides/page.tsx` (entire file) and `app/guides/[slug]/page.tsx` (entire file)

Neither guides page calls `trackPageViewIfPossible`. Compare to `/blog/page.tsx:121` and `/blog/[slug]/page.tsx:132`, which both import `trackPageViewIfPossible` from `@/lib/followupboss` and fire it server-side.

Guides pages do use `KbSectionTracker` (client component that fires `section_view` and `scroll_depth` to `/api/track`), but that is analytics-tier event tracking, not FUB CRM contact-page-view tracking. Authenticated users and identity-bridge users viewing guides are invisible to the FUB pipeline.

**Action:** Add the same three-line pattern used in `/blog/page.tsx:112-121` to both guides pages:
```ts
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
// ...in the server component body:
const [guides, session, fubPersonId] = await Promise.all([getPublishedGuides(12), getSession(), getFubPersonIdFromCookie()])
trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl: `${siteUrl}/guides`, pageTitle: 'Guides | Ryan Realty' })
```

---

### E2 — Legal/utility pages (/privacy, /terms, /cookies, /dmca, /fair-housing, /accessibility, /data-deletion) have no CRM tracking (LOW)

These are all static server components with no session/FUB import. For legal pages this is **probably intentional** (users visiting privacy/DMCA/fair-housing are likely not leads). No defect action required unless Matt wants funnel visibility into who reads legal pages.

Logging for completeness: no `trackPageViewIfPossible` call exists in any of the seven legal pages.

---

### C1 — /terms, /fair-housing, /dmca, /accessibility: openGraph block is missing `title` and `description` fields (LOW)

**Files:**
- `app/terms/page.tsx:12-14` — `openGraph: { images: [...] }` only
- `app/fair-housing/page.tsx:15-17` — `openGraph: { images: [...] }` only
- `app/dmca/page.tsx:13-15` — `openGraph: { images: [...] }` only
- `app/accessibility/page.tsx:13-15` — `openGraph: { images: [...] }` only

When these pages are shared to social platforms, the OG title and description will fall back to the page-level `title`/`description` metadata via Next.js inheritance — so the share preview is not completely broken. However the OG object should explicitly carry these fields for reliable rendering across all scrapers (LinkedIn in particular reads the OG object, not page-level meta).

**Action:** For each of the four pages, expand the `openGraph` block to include:
```ts
openGraph: {
  title: 'Terms of Service | Ryan Realty',  // (per page)
  description: 'Terms of service...',        // (per page)
  url: `${siteUrl}/terms`,
  type: 'website',
  images: [{ url: ogImage, width: 1200, height: 630 }],
},
```

---

### C2 — Sitemap missing /cookies and /data-deletion (LOW)

**File:** `app/sitemap.ts` (static pages array, lines 53-97)  
The sitemap includes `/privacy`, `/terms`, `/accessibility`, `/fair-housing`, `/dmca` but does NOT include `/cookies` and `/data-deletion`. Both pages have proper canonical metadata and are `noindex`. Since they are `noindex` this does not affect crawl/index. However the sitemap should be consistent — if other legal pages are listed for completeness, `/cookies` and `/data-deletion` should be too.

**Action (optional):** Add to `staticPages` in `app/sitemap.ts`:
```ts
{ url: `${baseUrl}/cookies`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
{ url: `${baseUrl}/data-deletion`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
```

---

### A1 — Blog index: read-time always renders "2 min read" for grid posts (LOW)

**File:** `app/blog/page.tsx:302`

The blog grid cards call:
```tsx
<span>{estimateReadTime(null)} min read</span>
```

`null` is passed unconditionally. `estimateReadTime(null)` returns `2` (the `Math.max(1, ...)` floor with no content). The featured post does not have this bug (its read-time calculation appears to use the full content). Grid post read-times are always "2 min read" regardless of article length.

Note: the blog index DAL (`getPublishedBlogPosts`) does NOT select `content` — it only selects `excerpt` and basic metadata to keep the index query light. The fix is either to pass `post.excerpt` to `estimateReadTime` (rough but better than always-2), or accept "2 min read" as the index fallback and change the label to "Quick read" or similar.

**Action:** Change line 302 from `estimateReadTime(null)` to `estimateReadTime(post.excerpt)` as a quick fix, or remove the read-time estimate from grid cards entirely since there is no `content` column in scope.

---

### A2 — Popular posts on blog index derive titles from slugs (not real titles) (LOW)

**File:** `app/blog/page.tsx:362-365`

The "Popular posts" sidebar converts slugs to display titles via `slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())`. So a post with slug `bend-home-prices-drop-in-q2-2026` renders as "Bend Home Prices Drop In Q2 2026" — which happens to be readable, but it does not use the actual `title` field from the database.

`getPopularBlogSlugs(5)` (called at line 115) returns only slugs, not titles. To render real titles the function would need to be expanded to return title+slug pairs, or a second query joining on slug would be needed.

**Action:** Update `getPopularBlogSlugs` to return `{ slug, title }` pairs from the `blog_posts` table, and render `post.title` in the sidebar. Current slug→title derivation works for clean slugs but breaks for slugs with abbreviations, numbers, or acronyms (e.g., "Bend Q2 2026 Mls Report" instead of "Bend Q2 2026 MLS Report").

---

### B1 — /guides/[slug] stats in auto-generated fallback guides: `actions/guides.ts` uses unrounded median price (LOW)

**File:** `app/actions/guides.ts:47-51` (legacy action, not the DAL)

The `buildGuideHtmlFromStats` function in `app/actions/guides.ts` renders `median_sale_price` as:
```ts
`$${Math.round(Number(stats.median_sale_price)).toLocaleString()}`
```
This rounds to the nearest dollar, not the nearest $1,000 as required by §0 brand voice (e.g., `$474,500` instead of `$475,000`).

The DAL version (`lib/data/guides/getGuides.ts:63-66`) is CORRECT — it rounds to the nearest $1,000. However the legacy action in `app/actions/guides.ts` is also exported and may still be called by `admin/(protected)/guides/page.tsx` or other admin paths.

Note: the guides index page (`app/guides/page.tsx`) imports from `lib/data` (the DAL, which is correct), so public-facing guide pages use the correct rounding. The action is only invoked from admin/server-action contexts. Mark as low severity but should be fixed for consistency.

**Action:** In `app/actions/guides.ts:47-51`, change:
```ts
`$${Math.round(Number(stats.median_sale_price)).toLocaleString()}`
```
to:
```ts
`$${(Math.round(Number(stats.median_sale_price) / 1000) * 1000).toLocaleString()}`
```

---

### D3 — DMCA fallback email uses wrong domain: `legal@ryanrealty.com` (no hyphen) (LOW)

**File:** `app/dmca/page.tsx:7`

```ts
const contactEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? 'legal@ryanrealty.com'
```

All other legal pages fall back to `admin@ryan-realty.com` (with the correct hyphenated domain). The DMCA fallback uses `ryanrealty.com` (no hyphen) — a different domain that is not the canonical `ryan-realty.com`. If `NEXT_PUBLIC_SITE_OWNER_EMAIL` is set in production this is a non-issue. If the env var is missing, the DMCA designated agent email resolves to a wrong/unrouted address.

**Action:** Change the DMCA fallback to `admin@ryan-realty.com` (matching the other pages), or to `matt@ryan-realty.com` per the known correct email.

---

### C3 — /guides index metadata: OG and Twitter images use relative path `/api/og?type=default` (LOW)

**File:** `app/guides/page.tsx:43, 49`

```ts
images: ['/api/og?type=default'],
```

The guides index `metadata` export uses relative paths for OG and Twitter card images. Other pages (including `/blog`) explicitly prefix with `siteUrl`:
```ts
images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: '...' }]
```

Relative OG image URLs may not resolve for social scrapers that read the meta tags. Next.js does normalize these at build time for the default site URL, but the explicit pattern is safer and consistent with every other page in the codebase.

**Action:** Add `const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')` and replace relative OG paths with absolute URLs in `app/guides/page.tsx`.

---

## What is working well (no defect)

- **Blog SEO:** Full `generateMetadata` on both index and detail pages. `Article` JSON-LD (via `generateBlogSchema`) + `BreadcrumbList` JSON-LD on every post. One semantic `<h1>` per post (`post.title`). OG type=`article` with `publishedTime`. Canonical URLs constructed from `siteUrl + slug`. Twitter `summary_large_image` card.

- **Blog index noindex on paginated/filtered pages:** `shouldNoIndexBlogIndex` correctly noindexes `page > 1` and category-filtered views, preventing duplicate-content indexing.

- **Blog + guides in sitemap:** Dynamic sitemap queries `blog_posts` (status=published) and `guides` (status=published) via paginated DAL, with correct `lastModified` from `published_at`/`updated_at`. Both `/blog` and `/guides` are in static pages list.

- **Blog CRM tracking:** Both `/blog` and `/blog/[slug]` call `trackPageViewIfPossible` server-side, reaching FUB for authenticated and identity-bridge users.

- **Guides auto-generated content:** When no authored guides exist, the DAL falls back to `market_stats_cache` data to generate guides. The DAL version (`lib/data/guides/getGuides.ts`) correctly drops stats that are null/unavailable rather than rendering "Data unavailable" (unlike the legacy action).

- **Legal page content:** All seven legal pages (`/privacy`, `/terms`, `/cookies`, `/dmca`, `/fair-housing`, `/accessibility`, `/data-deletion`) contain real, substantive legal content — no lorem ipsum, no placeholder text. Privacy page includes CCPA, Oregon CPA, Google Signals, SMS section, Ryan Realty Social app disclosure. Terms includes SMS program, Ryan Realty Social app disclosure. Cookie policy includes a full cookie registry table (9 named cookies with provider/type/duration/purpose). Last-updated dates are present on all pages.

- **Legal page noindex:** All seven legal pages set `robots: 'noindex, follow'` — correct behavior; these pages should not be indexed.

- **Fair-housing page:** Includes `EqualHousing` component (Equal Housing logo), HUD URL + phone, Federal + Oregon law coverage. Content is appropriate and non-placeholder.

- **Offline page:** Correctly `noindex, nofollow` (set in `app/offline/layout.tsx`), not in sitemap, functions as PWA fallback with "Try again" button and homepage link.

- **Article rendering:** Blog posts render HTML body via `dangerouslySetInnerHTML` inside a `prose` div. Guide detail pages render `content_html` with explicit spacing for headings/paragraphs/lists. Both have a fallback message when content is empty ("This article is being updated." / graceful null).

- **Share buttons:** `ShareButton` is present on both blog index (top) and blog post detail (header + bottom). It fires a `share` event via `trackEvent` client-side. No broken buttons.

- **Related posts / articles:** Both blog and guides have related-content sections. Blog: `getRelatedBlogPosts` queries by category+exclusion of current slug, up to 3. Guides: in-memory filter on category/city from a wider `getPublishedGuides(200)` call, up to 4.

- **dev/components metadata:** Correctly set to `noindex, nofollow` — search engines will not index it.

- **robots.ts:** `/dev/` is NOT in the `disallow` list, but the page-level `noindex, nofollow` metadata means Googlebot won't index it even if it crawls it. The disallow addition in D1 is defense-in-depth, not a current crawl risk.

---

## Defect severity matrix

| ID | Page(s) | Dimension | Severity | Fix complexity |
|---|---|---|---|---|
| D1 | /dev/components | A Functional / Security | MEDIUM | Low (move route or add middleware match + robots disallow) |
| E1 | /guides, /guides/[slug] | E CRM | MEDIUM | Low (add 3-line pattern already used in /blog) |
| D2 | /dev/components | B Stats §0 | LOW | Trivial (label as example data) |
| A1 | /blog | A Functional | LOW | Low (pass post.excerpt instead of null) |
| A2 | /blog | A Functional | LOW | Medium (update DAL to return titles) |
| C1 | /terms, /fair-housing, /dmca, /accessibility | C SEO | LOW | Trivial (expand OG block) |
| C2 | sitemap | D Indexability | LOW (noindex pages) | Trivial (2 lines) |
| C3 | /guides | C SEO | LOW | Trivial (absolute URL) |
| B1 | /guides/[slug] (admin action only) | B Stats §0 | LOW | Trivial (rounding fix) |
| D3 | /dmca | A Functional | LOW | Trivial (fix email domain) |
