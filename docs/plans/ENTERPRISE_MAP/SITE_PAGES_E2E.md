# Site pages rebuild — /endtoend

Goal locked 2026-09-06. Measure the final review against this file.

## When finished

A real person can walk the public site and:

- Land on **one URL per search** (PAGE_OUTLINE SEO table). `/` is **Ryan Realty, Bend**. Search owns `{City} homes for sale`. City guide owns `{City} real estate`. Tetherow community owns `Tetherow homes for sale`. `/lp/tetherow` 301s.
- Place pages are **not** Bend clones. Atlas + one DATA_GRAPHICS drawing (typical price as a mark on closes, or homes-for-sale vs a month of sales). No leftover HUD. No pinch-to-zoom essay.
- About/broker pages convert: Call/Text first, **firm** reviews and **firm** sales. Personal sales only when that broker has a real set. No CMA form on `/team/[slug]`.
- One house row. One payment formula. Footer links **by city**.
- Every rebuilt route has `tasteReview.shots` (desktop + 375 PNGs on disk) from a **separate** evaluator. Score cannot outvote HUD/how-to tells.

Canon: `PAGE_INVENTORY.md`, `PAGE_OUTLINE.md`, `PLACE_PAGES.md`, `DATA_GRAPHICS.md`, `TASTE.md`, `docs/research/taste-on-x-2026-09-05.md`.

Not this mission: OAuth, Studio publish, LOOP_SENTINEL, outbound mail, ad spend, dropping DEAD tables.

## How (parallel only when files do not overlap)

After **every** wave: Playwright 1440 + 375, **look**, dedicated evaluator on those PNGs, commit, log here.

| Wave | What | Exclusive files | Verify |
|---|---|---|---|
| **0** | Taste gate: PNG receipts, HUD/how-to tells, no self-score | `scripts/check-taste-canon.mjs`, `TASTE.md`, frontend-design skill | `ci:taste-canon` |
| **1** | HUD off openings, Atlas how-to gone, H1 split, Tetherow LP 301 | Atlas client, place `page.tsx`, `app/page.tsx`, `app/search/page.tsx`, `legacy-redirects.json` | Local walk `/` `/homes-for-sale` `/cities/bend` `/communities/tetherow` `/lp/tetherow` |
| **2** | Tetherow **class**: belonging facts + Atlas + one cost/pace graphic. Then clone to one neighborhood + one city | `app/communities/[slug]/**`, `app/cities/**` (after 2a Tetherow lands) | Tetherow ≠ Bend first screen. Graphic answers one question. |
| **3** | About §6 + `/team/[slug]` | `app/about/**`, `app/team/**` | Call/Text above fold. No valuation form. Firm proof. |
| **4** | One Field (kill city-search second app) | `app/search/**`, `components/search/**` | `/homes-for-sale` and `/homes-for-sale/bend` same row language |
| **5** | Listing: price on media, one PITI, lot Atlas | listing page + payment helper | Crosby `$/mo` face === calculator |
| **6** | Market: one chart, MOS definition page not a tile wall | `app/housing-market/**`, `app/months-of-supply/**` | foldAfter, DATA_GRAPHICS labels |
| **7** | Footer by city + cityscape band | `V3Footer`, `lib/site-nav.ts` | SEO anchors `Homes for sale in Bend` |
| **8** | Review pass: architecture, gates, real-user walk. Push. | — | `ci:gates` + production READY |

**Wave 0–1 are in the working tree (2026-09-06), not on `origin/main` yet.** Tells list is empty. 0 complete `tasteReview` with PNGs.

## Split rules

- One owner per file set. Community page is **not** edited by two workers in the same wave.
- Tests decide disagreements (`place-grain-openings`, `seo-shell`, `taste-canon`).
- Builder never writes `tasteReview.score`. Spawn an evaluator with the two PNGs.

## Stops (only these)

1. Missing secret.
2. Irreversible action without a yes (outbound, ads, OAuth).
3. Two canons that cannot both hold — quote both, park.

## Log

