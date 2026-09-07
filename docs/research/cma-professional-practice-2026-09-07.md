# How professionals build a CMA — research brief (2026-09-07)

Scope: what to change in `docs/plans/CMA_REIMAGINED_2026-09-07.md` so the price is supported by
facts. VERIFIED = fetched directly this session. UNCONFIRMED = no primary source reached; must not
ship as a figure.

---

## 1. What a professional CMA contains, in presentation order

**Appraisal (Form 1004 / Freddie 70):** subject → neighborhood and market conditions → site →
improvements → **sales comparison grid** → **reconciliation** → value conclusion with an effective
date → limiting conditions. Market conditions come BEFORE the grid, the conclusion AFTER it.
**RPR (read page-by-page, 30pp):** cover → pricing summary (one number) → pricing strategy (status
distribution + 90-day sold comparison + a **value bridge**: original estimate → home-facts →
improvements → needed repairs → market conditions → final) → subject snapshot → property facts →
legal/owner → photos → market KPIs with a market-type gauge → eight trend charts → comp map →
**comp adjustment grid** carrying Net Adj %, Gross Adj % and **Comp Weighting %** → one page per
comp with an estimated range and a confidence score.

| Element, in professional order | Our blueprint | MISSING from ours |
|---|---|---|
| Subject identification, effective date, basis | ch.0 cover | No effective date semantics, no "broker price opinion, not an appraisal" line, no statement of what was inspected |
| Market conditions stated **before** the evidence | ch.2b, ch.5 (both AFTER ch.3) | The %/month index the time adjustment uses is never shown anywhere, in any chapter |
| Sale price, proximity, **data source, verification source** per comp | ch.3 table | No MLS number, no "closed, verified" line per sale |
| **Sales or financing concessions** — the FIRST value adjustment on the 1004 | absent from ch.3; ch.6 net sheet only | Per-sale concession line, though `listings.concessions_amount` exists |
| Adjustment lines, each with a signed dollar amount: date/time, location, site, view, design, quality, age, condition, room count, GLA, basement, garage | ch.3 prints one arrow, "adjusted for date and size → sale price today" | Per-line dollar basis. The engine itemizes time, size and story (`lib/pricing/estimate.ts:193-228`) and the document collapses all three into one number |
| **Net adjustment $, Net adj %, Gross adj %** per comp | absent | All three. RPR prints the rows even when empty |
| **Reconciliation**: which sale was weighted most and why (similarity, recency, smallest gross adjustment) — never a silent average | absent | The whole paragraph. `estimate.ts:226` computes `weight = sizeProximity × recency` per comp and never prints it. RPR prints "Comp Weighting 60% / 10% / 10% / 10% / 10%" |
| Value conclusion: range and/or point, as of a date | ch.3 title + cover | The range is not derived from the printed adjusted prices (see §2) and its meaning is never stated |
| Sales considered and **rejected**, with the reason | ch.3 search sentence | The rejected-sales list. The search story asserts a radius; it does not show what was excluded |
| Limiting conditions / assumptions | ch.7 disclosure sentence | Condition was not adjusted for on sales where condition is unrecorded — the honest disclosure, and per `CMA_STATE_OF_THE_WORLD.md` the widest open gap in the category |

Worth taking from RPR: the **value bridge**, an itemized walk from a starting number to the
conclusion, reads as arithmetic a seller can follow. Worth refusing: its Sunstone comps are RVM
estimates on off-market homes, its grain is a whole ZIP, and every adjustment cell reads `$0`.

---

## 2. How the best state "what the price is and why", without hype

The form is **grid → reconciliation → conclusion**, and each step is mechanical.

