# competitors — long-form notes (2026-09-22, reader: competitors)

Repo /home/user/RyanRealty @ 83a459c (tree clean before and after; `git status --short` empty). Production https://ryan-realty.com fetched with a Chrome 128 UA. All SERP data below is **WebSearch's view (US), not a logged-out Google SERP**. Raw artifacts in this folder: `websearch-results.md`, `ours-*.html`, `ours-analysis.jsonl`, `comp/*.html`, `comp-analysis.jsonl`, `pw/*`, `analyze.py`.

## 1. Who wins the 12 queries (WebSearch top 9-10)

| Query | ryan-realty.com | Local (non-portal) sites in top 10 |
|---|---|---|
| bend oregon homes for sale | absent | bendpremierrealestate.com (5), bendrealestate.com (7), cascadehasson.com (8), bendoregonhomes.com (9) |
| homes for sale bend oregon | absent | bendpremierrealestate.com (6), bendrealestate.com (8), cascadehasson.com (9) |
| tetherow homes for sale | absent | engelvoelkers (3), bendpremierrealestate.com (5,6), cascadehasson.com/Tetherow (7), tetherow.com/live (8), bendrealestate.com/tetherow (9) |
| awbrey butte homes for sale | absent | cascadehasson.com/Awbrey-Butte (6), bendrealestate.com/awbrey-butte (7), enjoybendlife.com (8) |
| northwest crossing bend homes for sale | absent | bendpremierrealestate.com (2,3), cascadehasson.com (4), bendrealestate.com (5), enjoybendlife.com (6), tuttlebendrealestate.com (7) |
| sunriver homes for sale | absent | sothebysrealty.com (3), sunriverresort.com/sunriver-realty (7), cascadehasson.com/sunriver (8), sunriverrealty.com (9) |
| redmond oregon homes for sale | absent | exprealty.com (6), bendpremierrealestate.com (7), century21northhomes.com (8), cascadehasson.com (9) |
| bend oregon real estate | absent | bendpremierrealestate.com (6,7), bendrealestate.com (8), cascadehasson.com (9) |
| bend oregon housing market | absent | doorloop blog (1), bendsource.com (2), bendbulletin (4), bendpremierrealestate.com blog (5,6), bendpropertysource.com (7, Ladd Group) |
| best neighborhoods in bend oregon | absent | **9 of 9 are local brokerages/agents/guides, zero portals**: bendpremierrealestate.com blog (1), movingtobend.com, dukewarner.com, bernardrealestategroup.com, movetobend.com, brokererinmartin.com, amandakrealestate.com, allthingsbend.org (x2) |
| bend oregon real estate agents | absent | dukewarner.com (7), kbire.com (8), bendrealestate.com (9) |
| ryan realty bend | **6th** (home), then /properties/ (7), /sell-your-bend-oregon-home (8), /cities/bend (9) | above us: LinkedIn (1), ZoomInfo (2), Zillow profile (3), Facebook (4), Yelp (5) |

Recurring local winners: bendpremierrealestate.com (7 of 11 non-brand queries), cascadehasson.com (7), bendrealestate.com (7; Greg Broderick, Stellar Realty NW, per WebSearch domain-scoped result), enjoybendlife.com (2), dukewarner.com (2).

## 2. Our real Google position (Supabase site_signal, source gsc_search_analytics_api, scope='campaign', surface='query:<q>'; the snapshot stores only the top-25 queries by impressions per day, so absence = not in the daily top 25, not zero)

Windows: last8w = 2026-07-28..2026-09-19; prior8w = 2026-06-02..2026-07-27; older = before.