- 2026-09-06 Wave 0: `ci:taste-canon` requires shots; HUD/how-to are shrink-only tells; self-score killed.
- 2026-09-06 Wave 1: PlaceFaceStrip off openings; Atlas how-to gone; `/` H1 Ryan Realty, Bend; search H1 Central Oregon homes for sale; city H1 `{City} real estate`; `/lp/tetherow` 301s. Looked at localhost 1440/375. **Not pushed.**
- 2026-09-06 Wave 2: Tetherow opens on owned still + H1 `Tetherow homes for sale` + belonging Instrument (`#facts`) + Atlas. City/neighborhood clone: `foldAfter={2}`, no “in plain words”. Atlas claim is for-sale count only. Looked 1440/375.
- 2026-09-06 Wave 3: `/about` Call/Text then firm proof + firm closings. `/team` roster only. `/team/[slug]` Call/Text/Email on the fold, no CMA sheet, personal record gated at 5. Looked 1440/375.
- 2026-09-06 Wave 4: Regional and city slug search both use V3ListingRow (photo · $ · beds · baths · sqft · street). City slug chrome is still a second map shell — remaining.
- 2026-09-06 Wave 5: Face Est. $/mo and listing calculator seed `computeMonthlyPiti`. Listing JSON-LD `@type` is `RealEstateListing`.
- 2026-09-06 Wave 6: Market instruments `foldAfter={2}`. MOS page two-bar is homes for sale vs a month of sales (`MOS_PLAIN_LABEL`). `{city} homes for sale` stripped from market keywords.
- 2026-09-06 Wave 7: Footer columns by city (`Homes for sale in Bend`). Cityscape band + navy wordmark on cream sky.
- 2026-09-06 Wave 8: 1440/375 PNGs on disk under `ui_kits/*/shots/`. Separate evaluators writing `tasteReview`. Then gates + push.
- 2026-09-06 Wave A: leftover `/lp/*` and `/luxury-homes-bend` 308 to inventory winners. Capture stays on `/sell`.
- 2026-09-06 Wave B: search Field chrome. MapChrome replaces Google Map dropdown/zoom. One view toggle. Guest save is a chip, not email-first at 375. `view=list` stays on the Field.

## Site queue (loop_work_nodes, domain public-ux)

Nodes: 58bd29ba-c0b0-4cbe-bee2-d46b292015df

This table is the only site backlog. Sessions pull the oldest open node (`npx tsx scripts/loop-brief.ts` serves it first whenever `app/**` or `components/site/**` changed in the last 14 days); they do not re-audit. A commit touching the public site names its node in a `Node:` trailer (G72). Decisions behind the queue: Matt 2026-09-07, recorded in the conversion research artifact 525cdcda and memory `project_site_conversion_decisions_2026-09-07`. Seeded by `scripts/seed-site-queue.ts` (idempotent).