- **Grid.** Every adjustment is a signed dollar amount on its own labelled line ("adjust the comp
  to the subject": comp better → minus), then net adjustment total, net adj %, gross adj %,
  adjusted sale price. Nothing is bundled. (Form 1004; Fannie Mae B4-1.3-07.)
- **Each adjustment carries its derivation.** Fannie Mae B4-1.3-09, eff. 06/04/2025 (VERIFIED):
  *"Fannie Mae does not have specific limitations or guidelines associated with net or gross
  adjustments"* — the 15%/25% caps are legacy folklore. Time adjustments are required where the
  market moved, supported by *"home price indices (HPIs) … statistical analysis, modeling, paired
  sales"*, and the report must describe *"the data sources, tool(s), and technique(s) used."*
- **Reconciliation.** USPAP SR 1-6 requires reconciling the quality and quantity of data and the
  relevance of each method; SR 2-2 requires the reasoning be summarized. *The Appraisal of Real
  Estate* (15th ed.) names the most-weighted comparable on three axes — similarity, recency,
  smallest adjustment magnitude — never an average. One sentence: "The Juniper sale carries the
  most weight: 60 sqft from yours, closed 45 days ago, smallest total adjustment of the eight."
- **Conclusion.** USPAP permits a value stated as an amount **or as a range**, a range being
  appropriate where data quality limits reliability. A CMA is not bound by USPAP, but this is the
  licence for our shape: **a range plus a most-likely point**, the range being the spread of the
  printed adjusted prices and the point their weighted reconciliation — not the midpoint, not a
  separate calculation. Today the band is p25/p75 of time-adjusted $/sqft ÷ sale-to-list
  (`estimate.ts:68-81`), a different basis from the evidence printed. That is D10, and this form
  closes it by construction: the conclusion may only use what is on the page.

---

## 3. Failed listings and price history — how the field presents them

- **Nobody draws a per-listing price path.** Checked Redfin, Zillow, RPR, Cloud CMA (Lone Wolf),
  Altos, HouseCanary: every one presents a single listing's history as a **table** (date · event ·
  price · source). Line charts exist only at market-aggregate level (Altos median list price and
  price-reduction rate; HouseCanary HPI/RPI). **The blueprint's `priceHistoryLine` is not catch-up;
  it is the differentiator.**
- **Expired listings barely appear.** RPR gives them one column in the page-3 status table (low /
  median / high / $/sqft / median days) and nothing more — no story, no path, no reason. Cloud
  CMA's expired handling could not be confirmed. Ch.2's one-story-per-failed-listing has no
  equivalent in any product found.
- **Worth copying:** RPR's per-comp page carries an estimated range and a confidence score beside
  the point value. A stated per-property uncertainty is otherwise absent from the category.

---

## 4. Overpricing: what is backed by a dataset, and what is folklore

**FOLKLORE — no dataset, never ship with numbers attached.**

| Claim | Status |
|---|---|
| Pricing/buyer-activity pyramid ("at market = 60% of buyers, 10% over = 30%, 15% over = 10%") | No dataset, no original author, no study. A Keller Williams-style training graphic restated across broker blogs with no citation. Ban. |
| "The first 30 days / first two weeks are the most important" | An interpretive gloss on an outcome table, not itself a measured claim. |
| "The longer it sits, the more buyers assume something is wrong" | Taylor (1999), *Rev. Econ. Studies* 66:555-578 is a **theoretical signalling model**, not an empirical measurement of buyer behavior. Ban as a stated fact. |
| Showings-to-offer ratios ("6 showings in two weeks", "10–25 per offer") | Sources contradict each other; none names a dataset. Ban. |
| $99,000-vs-$100,000 price banding | No real-estate study found; borrowed retail charm-pricing. |
| 15% net / 25% gross adjustment caps as a quality signal | Explicitly disclaimed by Fannie Mae B4-1.3-09 (VERIFIED). Ban. |
| NAR's overpricing-risk guidance | NAR asserts the risk narratively and attaches no statistic to that claim on the page checked. |
| "% of original list received by weeks on market" (100 / 99 / 98 / 96 / 94) | Attributed to NAR via secondary sources; primary source **UNCONFIRMED** (fetches blocked). Do not cite. Compute the same shape locally instead. |

**BACKED — named dataset, and whether we can compute it locally.** `listings` holds
`OriginalListPrice`, `ListPrice`, `ClosePrice`, `CloseDate`, list date, `StandardStatus`,
`days_to_pending`, `concessions_amount`, `total_price_changes`, `last_price_change_*`; plus
`listing_history` (3.87M rows: `event_date`, `event`, `price`, `price_change`).