| Query (as GSC reports it) | older | prior8w | last8w |
|---|---|---|---|
| bend oregon homes for sale | 14 days, pos 42.4, 17 impr | 2 days, pos 25.0, 2 impr | absent |
| homes for sale bend oregon | 5 days, pos 38.2 | absent | absent |
| bend oregon real estate | 38 days, pos 24.6, 100 impr | 1 day, pos 33.0 | absent |
| bend oregon real estate agents | 79 days, pos 29.2, 112 impr (last seen 2026-05-29) | absent | absent |
| best neighborhoods in bend oregon | 2 days (2026-02-24/25), pos 1.0, 2 impr | absent | absent |
| northwest crossing bend homes for sale | 2 days (Apr), pos 46.5 | absent | absent |
| bend oregon housing market | — | 1 day (2026-06-03), pos 23.3 | absent |
| awbrey butte homes for sale | never in snapshot | never | never |
| sunriver homes for sale | never | never | never |
| redmond oregon homes for sale | never | never | never |
| "tetherow homes for sale" (literal quotes) | first seen 2026-05-23; all-time 111 days, pos 17.2, 395 impr, 0 clicks | (included in all-time) | 45 days, pos 21.2, 147 impr, 0 clicks |
| "tetherow real estate" (literal quotes) | all-time 85 days, pos 32.4, 281 impr, 0 clicks | | 41 days, pos 35.9, 127 impr |
| ryan realty | 16 days, pos 11.8, 11 clicks | 5 days, pos 9.6, 6 clicks | 1 day, pos 1.0, 1 click (last seen 2026-08-08) |
| matt ryan real estate | 9 days, pos 1.5, 7 clicks (through 2026-09-14) | | |

Other place queries we do hold (last 8w, all literal-quoted, all 0 clicks): "brasada ranch real estate agent" pos 1.0 (151 impr), "brasada ranch homes for sale" 11.1 (173), "broken top homes for sale" 15.4 (141), "broken top real estate" 20.1 (145), "black butte ranch homes for sale" 21.7 (144), "golf course homes bend" 5.2 (91), "bend new construction luxury homes" 1.4 (32), "resort investment property bend" 1.0 (20). Plus 13 "greenwood playhouse" variants (pos 2-10, 0 clicks) and dozens of single-address queries (Medford, Klamath Falls, Grants Pass, Salem, La Pine).

Observation on the quoted rows: `app/actions/search-console-report.ts:33` stores `row.keys[0]` verbatim and `app/api/cron/marketing-snapshot-gsc/route.ts:62-97` writes `query:${q.key}` for the top 25 by impressions; so the double quotes are in the searches themselves. From 2026-05-23 onward these quoted, zero-click queries fill most of the daily top-25 slots and the plain human queries (bend real estate agent family, ryan realty) drop out of the snapshot after ~2026-05-31/06-16. Interpretation UNVERIFIED (looks like automated / AI-agent search traffic; no repo script issues quoted Google queries — grep of app/lib/scripts for serpapi|google.com/search finds only `scripts/recon-design.mjs` (Apify image/LinkedIn recon, hand-run, last touched 2026-06-01) and `scripts/gbp-audit-nap-consistency.mjs`).

Page-level (scope='page', last 8w, place surfaces): /blog/sunriver-year-round-living-vs-vacation 20 days, pos 6.8, 890 impr, 28 clicks; /blog/best-neighborhoods-bend-retirees 38 days, pos 21.7, 279 impr, 4 clicks; /housing-market/bend 5 days, pos 18.6, 131 impr, 5 clicks; /blog/best-neighborhoods-bend-families 26 days, pos 27.2, 89 impr, 0 clicks; /blog/tetherow-resort-living-real-estate 4 days, pos 7.8, 84 impr, 4 clicks; /blog/best-neighborhoods-bend-buyers 4 days, pos 7.1, 20 impr; /communities/tetherow 1 day, pos 41.1, 10 impr, 1 click; /communities/black-butte-ranch 2 days pos 38.9. Monthly for the head pages: home page impressions 4,851 (Mar) → 2,172 (Apr) → 959 (May) → 940 (Jun) → 681 (Jul) → 479 (Aug) → 211 (Sep-to-date), avg pos 27→34.7 (Aug). /communities/tetherow: Jun pos 24.2 (1 day), Jul 33.5 (3 days), Aug 41.1 (1 day), Sep absent. /communities/sunriver: one day in June at 44.9. /cities/bend, /cities/redmond, /cities/bend/awbrey-butte, /communities/northwest-crossing, /homes-for-sale, /neighborhoods: never in the top-25 page list.

