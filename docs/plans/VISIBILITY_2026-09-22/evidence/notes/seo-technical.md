# seo-technical — long-form notes (2026-09-22, HEAD 83a459c, branch claude/admiring-feynman-7lgwc3)

Read-only audit. All live requests used a Chrome 128 UA or the crawler UA named. `git status --short` empty at
every checkpoint. Every artifact referenced below sits in this directory.

Artifacts: `ua-matrix.sh` + `ua-matrix.log` (13 UAs × 7 paths), `sitemap-*.xml` + `.hdr` (the five children),
`sitemap-*-timing-*.hdr` (cache-busted timing), `classify.log` (family counts; NOTE its "OUT OF AREA" labels are
wrong — the script parsed 0 city slugs; corrected below), `render-check.log`, `render-check-2.log`, `page_*.html`
(raw served HTML), `sitemap-sample-check.mjs` + `sitemap-sample-results.json` (live sample per family),
`retest-500s.mjs/.json`, `burst-500.mjs`, `soft404-and-dupes.mjs`, `nav-and-size.mjs`, `hops.ts` (offline
redirect pass over every sitemap URL), `listing-status.mjs` (MV status of every listing URL).

## 1. Middleware bot screen (middleware.ts)

- `screenBotRequest` (L202-223): page routes only, never `/api/*`; compliance paths exempt (L187-196).
  Order: `GOOD_BOT_RE` allowlist (L150-151) → empty UA → 403 `empty-ua` → `BAD_BOT_RE` (L170-171: `curl/`,
  wget, python-requests, urllib, aiohttp, httpx, axios, node-fetch, go-http-client, okhttp, scrapy, nmap,
  sqlmap, semrushbot, mj12bot, dotbot, dataforseobot, petalbot, blexbot, megaindex, serpstatbot, seekport,
  barkrowler, spbot …) → 403 `bad-ua` → geo `x-vercel-ip-country` in {CN,HK,RU,SG} (L173-180) → 403 `geo:XX`.
  Kill switch `BOT_SCREEN_DISABLED=1`. AhrefsBot deliberately not blocked; Bytespider allowed.
- `GOOD_BOT_RE` covers googlebot, google-inspectiontool, storebot-google, googleother, google-extended,
  bingbot, slurp, duckduckbot, applebot, gptbot, oai-searchbot, chatgpt-user, perplexitybot, perplexity-user,
  claudebot, claude-searchbot, claude-user, claude-web, anthropic-ai, cohere-ai, ccbot, youbot,
  meta-externalagent, amazonbot, bytespider, lighthouse/pagespeed, facebookexternalhit, twitterbot,
  linkedinbot, slackbot, whatsapp, discordbot, telegrambot, pinterest, redditbot, vercelbot.
  Not covered: Yandex, Baidu, SeznamBot (Yandex from RU would be geo-blocked). Immaterial for the mission.
- Matcher (L655-657) excludes any path containing a dot, so `/sitemaps/*.xml`, `/robots.txt`, `/llms.txt`
  never pass through middleware (explains bare-curl 200 on those).
- LIVE (ua-matrix.log): Googlebot, Googlebot-smartphone, Bingbot, GPTBot, ChatGPT-User, OAI-SearchBot,
  ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, Applebot, Chrome → **HTTP 200 with full HTML** on
  `/`, `/cities/bend`, `/subdivisions/ridge-at-eagle-crest`, `/listing/220222277`, and 200 on `/sitemap.xml`,
  `/llms.txt`, `/robots.txt`. Bare curl → `403 Forbidden` (9 bytes) with `x-bot-screen: bad-ua`,
  `cache-control: no-store` on `/` and `/listing/…`; `-A ''` → `x-bot-screen: empty-ua`. Sitemap/llms/robots
  200 for bare curl. The `curl: (35)` / `000` rows in ua-matrix.log are sandbox proxy resets
  (`[agent-proxy] ws_closed_mid_exchange`), not server responses — every such path succeeded on retry.
