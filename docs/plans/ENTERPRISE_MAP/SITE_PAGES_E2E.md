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

This table is the only site backlog. Sessions pull the oldest open node (`npx tsx scripts/loop-brief.ts` serves it first whenever `app/**` or `components/site/**` changed in the last 14 days); they do not re-audit. A commit touching the public site names its node in a `Node:` trailer (G72). Decisions behind the queue: Matt 2026-09-07, recorded in the conversion research artifact 525cdcda and memory `project_site_conversion_decisions_2026-09-07`. Seeded by `scripts/seed-site-queue.ts` (idempotent). Round reseeding is not automatic: `node scripts/taste-table.mjs --seed-draft` emits draft seeds for every class under 70; a person edits `scripts/seed-site-queue.ts` then runs `npx tsx scripts/seed-site-queue.ts` (SITE-62).

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
| SITE-64 | `13814dc4-a5bd-4d79-93ac-6d61e9a66ee2` | /about first viewport: faces open the page, not a three-tile KPI grid of 5.0 / 25 / 3 (live 2026-09-10) |
| SITE-65 | `ee7852f3-c9a9-4307-87f2-f0e337b2305f` | /compare first viewport: the four slots open filled with the live sample, not four dashed empty boxes above it |
| SITE-66 | `756b610c-93f9-4d77-a1d3-b424a170be77` | Every public park, ZIP, school, and taxlot surface has an authoritative polygon — most is not done |
| SITE-67 | `2815cf9e-a39f-4ecc-8cdc-8d595525e943` | SITE-66 left most: last OSM park, 13 out-of-Deschutes schools, Jefferson taxlots |
| SITE-75 | `d4df3bdd-6826-46e0-9ec8-a8a39ced4961` | /housing-market first viewport: live market Instrument, not Pick a report / Five products (claimed 2026-09-10) |
| SITE-77 | `95b3edfe-e265-4519-a14f-9270fd4bccbc` | /buy first viewport: not a three-tile KPI strip of 1,562 / $749,900 / 29 (claimed 2026-09-10) |
| SITE-68 | `1168a18c-5523-4a2a-80bd-aff4b4365570` | /invest first viewport: drawn finding and a live count, not a cover memo (catalog builder card) |
| SITE-69 | `bebcec55-8c94-4f96-86cf-57aede1a7b7a` | /cities first viewport: not a hairline list of Oregon rows (catalog builder card) |
| SITE-70 | `c35f52e6-6c7e-4f2b-8ae3-cd5e0bda8ab9` | /price-drops first viewport: field of cut houses, count as caption |
| SITE-71 | `3a2e11f7-d7a2-4ca6-b687-475172bf1699` | market-report-annual first viewport: Instrument, not a KPI tile |
| SITE-72 | `c33400e1-7007-409b-9e4a-18dc139fa504` | /search first viewport: Atlas-grade map plus list |
| SITE-73 | `bc55bad2-4dd1-4f46-a422-b73508994bae` | /zip first viewport: Field of this ZIP's houses (city grain) |
| SITE-74 | `0ca6a153-3668-4c52-b9a8-148cd53025a2` | /team first viewport: faces plus a sourced coverage fact, not identical directory cards |
| SITE-75 | `d4df3bdd-6826-46e0-9ec8-a8a39ced4961` | /housing-market first viewport: Instrument + MOS bars |
| SITE-76 | `de87b75a-feeb-4cf8-9266-e506f575d0b0` | /oregon/[city] first viewport: honesty first, not a Central Oregon place page |
| SITE-77 | `95b3edfe-e265-4519-a14f-9270fd4bccbc` | /buy first viewport: Stage with live inventory, then Field |
| SITE-78 | `3e98dc8e-45e5-462b-b0ae-7a88f417ca10` | place-type-community first viewport: claim sentence then Atlas |
| SITE-79 | `7fda19f1-0e6b-4791-a31e-6a3b0fe341ed` | /reviews first viewport: V3Proof, not a Quiet list of reach rows |
| SITE-80 | `0a06cb7f-4b9e-452d-8dd2-1b2aaff9a788` | /contact first viewport: one ask, doors with hierarchy |
| SITE-81 | `96587b99-0861-4819-93a0-2d959b39618c` | market-report-detail first viewport: Instrument |
| SITE-82 | `3ff28940-ae58-4e22-a4be-a7ed2c440652` | /cities/[slug] first viewport: drawing and a figure beside alerts |
| SITE-83 | `15968659-eb1a-4930-a227-e3658063d9eb` | homepage first viewport: live inventory, not a stock search hero |
| SITE-84 | `8358e6a9-788a-4983-a33f-a60b3ec06a5d` | neighborhood first viewport: drawing and figure beside alerts |
| SITE-85 | `e7db6225-5d83-4f8a-88d2-b34bc2794c64` | /sell first viewport: Stage then address sheet, sourced answer |
| SITE-86 | `ff530d52-5221-4422-8e31-689af23b2c91` | subdivision first viewport: authored caption, Atlas |
| SITE-87 | `adc5bb3e-f44d-4cb7-8145-a7a4923efb22` | community first viewport: drawing and figure beside alerts |
| SITE-88 | `08545734-a7cc-4d3b-b6a0-d1129911f21c` | market-report-region first viewport: Instrument |
| SITE-89 | `0a032f84-2c09-485e-8efa-88a568a219ee` | place-type first viewport: claim sentence then Atlas |
| SITE-90 | `edabba8e-f8aa-4271-909d-c258914f75ef` | about first viewport: faces, not a phone book |
| SITE-91 | `f7d09828-dd86-47e7-9afd-d92cc3aad527` | /buy first viewport: Stage with live inventory |
| SITE-92 | `fd7e56bb-00ba-4106-bcbf-6ad6d8c377f0` | /cities first viewport: not a hairline list |
| SITE-93 | `c53c2c5e-d250-4d9d-9122-1e37a0dcf06c` | /cities/[slug] first viewport: drawing beside alerts |
| SITE-94 | `b564694b-2b33-431d-9722-98e9c01f6368` | community first viewport: drawing beside alerts |
| SITE-95 | `a782d1a3-5b16-4970-9157-eaa5d1590240` | /compare first viewport: four slots filled |
| SITE-96 | `309b471b-961b-4419-a374-05f00e419c5d` | /contact first viewport: one ask |
| SITE-97 | `29f29f1c-9340-4ac9-9efa-eae498abdd64` | homepage first viewport: catalog MorphingSearch, not a stock hero |
| SITE-98 | `6c2b8197-0b46-4215-8e43-749481794e9b` | /invest first viewport: drawn finding and live count |
| SITE-99 | `207ffae3-5242-4446-9e3b-1728dd7220f2` | listing-detail first viewport: interrogable gallery |
| SITE-100 | `d202be90-0198-43fa-ac06-666560f103c7` | /housing-market first viewport: Instrument |
| SITE-101 | `1fc38f60-c84f-472f-b399-30cff00d8f32` | market-report-annual first viewport: Instrument, not KPI tiles |
| SITE-102 | `9cd74519-9ab0-42da-9db2-7ca8d20aff39` | market-report-detail first viewport: Instrument |
| SITE-103 | `4de56cc6-c112-4db6-b785-a76bb0488b5a` | market-report-region first viewport: Instrument |
| SITE-104 | `14e29311-e83d-4810-a9c4-eefd3dc7cf99` | neighborhood first viewport: drawing beside alerts |
| SITE-105 | `0e402cf5-3e29-419d-9e14-3f7896687b53` | /oregon/[city] first viewport: honesty, not a KPI grid |
| SITE-106 | `a59bf941-e062-48a8-b57d-085c508802b8` | place-type first viewport: claim sentence then Atlas |
| SITE-107 | `60878edd-4c3f-46c1-88f6-419a209b92b7` | place-type-community first viewport: claim then Atlas |
| SITE-108 | `3d1f25ad-6a6b-4992-8693-ef8c4e63e205` | /price-drops first viewport: field of cut houses |
| SITE-109 | `1b11134b-42dd-40f5-84e8-d9f076f53f9c` | /reviews first viewport: faces |
| SITE-110 | `1a58de09-2afa-4650-9833-f57242b32d30` | /search first viewport: Atlas plus list |
| SITE-111 | `75009aa9-561b-49c5-b34f-6725412a2e2d` | /sell first viewport: sourced answer |
| SITE-112 | `19ae02ff-f1b9-49d6-b895-aa7e98f10034` | subdivision first viewport: authored caption, Atlas |
| SITE-113 | `005519f9-657b-44c8-82d3-b76d1e579088` | /team first viewport: faces |
| SITE-114 | `d2b42092-600e-45d5-a383-0707cf5c2d76` | /zip first viewport: Field of this ZIP's houses |

