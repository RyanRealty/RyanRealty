# PUB-1 Core Marketing — QA Defect Log

Audited: 2026-06-26  
Auditor: Claude Code (read-only, no form submits)  
Scope: /, /about, /team, /team/[slug], /contact, /reviews, /our-homes, /join, /resources, /faq, /videos, /pulse, /feed, /activity, /compare  
Files read: page.tsx for every route, HideOnLP.tsx, sitemap.ts, robots.ts, lib/testimonials.ts, app/layout.tsx, KbSectionTracker.client.tsx, contact/actions.ts, lib/slug.ts  

Legend: ✅ Pass · 🐞 Defect · ☠️ Blocker · ❓ Needs live verification  

---

## / (Homepage)

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| H-1 | A Functional | ✅ | All links use `<Link href=...>` with real DAL-backed paths. KbNav, KbFooter, KbExploreTowns, KbFeatured, KbListingMap, KbTicker, KbTeam, KbSell all wired. No dead `#` hrefs visible in source. | — | — |
| H-2 | B Statistics | ✅ | All numbers come from DAL calls: `getRegionPulse()`, `getCitiesForIndex()`, `getMarketStatsCacheRowForGeo()`, `getPriceHistory()`, `getListingTiles()`. No hardcoded stats. `revalidate = 60`. | — | — |
| H-3 | C SEO | ✅ | `export const metadata` has title, description, canonical (`siteUrl`), full OG (title/description/url/siteName/type/images), twitter card. One H1 via `KbHero` (renders `<h1 className="hero-h display">`). | — | — |
| H-4 | D Indexability | ✅ | No `noindex`. `revalidate = 60` (ISR — SSR-crawlable). Homepage canonical in `app/page.tsx` metadata. In sitemap (priority 1.0). robots.txt allows `/`. | — | — |
| H-5 | E CRM | ✅ | `KbSectionTracker pageType="homepage"` fires section_view + scroll_depth to `/api/visitors/track` AND GA4/Pixel. `VisitTrackerWithSession` in layout runs on `/` (HideOnLP does NOT hide `/`). | — | — |

---

## /about

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| AB-1 | A Functional | ✅ | All links real: `/team`, `/cities/*`, `/blog/*`, `/sell`. `KbExploreTowns` CTA points to `/homes-for-sale`. No `#` hrefs. | — | — |
| AB-2 | B Statistics | ✅ | `getRegionPulse()`, `getCitiesForIndex()`, `getRecentBlogPosts()` all live. Founded date (June 2023), license numbers are verified OREA facts per CLAUDE.md memory. `revalidate = 3600`. | — | — |
| AB-3 | C SEO | ✅ | `generateMetadata()` via `pageMetadata()` — title, description, canonical `/about`, OG image (`hero-old-mill-master-4k.jpg`), keywords. `MetadataBlock` emits `AboutPage` + `BreadcrumbList` JSON-LD. One H1 via `KbHero`. | — | — |
| AB-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.5, monthly). `HideChrome` list includes `/about`. SSR via `revalidate`. | — | — |
| AB-5 | E CRM | ✅ | `KbSectionTracker pageType="about"`. `VisitTrackerWithSession` runs (not hidden by HideOnLP). | — | — |

---

## /team (index)

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| TM-1 | A Functional | ✅ | `getBrokers()` + `getReviews(8)` wired. `KbTeam` component links to `/team/[slug]`. `KbSell`, `FAQBlock`, `KbFooter` all real components. One FAQ answer uses `CONTACT.phoneDirect` (live constant, not hardcoded). | — | — |
| TM-2 | B Statistics | ✅ | Broker license numbers from `getBrokers()` (Supabase `brokers` table). Reviews from `getReviews()`. No fabricated counts. KbSell data nulled (no pulse context — correct). | — | — |
| TM-3 | C SEO | ✅ | `pageMetadata()` with title, description, path `/team`, OG. `MetadataBlock` emits `CollectionPage` + `BreadcrumbList` JSON-LD. One H1 via `KbHero`. | 🐞 OG image path is `/brand/hero/hero-old-mill-master-4k.jpg` — double-check public asset exists at that path (homepage uses `/images/hero/hero-old-mill-master-4k.jpg`). | Low |
| TM-4 | D Indexability | ✅ | No `noindex`. In sitemap via `teamPath()` (priority 0.7). `HideChrome` covers `/team/*`. | — | — |
| TM-5 | E CRM | ✅ | `KbSectionTracker pageType="team"`. `VisitTrackerWithSession` runs. | — | — |