| version_gap | id | title |
|---|---|---|
| SITE-00 | `58bd29ba-c0b0-4cbe-bee2-d46b292015df` | Site queue mechanism |
| SITE-01 | `4618d781-e5c7-4cd5-a036-05aff5de3249` | Resort community pages: address field, verdict + pace answer, valuation request |
| SITE-02 | `6df63f51-bbe3-4e3a-b1ec-d013435f617a` | /sell: show the sourced answer between the address and the contact step |
| SITE-02b | `89efe5a4-5494-4344-8386-265bbfc36b37` | The answer drawn, not tiled: months-of-supply bars, comparable-sale dots, days-to-pending rule (one primitive for every ask). Every later item depends on it. |
| SITE-03 | `0c7e2f07-4fea-489a-808c-86e3d7f43366` | Place hero button: live count + verdict, linking to the filtered search |
| SITE-04 | `9339692e-a02e-4a31-a416-cf7ebcdc010a` | Place alerts: first callout, sticky repeat, real 30-day count, price-drop alert |
| SITE-05 | `547c080a-a47d-4ddd-902b-3d902945dce5` | Sticky Value my home control on /sell and place pages |
| SITE-06 | `b2366127-ce47-4210-b230-70a5df0d8c71` | Listing instrument gets an ending: base rate, price-drop alert, tour slot, email-me-this-payment |
| SITE-07 | `f2cfd7a0-4768-4297-8890-d6193898320a` | Place-page payment calculator pre-filled with the place median and financing mix |
| SITE-08 | `f475834f-cb36-439d-9793-9d0743de747a` | Cited Q&A with FAQPage schema on neighborhood, community, subdivision pages |
| SITE-09 | `d575d2eb-7514-4be7-8399-f0ebaa2f7dc7` | Response clock on every site submit |
| SITE-10 | `abcadda1-aa57-483e-9b8a-33345a3276d4` | Ask the selling timeframe after the answer; route the near-term lane to /book |
| SITE-11 | `6c98f6ba-3627-4e28-ba06-7271e17f3b7c` | Proof beside the ask: reviews, MLS-sourced record, outcome table, named broker cards on place pages |
| SITE-12 | `28a55619-eff3-4763-aeaf-e7f3617a9cb3` | Homepage: live counts under the hero search; Sell tab renders the real address field without JS |
| SITE-M1 | `64fe8b08-f6a1-4b93-a0d1-978fcfe3d7e1` | Homepage brokers section on phones opens compact (2026-08-27 parked item, Matt: fix) |
| SITE-20 | `39158a7c-5e7f-4d6f-81b5-a211f03c19ba` | Closed listings publish the list price in snippet, share card, JSON-LD, hero caption, map card (§0): one status-aware price publisher |
| SITE-21 | `2ae822cc-c290-4c5c-a5b8-9fb3eaf7ccc5` | Off-market listing page shows the sold facts and a saved-search ask, not a mortgage on the old price and a tour (waits on SITE-20) |
| SITE-22 | `5066c8f4-3d6a-4451-bd86-60baa0a8b531` | One canonical per listing: by-address stops self-canonicalling; every link builder derives the path from the canonical's fields |
| SITE-23 | `8e7a1a7a-739e-435b-86cc-eceeab5ce097` | Brasada Ranch sits under the boundary classifier's sentinel: fix the polygon coverage |
| SITE-24 | `5f0ab161-b6e4-4e2f-8cc1-4d3ba20e11a8` | Plat closed-sale counts are a text join at resort grain, so sub-plats score zero forever: attribute closes by polygon |
| SITE-25 | `3dab9349-2613-4467-8770-2bd1052a0edf` | Title and description budget: suffix-aware cleanTitle, dangling &, registry pages lead with their blurb, plat titles keep the place name, noindex without nofollow |
| SITE-26 | `023376fb-7665-47e2-bb26-25d18aff957f` | Housing-market and report pages: brand once, figures in the snippet, no ISO dates, JSON-LD on-route, unknown geo noindexed before the flush |
| SITE-27 | `13eb1d1e-06a4-4559-8f62-f431e748db3a` | Out-of-market cities under a Central Oregon title: /open-houses and /homes-for-sale hop to /oregon in middleware; open-houses hub carries its count |
| SITE-28 | `e71d6948-ebeb-4293-b72c-db9269624e61` | Compound community slugs publish MLS abbreviations as place names: render the recorded plat's real name or refuse |
| SITE-29 | `e3d1713f-9436-4041-b939-829d03259e94` | Place pages and the blog become cacheable: PlaceSplitView's session read leaves the server render; blog drops two discarded awaits |
| SITE-30 | `200907b8-e6ab-4dfa-86fa-2070b011e269` | Crawlable links into the place tree: atlas regions as real anchors; community pages link the guides that name them |
| SITE-31 | `0bacd965-e160-4fc4-9395-0e1d1b2f163a` | Eleven registry communities get a guide with a claim-shaped title; four keyword-stacked titles rewritten |
| SITE-32 | `1c1bff8e-f699-4dcc-b793-fe5c573f0f51` | Off-market listing index policy: two contradictory written policies, Matt ruled 2026-09-08: keep indexed with the honest state; one implementation, one gate |
| SITE-33 | `00b6bd10-cdb1-4d97-ad99-7a2ad7d091b3` | Out-of-market listing pages: 56% of the listings sitemap is Southern Oregon inventory rendered like Bend; Matt ruled 2026-09-08: honesty block + noindex,follow; waits on SITE-25 |
| SITE-40 | `ac7b98f8-dc09-4d26-89e8-a0cffc1070c5` | V3Quiet: prose gets one measure instead of an empty column, link rows get a form, and a figure slot exists — six pages at the bottom of the taste tabl |
| SITE-41 | `acab2ca3-3baf-498d-918f-e208466bf4a7` | V3Instrument: the opening is a claim and a drawing, not a KPI grid — cap the headline figures, put the chart in the fold, name the disclosure, one mar |
| SITE-42 | `7c4780c6-e0e0-412e-8095-11c059aedfc9` | V3SourceLine: a compact default (source and date) with the method behind a disclosure, held to the content measure, never at hero weight |
| SITE-43 | `c7291c88-faf8-4f88-9fb8-fe5aeaf2e281` | The place opening: a drawing in the hero and a figure beside the alerts sentence, so the first screen of every city, neighborhood and community page i |
| SITE-44 | `fe29cdd3-149d-42b3-8d71-e23c193b835c` | The map is a Google default map: search and zip get Atlas-grade cartography, clustered markers, padded bounds, and a claim above the results |
| SITE-45 | `db6d07a9-e102-4af4-9b5b-69fcd00afea1` | The listing page opens with something to interrogate: the gallery as the first interactive object, the price cut as a two-point mark, a plain read bes |
| SITE-46 | `bc1d4f83-9eab-4a30-9746-98bc20a1fae5` | V3Stage on a page with live inventory carries the inventory: /buy opens with a count and a price, the Field breaks the fold, the CTA has the brand's w |
| SITE-47 | `43f4251a-f30f-4868-92e6-59cb65ea351c` | The subdivision opening: an authored caption instead of a filled-in frame, the Atlas with its claim and legend in view, and one next action in the fol |
| SITE-48 | `f1010c07-f88a-4111-be78-891fdf597160` | The people pages open with proof: faces and the 5.0 from 25 before any contact row, one reach control instead of a phone book |
| SITE-49 | `1c971ea5-8537-45ab-878d-0a2c632aa39b` | /price-drops: the alerts sheet stops covering a listing card, and the sixty cuts get a drawing above the grid |
| SITE-50 | `eaafcbf2-02a2-4c85-964d-16198bf0d58c` | /invest and /compare open with the product, not a memo: the live count and a claim in the first screen, an empty state that shows the four-slot object |
| SITE-51 | `2750dd42-ec34-4561-81eb-cca45646f814` | The taste table is a standing instrument: one command captures every public class and scores it, the results land on the queue doc, and the next round |
| SITE-52 | `49414e76-c39b-4214-8347-6f8c46a76a34` | V3Ledger: a row past six carries a visible mark, hover reveals more than the row says, media is all-or-none, and a slot never repeats a fact the page  |
| SITE-53 | `fc2bfe1a-a056-4e52-9b69-94475ae160e8` | The place-type pages: the Atlas is guaranteed, a claim sentence under the H1, the list and the map linked, and no duplicate headline |
| SITE-54 | `4e3a13ee-a4ef-4ed5-a643-0d483161471f` | /sitemaps/geo.xml answers under the 300s ceiling on a cold request: two consecutive 504s on 2026-09-09 mean Google cannot read the place tree at all |
| SITE-55 | `3b4713f8-dff9-4bfb-a2ec-b18566aa4d4c` | The subdivision page shows what sold and what did not sell in the plat, then the wider market |
| SITE-56 | `46533078-e2b5-4b66-aa25-79e0b5186fd9` | A plat page without a recorded polygon still opens with a photograph and a map (Matt 2026-09-09); the resolver comes first — most plats are recorded under their phase names |
| SITE-57 | `39482bf4-ef6d-494d-aeb6-be936743eafb` | The MLS public remarks come back to the listing page, as written, and a gate keeps them there (Matt 2026-09-09) |
| SITE-58 | `6c2ab791-d264-4c34-87ad-07036cbf80d4` | Every plat polygon we hold is Deschutes: source the Crook and Jefferson subdivision layers, or say on the page that we cannot draw the plat |
| SITE-59 | `a446f730-7bba-429e-ab3d-0127c0d8b4bb` | Nothing renders an empty frame: the dead Google pane comes out (Matt 2026-09-09), and the out-of-area listing rows get their photographs |
| SITE-60 | `e3c3e151-3238-4082-8e38-3217981019d7` | A page that links to listings prefetches ~25 MB of MLS photographs nobody sees (measured on /oregon/[city]; belongs to app/listing/**) |
| SITE-61 | `edb9bf36-2734-4cb2-99bc-01f544a7b079` | The listing-shaped ledgers still drawing a photo in a 44px tap mark pick up V3Ledger's photo treatment |

**Round two (seeded 2026-09-08, SITE-20 to SITE-33).** Source: Search Console 2026-06-08..2026-09-05 pulled by `scripts/_gsc-by-class.mjs` (129,817 impressions, 1,368 clicks, 1.05% CTR site-wide), four investigation lenses and twenty-two adversarial verifications (workflow `wf_71474111-a25`), every code fact re-read and every live claim re-curled with a browser UA. Every traffic-causation claim was refuted against this site's own query data (the class CTR gap is rank on head terms, not copy; cross-class position comparison is uninformative), so round two claims no click it cannot prove: it is correctness on a licensed broker's public site (wrong prices in the SERP and the structured data, MLS abbreviations as place names, out-of-market pages under a Central Oregon title), consolidation (one canonical per listing, plats attributable by polygon), origin cost, and two policy calls that are Matt's (SITE-32, SITE-33). Refuted and NOT seeded: registry-alias noindex for plats (already shipped by `getIndexableSubdivisions`; what remains is recrawl latency), a /cities out-of-area gate (middleware already 308s), cannibalization and crawl-budget mechanisms (no measurement on this site), and the greenwood-playhouse snippet (every impression is a quoted navigational query for the venue's own site).

**Round three (seeded 2026-09-09, SITE-40 to SITE-53).** Taste-sourced: the table below, one node per primitive the evaluators named, bottom first. Each accept test names the mark to beat on the table instrument and a mechanical check; the lane writes the route receipt per TASTE.md. SITE-51 makes the table a standing tool so round four seeds from its bottom the same way.


### Taste table 2026-09-08 (the instrument's first full pass; source `design_system/public/taste-table.json`)

Every public page class captured at 1440x900 and 375x812 (first viewport, `scripts/take-route-shots.mjs`, a dev server on main) and scored by a SEPARATE evaluator, claude-sonnet-5 on rubric v1-2026-09-08, three scorings, the median. Ranks classes against each other on one shot spec; not comparable to a route's receipt (different shotsHash). Nothing scored above 69. Round three (SITE-40 to SITE-53) fixes the primitives the evaluators named, bottom first.

<!-- taste-table:start -->
_Regenerated 2026-09-08 by `scripts/taste-table.mjs` — claude-sonnet-5, rubric v1-2026-09-08, 3 scorings, median. Source: `design_system/public/taste-table.json`._

| class | median | scores | DQ/30 | OR/30 | IN/15 | CR/15 | HF/10 | tells | primitive named most | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| invest | **25** | 25 · 19 · 29 | 9 | 3 | 0 | 9 | 4 | 2 | `app/invest/page.tsx` | This is a cover memo, not a landing page — a headline and two internal-sounding paragraphs with an empty box beside each, no number, no listing, and… |
| compare | **29** | 29 · 34 · 25 | 12 | 3 | 0 | 8 | 6 | 0 | `components/site/v3/V3Quiet.tsx` | The compare tool's landing state is an empty form label, not a product demo — it should show the comparison, not describe it, and right now it does n… |
| cities | **30** | 33 · 29 · 30 | 11 | 3 | 1 | 8 | 7 | 1 | `components/site/v3/V3Ledger.tsx` | Fails the gate. Median score 30/100, well below any passing bar, on a page whose entire visible content is the one pattern TASTE.md names first as th… |
| price-drops | **30** | 30 · 37 · 24 | 14 | 8 | 3 | 2 | 3 | 0 | `app/price-drops/_v3/PriceDropAlertsSheet.client.tsx (page-local component, colliding with components/site/v3/V3Field's grid)` | The masthead is on-brand, but directly beneath it the email-signup card overlaps and hides listing prices and addresses on both desktop and mobile, a… |
| about | **31** | 31 · 35 · 28 | 8 | 4 | 1 | 10 | 8 | 1 | `components/site/v3/V3Quiet.tsx` | The About page's first screen is a phone book, not a proof point — it opens as a stack of plain contact links with no photo or figure, while the page… |
| market-report-annual | **31** | 31 · 35 · 27 | 12 | 4 | 0 | 10 | 5 | 2 | `components/site/v3 — V3Instrument (figures grid, id="market")` | The annual review opens with sixteen flat stat tiles and no visible chart on either desktop or phone — it reads as a spreadsheet pasted onto the bran… |
| search | **32** | 33 · 32 · 31 | 8 | 4 | 8 | 5 | 7 | 2 | `components/search/HideAwareSearchMap.tsx (wraps MapSearchView's underlying map render)` | This is a correctly-functioning, well-engineered search page (real viewport sync, draw tool, degraded-state handling, registry-driven filters — the h… |
| zip | **33** | 32 · 36 · 33 | 9 | 4 | 3 | 10 | 7 | 2 | `app/central-oregon/_v3/PlaceFieldMap.client.tsx (+ PlaceFieldMapImpl.tsx), reused by ZipHomesField via V3Field's mapSlot` | The page functions and the typography/layout outside the map is on-brand, but the hero section is a default Google Maps embed next to a stock portal-… |
| team | **39** | 36 · 43 · 39 | 12 | 5 | 2 | 12 | 8 | 2 | `app/about/_v3/AboutFaces.tsx` | A licensed-brokers directory page with correct contact plumbing and zero reason for a buyer or seller to linger, screenshot, or come back — it beats… |
| market-report | **41** | 44 · 38 · 41 | 13 | 8 | 3 | 12 | 5 | 2 | `components/site/v3/V3Quiet.tsx` | The first thing a buyer or seller sees on the market-report hub is a plain link list with no live number, chart, or interaction anywhere on screen —… |
| oregon-city | **41** | 41 · 47 · 36 | 15 | 6 | 2 | 11 | 7 | 1 | `components/site/v3/V3Instrument.tsx` | A correct, honestly-sourced, gated hero that is still a KPI grid with a button under it — it will not beat a portal's Medford page on the one thing t… |
| buy | **42** | 42 · 45 · 37 | 15 | 8 | 3 | 10 | 6 | 3 | `components/site/v3/V3Stage.tsx` | Competent, on-brand, and inert. Everything visible reads as Ryan Realty (navy/cream, Amboqia headline, the two-color hairline system) and nothing in… |
| place-type-community | **44** | 39 · 44 · 48 | 13 | 9 | 4 | 11 | 7 | 4 | `V3ListingRow rendered inside the '.v3-lrow-list' block in app/communities/[slug]/types/[type]/page.tsx (components/site/v3 V3ListingRow)` | Fails the standard. The mobile fold at least shows the class's differentiator (V3Atlas, cream field / navy marks / boundary polygon) before the list,… |
| reviews | **48** | 45 · 51 · 48 | 15 | 9 | 4 | 12 | 8 | 3 | `components/site/v3/V3Quiet.tsx (top spacing) or the section rhythm around it in app/reviews/page.tsx` | The reviews page buries its best asset — 25 five-star reviews — under a blank gap and a plain contact list before the reader sees a single number, an… |
| contact | **49** | 46 · 49 · 54 | 17 | 9 | 3 | 12 | 8 | 1 | `components/site/v3/V3Doors.tsx` | On-brand and functional, but the fold is a text hero on top of a four-times-repeated link row with zero interaction — correct, gated, and dull, which… |
| market-report-detail | **53** | 52 · 56 · 53 | 19 | 13 | 7 | 9 | 5 | 3 | `app/housing-market/[...slug]/_v3/city-view.tsx (source-string composition; the identical 'Market Truth mt-v1 / sample-gated' phrasing is duplicated in at least 6 other page files — app/sell/page.tsx, app/housing-market/central-oregon/page.tsx, app/housing-market/annual-review/page.tsx, app/months-of-supply/page.tsx, app/search/[...slug]/sections/SeoTail.tsx, lib/data/market-truth/public-pace.ts — so this is a systemic copy pattern, not a one-off typo)` | The chart and headline are on-brand and the claim-first sentence beats a bare KPI tile, but the page leaks an internal dataset codename ('Market Trut… |
| city | **54** | 54 · 53 · 55 | 19 | 12 | 4 | 12 | 7 | 0 | `app/cities/[slug]/_v3/CityAlertSheet.client.tsx (CityAlertsStrip)` | On-brand and honest in the fold, but the first screen is still a photo-hero-plus-stat-tile pairing with zero interaction — the exact shape a portal o… |
| listing-detail | **55** | 55 · 52 · 61 | 22 | 12 | 4 | 10 | 7 | 2 | `components/site/listing-detail/ListingHero.tsx` | This fold is correct, on-brand in color and type, and functional — but it is the conventional real-estate-portal listing shape (gallery grid, price/f… |
| homepage-v6 | **56** | 55 · 57 · 56 | 21 | 11 | 5 | 12 | 7 | 0 | `app/_v3/HomeHeroSearch.client.tsx (page-local, inside components/site/v3's V3Stage)` | The homepage hero is polished but generic — the stock search-hero every portal ships, redressed in navy/cream and Amboqia rather than composed as som… |
| neighborhood | **58** | 61 · 55 · 58 | 20 | 14 | 6 | 12 | 6 | 0 | `components/site/v3/V3AlertsStrip.client.tsx` | The fold is well-typeset and on-brand but thin: one static-looking stat sentence and an email form is all a visitor sees before scrolling, with the p… |
| sell | **59** | 59 · 57 · 63 | 22 | 12 | 5 | 12 | 8 | 0 | `components/site/v3/V3Stage.tsx (shared Stage primitive) + app/sell/_v3/SellCapture.tsx and app/sell/_v3/SellValueForm.tsx (page-local card/form)` | The /sell hero is a well-crafted, on-brand skin over the identical address-in lead-capture template every competing portal already runs — nothing a v… |
| subdivision | **59** | 59 · 63 · 57 | 20 | 18 | 5 | 11 | 5 | 2 | `components/site/v3 (V3SourceLine), called from app/subdivisions/[slug]/page.tsx line 798` | A distinct, on-brand hero and the right differentiator object (V3Atlas, cream field / navy marks) sit directly beneath two lines of visible internal… |
| community | **61** | 61 · 55 · 63 | 23 | 14 | 5 | 12 | 7 | 1 | `app/communities/[slug]/_v3/CommunityPlaceValue.client.tsx (page-local card; components/place/PlaceAreaHero.tsx is the shared photo/scrim wrapper around it, so this shape repeats on every place-page class)` | The hero is confident, on-brand, and quiet, but it is the same address-in/value-out card every portal already runs, and the section right after it is… |
| market-report-region | **63** | 62 · 65 · 63 | 22 | 18 | 8 | 10 | 5 | 3 | `app/housing-market/central-oregon/_v3/region-figures.ts` | The hero chart is on-brand and reads clean, but the only section visible in the fold ships a garbled, jargon-leaking source citation and a database-c… |
| place-type | **69** | 64 · 69 · 73 | 20 | 19 | 12 | 10 | 8 | 3 | `app/cities/[slug]/types/[type]/page.tsx (the headline passed into V3Atlas at the atlasRegions block, built from placeTypeHeadline/atlasViewForType in @/lib/place/place-type-page); V3Atlas in components/site/v3 has no compact/eyebrow mode for when it directly follows the page H1` | The core object is right: V3Atlas's density heatmap, dot legend, type toggle, price slider, and live activity ticker is exactly the interactive, data… |

**Under 70, bottom first:**

- `invest` — **25**
- `compare` — **29**
- `cities` — **30**
- `price-drops` — **30**
- `about` — **31**
- `market-report-annual` — **31**
- `search` — **32**
- `zip` — **33**
- `team` — **39**
- `market-report` — **41**
- `oregon-city` — **41**
- `buy` — **42**
- `place-type-community` — **44**
- `reviews` — **48**
- `contact` — **49**
- `market-report-detail` — **53**
- `city` — **54**
- `listing-detail` — **55**
- `homepage-v6` — **56**
- `neighborhood` — **58**
- `sell` — **59**
- `subdivision` — **59**
- `community` — **61**
- `market-report-region` — **63**
- `place-type` — **69**
<!-- taste-table:end -->

**Lane re-scores on the instrument (route receipts, not table rows; the table is replaced only by a full `npm run taste:table` pass).** 2026-09-09 SITE-52: cities **30 → 75** (75 · 71 · 80; three rounds: 71 cold, 72 after the navy monogram and the supply hover record, 75 after the reveal cue), no tell named; subdivisions **first mark 53** (53 · 55 · 53; 36 cold, 44 after the monogram, 53 after the row dropped its `when` and the caption said what a bar is). Receipts in `ui_kits/cities/parity.json` and `ui_kits/subdivisions/parity.json`; evaluator claude-sonnet-5, rubric v1-2026-09-08, the same first-viewport pair plus hover records. 2026-09-09 SITE-45: listing-detail **77 → 79** (80 · 78 · 79; table row 55) on the rebuilt opening — one frame and a filmstrip, the price cut as a hover mark, a read under the pills, Tour in the fold; the tell named is the breadcrumb's `EASTON COMMERCIAL` plat alias and the Medford sidebar CTA and calculator are carried as Matt's calls. Receipt in `ui_kits/listing-detail/parity.json`, ten shots (instrument pair, close, out-of-area, strip and drop hover records). 2026-09-09 SITE-40 (V3Quiet, the six classes that open on it): invest **25 → 60** (63·54·60), compare **29 → 42**, about **31 → 49** (three rounds), market-report **41 → 54**, reviews **48 → 50**, contact **49 → 62** (four rounds); all rebaselined, evaluator claude-sonnet-5, rubric v1-2026-09-08, first-viewport pair. Only market-report still carries tells, both the chooser's repeated card shape, which belongs to its composition node.

Primitives named on the most classes: `components/site/v3/V3Quiet.tsx` (6), `components/site/v3/V3Instrument.tsx` (3), `components/place/PlaceAreaHero.tsx` (3), `components/site/v3` (2), `components/site/v3/V3Stage.tsx` (2), `app/housing-market/_v3/market-charts.ts` (2), `app/invest/page.tsx` (1), `app/compare/page.tsx` (1).

**Done rule (Matt 2026-09-07, "I want to be done with these shitty looking sites"):** a SITE item is not done until the separate evaluator's score for its page class, recorded in the route's `parity.json` `tasteReview`, rises above its previous mark. A page that still looks bad is a failed item. The rule is written into every open node's accept test.

**Finish line (Matt 2026-09-09):** the site is done when every public page class scores 70 or above on the table instrument (`design_system/public/taste-table.json`; first-viewport shots, claude-sonnet-5, rubric v1-2026-09-08, three scorings, median). A class under 70 after its node lands gets a node from the next table, never a lower bar. **Serve order (same day):** a fleet p0 or major, then round three (SITE-40 to SITE-53) and SITE-31, then the rest oldest first; `siteServeTier` in `lib/data/loop/work-node.ts`.