Site-wide context (scope='account', weekly): clicks 4-20/wk Mar-May; 86-151/wk Jun-Sep (peak 151 wk of 2026-08-24; impressions peak 13,328 wk of 08-31); wk of 09-14: 123 clicks, 8,543 impr, pos 9.7. The slip Matt describes is not visible as a site-wide click collapse; it is visible in (a) head pages losing impressions (home -95% Mar→Sep) and (b) never ranking for the head queries at all.

## 3. Redirect landed today on the one Tetherow asset that ranked (SITE-180)

- `git log`: 2026-09-22 136088ad1 "fix(seo): 301 tetherow blog onto /communities/tetherow"; 3e08ce120 merge "Node: none (merge land Tetherow blog 308)". `next.config.ts:423` `{ source: '/blog/tetherow-resort-living-real-estate', destination: '/communities/tetherow', permanent: true }`. Live: `curl -A Chrome /blog/tetherow-resort-living-real-estate` → 308 → /communities/tetherow.
- The node's own objective (`scripts/seed-site-queue.ts:1490-1499`) records: query landings for tetherow*: blog 186 impr pos 15.2; community 220 impr pos 46.1; page rows: blog 807 impr / 3 clicks / pos 9.6; community 261 impr / 0 clicks / pos 41.5. It also correctly excludes the Sunriver/Caldera/Eagle Crest guides.
- blog_posts row: slug tetherow-resort-living-real-estate, title "Tetherow Where Resort Living Meets Real Estate", published 2025-08-20, content 9,551 chars. The community page's prose is one "More about Tetherow 5 paragraphs" block plus data rows; whether the guide's prose was merged before the 301 is not evidenced in the commit (the node says "Do not edit app/communities/[slug]/page.tsx").
- Consolidation of a true duplicate is standard; here the target is a data/inventory page at pos 41-46 and the source is a guide at pos 9-15 for the same queries. Google may or may not transfer; the measurement is simply GSC page rows for /communities/tetherow over the next 14-28 days. No process rule in the repo says "do not 301 a page-1 URL onto a pos-40 URL without merging content and a rollback date".

## 4. Page-level comparison (what I could fetch)

Every competitor brokerage page is bot-walled for this sandbox: curl (Chrome UA) → 403 (Cloudflare "Attention Required" on cascadehasson.com/reliancenetwork and bendrealestate.com; "Digital Sentinel" PoW on bendpremierrealestate.com; Akamai "Access Denied" on homes.com; zillow 403); WebFetch → 403 on all 12; headless Chromium (Playwright 1.58.2 with /opt/pw-browsers/chromium-1194) → same 403 pages; archive.org → "Blocked by egress policy". So competitor page internals are UNVERIFIED beyond WebSearch summaries. Fetched successfully: redfin.com Tetherow + Bend, enjoybendlife.com/bend/awbrey-butte, bendpropertysource.com market page, sunriverrealty.com.

Metrics from `analyze.py` (visible words exclude script/style/svg; "price tokens" = $ figures in text; JSON-LD @types parsed):

| Page | HTML | script % | words | listing cards w/ price in HTML | price tokens | internal links (unique) | JSON-LD |
|---|---|---|---|---|---|---|---|
| ours /communities/tetherow | 920 KB | 52 | 4,163 | 29 (price·address·bd·ba·sqft in anchor text) | 42 | 231 (114) | RealEstateAgent/LocalBusiness, WebSite, BreadcrumbList, Place(geo,address,hasMap), Dataset, FAQPage(6 sourced Q&A), ItemList x2, VideoObject |
| redfin Tetherow | 477 KB | 57 | 2,070 | 27 | 59 | 174 (133) | Organization, ~30x SingleFamilyResidence+Product, Event (open houses), BreadcrumbList |
| ours /cities/bend/awbrey-butte | 2.01 MB | 57 | 5,335 | 84 | 151 | 317 (169) | …Neighborhood, Dataset, ItemList, VideoObject, FAQPage |
| enjoybendlife Awbrey Butte | 274 KB | 1 | 7,793 | listing feed (server-rendered) | 100 | 348 (320) | RealEstateAgent, WebSite, BreadcrumbList; phone in header |
| ours /cities/bend | 3.77 MB | 55 | 12,813 | 741 | 853 | 995 (834) | City, Dataset, FAQPage, ItemList, VideoObject… |
| redfin Bend | 1.57 MB | 85 | 2,683 | ~30 | — | — | per-listing Product LD |
| ours /housing-market/bend | 331 KB | 67 | 1,993 | — | 14 | 205 | WebPage, Dataset, FAQPage, ItemList |
| bendpropertysource market page | 226 KB | 68 | 2,080 | — | 7 | 83 | none |
| ours /team | 1.70 MB | 75 | 1,303 | | | | |
| ours /team/matthew-ryan | 1.72 MB | 77 | 1,553 | | | | |