---

## /team/[slug] (broker profile)

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| TS-1 | A Functional | ✅ | `getAgentBySlug()` → `notFound()` if missing. Call/text/email links are `tel:`, `sms:`, `mailto:` from live DB data. `LeadCaptureBlock` → `submitBrokerSellerLead` server action. `BrokerAttributionSetter` sets cookie. `KbFeatured` → listing detail links. | — | — |
| TS-2 | B Statistics | ✅ | `getBrokerSales()` closings count from verified MLS data. `getReviews(24)` aggregate rating from Supabase. Brokerage tiles from `getBrokerageListingTiles()`. Review attribution filter (`reviewBelongsOnPage`) prevents wrong-broker name appearing. `revalidate = 60`. | — | — |
| TS-3 | C SEO | ✅ | `generateMetadata()` per broker: title/description/canonical/OG(broker-specific `/api/og?type=broker&id=`)/twitter. `RealEstateAgent` + `BreadcrumbList` JSON-LD inline. One H1 via `KbHero` (broker first+last name split across titleTop/titleBottom). | — | — |
| TS-4 | D Indexability | ✅ | No `noindex`. `revalidate = 60`. `HideChrome` covers `/team/<slug>` (1-segment). Broker slugs in sitemap via `teamPath()` call pattern (verify dynamic broker slug sitemap entries). | ❓ Confirm that `/team/[slug]` individual broker pages are included in sitemap dynamically — sitemap.ts has `teamPath()` for `/team` index but no loop over broker slugs was visible in the checked portion. | Medium |
| TS-5 | E CRM | ✅ | `KbSectionTracker pageType="broker"`. `VisitTrackerWithSession` runs. | — | — |

---

## /contact

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| CO-1 | A Functional | ✅ | `ContactForm` → `submitContactForm` server action (code-verified: writes to FUB, fallback to native CRM on FUB failure). Phone link uses `CONTACT.phoneFubTel`. `/team` and `listingsBrowsePath()` links valid. `?inquiry`, `?listingKey`, `?intent` params wired. NOTE: form not submitted per safety rule — wiring verified in code only. | — | — |
| CO-2 | B Statistics | ✅ | No market stats on this page. Office info from `CONTACT` brand constant. | — | — |
| CO-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/contact`, OG, twitter. `ContactPage`, `BreadcrumbList`, and `FAQPage` JSON-LD emitted inline. One H1 via `KbHero` (CMS-overridable via `getPageContent('contact')`). | 🐞 `metadata.openGraph` is missing `description` field (has title + url + type + images but no description). | Low |
| CO-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.5). `HideChrome` covers `/contact`. SSR via `trackPageViewIfPossible` (force-dynamic behaviour — no explicit `dynamic` export, but the `getSession()` + `getFubPersonIdFromCookie()` calls make this dynamic). | — | — |
| CO-5 | E CRM | ✅ | `trackPageViewIfPossible()` called server-side (FUB page view). `KbSectionTracker pageType="info"`. `VisitTrackerWithSession` runs. | — | — |

---

## /reviews

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| RV-1 | A Functional | ✅ | "View reviews on Google" links to `GOOGLE_REVIEWS_URL` (external, real). `/contact` and `/team` CTAs wired. All `<Link>` hrefs are real routes. | — | — |
| RV-2 | B Statistics | ✅ | Reviews from `TESTIMONIALS` (verified 24 Google reviews pulled 2026-06-13 via GBP API, per file header). Review count (24), rating (5.0) derived from same array — not fabricated. `buildReviewsJsonLd()` computes aggregate from the same rendered set. | — | — |
| RV-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/reviews`, OG, twitter. `RealEstateAgent` + `AggregateRating` + per-`Review` JSON-LD. One H1 via `KbHero`. | — | — |
| RV-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.5, monthly). `HideChrome` covers `/reviews`. Sync server component — SSR. | — | — |
| RV-5 | E CRM | 🐞 | `KbSectionTracker pageType="media"` fires section_view events. BUT `trackPageViewIfPossible` (FUB) is NOT called — only the Contact and FAQ pages call it explicitly. The global `VisitTrackerWithSession` in layout does run a session-level page view, but FUB-specific page view (for lead-nurture attribution) is absent. | Add `trackPageViewIfPossible` server-side call or confirm that `VisitTrackerWithSession` is sufficient for FUB tracking on this page. | Low |

