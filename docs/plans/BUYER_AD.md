# Buyer ad, autumn 2026

Status: **whiteboard next, then techniques** (Matt 2026-10-14). The ad-strategist (`.claude/agents/ad-strategist.md`) writes this ad's whiteboard and read-aloud script first (CONTENT_PROCESS.md step 0), from the verified dollar figures below once they are `brief.numbers` rows (key, on-screen value, definition, window, geography, source); Matt reads that script before any board is made. This ad's techniques are built first: the full-screen $10,000, a map that never singles out a sold home (ODS §5-4; the hexagon cells are rejected, below), motion blur, and the number landing on the beat. Matt approves each from a showcase reel; then Matt sees this ad's board before anything costly is made. Nothing renders as an ad, and nothing posts, before that. Process: `docs/plans/CONTENT_PROCESS.md`.

**Buyer ad, Matt's calls 2026-10-14 (morning).** Lead with the $10,000 typical seller credit. Count Bend single-family homes (MLS city `bend`, segment detached). A map of this summer's price-cut and credit sales closes it, then "Bend's Best Deals, link in bio", then the locked end card. The payoff line "Sellers are paying to close" was in this list; it is retired (below).

**Matt's calls later the same day (these win):**
- **The payoff line "Sellers are paying to close" is retired.** "It's only you bots that understand it. You jump right into the middle of a concept when you really don't explain it." Plain English a 75-year-old follows on first hearing (CONTENT_PROCESS.md rulings 10 to 15; R-186 to R-191).
- **The hexagon-cell map is rejected** ("those gigantic hexagon dots"). The map's look goes back to Matt; no single sold home shows either way (R-140, R-196).
- **The ad opens on the bigger context**, in Matt's words: "Are you thinking of buying in Central Oregon? You need to know what's happening in the market. Here's what we're seeing in the market." Then what sellers are doing in actual dollars, the contrast with what came before, why now, and why us ("we've been watching the market"). Succinct enough to fit the type's window.
- **The angle is "Bend vs. 2021"** (Matt chose it): contrast with the bidding-war years, not "a break just now". The data shows the shift built up over 2022 to 2025 and is flat against last summer, and Bend months of supply was 3.42 at Sep 30, a seller's market by the 4-or-under rule. So the ad never says the market broke this summer, and never calls Bend a buyer's or a balanced market.

**Whiteboard: pending.** The figures below are verified; once they are `brief.numbers` rows the ad-strategist writes the whiteboard and script, and `npm run studio -- whiteboard <whiteboard.json> <brief.json> --ad` must pass. Nobody else writes the script.

Verified dollar figures the ad may use (Bend single-family, MLS city `Bend`, segment detached, close dates Jul 1 to Sep 30 2026; `market_report_series` mr-v1 and the `market_report_sale` rows that feed it, checked against Spark, computed 2026-10-14):
- **$25,000 below the original asking price:** the typical Bend single-family home closed $25,000 below its original asking price (median of original list minus close, 623 sales with the two typo rows below removed). 2021: $0, at asking. 2025: $29,000. Spark gives the same $25,000.
- **$10,000 in seller credits:** sellers who gave a credit typically gave $10,000 (median of 276 credits on 625 sales; Spark 277, $10,000). 2021: $2,500 among sellers who reported a credit. 2025: $8,500; that change is inside sampling noise, so do not say the typical credit grew since last year.
- **$50,000 price cut, now verified:** when a Bend seller cut, the typical cut from the original to the final list price was $50,000 (281 cuts as the series and Spark report them; 279 without two typo rows whose original list is exactly 10 times the final, median $49,500). Which count prints is Matt's call. It has sat at or near $50,000 every year since 2022, so never pair it with "bigger than before".

Wording the figures need (R-188, R-189): these are medians, so say "typical" and never "average" (Matt said "on average"; the data is a median). "Seller credit" is an insider term: say "money the seller put toward the buyer's costs at closing". The MLS credit field does not say whether the money went to closing costs, the rate or repairs, so the ad does not name one. Dollar amounts only on screen and in the voiceover, never the percentages below.

Earlier counts (Bend SFR, Jul-Sep, `market_report_series` mr-v1, computed 2026-10-13; data notes, not ad copy):
- Sold after a price cut: 281 of 625 = 45%. Same quarter 2025: 319 of 662 = 48%. 2021: 188 of 903 = 21%.
- Reported a seller credit: at least 276 of 625 = 44%. 2025: 245 of 662 = 37%. 2021: at least 173 of 903 = 19% ('No' was not coded before 2023, so 2021 is a lower bound).
- Median credit: $10,000. 2025: $8,500. 2021: $2,500.
- $10K toward the rate: $169.07 a month at 7.40% (`market_history_weekly` week 2026-10-12), on $695,850 with 20% down and 1 point per 0.25%. An illustration only: the credit field does not say a credit went to the rate.

Do not use:
- "Sellers are paying to close": retired by Matt (above).
- "63% cut their price": a placeholder in the contract doc, now removed.
- "5.6% of the first ask": unverified. It cannot be reproduced (the median cut is 5.3% of the first ask); keep it out of all copy. The $50,000 dollar figure above replaces it, and ads say dollars, not percentages (R-189).
- "The market broke this summer", "a break just now": the shift built up over 2022 to 2025 and is flat against last summer.
- "Buyer's market" or "balanced market" for Bend: months of supply 3.42 at Sep 30 is seller's.
- "More inventory": 713 for sale at Sep 30 vs 794 a year earlier, down 10%. Sep 2021's 334 is 297 inferred.
- "Buyers have leverage" beside months of supply 3.5: video:check check 10 now fails it.
- "Average" for any figure above: each is a median.
- Hexagon cells on the map.

**Sound** (Matt 2026-10-14): this is an ad, so the voice and our composed music are baked into the file. Instagram's in-app picker songs are for organic Reels only.

**Map data:** `getSaleLeveragePoints` (lib/data/market-report/leverage-points.ts, branch `worktree-agent-a4664ce53feb2f62b` until merged) reconciles exactly to mr-v1: 625 closed, 281 cut, 276 credit, 127 both, 624 with coordinates. 80 of the points sit outside the city box (MLS city "Bend" includes rural Bend). The map fits all points and draws no city-limits line. The coarse grid that kept any single home from being picked out was drawn as hexagon cells, which Matt rejected; whatever replaces it must still hide single homes.