What inflates ours: /cities/bend has a single 1,305,913-byte `self.__next_f.push` chunk for `place-one-map` (22,005 coordinate-looking tokens = polygon geometry inlined) and a 451 KB rail chunk; 3,236 photo URLs; 741 listing-detail links. Redfin's city page carries ~30 listings and a "More to explore" link block.

Ours in the raw HTML is fully server-rendered (H1, counts, FAQ, listing anchors present with no JS) — that part is fine.

Copy contrast (their prose from WebSearch summaries; ours from the fetched HTML):
- Bend Premier: "Buyers who value walkability and community often gravitate toward Northwest Crossing." / "westside Bend neighborhoods tend to have higher home prices due to their proximity to trails, Cascade views, and walkable amenities"
- Cascade Hasson Tetherow: "a 700-acre golf and recreational planned resort community cradled beneath the snowcapped Cascade peaks…" plus sub-community pages (Tartan Druim, Tripleknot, Timberline Collective).
- Ours (Tetherow FAQ): "Tetherow has had fewer sales we can attribute to it on its own than a fair buyer's or seller's verdict needs, so we are not printing one." / "Each answer carries the one figure it is about and where that figure came from." / "That 11 is single-family only, which is the population every figure on this page measures." Honest, sourced, but system-voice (the voice reader owns this).

Inventory counts printed on ONE page (ours-communities_tetherow.html, visible text): "11 homes for sale" (headline), "24 for sale 4 pending" (map), "Tetherow 25 for sale · Homes 15 for sale · Townhomes and condos 9 for sale · Lots 1 for sale" (type rail), FAQ "11 single-family homes are on the market… 24 homes… when every property type is counted", and "HOA $2,052 a year median of the 131 current listings that report dues" (x3). Five figures (11/24/25/131) for one place. Portals print one (Redfin desc: 26; Zillow: 35; WebSearch: Redfin 39) and they count all residential.