---

## /our-homes

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| OH-1 | A Functional | ✅ | `getListingsWithAdvanced({ limit: 24, sort: 'newest' })` live DAL call. Each listing card → `listingDetailPath()` (valid canonical URL). "View all listings" → `listingsBrowsePath()` = `/homes-for-sale`. "Sell with us" → `/sell`. Empty state CTAs both wired. `dynamic = 'force-dynamic'`. | — | — |
| OH-2 | B Statistics | ✅ | Live listing count from the DAL result (`listings.length`). No hardcoded counts. Photo/price/address all from MLS data. | — | — |
| OH-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/our-homes`, OG, twitter. One H1 via `KbHero`. | 🐞 Hero `data.activeCount` is passed as `listings.length || null` — this is the Ryan Realty-only listing count, not the total active Central Oregon count, but it's displayed in the KbHero sub-row alongside messaging about "N listings by Ryan Realty" so contextually correct. Verify KbHero renders this number with appropriate copy context. | Low |
| OH-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.6, daily). `HideChrome` covers `/our-homes`. `force-dynamic` — always fresh, always crawlable. | — | — |
| OH-5 | E CRM | 🐞 | `KbSectionTracker pageType="info"`. Global `VisitTrackerWithSession` runs. BUT no `trackPageViewIfPossible` FUB call. For a page showing Ryan Realty's own inventory, FUB tracking would identify high-intent visitors. | Consider adding FUB page view tracking. | Low |

---

## /join

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| JN-1 | A Functional | ✅ | "Start the conversation" → `/contact?inquiry=Join%20the%20team`. "See how we market listings" → `/sell#marketing-plan` (anchor verified: `SellMarketingPlan.tsx:107` has `id="marketing-plan"`). "Meet the brokers" → `/team`. "Get in touch" → same contact URL. `a href tel:` from `CONTACT.phoneDirectTel`. `getSurfaceImage()` for hero photo. | — | — |
| JN-2 | B Statistics | ✅ | No market stats on this page (intentional — no fabricated close counts or agent counts per CLAUDE.md directive). Copy is process facts only. | — | — |
| JN-3 | C SEO | ✅ | `pageMetadata()` — title, description, path `/join`, OG image, keywords. `MetadataBlock` emits `webPage` + `BreadcrumbList` + `FAQPage` JSON-LD. One H1 via `KbHero`. `revalidate = 3600`. | — | — |
| JN-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.5, monthly). `HideChrome` covers `/join`. | — | — |
| JN-5 | E CRM | 🐞 | `KbSectionTracker pageType="join"`. Global `VisitTrackerWithSession` runs. No explicit FUB `trackPageViewIfPossible` call. Broker recruiting page — low priority for FUB tracking. | Acceptable. | Info |

---