- **No crawler gets the bot screen.** Not a finding.

## 2. Vercel firewall — UNVERIFIED

- The orchestrator forbade MCP calls mid-task. Before the rule I had run only `list_teams` and
  `list_projects`: team `team_zwYQPapH0CpleD7RzJ7WctGO` ("ryanrealty's projects"), project `ryanrealty`
  `prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA`. `get_firewall_config`, `get_active_attack_status`,
  `list_project_domains` were NOT called.
- Inference from ~140 live responses: no `x-vercel-mitigated`, `x-vercel-challenge` or `_vcrcs` header in
  any captured `.hdr` file or body; every crawler UA 200; the only 403s carry middleware's `x-bot-screen`.
  Attack Challenge Mode would have returned a challenge page to curl regardless of UA. State: **UNVERIFIED but
  no evidence of a challenge or block rule affecting crawlers.**
- `vercel.json` has no `headers`, `redirects` or `rewrites` — only `build.env`, `ignoreCommand`, `crons`
  (incl. `/api/cron/warm-sitemaps`). All headers/redirects live in `next.config.ts` (`headers()` L196-273:
  CSP, X-Frame-Options, Referrer-Policy, and per-family `Cache-Control: public, s-maxage=60,
  stale-while-revalidate=600` for `/`, `/cities/*`, `/communities/*`, `/zip/*`, `/listing/*`,
  `/homes-for-sale/*`, `/subdivisions/*`; 300/3600 for /about, /team, /blog; `redirects()` L275+).

## 3. robots.txt (app/robots.ts) — live 883 bytes, 200 for every UA

`User-Agent: *` allow `/`, `/api/og`, `/llms.txt`; disallow `/admin/ /dashboard/ /account/ /api/ /auth/
/mockup-preview/ /dev/`. Explicit `Allow: /` for OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User,
Claude-SearchBot, Claude-User, Claude-Web, Applebot, YouBot, meta-externalagent, Amazonbot, Googlebot,
Bingbot, GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, Bytespider. `Sitemap:
https://ryan-realty.com/sitemap.xml`. `/llms.txt` 282,193 bytes, 200. Gate `check-ai-crawler-access.mjs`
(G39) pins robots ↔ middleware parity. Fine.

## 4. Sitemaps

- `/sitemap.xml` → `<sitemapindex>` (705 B, `app/sitemaps/index.xml/route.ts` via beforeFiles rewrite) →
  `/sitemaps/{core,geo,listings,matrix,content}.xml` (`app/sitemaps/[cls]/route.ts`, revalidate 3600,
  maxDuration 300, dynamicParams true; universe built by `buildAllUrls` in `app/sitemap.ts` with a 210 s
  shared deadline per leg, SITE-54). `/sitemap-0.xml` 404 (not referenced anywhere; fine).
- Counts (fetched 19:43 UTC): core 205, geo 4,827, listings 3,283, matrix 885, content 92 = **9,292**.
- Timing today (cache-busted `?audit=…`, Chrome UA): geo run1 200, 601,535 B, ttfb 0.33 s, **total 36.3 s**
  (cold universe build streams while generating); geo run2 0.42 s; listings 0.31/0.33 s; matrix 0.23/0.21 s;
  core 0.54/0.20 s; content 0.22/0.29 s. Cached (no query): age ~1000 s, HIT. **No 504/5xx today**; the
  SITE-54 504 is not reproducing. Headers: `cache-control: public, max-age=3600`.
