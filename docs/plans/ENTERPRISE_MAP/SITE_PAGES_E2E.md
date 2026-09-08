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
| SITE-32 | `1c1bff8e-f699-4dcc-b793-fe5c573f0f51` | Off-market listing index policy: two contradictory written policies, one ruling, one implementation, one gate (blocked on Matt) |
| SITE-33 | `00b6bd10-cdb1-4d97-ad99-7a2ad7d091b3` | Out-of-market listing pages: 56% of the listings sitemap is Southern Oregon inventory rendered like Bend; does the referral tier extend per-listing (blocked on Matt) |

**Round two (seeded 2026-09-08, SITE-20 to SITE-33).** Source: Search Console 2026-06-08..2026-09-05 pulled by `scripts/_gsc-by-class.mjs` (129,817 impressions, 1,368 clicks, 1.05% CTR site-wide), four investigation lenses and twenty-two adversarial verifications (workflow `wf_71474111-a25`), every code fact re-read and every live claim re-curled with a browser UA. Every traffic-causation claim was refuted against this site's own query data (the class CTR gap is rank on head terms, not copy; cross-class position comparison is uninformative), so round two claims no click it cannot prove: it is correctness on a licensed broker's public site (wrong prices in the SERP and the structured data, MLS abbreviations as place names, out-of-market pages under a Central Oregon title), consolidation (one canonical per listing, plats attributable by polygon), origin cost, and two policy calls that are Matt's (SITE-32, SITE-33). Refuted and NOT seeded: registry-alias noindex for plats (already shipped by `getIndexableSubdivisions`; what remains is recrawl latency), a /cities out-of-area gate (middleware already 308s), cannibalization and crawl-budget mechanisms (no measurement on this site), and the greenwood-playhouse snippet (every impression is a quoted navigational query for the venue's own site).

**Done rule (Matt 2026-09-07, "I want to be done with these shitty looking sites"):** a SITE item is not done until the separate evaluator's score for its page class, recorded in the route's `parity.json` `tasteReview`, rises above its previous mark. A page that still looks bad is a failed item. The rule is written into every open node's accept test.