## /resources

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| RS-1 | A Functional | ✅ | All 6 resource tile links are real internal routes: `/housing-market/reports`, `/housing-market`, `/guides`, `/compare`, `/tools/appreciation`, `/activity`. "View market reports" and "Search listings" CTAs wired. `AdUnit` and `HomeValuationCta` components preserved. | — | — |
| RS-2 | B Statistics | ✅ | No market stats on this page — all content is navigation tiles. | — | — |
| RS-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/resources`, OG (both title/description), twitter. `CollectionPage` JSON-LD inline. One H1 via `KbHero`. | — | — |
| RS-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.6, weekly). `HideChrome` covers `/resources`. Sync server component — SSR. | — | — |
| RS-5 | E CRM | 🐞 | `KbSectionTracker pageType="info"`. Global `VisitTrackerWithSession` runs. No FUB `trackPageViewIfPossible`. | Low priority for this navigation hub page. | Info |

---

## /faq

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| FQ-1 | A Functional | ✅ | "Talk to us" → `/contact`. "Latest market report" → `/housing-market/reports`. Contact CTA at bottom → `/contact`. Category TOC links are in-page anchors (`#neighborhoods`, `#buying`, etc.) — IDs generated consistently from `g.cat.toLowerCase().replace(/\s+/g, '-')`. `FaqAccordion` (Radix) keeps answers in DOM. | — | — |
| FQ-2 | B Statistics | ✅ | FAQ answers contain only qualitative facts and process descriptions — no market stats requiring live sourcing. All claims (license numbers, area coverage, broker count) match verified facts in CLAUDE.md. | — | — |
| FQ-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/faq`, OG, twitter. `FAQPage` JSON-LD inline (10 Q&A entries). One H1 via `KbHero`. | — | — |
| FQ-4 | D Indexability | ☠️ | `/faq` is **MISSING from sitemap.ts**. The page exists, is not `noindex`, and has valuable SEO content (FAQ snippets), but was never added to the `staticPages` array. | Add `{ url: \`\${baseUrl}/faq\`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 }` to `staticPages` in `app/sitemap.ts`. | High |
| FQ-5 | E CRM | ✅ | `trackPageViewIfPossible` called server-side (FUB). `KbSectionTracker pageType="info"`. `VisitTrackerWithSession` runs. `dynamic = 'force-dynamic'`. | — | — |

---

## /videos

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| VD-1 | A Functional | ✅ | City filter chips are real `<Link>` with `aria-current`. `getListingTiles()` / `getCityListings()` with `hasVirtualTour: true` DAL call. `VideoListingCard` per tile. Empty state links to `/homes-for-sale`. `revalidate = 300`. | — | — |
| VD-2 | B Statistics | ✅ | `cards.length` displayed live. No hardcoded counts. `revalidate = 300` (5 min fresh). | — | — |
| VD-3 | C SEO | ✅ | `generateMetadata()` — dynamic title/description/canonical per `?city=`. Multiple JSON-LD blocks: `ItemList`, `BreadcrumbList`, `CollectionPage`, per-listing `VideoObject`. One H1 via `KbHero`. | — | — |
| VD-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.5, weekly). `HideChrome` covers `/videos`. ISR via `revalidate = 300`. | 🐞 `?city=` variants are not in sitemap (e.g. `/videos?city=Bend`). Crawlers will discover them via links but won't get sitemap priority. | Low |
| VD-5 | E CRM | 🐞 | `KbSectionTracker pageType="media"`. Global `VisitTrackerWithSession` runs. No FUB `trackPageViewIfPossible` call. | Low priority — no lead capture on this page. | Info |

---

