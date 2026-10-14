# SEO & discoverability (Ryan Realty)

> This file absorbed `SEO_AUTHORING_CHECKLIST.md` and `ENTITY_OPTIMIZATION.md` (2026-04-24 governance merge).
> Archived URL architecture reference: `docs/archive/_stale-refs/URL_ARCHITECTURE.md`

This doc summarizes what's in place so the site can compete for real estate searches and be a strong source for users and LLMs.

**Every agent (Claude, Cursor, Grok) starts SEO work here.** Matt's calls are in `data/seo/decisions.json`; read it before planning, not after a deploy fails. Measurement (GA4, Search Console, GTM) is [`docs/analytics/README.md`](analytics/README.md), and Matt's tracking calls are pinned the same way in [`data/analytics/decisions.json`](../data/analytics/decisions.json) (checked live by `npm run analytics:audit`). A new call from Matt becomes a new entry in the matching file in the same session, so SEO, AEO and tracking only move forward. The dated `docs/seo-*-2026-05-1x.md` files are history: where they disagree with this page or a pin, the pin wins.

## How SEO is kept from regressing (2026-10-04)

Read this before changing any URL, redirect, title, canonical or robots rule.

1. **Pinned decisions:** [`data/seo/decisions.json`](../data/seo/decisions.json). Every SEO call Matt made (one page per place, homepage title, which pages index) is an entry checked against PRODUCTION on every deploy (`npm run deploy:verify` runs `npm run seo:live`). A failure means the site regressed: fix the site. Removing or loosening an entry needs an `SEO-decision: <who, when, why>` commit trailer (`ci:seo-decisions`, commit-msg hook). New decisions get a new entry.
2. **Live baseline:** `scripts/lib/live-seo-audit.mjs` samples every sitemap on each deploy: robots, sitemaps, noindex, canonical, one H1, titles, alt text, listing photo preload.
3. **Daily crawl probe:** `/api/cron/crawl-probe` checks sitemaps, sampled pages and Google's own index status every morning, and alerts Matt.
4. **Commit gates:** `npm run ci:gates` (titles, H1s, nav, crawler access, internal links and more; catalog in `docs/MECHANICAL_GATES.md`).

**Listing indexing (2026-10-13):** `/sitemaps/listings.xml` submits Active, Active Under Contract, and Pending only, with `lastmod` from `modified_at` (ModificationTimestamp). Closed / Expired / Withdrawn / Canceled pages older than 90 days are `noindex, follow` with a canonical to the community hub, else the city hub. Recent off-market and every on-market status stay `index, follow` on the listing URL. Out-of-area on-market listings stay indexed (SITE-33 reverted 2026-10-05). Thin geo/matrix URLs with fewer than 3 active listings are omitted and noindexed. Held by `listingIndexPolicy`, `ci:listing-offmarket-index`, and the `out-of-area-listing-indexed` pin.

**Sitemap vs page on the preset URLs (2026-10-14):** the sitemap never submits a URL its page serves noindex or canonicalizes elsewhere, and a slow or failed read never flips that. The page fails open (a read blip never noindexes a live page); the sitemap fails closed. While the city x preset matrix decision is unknown, `app/sitemap.ts` omits every `/homes-for-sale/{city}/{preset}` that needs a verified decision (`presetNeedsVerifiedDecision`, `lib/seo/place-type-twin.ts`) and the file thins for that regeneration; it never submits the verified-thin presets or the type presets that canonicalize to `/cities/{city}/types/{type}`. Held by `ci:sitemap-inventory-gate` and `app/sitemap.matrix.test.ts`. Cause: matrix.xml served 808 URLs at 16:05Z because the matrix inventory read hit a statement timeout and the sitemap read the unknown as "index".

## IndexNow (2026-10-14)

**What.** IndexNow tells Bing, and the answer engines that search through Bing (ChatGPT search, Copilot), that a URL is new or changed, so it is recrawled in minutes instead of on the crawler's schedule. One POST to `https://api.indexnow.org/indexnow` reaches every participating engine. Google does not take IndexNow; it still reads the sitemaps.

