# AEO reader — long-form notes (2026-09-22, HEAD 83a459c, branch claude/admiring-feynman-7lgwc3)

Scratch: `/tmp/claude-0/-home-user-RyanRealty/9fe9d814-a247-5921-8288-dab9436e06db/scratchpad/aeo/`
Evidence files in this folder: `ua_matrix.txt` (AI-UA probe), `live_robots.txt`, `live_llms.txt`, `llms_resolve.txt`,
`sub_sample_results.txt`, `pages/*.html` (11 production bodies, Chrome UA), `jsonld_*.json` (parsed JSON-LD per page),
`text_*.txt` (visible text per page), `analysis.json` (payload breakdown), `brokers_rows.txt`, `legacy_urls.txt`,
`sitemap_index.xml`, `sitemap_geo.xml`, `sitemap_core.xml`, `aeo_guides_live.txt`.

Rules followed: read-only (I edited nothing tracked; see §13 for the concurrent session's edits present at finish), no sends, no MCP calls after the orchestrator's rule change
(one Vercel firewall read happened before it and is reported as observed), DB reads only via `scratchpad/lib/sb.mjs`
(one 3-row read of `brokers`). Production fetched with a Chrome 128 UA; several `000` results in the raw logs are
sandbox-proxy resets (`ws_closed_mid_exchange`), not server responses; every such cell was retried and resolved.

---

## 1. llms.txt

**Route:** `app/llms.txt/route.ts` (185 lines), `revalidate = 3600`, `cache-control: public, max-age=0, s-maxage=3600`.
Sections built from the DAL: blog (25), guides (50), reports (12), events, venues, golf, trails, cities (SITE_CITY_SLUGS),
communities (registry), neighborhoods (`getAllNeighborhoodsWithCity`), ZIPs (`zipLlmsLines`), market cities, and
subdivisions via `getIndexableSubdivisions()` (polygon + >= 10 lifetime closed sales, `SUBDIVISION_INDEX_MIN_LIFETIME_SALES = 10`
in `lib/data/subdivisions/subdivision-index.ts:48`). Pillars from `lib/seo/ai-query-map.json`.

**Live** (`curl -A <Chrome> https://ryan-realty.com/llms.txt`): 200, `text/plain`, **282,193 bytes, 2,941 lines, 2,904 bullets**.
Section bullet counts (awk over `live_llms.txt`):

```
Listings 10 · Price Drops 4 · Market Data 25 · Local Areas 2 · Cities 11 · Communities 20 · Neighborhoods 13 · ZIP codes 10
Subdivisions 2642 · Local Events 49 · Venues 21 · Golf 26 · Trails 20 · Guides 14 · Blog 25 · Tools 4 · Brokerage 8
```

- 2,642 of 2,904 bullets (91.0%) are subdivision plat URLs, names like "Ridge At Eagle Crest 11 Replat Lots 21-28 (Redmond)".
- Freshness is good: the newest weekly report listed is `weekly-2026-09-13` (Sep 13–19), and both August monthly city
  reports (`bend-oregon-market-report-august-2026`, `redmond-...`) are in the Blog section (grep count 2).
- **No property-type page** is listed (`grep -c '/types/' live_llms.txt` = 0), so the `/cities/<city>/types/<type>` family the
  mission names is invisible on the AI map (and absent from `sitemaps/core.xml`: `types=0`; not checked in matrix.xml).
- **Duplicate lines:** `- Value my home: .../sell` appears at lines 2931 and 2937 (Tools and Brokerage sections) and
  `- Refer a client to Central Oregon: .../refer-a-client` at 2940 and 2941 — `lib/seo/ai-query-map.json` `pillars[]`
  lists `/sell` twice (tools + brokerage) and `/refer-a-client` twice (lines 60–69). `closing-costs` is also emitted twice
  (pillar + guides list).
- **`/llms-full.txt` → 404** (142,610-byte HTML 404 page).
- llmstxt.org (WebFetch 2026-09-22): "The file itself stays small enough to fit in context. The detail lives behind the
  links, and is fetched only when needed." and distinguishes llms.txt from sitemap.xml, which "will include a lot of
  information that isn't necessary to understand the site." Ours is a sitemap in Markdown clothing.

**Do the URLs resolve?** Sampled 69 distinct URLs (`llms_sample2.txt`, every 73rd line plus every 9th non-subdivision line):

```
61 × 200 · 1 × 301 · 1 × 308 · 6 × 500
```
- 301: `https://ryan-realty.com/homes-for-sale/bend/northwest-crossing?beds=3&baths=2` → `/communities/northwest-crossing`
  (an F1 pillar path; see §4).
- 308: `/communities/mountain-high` → `/subdivisions/mountain-high` (llms.txt cites the hop URL).
- 500 (retried twice each, 4.5–5.2 s): `/subdivisions/ridge-at-eagle-crest-13`, `/subdivisions/skyliner-summit-at-broken-top-phase-9`,
  `/subdivisions/steve-w-yancey` stayed 500 (`<title>500: Internal Server Error`); `taylors-addition`, `tollgate-fifth-addition`,
  `westgate-phases-5-6-and-7` recovered to 200 (transient).
- Second sample: 150 subdivision URLs (every 17th) — see `sub_sample_results.txt`; summary appended in §11.
- `ci:sitemap-resolvable` (`scripts/check-sitemap-resolvable.mjs`) is a static "route file exists" check (line 73 maps
  `subdivisions` to `app/subdivisions/[slug]/page.tsx`); no gate fetches these URLs live, so a plat slug that 500s is
  invisible to CI while it sits in both the sitemap (`sitemaps/geo.xml` has 2,643 `/subdivisions/` URLs) and llms.txt.

## 2. AI crawler access (scripts + live)

**Scripts** (all wired in `ci:gates:chain`, `package.json:255-257,273`):
- `scripts/check-ai-crawler-access.mjs` — static: robots.ts lists 15 REQUIRED_BOTS, Allow '/', llms route exists,
  `GOOD_BOT_RE` in middleware matches every robots userAgent and 4 geo-bypass UAs, `BAD_BOT_RE` matches none, llms route
  contains 18 marker strings. Passes locally.
- `scripts/check-ai-structured-data.mjs` (G34) — static presence of import/usage tokens (`MetadataBlock`, `buildMarketFaq`…)
  in 34 files. Passes. It is a presence check, not a value check ("not a deep schema validator").
- `scripts/check-ai-query-battery.mjs` (F1) — static: pillars present in llms route source; citable paths not `/lp/`, not in
  `hopForbiddenPathnames`, and **not a `permanent: true` source in `next.config.ts` only** (`isPermanentHop`, lines 29–38).
  Live fetch of llms.txt is "evidence-only". Passes locally today: "10 queries, 12 llms.txt pillars, hop URLs excluded.
  LIVE /llms.txt contains every pillar path." — while the live pillar path 301s (see §4). Redirects in `middleware.ts` are
  outside its view.

**middleware.ts** (`screenBotRequest`, lines 202–223): order = `/api/*` exempt → compliance paths exempt → `GOOD_BOT_RE`
allow (line 150–151: googlebot…google-extended, bingbot, applebot, gptbot, oai-searchbot, chatgpt-user, perplexitybot,
perplexity-user, claudebot, claude-searchbot, claude-user, claude-web, anthropic-ai, cohere-ai, ccbot, youbot,
meta-externalagent, amazonbot, bytespider, social unfurlers…) → empty UA 403 → `BAD_BOT_RE` 403 (curl/, wget,
python-requests, httpx, aiohttp, node-fetch, axios, go-http-client, okhttp, java/, semrushbot, mj12bot, dotbot…) →
geo 403 for CN/HK/RU/SG. Matcher (line 656) skips any path with a dot, so `/robots.txt`, `/llms.txt`, `/sitemaps/*.xml`
never hit the screen.

**Live UA matrix** (`ua_matrix.txt`; 4 pages × 13 UAs; `000` = sandbox proxy reset, all retried to 200):

| UA | / | /cities/bend | /communities/tetherow | /subdivisions/ridge-at-eagle-crest |
|---|---|---|---|---|
| GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Bytespider, CCBot, Amazonbot, meta-externalagent, Claude-User, Perplexity-User | 200 | 200 | 200 | 200 |
| bare `curl/8.5.0` | 403 `x-bot-screen: bad-ua` | 403 | 403 | 403 |

Titles/H1 identical across UAs (no cloaking). This session's own WebFetch tool fetched `/cities/bend/awbrey-butte` and got
the real page (title + H1 + FAQ sentences). **No AI crawler is blocked.**

**robots.txt live** (`live_robots.txt`): `*` group Allow `/`, `/api/og`, `/llms.txt`; Disallow `/admin/ /dashboard/ /account/
/api/ /auth/ /mockup-preview/ /dev/`; then 19 named groups each containing only `Allow: /`. Per Google's robots spec
(WebFetch developers.google.com 2026-09-22): "Only one group is valid for a particular crawler … User agent specific
groups and global groups (*) are not combined." So GPTBot, ClaudeBot, PerplexityBot, CCBot, Bytespider, Googlebot,
Bingbot etc. are **not** bound by the Disallow list; combined with middleware never screening `/api/*`, the named bots may
crawl `/api/*`, `/admin/`, `/dashboard/`. Not a visibility loss, but the named groups are decorative-plus-harmful.

**Vercel firewall:** one `get_firewall_config(active)` and one `get_active_attack_status` call (made before the
orchestrator's no-MCP rule) both returned `404 "Seawall Config not found."` — i.e. no custom firewall configuration exists
on project `ryanrealty` (`prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA`). Attack Challenge Mode state: UNVERIFIED beyond that (no
further MCP calls). `vercel.json` has no bot-related headers (not re-read here; the seo-technical reader owns it).

## 3. Structured data / entity graph

Parsed every `application/ld+json` block on 11 production pages (`jsonld_*.json`): **69 blocks, 0 parse errors.**

| page | bytes | JSON-LD @types |
|---|---|---|
| / | 535,884 | RealEstateAgent+LocalBusiness, WebSite, ItemList, FAQPage |
| /about | 4,682,636 | Org, WebSite, AboutPage, BreadcrumbList, FAQPage, ItemList×2, Dataset |
| /contact | 209,247 | Org, WebSite, ContactPage, BreadcrumbList, FAQPage |
| /team | 1,702,333 | Org, WebSite, CollectionPage, BreadcrumbList, ItemList×2 |
| /team/matthew-ryan | 1,721,770 | Org, WebSite, RealEstateAgent (no sameAs), BreadcrumbList |
| /cities/bend | 3,773,792 | Org, WebSite, BreadcrumbList, City, Dataset, FAQPage, ItemList, VideoObject |
| /cities/bend/awbrey-butte | 2,011,675 | Org, WebSite, BreadcrumbList, Neighborhood, Dataset, ItemList, VideoObject, FAQPage |
| /communities/tetherow | 920,816 | Org, WebSite, BreadcrumbList, Place, Dataset, FAQPage, ItemList×2, VideoObject |
| /subdivisions/ridge-at-eagle-crest | 1,068,290 | Org, WebSite, BreadcrumbList, Place, FAQPage — **`robots: noindex, follow`** |
| /cities/bend/types/single-family | 1,684,335 | Org, WebSite, BreadcrumbList, WebPage, ItemList |
| /listing/220222277 | 948,104 | Org, WebSite, BreadcrumbList, RealEstateListing |
| /housing-market/bend | 331,924 | Org, WebSite, BreadcrumbList, WebPage, Dataset, FAQPage, ItemList |

**Organization** (`components/JsonLd.tsx`, values from `lib/brand/contact.ts`): `@type [RealEstateAgent, LocalBusiness]`,
`@id https://ryan-realty.com#organization`, legalName, telephone `+15417033095`, email, foundingDate `2023-06-21`,
areaServed GeoCircle (44.0582,-121.3153 r=80 km), PostalAddress `115 NW Oregon Ave #2, Bend, OR 97703`, `sameAs` = 8
socials + GBP `https://maps.google.com/?cid=11038319841912529644` (placeId `ChIJfVsN4o3IuFQR7KJXpmn9L5k`, contact.ts:67-70),
`founder` + 2 `employee` RealEstateAgent nodes with `identifier {propertyID:'Oregon Real Estate License', value}` (201206613,
201259123, 201254727), telephone, email, image, url `/team/<slug>`.

Gaps:
- **Broker nodes have no `sameAs`.** `brokerAgent()` (JsonLd.tsx:37-53) emits none. `public.brokers` row read
  (`brokers.mjs`, 3 rows): `zillow_id, realtor_id, yelp_id, google_business_id, google_review_url, zillow_review_url, mls_id`
  are `null` for all three; `social_*` null for Paul and Rebecca; Matt's `social_instagram/facebook/linkedin/youtube` hold
  the **brokerage** handles (`instagram.com/ryanrealtybend/`, `linkedin.com/company/ryan-realty-llc-bend-oregon/`,
  `youtube.com/@Ryan-Realty`), not personal profiles. WebSearch ("Matt Ryan Ryan Realty Bend Oregon Zillow agent profile")
  returns `zillow.com/profile/Ryan%20Realty%20Bend` and `linkedin.com/in/mattmryan/` — profiles exist, unlinked.
- **Organization `sameAs` omits** Zillow, Yelp (`yelp.com/biz/ryan-realty-bend` appears in the brand WebSearch),
  Realtor.com, Homes.com. `AEO_GUIDES_2026-09.md` §"Market page price answer" records that engines rank "best broker" by
  review count (25 Google / 6 Zillow vs 100–483) and names "third-party profiles completed for all three brokers" as the
  next step; no linkage shipped.
- `/team/matthew-ryan` emits a `RealEstateAgent` without sameAs and the sitewide Org repeats the founder node — two
  RealEstateAgent statements for the same person on one page, neither with sameAs; `@id` on the page-level node was not
  checked for equality with the founder `@id` (UNVERIFIED).

**Listing** (`/listing/220222277`): RealEstateListing with name, description "$1,399,900 · 3 bed, 3 bath · 2,008 sq ft",
canonical url `/homes-for-sale/bend/river-west/west-hills/1671-saginaw-220222277`, PostalAddress, geo, beds/baths, floorSize,
lotSize, yearBuilt 1964, `availability InStock`, Offer {price 1399900, USD, InStock}, 5 Spark CDN images. No listingAgent
(pruned). Sound.

**Place + FAQPage on place pages** — real Q&A generated from live data (`lib/site/market-faq.ts` for Dataset/Place
variables; `lib/site/place-answers.ts` for the visible FAQ + FAQPage on neighborhood pages, `page.tsx:550,612,827`).
Contents in `jsonld_*.json`; the full Q&A text is reproduced in the tool log and summarized in §5.

## 4. F1 pillar hop (new today)

`lib/seo/ai-query-map.json` `nwx-3bed-2bath` cites `/homes-for-sale/bend/northwest-crossing` and
`/homes-for-sale/bend/northwest-crossing?beds=3&baths=2` ("stays on the AI map so assistants can fetch filtered inventory";
file note: "never a 308 hop"). Live (Chrome UA):

```
/homes-for-sale/bend/northwest-crossing                 -> 301 https://ryan-realty.com/communities/northwest-crossing
/homes-for-sale/bend/northwest-crossing?beds=3&baths=2  -> 301 https://ryan-realty.com/communities/northwest-crossing  (filter dropped)
/communities/northwest-crossing                          -> 200, index,follow, 997,875 bytes
```
Origin: `git log -S'communities/northwest-crossing' -- middleware.ts …` → `2026-09-22 e952d8492 fix(seo): 301 leftover
area-search URLs onto place pages`; rule at `middleware.ts:336-351` (`resolveGeoCityRedirect`: `/homes-for-sale/<slug>`
where slug is a resort/community → `/communities/<slug>`). Wait — the live hop is on the two-segment
`/homes-for-sale/bend/northwest-crossing`; the one-segment rule above matches `/homes-for-sale/<slug>` only, so the
two-segment redirect comes from another rule in the same commit (not traced line-by-line; the commit is the evidence).
`check-ai-query-battery.mjs` still passes because it only consults `next.config.ts` for permanent redirects.

## 5. Content shape for answer engines (5 pages, raw HTML with Chrome UA)

From `analysis.json` (visible text = HTML minus script/style/svg/noscript, tags stripped):

| page | words | sentences with a number | …that also name a source/date | HTML tables | numbers only inside SVG `<text>` |
|---|---|---|---|---|---|
| /cities/bend | 12,813 | 70 | 34 | 0 | 3 |
| /cities/bend/awbrey-butte | 5,335 | 60 | 25 | 0 | 3 |
| /communities/tetherow | 4,163 | 72 | 18 | 0 | 0 |
| /subdivisions/ridge-at-eagle-crest | 5,539 | 37 | 29 | 0 | 0 |
| /housing-market/bend | 1,999 | 37 | 20 | 0 | 0 |

- Direct-answer blocks exist: e.g. `/cities/bend` FAQ "The median sale price for a single-family home in Bend was $750,000
  in August 2026. The median list price … is $979,995 as of September 2026, based on a direct count of the active MLS
  listings." Numbers are in HTML text, not canvas/SVG (the atlas SVG carries ≤3 numeric `<text>` nodes). Good.
- No `<table>` on any place page; stat sets are div grids. Not fatal for LLM extraction, but tables are the cheapest
  quotable structure and none exist.
- H2 structure is weak for extraction: `/cities/bend` has three `<h2>` reading just "Bend" (atlas eyebrow, `homes-heading`,
  `about-heading`), `/cities/bend/awbrey-butte` three reading "Awbrey Butte"; `/team` H1 "The brokers"; the type page H1
  "Single-family in Bend" under a title "757 single-family homes for sale in Bend, Oregon" (count in the title changes daily).

**The quotable FAQ text talks to the auditor, not the buyer.** Counting provenance/disclaimer phrases inside FAQPage answers
(`this page already`, `not a guess`, `not an invented`, `ledger`, `market layer`, `place membership`, `at the last sync`,
`we are not printing one`, `we can attribute`, `registry list`, `the same … pull/feed/series`):

```
cities_bend               Q&A=14 answerWords=661 hits=15
cities_bend_awbrey-butte  Q&A=11 answerWords=530 hits=12
communities_tetherow      Q&A=8  answerWords=335 hits=2
subdivisions_ridge…       Q&A=5  answerWords=208 hits=3
housing-market_bend       Q&A=5  answerWords=120 hits=0
TOTAL Q&A=43  hits=32
```
Examples an engine would quote verbatim: "Times and addresses are the same MLS OpenHouses pull the open-house ledger
uses."; "This is the Central Oregon parks registry list this page already shows, not an invented complete inventory.";
"54 single-family homes are on the market in Awbrey Butte right now. The supply verdict above divides 45, not this 54. That
ratio counts the homes the market layer assigns to Awbrey Butte by place membership; this count is the homes inside its
neighborhood lines. Two honest counts of two populations, and neither is a correction of the other."; `/about` FAQ "Who are
the brokers? — The brokers are on /team." (a path as an answer).

## 6. §0 conflicts inside the machine-readable layer

**Awbrey Butte (p0 candidate).** Same page, same minute:
- `Neighborhood.additionalProperty` and `Dataset.variableMeasured` (`jsonld_cities_bend_awbrey-butte.json`):
  `Median List Price 1,350,000`, `Active Listings 45`, `Median Days to Pending 29`, `Homes Sold (12 months) 120`.
- `FAQPage` + visible text: "asking a median of **$1,312,500**", "**54** single-family homes are on the market", face
  "54 Single-family in Awbrey Butte $1,312,500", source line "Median asking price $1,312,500, the single-family homes for
  sale inside Awbrey Butte's recorded boundary".
- Code: Dataset/Place come from `buildMarketFaq(neighborhood.name, { activeCount: hud.active, medianListPrice: hud.medianList … })`
  (`app/cities/[slug]/[neighborhoodSlug]/page.tsx:486-498`) where `hud = leftoverHudKpis({ headlines: nbhMt?.headlines,
  inventory: nbhMt?.inventory … })` (line 345, the market-truth overlay); the FAQPage comes from `buildPlaceAnswers`
  (line 550) → `answersFaqItems` (612) → `{ type: 'faqPage', items: answerFaqs }` (827), fed by `inventory =
  getNeighborhoodPublicInventory(...)` (boundary count). The page's own comment (lines 386-390) forbids exactly this
  mixing: "Do not fall back to pin length, pulse.active_count, or listing_tile_mv tags - those are different populations
  (Awbrey Butte 52 / 62 / 63, 2026-08-16)." The Dataset does it anyway.

**Bend (minor).** `/cities/bend` text: "Bend 581" (cities list), "Homes for sale 581 … Source Oregon Data Share as of Sep 21,
2026", FAQ/Dataset `Active Listings 581`; the same page's menu: "Single-family in Bend 757 homes ask $379,500 to
$2,125,000"; `/cities/bend/types/single-family` title "757 single-family homes for sale in Bend, Oregon". Two Bend
single-family active counts, one hour, one label.

**Tetherow HOA (minor, UNVERIFIED which is right).** FAQ: "Annual HOA dues run $2,052, the median of the **131 current
listings** that report dues." Same page: "**11** single-family homes are on the market in Tetherow right now … Tetherow also
has **24** homes listed across its named subdivisions when every property type is counted." Source: `getPlaceCharacter`
member-listing median (`lib/market/publish-place-hoa.ts:41-43`, `lib/data/places/getPlaceCharacter.ts`). 131 "current
listings" cannot be a subset of 24 current listings; the population is not the one the page counts.

## 7. Do answer engines cite us today? (WebSearch view, not a logged-out Google SERP)

| query | ryan-realty.com? | who appears |
|---|---|---|
| Tetherow homes for sale | no | redfin, zillow, engelvoelkers, homes.com, bendpremierrealestate (×2), cascadehasson, tetherow.com, bendrealestate.com |
| Awbrey Butte real estate | no | zillow, homes.com, trulia, bendpremierrealestate (×2), bendrealestate.com, realestate.visitoregon.com, enjoybendlife.com, redfin |
| best neighborhoods in Bend Oregon for families | no | conradquinnteam, movingtobend.com, gregpowellhomes, bendpremierrealestate, lohrrealestate, movetobend.com, isellbendoregon, legacypropertymanagement, stonebridgehomesnw, allthingsbend |
| Bend Oregon housing market 2026 | no | zillow, houzeo, bendpremierrealestate (×2, dated monthly posts "March 2026: Prices Drop 7.4%"), gregpowellhomes, movetobend ("Updated May 2026"), isellbendoregon (×2), bendlifestylerealtors |
| months of supply Bend Oregon | no | bendsource, ktvz, movetobend, bendpremierrealestate (×2), kbire, keypropertiesoregon, bendpropertysource |
| Ryan Realty Bend | yes (brand) | linkedin, facebook, yelp, then ryan-realty.com `/matt-ryan/`, `/contact/`, `/`, `/properties/`, `/sell-your-bend-oregon-home`, `/cities/bend`, instagram |

The synthesized answer for the brand query said "their phone number is 541-213-6706" — taken from the indexed title
"541-213-6706 | Bend Oregon Broker - Contact Ryan Realty" for `ryan-realty.com/contact/`. Canon phone is 541.703.3095
(`lib/brand/contact.ts:89`); the live `/contact` title is "Contact · Call, text, or write — 115 NW Oregon Ave #2, Bend | …".
The engine's index still holds legacy WordPress titles/URLs for our own domain. Live resolution of those URLs
(`legacy_urls.txt`):

```
/matt-ryan/                 -> 308 /matt-ryan -> 301 /team/matthew-ryan   (two hops)
/contact/                   -> 308 /contact
/properties/                -> 308 /properties -> 308 /homes-for-sale     (two hops)
/sell-your-bend-oregon-home -> 301 /sell
/featured-listings/         -> 308 /featured-listings -> 301 /our-homes   (two hops)
/team/matt-ryan             -> 301 /team/matthew-ryan
```
Three URLs for Matt (`/matt-ryan/`, `/team/matt-ryan`, `/team/matthew-ryan`) sit in the index at once.

Competitor pages could not be fetched for a content comparison: bendpremierrealestate.com, bendrealestate.com,
cascadehasson.com, movetobend.com all returned 403 to both WebFetch and a Chrome-UA curl from this sandbox (bot
protection). What the search snippets show they have and we lack: **dated monthly narrative reports** with YoY deltas in
the title ("Bend Oregon Real Estate Market Update March 2026: Prices Drop 7.4%, Sales Surge", "Bend Oregon Housing Market
Updated May 2026"), and evergreen "best neighborhoods" listicles with named schools/parks. Our equivalents are
`/housing-market/reports/weekly-2026-09-13` (title = a date range) and the two August monthly blog reports (cron
`blog-monthly-city-report`, `vercel.json:14`, live 200 with FAQPage).

## 8. NAP / GBP

On-site NAP is consistent: all 11 pages render `541.703.3095` (contact/home also 541.250.3380, 541.502.3436 for brokers)
and "115 NW Oregon Ave #2"; Organization JSON-LD matches (`+15417033095`, `115 NW Oregon Ave #2`). GBP place id
`ChIJfVsN4o3IuFQR7KJXpmn9L5k`, cid `11038319841912529644` in `lib/brand/contact.ts:67-77`, in `sameAs`. Off-site: the Yelp
result title reads "115 NW Oregon Ave" (no "#2"); the search index carries the old 541-213-6706 on our own `/contact/`.
Live GBP name/phone/categories: UNVERIFIED (needs Matt's browser session; no Chrome MCP here).

`.claude/skills/local-seo/SKILL.md` (94 lines) claims a persistence layer `data/local-seo/{profile,competitors,citations}.json`
with `fetched_at` stamps and a "first-run capture". **`data/local-seo/` does not exist** (`ls: cannot access 'data/local-seo'`).
The knowledge base it points at (`marketing_brain_skills/platforms/gbp/SKILL.md`), the corpus
(`marketing_brain_skills/brand-voice/corpus/gbp_responses.md`), and the cron route `app/api/cron/marketing-snapshot-gbp/route.ts`
do exist. So the loop has never run to the point of writing its own state, or ran without persisting.

## 9. The AEO plan (docs/plans/PUBLIC_PRODUCT/AEO_GUIDES_2026-09.md, 364 lines)

Promised → live check (Chrome UA, `aeo_guides_live.txt`):
- 15 guide slugs: 14 return 200 with a FAQPage block (`cost-of-living-bend-oregon` was not captured in the log because the
  loop's first iteration hit a proxy reset; UNVERIFIED for that one slug). Two August monthly reports: 200 + FAQPage.
- `lib/blog/publish-blog-faq.ts`, `lib/blog/monthly-city-report.ts`, `lib/auth/signin-prompt-policy.ts` (`/blog` and
  `/blog/*` → `guide`, line 29), `scripts/blog-content/aeo-guides-2026-09.ts`, `restored-guides-2026-09.ts` exist;
  `blog-monthly-city-report` cron registered.
- "The sibling session reruns the battery monthly" — no cron, routine, or script implements an answer-engine citation
  measurement (`grep -rn -i 'answer-share|ai-answer|aeo' vercel.json package.json scripts/` → only `ci:aeo-hub-guides`
  and `ci:ai-query-battery`, both static). The doc's own baseline says "no engine cited any F1 battery path"; nothing
  measures whether that changed.
- Open item "third-party profiles completed for all three brokers" — not reflected in `brokers` rows (§3).

## 10. Page weight seen by a fetcher

`analysis.json`: HTML → script bytes (of which RSC `self.__next_f.push`) → inline SVG → visible text.

| page | HTML | scripts (RSC) | inline SVG | visible text |
|---|---|---|---|---|
| /about | 4.68 MB | 3.55 MB (3.53) | 1,000 KB (45 svgs; one 982 KB atlas basemap) | 10 KB / 1,800 words |
| /cities/bend | 3.77 MB | 2.08 MB (2.06) | 923 KB (899 KB atlas) | 66 KB |
| /cities/bend/awbrey-butte | 2.01 MB | 1.15 MB | 615 KB | 31 KB |
| /team | 1.70 MB | 1.28 MB | 308 KB (300 KB atlas) | 7 KB |
| /cities/bend/types/single-family | 1.68 MB | 0.81 MB | 700 KB | 18 KB |
| /subdivisions/ridge-at-eagle-crest | 1.07 MB | 0.64 MB | 241 KB | 30 KB |
| /listing/220222277 | 0.95 MB | 0.47 MB | 348 KB | 14 KB |
| /communities/tetherow | 0.92 MB | 0.48 MB | 283 KB | 25 KB |

The 3.38 MB RSC chunk on `/about` is the "Where we work" atlas: 5,671 dot objects each with `href, lat, lng, age, photo,
street, beds, baths, sqft` (key counts from the chunk). `/cities/bend`: a 1.3 MB dots chunk (1,664 dots) + a 451 KB chunk of
713 listing cards. Visible-text share on `/about` is 0.2%. Documented fetch caps: Google 15 MB per HTML file; OpenAI /
Anthropic / Perplexity fetcher byte caps are UNVERIFIED (not published). TTFB was fine (0.25–1.9 s), so the cost is transfer
and parse, not server time.

## 11. Subdivision 500 rate — second sample (150 URLs, every 17th subdivision line)

`sub_sample_results.txt` (curl -A Chrome, `--max-time 40`, one attempt each; `000` = sandbox proxy reset):

```
lines=150 · 109 × 200 · 14 × 500 · 27 × 000
```
- 14 of 123 server responses = **11.4% HTTP 500**. Every 500 took 5.0–10.1 s (consistent with a timeout-capped stage
  exhausting and an uncaught throw, not an instant error).
- `sub_500_retry.txt`: of the first 8 500s retried, 6 stayed 500, 1 → 200, 1 proxy. `sub_000_retry.txt`: 17 proxy-reset
  URLs re-fetched → 16 × 200, 1 × 500.
- 500 slugs: awbrey-butte-homesites-phase-thirty-one, awbrey-glen-homesites-phase-five, blakley-heights,
  broken-top-phase-iii-d-lots-355-thru-371-and-tracts-r-and-s, college-park-phase-1-and-2, cottonwood-condominium,
  discovery-west-phase-3, full-moon-estates-phase-i, newsoms, northpointe-phase-ii, ridge-at-eagle-crest-31,
  ridge-at-eagle-crest-5, saddleback, squaw-creek-canyon-recreational-estates-first-addition (plus, from sample 1,
  ridge-at-eagle-crest-13, skyliner-summit-at-broken-top-phase-9, steve-w-yancey).
- If the rate holds across the 2,642 listed plats, that is on the order of 250–300 URLs — an estimate from the sample,
  not a count.
- Code read for a lead (no Vercel logs under the no-MCP rule): `app/subdivisions/[slug]/page.tsx` is `revalidate = 900`,
  `dynamicParams = true`, `maxDuration = 60`, `generateStaticParams` → `[]`; nearly every read is wrapped in
  `withTimeoutFallback` (lines 384–1145); `getIndexableSubdivisions()` (line 1385) is resilient-cached with fallback `[]`
  and throws only inside its own wrapper. The exception that produces the 500 is therefore UNVERIFIED; the Vercel runtime
  error log for this route is the next check. The route's own comment (lines 258–270) records the class's prior silent
  failure (2026-07-15 → 2026-09-01), and no gate fetches these URLs live.

## 12. Things that are fine (do not re-audit)

- Every AI/search UA gets the real page; llms.txt/robots/sitemaps are outside the middleware matcher.
- JSON-LD parses everywhere; Organization/WebSite/Breadcrumb/Place/Dataset/FAQPage/RealEstateListing types present and
  gated (G34); listing Offer/availability reflect status.
- llms.txt regenerates hourly from the same DAL as the pages; the newest weekly report is listed.
- Numbers are in HTML text (not only SVG/canvas). Visible FAQ and FAQPage JSON-LD come from one builder per page, so
  they cannot diverge from each other (the divergence is FAQ vs Dataset, §6).
- Guides end with a `Questions` block that becomes FAQPage JSON-LD (`publish-blog-faq.ts`), live on 16/16 checked URLs.

## 13. Tree state at finish (read-only rule)

`git status --short` was empty at start (19:37 UTC). At finish (20:13 UTC) it lists six modified tracked files:
`app/sitemap.ts`, `components/motion/number.tsx`, `lib/sitemap-guard.ts`, `lib/sitemap-guard.test.ts`,
`lib/sitemap.contract.test.ts`, `scripts/check-sitemap-resolvable.mjs` (mtimes 20:07–20:12 UTC; `git diff --stat`
+184/−35, hand-written source edits). None of my commands write into the tree (curl, node scripts under the scratch
dir, the three read-only `check-ai-*.mjs` gates, git log/grep), so these are a concurrent session's in-progress work on
the shared checkout. I did NOT `git checkout --` them: rule 1 covers files my own scripts dirtied, and reverting another
agent's edits would lose work. Reported here for the orchestrator.