- Families over all 9,292 (corrected classification — every listing city segment is in
  `CENTRAL_OREGON_CITY_SLUGS`): listing detail 3,283 (2,710 4-seg + 573 3-seg) = 35%; `/subdivisions/{slug}`
  2,642; `/homes-for-sale/{city}/{plat}` browse 1,815 (geo) + `/homes-for-sale/{city}/{preset}` 573 (matrix)
  + 3-seg `{city}/{area}/{preset}` 312; `/central-oregon/*` 117; `/zip/*` 115; `/blog/*` 91; `/oregon/{city}`
  61; `/schools/*` 56; `/open-houses*` 29; `/cities/{city}` 28 (with duplicates); `/housing-market/*` 37;
  `/communities/*` 19; `/parks/*` 19; `/cities/{city}/{nb}` 13; rest singletons.
- **Out-of-market**: listing URLs 0 of 3,283 (all 19 city segments in the service-area set). Geo: 61
  `/oregon/*` out-of-area city pages (by design, W12) + 105 statewide zips that 404 (below). ≈1.8% of the
  sitemap is out-of-market by URL; none of it is listing inventory.
- **Off-market listings in the sitemap: 0.** `listing-status.mjs` read every one of the 3,283 list numbers
  from `listing_tile_mv` (`.in()` batches of 300, tallied client-side): 3,283 found, Active 3,242 / Active
  Under Contract 39 / Pending 2. `check-sitemap-listings-honest.mjs` holds this.
- **lastmod**: geo.xml 4,827 tags / 13 distinct values; matrix 885 / 1; core 205 / 27; content 92 / 57;
  listings 3,283 / 2,940 (real `ModificationTimestamp`, 2026-02-28 … 2026-09-22). Source: `app/sitemap.ts`
  `lastModified: now` at L346-348, 366, 380, 426, 443, 461, 534; index lastmod = generation time
  (`index.xml/route.ts` L48).
- **Duplicates**: core.xml has 30 duplicate `<loc>` (10 cities × `/cities/{c}`, `/homes-for-sale/{c}`,
  `/open-houses/{c}`): the static seed (L251-257) and the dynamic cities loop (L343-349) both push them.
- **Zips**: `app/sitemap.ts` L515-539 emits every 5-digit `PostalCode` of an active listing statewide → 115
  zips; `app/zip/[zip]/page.tsx` L170-175 `dynamicParams=false` + `CANONICAL_ZIPS`
  (`app/zip/[zip]/_v3/zip-constants.ts` L67, 10 Bend/Redmond-area zips). Live: **10 × 200, 105 × 404**
  (`sitemap-sample-results.json` → zip). `check-sitemap-resolvable` checks the family's route exists, not
  the params, so it passes.
- **Redirecting URLs in the sitemap** (offline `hops.ts` = `resolvePreRenderHop` + the middleware geo-city
  rules over all 9,292): 5/2,642 `/subdivisions/*` (`brasada-ranch → /communities/brasada-ranch`,
  `eagle-crest → /communities/eagle-crest`, `first-on-the-hill-sites → /subdivisions/1st-on-the-hillsites`,
  `mountain-high → /communities/mountain-high`, +1). Live sample also caught
  `/homes-for-sale/bend/awbrey-butte → 301 /cities/bend/awbrey-butte` (1 of 40 browse URLs).

## 5. Index / canonical policy by route family (code + live)