| Finding | Source, n, window | Local? Blueprint field |
|---|---|---|
| Definitions for share-sold-above-list, share-with-a-price-drop, median DOM, and sale-to-list ratio, each **excluding sales 50% above or below list** (VERIFIED by direct fetch) | Redfin Data Center metric definitions; Redfin's MLS-sourced listings DB, weekly 4-week rolling + monthly, per metro | YES — and the ±50% exclusion is a defect in ours: `listPriceFromEngine` consumes `saleToAskRatios` with no outlier rule (`estimate.ts:255-270`) |
| Share of listings with a price cut; median days to pending | Zillow Research listing feed, monthly, metro level. **UNCONFIRMED** — zillow.com/research/data returned 403 to us; do not cite the national figure | YES, locally — `market.offerTiming.medianDays` (exists, uses `days_to_pending`); price-cut share available from `market_pulse_live.price_reduction_share` |
| Listings with large downward price revisions take longer AND sell for less | Knight (2002), *Real Estate Economics* 30(2):213-237, MLS duration/probit model. **n and market not confirmed** (paywalled) | YES as a local analog — `market.askOutcome.groups` (`sold-no-cut` / `sold-after-cut` / `did-not-sell`), plus the delta's `medianSoldToOriginalAskPct`. Report ours, cite Knight only as direction |
| Higher list price relative to value → longer time on market | Anglin, Rutherford & Springer (2003), *J. Real Estate Finance & Econ* 26(1):95-111. **n not confirmed** (paywalled) | PARTLY — needs a value estimate to measure degree of overpricing; we have one, so it must be labelled as our own estimate, not an independent value |
| Loss-averse sellers set asking prices 25–35% of the nominal loss higher, achieve 3–18% higher prices, and sell far less often | Genesove & Mayer (2001), *QJE* 116(4):1233-1260, downtown Boston condos, 1990s | NO — needs prior purchase price, absent from `listings` (county deed data could supply it). Do not use |
| Failed asks that later sold, and at what share of the failed ask | Ours: `FAILED_ASK_BACKTEST`, 3,394 Central Oregon relists, 2023–2026 | YES — already in ch.1; delta adds `market.localFailedThenSold` for the city |
| Median % of ORIGINAL ask realized, by weeks-on-market bucket | No confirmed publisher — build it ourselves | YES, and it is the single best overpricing exhibit. **New field needed**: `market.originalAskRealization = { city, windowMonths, buckets:[{maxWeeks, n, medianPctOfOriginalAsk}], source }` |

§0-safe posture: compute the local figure on Central Oregon data with a printed source block;
never cite a national aggregate as if it described Bend or Redmond.

---

## 5. Ten ranked changes to the blueprint

1. Print the adjustment grid line by line per sale — sale price, concessions, date/time, size, story, net adj $, net adj %, gross adj %, adjusted price — instead of ch.3's single arrow. (Form 1004; Fannie Mae B4-1.3-07.)
2. Add a reconciliation sentence and a printed weight per sale, naming the most-weighted sale on similarity, recency and smallest gross adjustment; `estimate.ts:226` already computes the weight and we print none. (USPAP SR 1-6; Appraisal Institute; RPR p.20.)
3. Derive the range from the printed adjusted prices and the point from their weighted reconciliation, closing D10, where the band is p25/p75 of $/sqft on a different basis from the evidence shown (`estimate.ts:68-81`). (USPAP permits a range.)
4. Make ch.2b's centrepiece a local table — median % of original ask realized by weeks-on-market bucket, new field `market.originalAskRealization` — replacing the NAR table we cannot source. (NAR UNCONFIRMED; Redfin definitions VERIFIED as the metric shape.)
5. Print the time-adjustment basis (%/month index, window, n, source) beside the first adjusted sale; no chapter shows it today and the description is now required. (Fannie Mae B4-1.3-09, VERIFIED.)
6. Ban the folklore in the voice gate alongside `band`: pyramid percentages, "first 30 days", "buyers assume something is wrong", showings-to-offer ratios, and 15%/25% adjustment caps. (§4; Fannie Mae B4-1.3-09.)
7. Keep `priceHistoryLine` and extend it to every row — it is the differentiator, not catch-up, since no product found draws a per-listing price path as a line. (Redfin, Zillow, RPR, Cloud CMA, Altos, HouseCanary.)
8. Add a concessions line to every sale row from `listings.concessions_amount` — the 1004's first value adjustment, absent from ch.3 while ch.6 prints two unexplained concession figures (D14). (Form 1004.)
9. Add a basis-and-limits block: effective date, broker price opinion rather than appraisal, what was inspected, and that condition was not adjusted for where it is unrecorded. (USPAP SR 2-2 analog.)
10. Print the sales considered and rejected with the reason, and apply Redfin's ±50% exclusion to the sale-to-list ratios feeding `listPriceFromEngine`, which has no outlier rule. (Appraisal reconciliation practice; Redfin definitions, VERIFIED.)