**Round five (seeded 2026-09-11, SITE-90 to SITE-114).** Every taste-table class still under 70. Catalog source is in-repo (`components/motion`, `components/ui`); `taste-evaluate` requires `demoMatch`. Accept: score above the 2026-09-08 table mark **and ≥ 70**. `run loop` picks these as open.

**Round four (seeded 2026-09-10, SITE-68 to SITE-89).** Catalog-backed class nodes from the 2026-09-08 table, bottom first. Skipped listing-detail (SITE-60 live), about (SITE-64 done today), compare (SITE-65 done today). Each objective carries `node scripts/lib/taste-catalog.mjs <class> --preflight`. Accept requires adaptedFrom + replaceWith and a rise on the table instrument. A lane re-measures the live first viewport before building — the 2026-09-08 scores predate round three.

**Round two (seeded 2026-09-08, SITE-20 to SITE-33).** Source: Search Console 2026-06-08..2026-09-05 pulled by `scripts/_gsc-by-class.mjs` (129,817 impressions, 1,368 clicks, 1.05% CTR site-wide), four investigation lenses and twenty-two adversarial verifications (workflow `wf_71474111-a25`), every code fact re-read and every live claim re-curled with a browser UA. Every traffic-causation claim was refuted against this site's own query data (the class CTR gap is rank on head terms, not copy; cross-class position comparison is uninformative), so round two claims no click it cannot prove: it is correctness on a licensed broker's public site (wrong prices in the SERP and the structured data, MLS abbreviations as place names, out-of-market pages under a Central Oregon title), consolidation (one canonical per listing, plats attributable by polygon), origin cost, and two policy calls that are Matt's (SITE-32, SITE-33). Refuted and NOT seeded: registry-alias noindex for plats (already shipped by `getIndexableSubdivisions`; what remains is recrawl latency), a /cities out-of-area gate (middleware already 308s), cannibalization and crawl-budget mechanisms (no measurement on this site), and the greenwood-playhouse snippet (every impression is a quoted navigational query for the venue's own site).