**Code.** `submitIndexNow(urls)` in [`lib/seo/indexnow.ts`](../lib/seo/indexnow.ts): only absolute `https://ryan-realty.com` URLs, deduplicated, at most 10,000 per request, a 5-second timeout, and it never throws. It sends only when `VERCEL_ENV=production`; `INDEXNOW_OPT_IN=1` allows a deliberate manual run elsewhere and `INDEXNOW_DISABLED=1` turns it off. HTTP 200 and 202 are success; 400, 403 (key), 422 (URL not on the host) and 429 (throttled) are logged as `[indexnow]` errors.

**Key.** Public by protocol: it proves we own the host and is not a secret. The constant is `INDEXNOW_KEY` in `lib/seo/indexnow.ts`; the file is `public/<key>.txt`, served at `https://ryan-realty.com/<key>.txt` as plain text holding only the key. The `indexnow-key-file` pin in `data/seo/decisions.json` fails `deploy:verify` if that file stops serving the key. To rotate: change the constant, rename the file, and move the pin in one commit (moving a pin needs an `SEO-decision:` trailer).

**Where it fires.** Only pages that changed, never the whole site and never a batch of unchanged URLs.

- **Listings:** the MLS delta sync, `lib/sync/deltaSync.ts` (the `sync-delta` cron every 15 minutes, the admin delta route and the sync action all run it). After the upsert lands, it submits rows that are new or whose status, price, lead photo or photo count changed, plus finalized rows the MLS reopened. The URL is `listingCanonicalHref`, the builder the listing page and `listings.xml` use. Skipped: IDX opt-outs (`permit_internet_yn`, `permit_address_internet_yn`, `idx_participant`), Coming Soon, and off-market pages past the 90-day noindex line (`listingIndexPolicy`). Recent Closed, Expired and Withdrawn pages count, because they stay indexed and their state changed. A photo change on a media-suppressed listing does not count (its page shows no photos). A broker override wins over Spark on the page: a listing whose status a broker overrode is left out, and a price change under a price override is not a change. Before submitting, each listing's cached reads (`cacheTag.listing`, by ListingKey and MLS number) expire at once, so the crawler reads the page as written rather than a stale-while-revalidate copy. A rejected upsert submits nothing; a failed override read or submission never fails the sync.
- **Blog:** the admin editor (`saveBlogPost`, `app/actions/blog.ts`) when a post is saved as published, after the response; and the monthly city report cron (`app/api/cron/blog-monthly-city-report`). Both refresh the post page first, since it caches for a day. `scripts/seed-blog-posts.ts` does not submit: for one seeded post, run `INDEXNOW_OPT_IN=1 npx tsx scripts/indexnow-submit.ts https://ryan-realty.com/blog/<slug>`.
- **Not wired:** place and market pages. Their figures move daily with the market cache, so a daily ping of every page would be the bulk submission the engines throttle. Bing reads them from the sitemaps.

**Verify.** Open `https://ryan-realty.com/<key>.txt` (the file name is in `public/`): it shows the key and nothing else. `npm run seo:live` checks it with the other pins. The `sync-delta` cron response carries `indexNow: { urls, submitted, ok, skipped }`, and Vercel logs show `[indexnow] submitted N URL(s)` or the failure status. Bing Webmaster Tools lists received URLs under IndexNow once the site is verified there. Tests: `npx vitest run lib/seo/indexnow.test.ts lib/seo/indexnow-listings.test.ts lib/sync/deltaSync.indexnow.test.ts`.

## Technical foundations