Structural things competitors have that our equivalent page does not link to:
- Price-band pages per neighborhood (bendrealestate.com/tetherow-by-price-1750000-2250000/, …-750000-1250000/ etc. all indexed) and per-neighborhood sold / condos / 3-bedroom / under-$500k pages (homes.com …/awbrey-butte-neighborhood/sold/, /condos-for-sale/, /3-bedroom/, /under-500k/). Ours: matrix pages exist (/homes-for-sale/sunriver/under-400k ranked pos 5 for a day) but /communities/tetherow links to 0 filtered `/homes-for-sale/*` pages (link-class count: homes-for-sale/root 8, homes-for-sale/filtered 0) and /homes-for-sale/bend/tetherow 301s back to the community page.
- Quadrant pages (bendrealestate.com NE/NW/SW/SE Bend; cascadehasson.com Bend-Southwest/Bend-Northwest). Ours has the 13 city districts under /cities/bend/*.
- Sub-community pages inside the resort (Tartan Druim, Tripleknot, Timberline at Tetherow on cascadehasson.com). Ours: /subdivisions/tartan-druim and /subdivisions/tripleknot are 200 (166 KB, small plat pages; content not inspected).
- Dated monthly market posts with the number in the title (Bend Premier "March 2026: Prices Drop 7.4%, Sales Surge"; Ladd Group "January 2026 Bend Housing Market Update") — that is what ranks 5-7 for "bend oregon housing market"; our /housing-market/bend is one evergreen page (pos 12-20).
- Per-listing Product/Offer + Event JSON-LD on the portal place pages (ours is ItemList on the place page).
- Agent phone in the header (enjoybendlife; bendrealestate "(541)280-2363"). Ours: tel:+15417033095 appears 3x in the page (present).

## 5. Bing, GBP, mentions, age

- Bing: UNVERIFIED. curl with Chrome UA returned 200 but Bing served unrelated cached SERPs ("souperior meatloaf", then "Half Price Books" result lists for our query); headless Chromium got a 200 shell with 0 `b_algo` results; DDG html endpoint 202/502. Cannot state whether we appear on Bing.
- GBP-style: WebSearch cannot show a knowledge panel. "Ryan Realty Bend Oregon reviews" surfaces Zillow profile (4.99, 22 sales), Facebook, Yelp, and our /reviews, /team/matt-ryan, /team/matthew-ryan, /sellers/, /explore/bend/. Team page states "25 Google reviews". GBP itself: UNVERIFIED here (local-seo reader/aeo reader own it).
- Mentions: WebSearch `"ryan-realty.com" -site:ryan-realty.com` → ZoomInfo, realty.com office profile, then unrelated namesakes (Ryan Realty Tampa, Ryan Realty Group Plymouth MA, ryanrealty.org, Ryan Real Estate Walnut Ridge AR, Ryan Realty C21 Panama City Beach, ryanrealtyproperties.com). `"Ryan Realty" Bend Oregon -site:` → LinkedIn, Facebook, Yelp only. No press, no sponsorships, no local directories surfaced.
- Domain registration (RDAP, rdap.org): ryan-realty.com 2023-01-01; bendrealestate.com 1996-10-07; bendoregonhomes.com 2003-03-09; bendpremierrealestate.com 2010-12-07; bendpropertysource.com 2012-02-21; enjoybendlife.com 2019-05-08; cascadehasson.com 2022-05-20 (Sotheby's affiliate; brand and agent base predate the domain).
- Legacy indexed URLs: /properties/ → /homes-for-sale (1 hop); /sell-your-bend-oregon-home → /sell; /explore/bend/ → 2 redirects → /cities/bend; /sellers/ → 2 redirects → /sell; /team/matt-ryan → 301 → /team/matthew-ryan (both titles appear in the brand SERP); /guides → 308 → /blog; /cities/bend/neighborhoods → 200 "Page not found" (soft 404, noindex).
- Transient: 6 of ~45 curl requests to ryan-realty.com through the sandbox proxy ended in connection reset / SSL_ERROR_SYSCALL; retries succeeded (0.2-2.3 s). Not attributable to the site from here.

## 6. What would have to be true to win the subdivision/neighborhood long tail

1. The URL that holds the head H1 must be the URL Google ranks. Today our page-1 assets are guides (Sunriver pos 6.8, Tetherow guide 7-9, best-neighborhoods-buyers 7.1) and the place pages sit 38-46. Either the place page absorbs the guide (real prose + the data), or the guide stays and links; deleting the guide without proof is the one move that can only lose.
2. One number per page. A page printing 11/24/25/131 for its own inventory cannot be quoted by an answer engine and fails §0 on its face.
3. Weight. 0.9-3.8 MB HTML with inlined polygons is 2-8x the portals; nothing else on the page can outrank that cost for a crawler at 3,000+ URLs.
4. Links into the matrix. Price-band/type/sold pages exist but the hub pages do not link to them; competitors index those long-tail pages and win "tetherow homes $2M" style queries.
5. A dated, bylined content cadence (monthly market post per city with the number in the title; one best-neighborhoods hub) — the only query class in this set with zero portals is the guide class, and we are absent there.
6. Off-site: age (2023 vs 1996-2012), a brand name shared with ≥6 other brokerages, and no third-party mentions beyond profile sites. Code cannot fix this; consistent "Ryan Realty Bend" naming, profile links, and local press can.
7. Measurement: the target-query snapshot must query the API per target query (filter), not rely on the top-25 cap; 3 of the 12 queries have never produced a row.