**Round three (seeded 2026-09-09, SITE-40 to SITE-53).** Taste-sourced: the table below, one node per primitive the evaluators named, bottom first. Each accept test names the mark to beat on the table instrument and a mechanical check; the lane writes the route receipt per TASTE.md. SITE-51 makes the table a standing tool so round four seeds from its bottom the same way.


### Taste table 2026-09-08 (the instrument's first full pass; source `design_system/public/taste-table.json`)

Every public page class captured at 1440x900 and 375x812 (first viewport, `scripts/take-route-shots.mjs`, a dev server on main) and scored by a SEPARATE evaluator, claude-sonnet-5 on rubric v1-2026-09-08, three scorings, the median. Ranks classes against each other on one shot spec; not comparable to a route's receipt (different shotsHash). Nothing scored above 69. Round three (SITE-40 to SITE-53) fixes the primitives the evaluators named, bottom first.

<!-- taste-table:start -->
_Regenerated 2026-09-13 by `scripts/taste-table.mjs` — claude-sonnet-5, rubric v1-2026-09-12, 3 scorings, median. Source: `design_system/public/taste-table.json`._

| class | median | scores | DQ/30 | OR/30 | IN/15 | CR/15 | HF/10 | tells | primitive named most | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| subdivisions | **43** | 43 · 48 · 39 | 16 | 8 | 2 | 10 | 7 | 0 | `app/subdivisions/page.tsx` | This is a correct, on-brand list of subdivisions with real live counts and median prices, but it is not the shadcn-command A-Z directory the layout l… |
| listing-detail | **44** | 44 · 50 · 44 | 15 | 6 | 5 | 10 | 8 | 1 | `app/listing/[listingKey]/page.tsx` | This is a correct, on-brand, and functional listing page — full-bleed hero restored, real price-cut data, a direct broker ask — but it is the generic… |
| compare | **45** | 41 · 47 · 45 | 18 | 8 | 2 | 10 | 7 | 2 | `app/compare/page.tsx` | This is a correct, on-brand, static feature table dressed in the house serif and navy/cream palette — it avoids the empty-slots trap (good) and cites… |
| buy | **50** | 55 · 50 · 45 | 18 | 10 | 3 | 11 | 8 | 1 | `app/buy/page.tsx` | This is a correct, on-brand hero (Amboqia headline, navy scrim on the right mountain photo, sourced stats) sitting on top of a page that has no inter… |
| contact | **51** | 52 · 51 · 48 | 18 | 11 | 4 | 10 | 8 | 1 | `app/contact/page.tsx` | This is a correct, on-brand, functionally complete contact page — one clear ask, sourced trust stats, a working write path with SMS consent — but it… |
| community | **51** | 51 · 62 · 44 | 17 | 14 | 5 | 8 | 7 | 1 | `app/communities/[slug]/page.tsx` | This is a correct, on-brand, quiet page — navy/cream, Amboqia headline, a genuinely useful custom boundary map instead of a generic Google embed — bu… |
| neighborhood | **51** | 51 · 38 · 52 | 18 | 12 | 5 | 11 | 5 | 1 | `app/cities/[slug]/[neighborhoodSlug]/page.tsx` | This is a clean, correctly-branded, honestly-sourced neighborhood summary that is missing its required map and has no interactive layer anywhere abov… |
| about | **52** | 45 · 56 · 52 | 17 | 12 | 3 | 12 | 8 | 0 | `app/about/page.tsx` | This is a correct, on-brand opener — AboutFirm hero with office exterior and one purpose line, followed by V3Proof reviews — which respects the layou… |
| market-report | **52** | 38 · 52 · 54 | 16 | 10 | 6 | 12 | 8 | 0 | `app/housing-market/page.tsx` | This is a correct, on-brand stub, not a market report: the two-bar months-of-supply instrument follows the house-mos spec and the sourcing line is ho… |
| search | **53** | 53 · 49 · 53 | 18 | 8 | 8 | 11 | 8 | 1 | `app/search/page.tsx` | This is a competent, on-brand implementation of the standard portal search pattern (list + map split, price slider, cluster map) but not a page that… |
| sell | **53** | 50 · 60 · 53 | 20 | 10 | 3 | 12 | 8 | 0 | `app/sell/page.tsx` | This is a competent, on-brand seller landing page — clean type, real numbers, working hierarchy — but it is not the house-sheet the layout lock calls… |
| place-type-community | **54** | 54 · 64 · 50 | 20 | 10 | 6 | 11 | 7 | 1 | `app/communities/[slug]/types/[type]/page.tsx` | This is a correct, on-brand utility page — H1, claim sentence with count and price band, sourced timestamp, and Atlas showing the true Tetherow bound… |
| cities | **54** | 54 · 50 · 60 | 18 | 10 | 6 | 12 | 8 | 0 | `app/cities/page.tsx` | This is a clean, correctly-sourced, on-brand stat card, not yet a breathtaking place page — demoMatch is false because no catalog interaction (combob… |
| invest | **56** | 56 · 50 · 56 | 20 | 14 | 2 | 12 | 8 | 0 | `app/invest/page.tsx` | This is a well-typeset claim-first headline over a static stat list, not the interactive data page the brief calls for. demoMatch is false — no catal… |
| blog | **56** | 58 · 46 · 56 | 20 | 15 | 3 | 11 | 7 | 1 | `app/blog/[slug]/page.tsx` | This is a correct, on-brand article shell — strong hero, claim-first headline, an honest sourcing gesture in the sidebar — but nothing in the visible… |
| subdivision | **56** | 61 · 56 · 55 | 19 | 14 | 8 | 8 | 7 | 1 | `app/subdivisions/[slug]/page.tsx` | This is a page with one genuinely original idea — a hand-drawn plat-boundary map with a price-drag scrubber — bolted onto an otherwise stock real-est… |
| zip | **57** | 58 · 57 · 57 | 18 | 13 | 8 | 10 | 8 | 1 | `app/zip/[zip]/page.tsx` | This is a competent, on-brand data page — navy/cream held, sources cited per §0, the Atlas map is a genuine differentiator — but demoMatch is false:… |
| place-type | **57** | 57 · 64 · 52 | 18 | 10 | 10 | 11 | 8 | 1 | `app/cities/[slug]/types/[type]/page.tsx` | This is a functional, honestly-sourced place-type page with a working filter slider, a carousel that genuinely matches the shadcn demo interaction (v… |
| market-report-detail | **57** | 59 · 57 · 55 | 16 | 11 | 9 | 13 | 8 | 0 | `app/housing-market/[...slug]/page.tsx` | This is a correct, honestly-sourced market page that follows the layout lock (two named mos bars, one hoverable long-view chart, one verdict with a t… |
| oregon-city | **59** | 59 · 51 · 61 | 22 | 15 | 3 | 11 | 8 | 1 | `app/oregon/[city]/page.tsx` | This is a competent, honest out-of-market page: navy/cream identity holds, the dot-strip chart is a real step up from a bare table, and the copy does… |
| city | **61** | 58 · 63 · 61 | 20 | 14 | 8 | 11 | 8 | 1 | `app/cities/[slug]/page.tsx` | This is a clean, correctly-sourced, on-brand data page that follows its layout lock (Atlas map instead of a Google embed, MOS as bars instead of a KP… |
| team | **62** | 62 · 63 · 46 | 18 | 16 | 10 | 10 | 8 | 0 | `app/team/page.tsx` | This is a clean, correctly-branded broker directory — navy/cream, Amboqia display, tabular closing counts, a real geocoded map instead of a stock emb… |
| homepage-v6 | **63** | 60 · 71 · 63 | 20 | 16 | 7 | 12 | 8 | 0 | `app/page.tsx` | This is a real hero with a sourced, timestamped stat band and an editorial claim-first headline into a chart — a meaningful step up from a wall of te… |
| price-drops | **65** | 66 · 64 · 65 | 20 | 16 | 9 | 12 | 8 | 0 | `app/price-drops/page.tsx` | This is a real carousel with working prev/next controls and a card body that shows price, drop %, address and specs — not a cream box, so demoMatch h… |
| market-report-region | **65** | 68 · 65 · 62 | 20 | 15 | 10 | 11 | 9 | 1 | `app/housing-market/central-oregon/page.tsx` | This is a correct, on-brand, quiet page — navy/cream, Amboqia headline, sourced figures, a verdict that matches its own threshold math — but it is no… |
| market-report-annual | **70** | 73 · 61 · 70 | 22 | 16 | 12 | 12 | 8 | 0 | `app/housing-market/annual-review/page.tsx` | This is a real instrument, not a KPI wall: the two named supply bars and the paged, hover-driven price chart are legitimate interaction and match the… |
| reviews | **78** | 78 · 78 · 67 | 24 | 24 | 10 | 12 | 8 | 1 | `app/reviews/page.tsx` | This is closer to right than most of the site — a big sourced rating, a full-text quote instead of a truncated snippet, and a genuinely original time… |

**Under 70, bottom first:**

- `subdivisions` — **43**
- `listing-detail` — **44**
- `compare` — **45**
- `buy` — **50**
- `contact` — **51**
- `community` — **51**
- `neighborhood` — **51**
- `about` — **52**
- `market-report` — **52**
- `search` — **53**
- `sell` — **53**
- `place-type-community` — **54**
- `cities` — **54**
- `invest` — **56**
- `blog` — **56**
- `subdivision` — **56**
- `zip` — **57**
- `place-type` — **57**
- `market-report-detail` — **57**
- `oregon-city` — **59**
- `city` — **61**
- `team` — **62**
- `homepage-v6` — **63**
- `price-drops` — **65**
- `market-report-region` — **65**
<!-- taste-table:end -->

**Lane re-scores on the instrument (route receipts, not table rows; the table is replaced only by a full `npm run taste:table` pass).** 2026-09-09 SITE-52: cities **30 → 75** (75 · 71 · 80; three rounds: 71 cold, 72 after the navy monogram and the supply hover record, 75 after the reveal cue), no tell named; subdivisions **first mark 53** (53 · 55 · 53; 36 cold, 44 after the monogram, 53 after the row dropped its `when` and the caption said what a bar is). Receipts in `ui_kits/cities/parity.json` and `ui_kits/subdivisions/parity.json`; evaluator claude-sonnet-5, rubric v1-2026-09-08, the same first-viewport pair plus hover records. 2026-09-09 SITE-45: listing-detail **77 → 79** (80 · 78 · 79; table row 55) on the rebuilt opening — one frame and a filmstrip, the price cut as a hover mark, a read under the pills, Tour in the fold; the tell named is the breadcrumb's `EASTON COMMERCIAL` plat alias and the Medford sidebar CTA and calculator are carried as Matt's calls. Receipt in `ui_kits/listing-detail/parity.json`, ten shots (instrument pair, close, out-of-area, strip and drop hover records). 2026-09-09 SITE-40 (V3Quiet, the six classes that open on it): invest **25 → 60** (63·54·60), compare **29 → 42**, about **31 → 49** (three rounds), market-report **41 → 54**, reviews **48 → 50**, contact **49 → 62** (four rounds); all rebaselined, evaluator claude-sonnet-5, rubric v1-2026-09-08, first-viewport pair. Only market-report still carries tells, both the chooser's repeated card shape, which belongs to its composition node.

Primitives named on the most classes: `components/site/v3/V3Quiet.tsx` (6), `components/site/v3/V3Instrument.tsx` (3), `components/place/PlaceAreaHero.tsx` (3), `components/site/v3` (2), `components/site/v3/V3Stage.tsx` (2), `app/housing-market/_v3/market-charts.ts` (2), `app/invest/page.tsx` (1), `app/compare/page.tsx` (1).

**Done rule (Matt 2026-09-07, "I want to be done with these shitty looking sites"):** a SITE item is not done until the separate evaluator's score for its page class, recorded in the route's `parity.json` `tasteReview`, rises above its previous mark. A page that still looks bad is a failed item. The rule is written into every open node's accept test.

**Finish line (Matt 2026-09-09):** the site is done when every public page class scores 70 or above on the table instrument (`design_system/public/taste-table.json`; first-viewport shots, claude-sonnet-5, rubric v1-2026-09-08, three scorings, median). A class under 70 after its node lands gets a node from the next table, never a lower bar. **Serve order (same day):** a fleet p0 or major, then round three (SITE-40 to SITE-53) and SITE-31, then the rest oldest first; `siteServeTier` in `lib/data/loop/work-node.ts`.