- **Canonical URLs** – Every page sets `alternates.canonical` so search engines know the preferred URL (no duplicate indexing from query params).
- **metadataBase** – Root layout uses `NEXT_PUBLIC_SITE_URL` so Open Graph and other absolute URLs resolve correctly.
- **robots.txt** – Generated by `app/robots.ts`: allows `/`, disallows `/admin/`, `/api/`, `/auth/`, and points to `/sitemap.xml`.
- **Sitemap** – `app/sitemap.ts` includes: homepage, `/homes-for-sale`, every city (`/homes-for-sale/{city}`), every community/subdivision (`/homes-for-sale/{city}/{community}` and neighborhood-aware variants when applicable), and listing detail URLs via `listingDetailPath()` using MLS + address canonical format. Communities are loaded from the DB so new areas are included automatically. Legacy paths (`/listings`, `/search`) 301-redirect to canonical `/homes-for-sale` paths.

## On-page & metadata

- **Titles & descriptions** – City/subdivision pages use location-specific titles and meta descriptions (from `lib/city-content.ts` where defined). Listing pages: the title leads with the status word and address; the meta description (also `og:description`) is built by `listingMetaDescription` (`lib/listing/listing-meta-description.ts`) and is unique per listing by construction: status, published price, beds/baths/sq ft (or the lot on land), then the street address, plat and town, with the MLS number added only when the street has no house number, and the broker's remarks last, as written, cut at the 155-character limit. Sibling lots and same-building parcels share price, plat and remarks, so the address must come before the remarks (2026-10-14: five pages failed the live duplicate-description check). The MLS placeholder plat "N/A" is never printed. Held by `lib/listing/listing-meta-description.test.ts`.
- **Open Graph & Twitter** – All main pages set `openGraph` and `twitter` (`summary_large_image`) with title, description, and an absolute 1200×630 image from `/api/og`. The image is the photo plus the Ryan Realty wordmark and a navy `#102742` tint along the bottom edge (so iMessage's sampled bar leans brand navy). No title is painted on the image: the preview bar already shows `og:title`. Listing cards may add a small price · beds/baths chip when that line stays short. Listing pages (`/listing/*` and slugged `/homes-for-sale/...-{mls}`), Active/Pending/Closed, resolve ListNumber or ListingKey the same way the page does. `og:title` is address · price · beds/baths. `og:image` is `/api/og?type=listing` on the primary MLS hero (`listings.PhotoURL`, already null when `media_suppressed`). A listing with no photo, and every other page without a primary photo, uses a curated Bend / Central Oregon photo (community/neighborhood: area aerial; blog/guides: downtown Drake Park; homepage and other: Three Sisters landscape). Social UAs (`facebookexternalhit` and the rest of `GOOD_BOT_RE`) skip the bot screen and still take the listing canonical hop.
- **Structured data (JSON-LD)**
  - **Root**: `RealEstateAgent` (Ryan Realty) and `WebSite` with `SearchAction` (in `components/JsonLd.tsx`).
  - **Search (city/subdivision)**: `WebPage` (with `primaryImageOfPage` when banner exists), `BreadcrumbList`, `Place`, and `ItemList` (first 10 listing URLs).
  - **Listing**: `RealEstateListing` (no `Product` node; corrected 2026-10-14) with address, geo, beds, baths, floor size, lot, year built, `availability`, an `Offer` only while the home is on the market, `datePosted` / `dateModified`, the Quick facts as `additionalProperty`, a `Residence` `about`, and `image` (up to 10 gallery photos); plus `BreadcrumbList` (the visible place trail, ending at the street address) and one `VideoObject` per qualifying MLS video tour (see Listing media). Built by `buildListingJsonLd` in `app/listing/[listingKey]/listing-json-ld.ts` through `lib/site/json-ld.ts`. Google has no rich-result type for `RealEstateListing`; the node is there so search engines and answer engines read the facts the page prints.

## Listing media (photos and video tours, 2026-10-14)

What a listing exposes to search engines, and the MLS limits it stays inside.

**Photos.**
- `/sitemaps/listings.xml` gives each listing URL its lead photo. The whole gallery, up to 30 photos per listing, is in `/sitemaps/listing-photos/{1..24}.xml` (listed by the sitemap index; a listing's part is a stable hash of its ListingKey, about 1.1 to 1.3 MB per file). Same listing set, locs and lastmod as listings.xml. Code: `lib/data/sitemap/listing-photo-sitemap.ts`, `getListingSitemapPhotos.ts`, `app/sitemaps/listing-photos/[part]/route.ts`.
- Every photo URL is the 1600x1200 render on the MLS's own CDN (Spark), the URL the listing page loads. Nothing is copied.
- Gallery alt text: the MLS photo Caption leads, exactly as the listing broker wrote it, then the address sentence ("Kitchen with quartz island. 2750 NE Great Horned Place, Bend, OR, photo 3 of 54"). A blank, file-name or number-only caption falls back to "address, city, photo n of N". A caption with an email, phone number or link is withheld, never edited (`publishListingPhotoCaption`).
- JSON-LD `image` carries the first 10 photos.

**Video tours.**
- The listing video is the listing broker's work: we link or embed it from its host and never re-host it.
- Every stored or served video/tour URL passes `cleanListingMediaUrl` (`lib/listing/listing-media-url.ts`): mail-scanner rewrites (Microsoft SafeLinks, Proofpoint, Google and Facebook redirects) are unwrapped to the real link, unreadable wrappers (Mimecast, Cisco, Sophos) are dropped, and no URL carrying an email address ships. A SafeLinks `data` parameter names the recipient, another brokerage's agent; 112 listings carried a wrapper or an email in these fields on 2026-10-14.
- A `VideoObject` (listing page and `/videos`) and a `/sitemaps/video.xml` entry are emitted only for a YouTube or Vimeo player with a real date: the MLS media record's ModificationTimestamp, or for a listing's only record of a kind stamped with the feed's 1970 sentinel, its latest listing_history `Video` / `VirtualTour` event. Thumbnail: YouTube's own still; for Vimeo, the listing's MLS lead photo. No contentUrl and no Ryan Realty publisher; the description credits the listing brokerage. Code: `lib/listing/listing-video-assembly.ts`, `publish-listing-video-schema.ts`, `lib/data/videos/getListingMlsVideos.ts`.
- Place pages: the area-guide `VideoObject` (`areaGuideVideoSchema`) is emitted only when complete (YouTube still and publish date). A community is looked up by its public slug and its durable registry key (Juniper Preserve's guide is tagged `pronghorn`).

**MLS limits (Oregon Data Share rules, Aug 2024; `ci:ods-compliance`).**
- Display and search indexing of IDX listings are allowed. No database handoff or feed to a third party: the sitemaps list our own pages and point at MLS-hosted media.
- Never modify another broker's listing information. Captions and remarks show as written or not at all; video titles are our own label ("Video tour of {address}"), sourced to the MLS listing and its brokerage.
- Do not re-host listing photos or videos without license confirmation. Hotlink the Spark CDN.
- Honor `permit_internet_yn`, `permit_address_internet_yn`, `idx_participant` and `media_suppressed` (no photos, no videos). The public listing views already drop the opt-outs; the media reads check the flags again. Coming Soon never shows.

## Images & Core Web Vitals

- **Hero banners** – City/subdivision hero uses `next/image` with `priority`, fixed dimensions, and `sizes="100vw"` for fast LCP.
- **Listing gallery** – Primary photo uses `next/image` with `fill`, `sizes`, and `priority` on the first image.
- **Listing cards** – Already use `next/image` with `sizes` and optional `priority`.
- **All images** – Where we use `<img>`, we set `width`/`height` and `decoding="async"` to reduce CLS and avoid blocking.

## Local & hyper-local

- **City/subdivision content** – `lib/city-content.ts` provides descriptions and meta text for key cities; add more for better relevance.
- **Place schema** – Search pages output a `Place` with name, description, and address (locality, region, country) so search engines understand the geographic focus.
- **Internal links** – "Browse by subdivision" and listing cards link to other city/subdivision and listing pages to reinforce structure.

## What you should do

1. **Set `NEXT_PUBLIC_SITE_URL`** in production to your live domain (e.g. `https://ryan-realty.com`).
2. **Google Search Console** – Add the property and submit the sitemap (`/sitemap.xml`).
3. **Google Business Profile** – Keep NAP and business info consistent with the site; link to the site.
4. **Content** – Expand `lib/city-content.ts` (and subdivision blurbs) for more cities/neighborhoods to target long-tail "homes for sale in [place]" queries.
5. **Monitor** – Use Search Console and Core Web Vitals (LCP, INP, CLS) to catch regressions.

No shortcuts were taken in the implementation above; it follows current best practices for real estate and general SEO.

---

## Per-page authoring contract

Use this checklist for every new or updated public page route.

### Metadata contract
- Export `metadata` or `generateMetadata` in each public route page (`app/**/page.tsx`).
- For dynamic public routes (`[slug]`, `[...slug]`, `[id]`), define `alternates.canonical`.
- Keep canonical URLs on helper contracts:
  - Listings browse: `listingsBrowsePath()`
  - Team: `teamPath()`
  - Valuation: `valuationPath()`

### Indexation policy
- Canonical pages should be indexable.
- Filtered and paginated variants must be `noindex,follow`.
  - Search variants: `shouldNoIndexSearchVariant(...)`
  - Blog index variants: `shouldNoIndexBlogIndex(...)`

### URL and linking rules
- Never hardcode legacy canonical paths in new code:
  - `/listings`
  - `/agents`
  - `/home-valuation`
- Use canonical helper paths in navigation, metadata, and JSON-LD.

### Sitemap and structured data
- Include only canonical URLs in `app/sitemap.ts`.
- Structured data URLs must align with canonical helpers.

### Required validation
- Run `npm run lint:seo-routes` before committing.
- Run `npm test` to keep SEO contracts green.

---

## Entity / structured-data reference

This section is the single reference for how key entities appear in schema.org JSON-LD and meta tags so the site is optimized for search and AI Overviews (SGE).

### Entities

- **Ryan Realty** — Root `RealEstateAgent` and `WebSite` with `SearchAction` in [components/JsonLd.tsx](components/JsonLd.tsx). Name, areaServed (GeoCircle Central Oregon), sameAs (social URLs when set).
- **Listings** — Each listing page outputs `RealEstateListing` (with a nested `Offer` while on the market, and `listingAgent` only when a Ryan Realty broker is the listing agent), `BreadcrumbList`, and a `VideoObject` per qualifying MLS video tour. No `Product` node. See [`app/listing/[listingKey]/listing-json-ld.ts`](../app/listing/[listingKey]/listing-json-ld.ts) and [`lib/site/json-ld.ts`](../lib/site/json-ld.ts). **Important**: All URLs in structured data MUST match the canonical URL generated by `listingDetailPath()` which uses MLS number (ListNumber) + address slug with optional neighborhood hierarchy (`listingCanonicalHref`, one expression for the canonical, the sitemap and the JSON-LD).
- **Brokers** — Team profile pages output `Person`/`RealEstateAgent` with name, image, url, worksFor (brokerage). Brokers table: display_name, title, bio, photo_url, email, phone.
- **Cities and subdivisions** — Search pages output `WebPage`, `BreadcrumbList`, `Place`, `ItemList`. Resort communities additionally get Resort/GolfCourse/AmenityFeature via [ResortCommunityJsonLd](app/search/[...slug]/ResortCommunityJsonLd.tsx).
- **Market reports** — Report pages use appropriate schema for Article/Report and BreadcrumbList.

### Consistency rules

- Use the same organization name ("Ryan Realty") in all JsonLd and meta tags.
- Broker and listing agent names should match exactly between listing detail, team page, and schema.
- Key phrases (e.g. "homes for sale in Bend", "Central Oregon real estate") appear in titles, descriptions, and schema where relevant.
- Breadcrumb JSON-LD must mirror visible breadcrumbs and always start with "Home".

### SGE / AI Overviews

- Ensure every entity has a clear `name` and `description` or `url` so AI can cite the site.
- Keep required and recommended schema.org properties populated; avoid empty optional arrays.
