# Buyer ad, autumn 2026

Status: **techniques first** (Matt 2026-10-14). This ad's techniques are built first: the full-screen $10,000, the map lighting up area cells (never single sold homes, ODS §5-4), motion blur, and the number landing on the beat. Matt approves each from a showcase reel; then Matt sees this ad's board before anything costly is made. Nothing renders as an ad, and nothing posts, before that. Process: `docs/plans/CONTENT_PROCESS.md`.

**Buyer ad, Matt's calls 2026-10-14.** Lead with the $10,000 typical seller credit. Count Bend single-family homes (MLS city `bend`, segment detached). Payoff line "Sellers are paying to close". A map of this summer's price-cut and credit sales closes it, then "Bend's Best Deals, link in bio", then the locked end card.

Verified (Bend SFR, Jul-Sep, `market_report_series` mr-v1, computed 2026-10-13):
- Sold after a price cut: 281 of 625 = 45%. Same quarter 2025: 319 of 662 = 48%. 2021: 188 of 903 = 21%.
- Reported a seller credit: at least 276 of 625 = 44%. 2025: 245 of 662 = 37%. 2021: at least 173 of 903 = 19% ('No' was not coded before 2023, so 2021 is a lower bound).
- Median credit: $10,000. 2025: $8,500. 2021: $2,500.
- $10K toward the rate: $169.07 a month at 7.40% (`market_history_weekly` week 2026-10-12), on $695,850 with 20% down and 1 point per 0.25%.

Do not use:
- "63% cut their price": a placeholder in the contract doc, now removed.
- "Typical cut $50K": unverifiable. The verified figure is 5.6% of the first ask.
- "More inventory": 713 for sale at Sep 30 vs 794 a year earlier, down 10%. Sep 2021's 334 is 297 inferred.
- "Buyers have leverage" beside months of supply 3.5: video:check check 10 now fails it.

**Sound** (Matt 2026-10-14): this is an ad, so the voice and our composed music are baked into the file. Instagram's in-app picker songs are for organic Reels only.

**Map data:** `getSaleLeveragePoints` (lib/data/market-report/leverage-points.ts, branch `worktree-agent-a4664ce53feb2f62b` until merged) reconciles exactly to mr-v1: 625 closed, 281 cut, 276 credit, 127 both, 624 with coordinates. 80 of the points sit outside the city box (MLS city "Bend" includes rural Bend). The map fits all points, draws no city-limits line, and bins points to a coarse grid so no single home can be picked out.
