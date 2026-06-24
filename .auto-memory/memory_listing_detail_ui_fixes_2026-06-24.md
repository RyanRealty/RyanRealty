# Listing-detail UI fixes — 2026-06-24

Full-resolution visual audit of `/listing/20260618202606519366000000` (67480 Cloverdale, $6,999,000) against `design_system/ryan-realty/ui_kits/listing-detail/`. All 10 issues fixed + verified in real Chrome.

**Architectural note (why these persisted):** the live page renders `components/site/listing-detail/*` (the KB set), NOT `components/listing/*` (older, dead for this route). Prior fixes to `components/listing/*` had no effect.

## Fixes (all ✅ verified live)

| # | Issue | Fix | File(s) |
|---|-------|-----|---------|
| 1 | Dark-navy voids in facts grid (odd-count categories) | Last cell spans both columns when count is odd | `PropertySpecs.tsx` SpecGrid |
| 2 | `$/sqft` = `$1,000` in facts vs `$771` in pill | New `exact` mode on `<Price>` (whole dollars, no thousand-rounding); applied to facts + pill | `Price.tsx`, `PropertySpecs.tsx`, `PriceCtaStrip.tsx` |
| 3 | `· N/A` subdivision (detail, comp cards, video cards, JSON-LD) | New `displaySubdivision()` sentinel-collapser (N/A/None/Unknown/`***`→null), applied everywhere | `lib/slug.ts` + `PriceCtaStrip`, `SimilarListings`, `ListingJsonLd`, `lib/site/listing-card.ts` |
| 4 | Rental defaults 7.5%/25% vs mortgage 7%/20%; lighter input skin | Pass `initialDownPaymentPct=20`/`initialInterestRate=7`; harmonize `.kb-tool-skin` inputs to 2px-navy/0-radius | `RentalAnalysis.tsx`, `kb.css` |
| 5 | Map line "On the Deschutes River… near downtown" false for rural Bend | City-level true line: "In Bend, the largest city in Central Oregon, between the high desert and the Cascades." | `app/listing/[listingKey]/page.tsx` |
| 6 | Comp/video cards show `— bd · — ba · — sqft` (source MLS nulls) | Card renders only present stats; omits row when all null | `ListingCard.tsx` |
| 7 | Mortgage $/mo rounded to $1,000 ($37,000/mo) | `exact` mode → $37,252/mo, PITI $42,254 | `MortgageCalculator.tsx` |
| 8 | HOME PRICE input raw `6999000` | Comma-format display, store raw digits | `MortgageCalculator.tsx` |
| 9 | Hero thumbnail strip = navy void on first paint | Eager-load visible strip thumbnails (they're at the fold) | `ListingHero.tsx` |
| 11 | (found in review pass) BEND MARKET 4-KPI row overflowed its container ~48px on mobile (inline `repeat(4,1fr)` defeated the responsive rule) | Drive desktop column count via `--kpi-cols` CSS var; base rule `repeat(2,minmax(0,1fr))` → 2×2 mobile, `var(--kpi-cols)` desktop. Verified 4-across desktop, 2×2 mobile, 0 overflow | `NeighborhoodMarketContext.tsx`, `kb.css` |

`exact` Price mode + `displaySubdivision()` are reusable primitives now — use them anywhere $/sqft or a subdivision label renders.

Out of scope (noted, not regressions): Amboqia capital-I glyph (locked brand font reads "DESCR1PT1ON"); schools "Check with District" (correct null fallback); video-tour cross-sell shows entry-price homes under a luxury listing (product/relevance, not visual); the dev-mode "N" badge (not in prod).

Verified: `tsc --noEmit` clean, `ci:gates` clean, every fix screenshotted in real Chrome at localhost:3000.