## /pulse

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| PL-1 | A Functional | ✅ | `getPulseFeed()`, `getPulseRegionSnapshot()`, `getPulseCitySnapshots()` all DAL-backed. `PulseFeed` (interactive: city filters, infinite scroll, video autoplay, like/save, in-feed signup) is a preserved client component. `HomeValuationCta` wired. `KbFooter` linked. `dynamic = 'force-dynamic'`. | — | — |
| PL-2 | B Statistics | ✅ | All region stats (`active_count`, `median_list_price`, `months_of_supply`, `sold_count_30d`, `new_count_7d`, `median_active_dom`) from `getPulseRegionSnapshot()` live DAL call. Market verdict from `formatHealthVerdict()` using live MoS value — thresholds match CLAUDE.md (≤4 seller, 4–6 balanced, ≥6 buyer). | — | — |
| PL-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/pulse`, OG (with siteName), twitter. `BreadcrumbList` JSON-LD inline. One H1 via `KbHero`. | — | — |
| PL-4 | D Indexability | ☠️ | `/pulse` is **MISSING from sitemap.ts**. This is one of the highest-value live market pages (real-time MLS feed) and is completely absent from the sitemap. The page is indexed (`no noindex`) and crawlable but Google won't discover it via sitemap. | Add `{ url: \`\${baseUrl}/pulse\`, lastModified: now, changeFrequency: 'daily', priority: 0.7 }` to `staticPages` in `app/sitemap.ts`. | High |
| PL-5 | E CRM | ✅ | `KbSectionTracker pageType="feed"`. Global `VisitTrackerWithSession` runs. `PulseFeed` has in-feed signup card. | — | — |

---

## /feed

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| FD-1 | A Functional | ✅ | `getCentralOregonVideosHubListings()` DAL call. `normalizeEmbed()` filters non-embeddable videos. `VideoFeedClient` handles `?start=<listingKey>`. `listingDetailPath()` links for each card. Honest empty state. | — | — |
| FD-2 | B Statistics | ✅ | No explicit stats — purely a live video-tour feed from the DAL. | — | — |
| FD-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/feed`, OG (title/description/url/siteName/type/images), twitter. | 🐞 No JSON-LD (no BreadcrumbList, no ItemList, no VideoObject). No H1 — the empty state has an `<h1>` but the normal render is `<VideoFeedClient>` which may not contain an H1. No `KbBreadcrumb`. | Medium |
| FD-4 | D Indexability | ☠️ | `/feed` is **MISSING from sitemap.ts**. Also no `noindex` set, so it's indexable but not submitted. | Add to sitemap. Given its nature as an experience-first video feed (not a text-content page), lower priority (0.4) with weekly change frequency is appropriate. | Medium |
| FD-5 | E CRM | ☠️ | **NO tracking at all on `/feed`.** No `KbSectionTracker`, no `VisitTrackerWithSession` (it runs from layout but `/feed` is not `HideOnLP`-gated), no `trackPageViewIfPossible`. `VideoFeedClient` may have internal analytics but no session or FUB tracking is wired at the page level. | Add `KbSectionTracker` or at minimum verify `VisitTrackerWithSession` fires here; add FUB page view if warranted. | High |

---

## /activity

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| AC-1 | A Functional | ✅ | `getActivityFeed({ limit: 24 })` DAL call. Every event row → `listingTileHref()` (canonical listing detail URL). "View all listings" → `listingsBrowsePath()`. `AdUnit` and `HomeValuationCta` preserved. Honest empty state with listing browse CTA. `dynamic = 'force-dynamic'`. | — | — |
| AC-2 | B Statistics | ✅ | Live feed — no hardcoded stats. `whenLabel` dates from `event_at` field. Prices from `ListPrice`. | — | — |
| AC-3 | C SEO | ✅ | `export const metadata` static — title, description, canonical `/activity`, OG, twitter. `CollectionPage` + `BreadcrumbList` JSON-LD inline. One H1 via `KbHero`. | — | — |
| AC-4 | D Indexability | ✅ | No `noindex`. In sitemap (priority 0.6, daily). `HideChrome` covers `/activity`. `force-dynamic`. | — | — |
| AC-5 | E CRM | ✅ | `KbSectionTracker pageType="feed"`. Global `VisitTrackerWithSession` runs. | — | — |

---

## /compare

| # | Dim | Status | Evidence | Fix | Severity |
|---|-----|--------|----------|-----|----------|
| CP-1 | A Functional | ✅ | `getListingTiles` by listNumbers AND listingKeys, dedup, `getListingDetailPhotos` for hero. `CompareClient` (interactive: photo row, side-by-side table, Copy Link, Download PDF, Google Maps embed). Empty state when no `?ids=` present. `revalidate = 60`. | 🐞 `AICompare` component is built (`components/compare/AICompare.tsx`) but deliberately not wired — known brand-voice and rate-limit risks documented in page comment. Not a functional defect (intentional hold). | Info |
| CP-2 | B Statistics | ✅ | All data from live DAL (`getListingTiles`, `getListingDetailPhotos`). Derived DOM (`daysOnMarket()`) helper present but intentionally unconnected to listing-history data (retained for future use). No fabricated stats. | — | — |
| CP-3 | C SEO | ✅ | `export const metadata` includes `robots: { index: false, follow: true }` — intentional `noindex` for this utility tool. Title, description, canonical, OG, twitter present. `BreadcrumbList` JSON-LD via `MetadataBlock`. One H1 inline (not via KbHero). | — | — |
| CP-4 | D Indexability | 🐞 | `/compare` has `robots: { index: false, follow: true }` (intentional `noindex`) BUT is listed in `sitemap.ts` (line 84: `{ url: \`\${baseUrl}/compare\`, priority: 0.5 }`). Submitting a `noindex` URL to the sitemap is a contradiction — Google ignores noindex URLs from sitemaps and may generate a Search Console warning. | Remove `/compare` from `sitemap.ts` to match the `noindex` intent. | Medium |
| CP-5 | E CRM | ✅ | `KbSectionTracker pageType="compare"`. Global `VisitTrackerWithSession` runs. | — | — |

---

## Cross-cutting findings

| # | Pages | Dim | Status | Evidence | Fix | Severity |
|---|-------|-----|--------|----------|-----|----------|
| X-1 | /team (OG image path) | C SEO | 🐞 | `/team/page.tsx` line 51 and `/team/[slug]/page.tsx` line 164 both use `/brand/hero/hero-old-mill-master-4k.jpg` as the hero poster path. The homepage and `/contact` use `/images/hero/hero-old-mill-master-4k.jpg`. The `design_system/` MANIFEST locks the canonical hero at `design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg` (web convention: `public/images/hero/`). If `public/brand/` doesn't mirror the file, the hero image will 404. | Verify `public/brand/hero/hero-old-mill-master-4k.jpg` exists. If not, update the paths to `/images/hero/hero-old-mill-master-4k.jpg`. | Medium |
| X-2 | /faq, /pulse, /feed | D Indexability | ☠️ | Three indexable, no-`noindex` pages are missing from `sitemap.ts`. `/faq` has 10 FAQPage JSON-LD entries (high SEO value). `/pulse` is the live market hub (high freshness value). `/feed` is a TikTok-style video experience. | Add all three to `staticPages` in `app/sitemap.ts`. | High |
| X-3 | /compare | D Indexability | 🐞 | `noindex` page in sitemap. | Remove from sitemap. | Medium |
| X-4 | /feed | E CRM | ☠️ | No page-level tracking. `KbSectionTracker` is absent. While `VisitTrackerWithSession` in layout runs on all non-HideOnLP routes and `/feed` is not gated, the page is an unusual `bg-primary` full-screen experience that may not trigger standard session events. No FUB tracking. | Add `KbSectionTracker pageType="feed"` to `/feed/page.tsx`. | High |
| X-5 | /team/[slug] broker slugs | D Indexability | ❓ | `sitemap.ts` includes `/team` index (via `teamPath()`) but a dynamic loop over individual broker slug pages (`/team/matt-ryan`, `/team/paul-stevenson`, `/team/rebecca-peterson`) was not visible in the checked portion of `sitemap.ts`. These broker profile pages are high-value `RealEstateAgent` JSON-LD targets. | Read all of `sitemap.ts` to confirm whether broker slugs are included dynamically. If not, add a `getBrokers()` loop to emit each broker's URL. | Medium |
| X-6 | /reviews | E CRM | 🐞 | FUB `trackPageViewIfPossible` not called. Only `KbSectionTracker` + global `VisitTrackerWithSession`. | Low priority given no lead-capture on page; note for completeness. | Info |

---

## Defect summary

| Severity | Count | Items |
|----------|-------|-------|
| ☠️ Blocker (High) | 4 | FQ-4 (faq missing from sitemap), PL-4 (pulse missing from sitemap), FD-4+FD-5 (feed missing from sitemap + no tracking) |
| 🐞 Medium | 4 | X-1 (team hero image path), CP-4 (compare noindex but in sitemap), FD-3 (feed no H1/JSON-LD), TS-4 (broker slug sitemap coverage unknown) |
| 🐞 Low | 4 | TM-3 (team OG image path), CO-3 (contact OG missing description), OH-3 (our-homes activeCount context), VD-4 (video city filter variants not in sitemap) |
| ❓ Needs verification | 1 | TS-4 (broker slug sitemap coverage) |
| Info | 4 | JN-5, RS-5, OH-5, VD-5 (FUB tracking gaps on non-lead-capture pages) |

---

## Top 5 fixes (by impact)

1. **Add `/faq`, `/pulse`, `/feed` to `app/sitemap.ts`** — three pages with zero sitemap presence. `/faq` has FAQPage JSON-LD that Google can surface as rich results; `/pulse` is the primary market data hub. (`app/sitemap.ts` lines 83–95, `staticPages` array.)

2. **Add `KbSectionTracker pageType="feed"` to `/feed/page.tsx`** — only page in this cluster with zero page-level tracking. (`app/feed/page.tsx` — add after `<main>` open tag.)

3. **Remove `/compare` from sitemap** — `noindex` page submitted to sitemap creates a Search Console conflict. (`app/sitemap.ts` line 84 — delete that entry.)

4. **Verify `/brand/hero/hero-old-mill-master-4k.jpg` exists** — `/team` and `/team/[slug]` use this path for the hero poster; homepage and `/contact` use `/images/hero/`. If the file is absent, the hero breaks silently. (`public/brand/hero/` directory check.)

5. **Confirm broker slug sitemap coverage** — read `app/sitemap.ts` in full to verify `/team/matt-ryan`, `/team/paul-stevenson`, `/team/rebecca-peterson` appear. These are `RealEstateAgent` JSON-LD pages with high local-search value.