| Family | Index state | Source |
|---|---|---|
| `/`, `/cities`, `/cities/{city}`, `/cities/{city}/{nb}` | index,follow, self-canonical | live + `app/layout.tsx` L64 |
| `/cities/{city}/types/{t}`, `/communities/{c}/types/{t}` | index,follow, self-canonical; **not in any sitemap** (0 `/types/` locs); linked only from city page (10) + sibling types (4) | live |
| `/communities/{slug}` | index; compound non-community slugs noindex,follow self-canonical | `community-metadata.ts` L189-278 |
| `/subdivisions/{slug}` | index only if in `getIndexableSubdivisions()` (GIS polygon AND ≥10 lifetime sales, `subdivision-index.ts` L48); else noindex,follow self-canonical; refusal = noindex, no canonical | `page.tsx` L327-368, `SubdivisionUnavailable.tsx` L62 |
| `/homes-for-sale/{city}` and `/{city}/{area}` and `/{city}/{area}/{preset}` (search route) | index,follow self-canonical unless query params (`shouldNoIndexSearchVariant`, `lib/seo-routing.ts` L28-58) or verified-zero city×preset (`matrixCityPresetNoIndex`) | `app/search/[...slug]/page.tsx` L335-347 |
| `/listing/{key}` | index,follow; **canonical → `/homes-for-sale/{city}/{nb}/{plat}/{street}-{listnumber}`** (SITE-22 one canonical per listing); off-market stays indexed (SITE-32 gate) | live: `/listing/220222277` canonical → `/homes-for-sale/bend/river-west/west-hills/1671-saginaw-220222277` which returns 200 index,follow self-canonical |
| `/zip/{zip}` | index for the 10 canonical zips; real 404 otherwise | live |
| `/oregon/{city}` | index,follow for ≥5 active (top 100), force-dynamic | `lib/out-of-area-cities.ts` L44-52, `app/oregon/[city]/page.tsx` L150, L192-200 |
| `/lp/*`, `/compare`, `/luxury-homes-bend`, `/reports*`, `/builders*`, `/areas/*`, `/pulse`, `/motivated-sellers*`, `/resources`, `/area-guides`, `/data-deletion`, `/cookies`, auth/account/admin/dev | noindex (or redirect) | grep in app/** |
| `/housing-market/central-oregon` | noindex,follow (report twin) | `page.tsx` L218 |

No canonical pointing at a redirecting URL was observed in any sample. No self-canonical to a different path
other than the intentional `/listing/{key}` → address-path canonical (target verified 200).

## 6. Rendering (raw HTML with Chrome UA, no JS) — render-check.log

All place/listing pages are server-rendered: H1, counts, listing anchors and JSON-LD are in the raw HTML.
Sizes: `/` 535 KB (16.3K visible chars); `/cities/bend` **3,770 KB** (70.7K visible chars, 2,056 KB in 105
RSC push chunks, one 1,306 KB chunk = the `place-one-map` Atlas with 22,005 inline coordinate tokens, 741
listing anchors, 787 `<img>`); `/cities/bend/awbrey-butte` 2,011 KB; `/cities/bend/types/single-family`
1,684 KB; `/subdivisions/ridge-at-eagle-crest` 1,067 KB; `/communities/tetherow` 920 KB; `/listing/220222277`
948 KB; `/homes-for-sale/bend` 726 KB. JSON-LD parsed on every page (none invalid): RealEstateAgent +
WebSite everywhere; City/Neighborhood/Place + Dataset + ItemList + FAQPage + VideoObject + BreadcrumbList on
place pages; RealEstateListing + BreadcrumbList on listings; CollectionPage on indexes.

Titles are unique across classes and query-shaped on cities/neighborhoods/communities/types/listings
(`757 single-family homes for sale in Bend, Oregon`, `Awbrey Butte homes for sale · Bend, Oregon`,
`3 bed, 3 bath · 1671 NW Saginaw Avenue, Bend, OR 97703`). Subdivision titles are the problem (§8).

## 7. Caching / ISR per class (live headers, Googlebot UA)

- `/cities/bend`, `/communities/tetherow`, `/zip/97702`, `/subdivisions/*`: `public, s-maxage=60,
  stale-while-revalidate=600`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, `x-vercel-cache`
  HIT/STALE/MISS. ISR works; the 60 s CDN header (next.config) is shorter than the 900 s `revalidate`, so
  STALE is the common state.
- `/listing/{key}`, `/homes-for-sale/{city}`, `/homes-for-sale/{city}/{plat}`, `/{city}/{area}/{preset}`,
  `/oregon/{city}`, `/open-houses/{city}`: **`private, no-cache, no-store, max-age=0, must-revalidate`,
  `x-vercel-cache: MISS`, no `x-nextjs-prerender`** on every fetch. Cause: `app/listing/[listingKey]/page.tsx`
  L266-270 awaits `searchParams` (and reads `headers()` through `isNextRouterPrefetch`);
  `app/search/[...slug]/page.tsx` L94 `const sp = await searchParams`; `/oregon` is `force-dynamic`. Reading
  `searchParams`/`headers()` opts the route out of ISR, so `export const revalidate = 300` on both files is
  dead. `scripts/check-public-isr-ttl.mjs` L41-43 pins exactly those 300 s values ("cookies() ISR; stay on the
  5m window"). Observed Googlebot TTFB on listing detail: 5.5 s, 1.2 s, 2.6 s, 1.6 s, 1.1 s, 3.3 s, 1.5 s,
  1.2 s (ua-matrix.log); sample of 40 sitemap listing URLs avg 2.1 s max 4.4 s; 40 browse URLs avg 1.5 s.
  5,983 of 9,292 sitemap URLs (64%) are in this uncacheable class.
- Degraded-ISR protection: `runPublishedPageRender` + `unstable_noStore` (`lib/site/degraded-isr.ts`), held by
  `ci:degraded-isr`; `ci:count-degraded-read` blocks publishing a count from a timed-out read. Good.

## 8. /subdivisions/* — the biggest technical exposure

- 2,642 sitemapped plat pages; `generateStaticParams` returns `[]` (L280-282) so every plat renders on
  demand, `revalidate = 900`.
- Cold render 2.5–9.1 s (`retest-500s.json`, `burst-500.mjs`).
- **HTTP 500 under parallel load**: first sample (6 concurrent) 23/60 → 500; serial retest 0/23 (all 200,
  MISS); controlled 12-concurrent bursts with the Googlebot UA on untouched URLs: **3/12 and 1/12 → 500**
  (Next generic `500: Internal Server Error.` page, `x-vercel-cache: MISS`, no `x-vercel-error`, 6.4–9.8 s).
  Runtime logs not readable (MCP rule). Suspects: `generateMetadata` L353-358 calls
  `getIndexableSubdivisions()` and `getPlatBoundaryCity()` without the `withTimeoutFallbackResult` guard the
  body applies to every read (L376-384, 398-408, 428-438, 458-466); a statement timeout or pool exhaustion in
  either throws straight to the error boundary.
- **Inbound links**: raw-HTML anchors to `/subdivisions/{slug}`: `/subdivisions` 47 (featured plats via
  `publishFeaturedPlats`), `/cities/bend` 0, `/cities/redmond` 0, `/cities/bend/awbrey-butte` 0,
  `/cities/bend/old-bend` 0, `/site-index` 0, `/neighborhoods` 0, listing detail 1, plat pages min 0 / avg 2 /
  max 8. The Atlas is a client component (hrefs only in the hydration payload) — `V3PlaceIndex.tsx` L6-15
  measured the same on 2026-09-09 and built PATTERN 9 to fix it, but `app/cities/[slug]/page.tsx` L436-443
  now routes Bend's plats to the Atlas only ("A–Z `/subdivisions` is the directory") and that directory shows
  47. Crawl depth from `/` for ~2,595 plats: sitemap-only (no in-site path), or ≥3 clicks through a listing
  that happens to sit in the plat.
- **Titles / indexability inversion**: 22/37 sampled sitemapped plat titles carry legal-plat noise
  (`Broken Top Phase Ii C Lots 117 Thru 143 homes for sale · Bend`, `Rivers Edge Village Phase Xxii Pz 19 0632
  homes for sale`, `121 West Phases 1 and 2 711 21 000260 Sub homes for sale`, `Anderson Ranch P U D`,
  `Deschutes River Recreation Homesites Unit 9 Part I Blocks 41 42 And 53`). 24/37 have zero active
  listings (they do carry sold history, 8–15K chars). Meanwhile `/subdivisions/ridge-at-eagle-crest` (111
  listing anchors, 33.7K chars, the page a searcher wants) is **noindex,follow** and absent from geo.xml while
  `ridge-at-eagle-crest-7/-10/-11/-14` (phase plats) are submitted. `/subdivisions/bend` is submitted with the
  title `Bend homes for sale | Ryan Realty, Central Oregon` — identical to `/cities/bend`.
- **Two URL families per plat**: `/homes-for-sale/{city}/{plat}` (search route, 1,815 in geo.xml,
  `SUBDIVISION_SITEMAP_MIN_LIFETIME_LISTINGS=3` across all statuses, L386-429) and `/subdivisions/{plat}`.
  Pairs: `boulevard`, `cascade-peaks`, `1414-awbrey` → identical `<title>` on both (`Boulevard homes for sale |
  Ryan Realty, Central Oregon`), `/subdivisions` noindex + `/homes-for-sale/bend/...` index with **0 listings,
  ~3.5K visible chars**; `avonlea-estates` → both indexable. Sample of 39 browse URLs: **30 (77%) have zero
  listing cards** (`sitemap-sample-results.json` → hfs2). 3-seg matrix sample 20/20 have listings (that
  family is gated on ≥1 active).

## 9. Soft-404 / phantom-page classes (soft404-and-dupes.mjs)

- 200 + noindex "Page not found" (no `<h1>`): `/cities/bend/zzz-not-a-real-neighborhood`,
  `/cities/bend/types/condo`, `/cities/bend/types/zzz`, `/communities/tetherow/types/condo`,
  `/housing-market/zzz-nope`; 200 + noindex refusal with h1: `/subdivisions/zzz-not-a-real-plat-9x`,
  `/listing/999999999`, `/homes-for-sale/bend/fake-street-999999999`. Real 404: `/zip/97501`,
  `/schools/zzz`, `/communities/<garbage>` (edge). Mechanism documented in middleware.ts L252-260, 294-297
  (root `app/loading.tsx` streams 200 before `notFound()`); only `/communities/{slug}`, 1-seg `/cities`,
  `/open-houses`, `/homes-for-sale/{city}`, blog index paths and `/dev` are validated at the edge.
- **200 + index,follow + self-canonical + fabricated H1** for ANY made-up area under the search route:
  `/homes-for-sale/bend/zzz-not-a-real-area-9x` → H1 `Zzz Not A Real Area 9x homes for sale`;
  `/homes-for-sale/redmond/totally-made-up-place-42` → `Totally Made Up Place 42 homes for sale`;
  `/homes-for-sale/la-pine/not-a-place-at-all`; `/homes-for-sale/bend/qqq-nope/under-500k` → `Homes Under
  $500,000 in Qqq Nope`; `/homes-for-sale/bend/zzz-not-real/single-family` → `Single-Family Homes in Zzz Not
  Real`. Five shapes, three cities, all `robots=index, follow`, `cache-control: private, no-store`. The
  middleware's city rule matches exactly one segment by design (L299-309); `resolveSlug` only `notFound()`s
  an unknown 3-seg preset (page L96-100); `shouldNoIndexSearchVariant` looks at query params only.

## 10. Internal linking / crawl depth (nav-and-size.mjs on `/`)

Header nav (49 unique hrefs): `/homes-for-sale?view=list|map`, `/open-houses`, `/price-drops`,
`/luxury-homes-bend` (noindex!), `/new-construction`, `/our-homes`, `/cities` + 8 cities, `/communities` + 7
communities, `/neighborhoods`, `/subdivisions`, `/schools`, market pages, `/blog`, `/faq`, `/sell`,
`/sell/valuation`, `/about`, `/team`, `/join`, `/reviews`, `/contact`, `/login`, `/videos`,
`/central-oregon/golf`, `/parks`, `/newsletter`, `/account`. Footer 42 hrefs: cities, 9 communities, legal,
`/site-index`. No property-type or zip links in header/footer. Depth: city 1, neighborhood 2 (`/neighborhoods`
lists 13), community 1, type page 2 (via city), zip 2 (via `/zip/97702` cross-links only), plat 2 for 47
featured / unreachable for the rest, listing 1–2.

## 11. Gates touching SEO (all 17 are in `ci:gates:chain`, package.json; chain has 295 entries)

`check-ai-crawler-access` (robots ↔ middleware parity), `check-canonical-host` (308 alias funnel),
`check-canonical-integrity` (redirect/canonical collisions, missing canonicals, ratchet),
`check-canonical-listings` (one ListingCard), `check-degraded-isr`, `check-count-from-degraded-read`,
`check-public-isr-ttl` (pins TTL constants — but the listing/search TTLs are dead, §7),
`check-seo-routes`/`check-seo-authoring` (no legacy URLs), `check-seo-shell` (query-language titles on money
routes), `check-sitemap-resolvable` (family → route file exists; does NOT validate params, hence 105 zip 404s
pass), `check-sitemap-listings-honest`, `check-sitemap-inventory-gate` (verified-zero city×preset omitted),
`check-site-index-freshness`, `check-publish-place-index-truth`, `check-listing-canonical-single`,
`check-listing-offmarket-index` (off-market stays indexed — Matt 2026-09-08), `check-content-metadata`,
`check-content-schema`. Nothing here is counterproductive for visibility per se; the gap is that every gate is
static/source-level while the three live defects (500s under load, dynamic-not-ISR, phantom pages, submitted
404s) are only visible against production. `check-listing-offmarket-index` is a Matt ruling, not a defect.

## 11b. Concurrent edits on this checkout (NOT mine, NOT reverted)

At 20:11 UTC `git status --short` showed 5 modified tracked files that were clean at every earlier checkpoint
(19:47, 19:58, 20:03): `app/sitemap.ts` (mtime 20:10:08), `components/motion/number.tsx` (20:07:41),
`lib/sitemap-guard.ts` (20:10:51), `lib/sitemap-guard.test.ts`, `lib/sitemap.contract.test.ts` (20:10:21);
162 insertions / 31 deletions. None of my scripts writes into the repo (every `writeFileSync` targets a
relative path with cwd = this scratch dir; `hops.ts`/`listing-status.mjs` are read-only). The diff comments
cite "visibility audit 2026-09-22 … EXP-10 / COMP-1", replace `filterRogueCityUrls` with
`finalizeSitemapEntries`, drop the zip leg in favour of `LLMS_ZIPS`, and add a `REDIRECT_SOURCES` filter —
i.e. another session of this audit is already fixing SEO-3 (zip 404s) and SEO-11 (redirect sources) in the
working tree. Per the mission rule that nothing may be lost, I did NOT `git checkout --` them. All line
numbers in these notes and in findings.json refer to HEAD 83a459c as read before those edits landed; the live
site still serves the pre-edit behaviour (105 zip 404s measured 19:45 UTC).

## 12. Verdict on "why we slip" from this lens

Crawlers are not blocked. The site is server-rendered with valid schema and mostly good titles. The technical
drag is concentrated in the programmatic long tail Matt is counting on: (1) plat pages 500 under parallel
crawl and are cold every 15 min, (2) plat pages are orphaned from the internal graph, (3) the indexable plat
set is the wrong set (legal phases with junk titles indexed; marketing names noindexed; browse-URL twins with
zero inventory indexed), (4) 64% of sitemap URLs are uncacheable dynamic renders at 1–5 s, (5) the sitemap
submits 105 404s, 30 duplicates, 5+ redirects and fabricated lastmod on 5,900 URLs, and (6) an unbounded
indexable URL space exists under `/homes-for-sale/{city}/{anything}`.
