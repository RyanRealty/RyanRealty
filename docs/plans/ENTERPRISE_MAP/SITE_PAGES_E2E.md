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
