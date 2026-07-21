# Market Report Metric & Framework Inventory — Ryan Realty (Central Oregon)

Research report. Sources cited inline. All formulas explicit. Nothing here is a stat about the Bend market; this is the *specification* for how to produce those stats.

---

## 1. The HousingWire Housing Market Tracker

**What it is:** a weekly published dataset plus commentary, authored by Logan Mohtashami (HousingWire Lead Analyst), landing Mondays. Live page: https://www.housingwire.com/housing-market-tracker/. The underlying weekly listing data is supplied by **Altos Research** (HousingWire acquired Altos in 2022), which samples every active MLS listing in the country each Friday. That matters for us: Altos is a weekly, listing-level, non-seasonally-adjusted panel. It is structurally the same kind of data an MLS gives you. We can reproduce almost all of it locally.

Note: housingwire.com returns HTTP 403 to automated fetches. Metric definitions below are assembled from the Tracker page description, the weekly Tracker articles, and Altos methodology documentation.

### The Tracker's series, in the order it presents them

| # | Metric | Exact definition | Cadence | Why it matters |
|---|---|---|---|---|
| 1 | **Weekly active inventory** | Count of active single-family listings on the MLS as of the Friday snapshot. Excludes pending/under contract. Not seasonally adjusted. | Weekly, plus a WoW change and a YoY comparison to the same calendar week | The core supply variable. Mohtashami's entire market-health framework keys off the *level* and *direction* of this number, not off months-of-supply. |
| 2 | **Weekly new listings** | Count of listings that entered the market as new during the week. Excludes relists where possible. | Weekly, YoY | Seller-side flow. Distinguishes "inventory rising because nothing sells" from "inventory rising because more sellers are listing." These are opposite stories. |
| 3 | **Weekly pending contracts (total)** | Count of listings currently in pending/under-contract status, national aggregate. Reported as a level with a YoY comparison. | Weekly, YoY | Real-time demand. Leads closed sales by 30 to 45 days. Immune to the closing-lag distortion that makes NAR existing-home-sales a rear-view mirror. |
| 4 | **Weekly new pendings** | Count of listings that went pending during the week (flow, not stock). | Weekly, YoY | Cleaner demand read than total pendings, which is contaminated by longer escrow periods and fall-through rates. |
| 5 | **Percent of homes with price cuts** | Share of *active* listings that have taken at least one price reduction from original list. | Weekly, YoY | Mohtashami's single best forward indicator of price direction. He anchors it to a stated normal band: **roughly 30% to 35%** of active listings in a typical year. Above that band means sellers are over-list relative to demand; a rising cut share leads softening prices by one to two quarters. |
| 6 | **Median list price / price of new listings** | Median asking price, active and new-listing cuts. | Weekly | Forward-looking price signal. Leads median *sold* price because it is set today, not 45 days ago. |
| 7 | **Purchase mortgage applications (MBA)** | MBA Weekly Applications Survey, Purchase Index, seasonally adjusted and unadjusted, WoW and YoY. | Weekly, Wednesday 7am ET | Leading demand indicator, 30 to 90 days ahead of sales. |
| 8 | **30-year fixed mortgage rate** | Daily rate tracking (Mortgage News Daily) plus the Freddie Mac PMMS weekly. | Daily / weekly Thursday | The exogenous driver. Everything else in the model responds to it. |
| 9 | **10-year Treasury yield** | Daily constant-maturity yield. | Daily | The rate the mortgage market is priced off. |
| 10 | **Mortgage spreads** | 30-year fixed mortgage rate minus 10-year Treasury yield. | Weekly | The second driver. Explains why mortgage rates and Treasuries diverge. Historical normal band **1.60% to 1.80%**; peaked near **3.10% in 2023**. When spreads compress, mortgage rates fall without the 10-year moving at all. |
| 11 | **Weekly housing starts / permits / new home sales** (in the monthly companion pieces) | Census Bureau residential construction series. | Monthly | The recession channel. See §2. |

Sources:
- https://www.housingwire.com/housing-market-tracker/
- https://www.housingwire.com/articles/housing-market-inventory-price-cuts-spring-2026/
- https://www.housingwire.com/articles/housing-inventory-just-turned-negative-year-over-year/
- https://blog.altosresearch.com/housingwires-logan-mohtashami-straight-talk-on-the-housing-market

**The structural lesson for us:** the Tracker is weekly, flow-first, and non-seasonally-adjusted with explicit same-week-last-year comparisons. Almost every brokerage market report is monthly, stock-first, and compares to last month. That difference alone is most of the quality gap.

---

## 2. Mohtashami's analytical framework

The numbers are the easy part. The reasoning method is the asset. Here it is, laid out as a causal chain, because that is how he actually writes.

### 2.1 The causal chain (this is the whole model)

```
10-year Treasury yield  ──┐
                          ├──►  30-year mortgage rate  ──►  purchase applications
mortgage spread        ──┘                                        │ (30-90 day lead)
                                                                  ▼
                                                          weekly new pendings
                                                                  │ (30-45 day lead)
                                                                  ▼
                                                            closed sales
                                                                  
        rate move ──► ALSO acts on the SELLER side ──► new listings
                                                                  │
                    active inventory = f(new listings − new pendings − withdrawals)
                                                                  │
                                                                  ▼
                                              price-cut % ──► median price direction
```

**The key insight most analysts miss, and the one Ryan Realty should adopt verbatim:** a mortgage-rate move hits *both* sides of the ledger. Lower rates raise demand, but they also unlock sellers who are rate-locked, which raises new listings. Whether inventory rises or falls after a rate drop is an empirical question, not a deduction. Mohtashami documented exactly this: when rates moved toward 6% in 2025, the inventory *growth rate* fell from 33% YoY to 13.06% YoY. Demand absorbed supply faster than sellers added it. https://www.housingwire.com/articles/housing-inventory-growth-2026/

### 2.2 The mortgage-rate sensitivity bands

He works with explicit rate thresholds rather than continuous elasticity:

- **Below ~6.00%**: demand improves meaningfully; sellers also unlock; inventory growth decelerates.
- **6.00% to 6.64%**: the improvement zone. His stated pivot is that housing data "tends to improve when mortgage rates fall below **6.64%** and head toward 6%."
- **Above 6.64%**: data fades.
- **Above 7.00%**: demand deteriorates sharply; this is where he flags real weakness.

His 2026 forecast ranges: 10-year yield **3.80% to 4.60%**, 30-year mortgage **5.75% to 6.75%**, with spreads normalizing toward **1.80%**.
https://www.housingwire.com/articles/logan-mohtashamis-2026-housing-forecast/ · https://www.housingwire.com/articles/iran-conflict-664-mortgage-rates/

**How to use this locally:** the bands are national demand thresholds, but they apply to Central Oregon buyers because Central Oregon buyers borrow at national rates. The local report should state the current rate, name which band it is in, and then show whether *local* pendings behaved the way the band predicts. When local data diverges from the band, that divergence is the story, and it is the most valuable paragraph in the whole report. Bend's second-home and cash-buyer share means it should be *less* rate-sensitive than the nation. Measuring that is a genuinely differentiated finding.

### 2.3 The inventory channel thresholds

This is the most-cited part of his framework and also the most-misapplied.

- **1.52 million to 1.93 million** total existing-home inventory (NAR measure) is his "normal and sane" band. That is roughly 2019 levels, which were themselves a four-decade low pre-2020.
- **Below 1.52 million** is the danger line. Below it, any uptick in demand produces **forced bidding** because there is no absorptive slack. That is the mechanism that produces unhealthy price spikes.
- **Above 1.93 million**, he starts talking about price softness and buyer leverage.

https://www.housingwire.com/articles/logan-mohtashami-on-why-this-is-a-savagely-unhealthy-housing-market/

**Critical caveat for our use:** these are *national NAR* numbers. They do not scale to a county by simple ratio, and quoting them in a Bend report is meaningless. What transfers is the *concept*: there is a level of active inventory below which a market loses its ability to absorb a demand shock without bidding wars, and that level should be derived empirically from local history. See §3.11 for how to compute the Central Oregon analogue.

### 2.4 "Savagely unhealthy housing market"

Precise definition, not a vibe. It is the conjunction of:

1. Active inventory below the sane band (nationally, under 1.52M), **and**
2. Home-price growth running far above his tolerance model, **and**
3. Rising mortgage rates simultaneously, so affordability collapses from both the price and the rate side at once.

His price tolerance model was explicit: for 2020 to 2024 he wanted cumulative nominal price growth to stay **under 23% over five years**. Actual was roughly **30% in two years**. That breach is what took the market from "unhealthy" to "savagely unhealthy."
https://www.housingwire.com/articles/logan-mohtashami-the-2022-housing-forecast/ · https://www.housingwire.com/articles/the-savagely-unhealthy-housing-market-is-now-a-nightmare/

The word "savagely" is doing real work: it names a market that is bad *for buyers and sellers both*, because sellers cannot move up and inventory cannot rebuild. It is not a bearish call. He was explicitly not forecasting a crash. That distinction is the model of honest analysis Matt should copy.

### 2.5 "Housing recession"

Also precise, and it is about **construction, not resale**. His definition:

> Housing is in recession when **new home sales and housing permits/starts decline together**. That is the point at which builders lay off residential construction workers, and residential construction employment has historically led the national labor market into recession.

Supporting mechanics he tracks:
- **Completed units for sale** approaching ~120,000 is the level at which builders stop starting new homes.
- Starts and permits falling while completions rise is the signature of a builder inventory overhang.
- The tell is *demand-constrained*, not capacity-constrained, construction.

https://www.housingwire.com/articles/new-home-sales-make-it-clear-housing-is-in-a-recession/ · https://www.housingwire.com/articles/new-home-sales-show-why-permits-are-falling/

**Local relevance:** Central Oregon has meaningful new construction and a permits series (Deschutes County, see §4). A local "is construction in recession" read is fully computable and almost no Bend brokerage does it.

### 2.6 The purchase-application counting rule

His most distinctive methodological habit. Purchase applications are noisy week to week, so he does not react to single weeks. Instead:

> Count consecutive **week-over-week positive** prints. **12 to 14 weeks** of positive week-to-week data has, since late 2022, reliably preceded roughly **a couple hundred thousand additional annualized home sales**. Fewer than that is noise.

He also insists on **both** conditions before declaring a demand trend: week-to-week positive *and* year-over-year growth. A market that is up YoY but flat week-to-week (his 2026 read) is not accelerating.

https://www.housingwire.com/articles/mortgage-demand-holds-2026/ · https://www.housingwire.com/articles/how-is-housing-demand-holding-up-logan-mohtashami-answers/

**This is the single most transferable technique in the entire framework.** It is a formalized rule for when a data series has said something. Ryan Realty should adopt the identical discipline for weekly local pendings: define a minimum run-length before calling a trend, publish the rule, and hold to it even when a single week looks dramatic. That is what turns a market report from marketing into analysis.

### 2.7 New-listings seasonality benchmark

He benchmarks weekly new listings against a *normal-year seasonal peak*, not against last week. Nationally he wants **80,000 to 100,000 new listings** in peak weeks; in 2026 the national data cracked 80,000 only four times and never back to back.
https://www.housingwire.com/articles/is-housing-inventory-about-to-turn-negative-year-over-year/

The method to copy: establish a pre-2020 (2015 to 2019) seasonal baseline for local weekly new listings, and report every week as a percentage of that baseline. That is far more honest than YoY, which just compares to another abnormal year.

### 2.8 Rhetorical and epistemic habits worth copying

- **Names the mechanism, not just the number.** Every stat is followed by "which happens because…"
- **States falsifiable thresholds in advance.** Publishes the level at which he will change his mind.
- **Separates level from rate of change.** Inventory *up* and inventory *growth decelerating* are different facts and he never conflates them.
- **Refuses the crash narrative and the boom narrative equally.** His credibility comes from having been bearish on health and bullish on prices at the same time.
- **Uses "unhealthy" as a technical term about market function**, not a directional price call.

---

## 3. National indicators with a valid local MLS analogue

For each: the formula, the exact MLS/Supabase field logic, and the pitfalls. Our `listings` table conventions apply (`PropertyType='A'` for SFR, mixed-case columns quoted, and market aggregates should come from `market_stats_cache` / `market_pulse_live` rather than raw aggregation where a cached path exists).

### 3.1 Weekly active inventory
```
active_inventory(t) = COUNT(listings
                            WHERE StandardStatus = 'Active'
                              AND PropertyType = 'A'
                              AND geography = <target>
                              AND snapshot_date = t)
```
Cadence: weekly Friday snapshot, stored as a time series. This requires **storing snapshots**, not querying current state. A one-time query gives you today; a chart needs history.

**Pitfalls:**
- Do not include `Active Under Contract` / bumpable statuses in "active." Decide once, document it, never change it mid-series.
- Withdrawn-and-relisted properties double count if you measure flow instead of stock. Stock (a Friday count) is immune; flow is not.
- Seasonal homes in resort communities (Black Butte, Sunriver, Eagle Crest, Caldera Springs) get pulled off market in shoulder seasons. Report resort inventory separately from Bend/Redmond core or the seasonal artifact swamps the signal.

### 3.2 Weekly new listings
```
new_listings(week) = COUNT(listings WHERE ListingContractDate BETWEEN week_start AND week_end)
```
**Pitfalls:**
- **Relists are the killer.** A listing that expires and comes back with a new MLS number inflates new listings and, worse, resets DOM. Deduplicate on parcel/APN or normalized address plus a 90-day window, and report both raw and deduped.
- Use `ListingContractDate` (or `OnMarketDate` if your MLS populates it), not `ModificationTimestamp`.
- Compare to a 2015 to 2019 same-week baseline, per §2.7, not to last year.

### 3.3 Weekly new pendings (the demand series)
```
new_pendings(week) = COUNT(listings WHERE pending_timestamp BETWEEN week_start AND week_end)
```
Our schema has `pending_timestamp` as a lower-case column, so no quoting needed.

**Pitfalls:**
- Agents report pending late and inconsistently. There is a reporting lag of several days. **Always revise the last two weeks** and say so on the chart.
- Fall-throughs mean pendings overstate eventual closings by roughly 10% to 20% depending on the market. Compute your local fall-through rate (pendings that return to Active) and publish it. Almost nobody does; it is a genuinely useful number for sellers.
- Total pendings (stock) is contaminated by escrow length. Prefer new pendings (flow). Report both.

### 3.4 Closed sales
```
closed_sales(month) = COUNT(listings WHERE "CloseDate" BETWEEN period_start AND period_end)
```
**Pitfalls:**
- Closed sales are a 30 to 60 day lagging indicator. Never lead a report with them. They describe a rate environment that no longer exists.
- Data lands late; the most recent month is always undercounted for two to three weeks. Mark the trailing month "preliminary."

### 3.5 Days on market
```
median_DOM = MEDIAN("DaysOnMarket")   -- current listing only
median_CDOM = MEDIAN("CumulativeDaysOnMarket")  -- across relists
```
**Use CDOM for market analysis. Always.** DOM is gameable by withdrawing and relisting, and in a slow market the gap between DOM and CDOM widens precisely when the truth matters most. Publish both and let the gap itself be a stat.

**Pitfalls:**
- Median, never mean. One 900-day land listing destroys the mean.
- DOM on *closed* sales is survivorship-biased: it only counts homes that sold. In a soft market the homes sitting at 200 days are invisible. Pair it with a **median age of active inventory**:
```
median_active_age = MEDIAN(today − "ListingContractDate") over Active listings
```
That second number is the honest one and virtually no brokerage publishes it.

### 3.6 Price-cut percentage (Mohtashami's key series)
```
price_cut_pct(t) = COUNT(Active listings WHERE "ListPrice" < OriginalListPrice)
                   / COUNT(Active listings)
```
If original list price is not a stored column, derive it from `listing_history` price-change events.

**Pitfalls:**
- Denominator must be **active listings only**. Computing it over closed sales measures something different and much less predictive.
- Price *increases* exist and should be excluded from the numerator, not netted.
- New listings entering with no price history dilute the ratio. Report a second version restricted to listings on market 30+ days.
- Establish a local normal band the way Mohtashami established 30% to 35% nationally: take the 2015 to 2019 mean and standard deviation for the same calendar week.

Also compute **depth of cut**, which he does not publish and which is more useful locally:
```
median_cut_depth = MEDIAN((OriginalListPrice − "ListPrice") / OriginalListPrice)
                   over Active listings with ≥1 reduction
```

### 3.7 List-to-sale-price ratio (sale-to-list)
```
SP_LP_original = MEDIAN("ClosePrice" / OriginalListPrice)   -- the honest one
SP_LP_final    = MEDIAN("ClosePrice" / "ListPrice")         -- the flattering one
```
**Pitfalls:**
- Nearly every brokerage publishes the final-list version, which hides every price cut and reads near 99% even in a bad market. Publishing **both** and showing the spread is a differentiator and is more truthful.
- Median of ratios, not ratio of medians. These are not the same number.
- Exclude seller concessions or you overstate net price. If `ConcessionsAmount` is populated, publish a **concession-adjusted** close price:
```
effective_price = "ClosePrice" − concessions
```
In a buyer's market concessions are how prices fall without appearing to. That is a real and currently invisible phenomenon.

### 3.8 Months of supply
```
MoS = active_listings / (closed_last_6_months / 6)
```
Thresholds per Ryan Realty's own standing rule: **≤ 4 seller's market, 4 to 6 balanced, ≥ 6 buyer's market**. The verdict pill must match the computed number, always.

**Pitfalls:**
- MoS mixes a stock (today's actives) with a flow (trailing sales), so it lags badly at inflection points. It is the *last* metric to turn, not the first. Use it as a summary label, never as the lead signal.
- The 6-month trailing denominator embeds seasonality. A February MoS uses Aug to Jan sales; a July MoS uses Jan to Jun. Those are not comparable. Compare February to February.
- At neighborhood scale the denominator can be under 10 sales, which makes MoS meaningless. Set a minimum-sample rule (see §6).

### 3.9 Absorption rate
```
absorption_rate(month) = closed_sales(month) / active_listings(start_of_month)
```
Or the forward-looking version, which is better:
```
pending_absorption = new_pendings(last 4 weeks) / active_inventory(now)
```
The pending version turns weeks earlier than the closed version because it does not wait for escrow.

### 3.10 Seasonally adjusted comparison
Do not attempt X-13ARIMA on a county with 200 monthly sales. Use a **seasonal index** built from a stable pre-shock baseline:
```
seasonal_index(month m) = mean over 2015..2019 of [ value(m, y) / annual_mean(y) ]
SA_value(m, y) = value(m, y) / seasonal_index(m)
```
**Pitfalls:**
- Never include 2020 to 2022 in the baseline. Those years have a distorted seasonal shape and will corrupt the index permanently.
- Recompute the index annually and version it; note the version on every chart.
- Say plainly on the chart: "seasonally adjusted using a 2015 to 2019 index." Undisclosed adjustment is worse than no adjustment.
- For weekly data, prefer the direct **same-week-last-year** and **same-week-vs-2015-to-2019-average** comparisons over adjustment. Less machinery, fewer failure modes.

### 3.11 The local inventory-channel threshold (the Bend analogue to 1.52M)
This is the piece that makes the report ours rather than a national rehash. Method:

1. Build a monthly series of active SFR inventory for the target geography, 2015 to present.
2. Build the matching series of median price MoM change and of price-cut share.
3. Regress (or simply bin) price acceleration against the inventory level.
4. Find the inventory level below which median price MoM change turns reliably positive and price-cut share collapses. **That is the local forced-bidding line.**
5. Find the level above which price cuts exceed the local normal band. **That is the local buyer-leverage line.**

State both numbers publicly, in units of active listings, and update annually. Then every weekly report can say where current inventory sits relative to those two lines. That is exactly what Mohtashami does nationally, computed honestly for Central Oregon, and no competitor will have it.

---

## 4. National indicators with NO local analogue

These cannot come from the MLS. Source them properly or leave them out.

### 4.1 Mortgage rates
| Source | Series | Cadence | Access |
|---|---|---|---|
| Freddie Mac PMMS via FRED | **`MORTGAGE30US`** (30-yr), **`MORTGAGE15US`** (15-yr) | Weekly, Thursday | FRED API, free key at https://fred.stlouisfed.org/docs/api/api_key.html |
| Mortgage News Daily | Daily 30-yr fixed | Daily | https://www.mortgagenewsdaily.com/mortgage-rates — no public API, scrape or manual |

Freddie PMMS is a weekly survey average and lags the actual daily market by several days. For "rates today" use MND; for charts use FRED.

### 4.2 10-year Treasury and the spread
- **`DGS10`** — 10-Year Treasury Constant Maturity, daily, FRED.
- Mortgage spread is derived, not published:
```
spread = MORTGAGE30US − DGS10   (align to the same week)
```
Normal band 1.60% to 1.80%; 2023 peak ~3.10%. Charting this explains rate moves that the 10-year alone does not.

### 4.3 Purchase mortgage applications
- **MBA Weekly Applications Survey**, Purchase Index. Wednesdays 7am ET.
- https://www.mba.org/news-and-research/newsroom — headline WoW and YoY are free in the press release. The index history itself is a paid product and **not on FRED**.
- Practical approach: parse the weekly press release for the purchase-index WoW and YoY figures, store them, and build your own history going forward. Cite MBA and the release date every time.

### 4.4 Builder sentiment
- **NAHB/Wells Fargo Housing Market Index (HMI)**, monthly, mid-month. https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index
- Not on FRED (licensing). Headline value and the three components (present sales, next-six-months sales, traffic) are in the free monthly release. 50 is the neutral line.

### 4.5 Construction and new home sales (national)
All on FRED, all monthly, all Census Bureau:
- **`HOUST`** Housing Starts, **`HOUST1F`** single-family starts
- **`PERMIT`** Building Permits, **`PERMIT1`** single-family permits
- **`HSN1F`** New One-Family Houses Sold
- **`HNFSEPUSSA`** New Houses For Sale by Stage of Construction, Completed — this is the ~120,000 completed-units line from §2.5
- **`COMPUTSA`** Housing Completions

### 4.6 National resale benchmarks
- **`EXHOSLUSM495S`** Existing Home Sales (NAR), monthly
- **`HOSINVUSM495N`** Existing home months' supply / inventory (NAR)
- **`MSPUS`** Median Sales Price of Houses Sold, quarterly
- **`CSUSHPINSA`** / **`CSUSHPISA`** Case-Shiller US National Home Price Index, monthly, two-month lag
- **`ACTLISCOU`**, **`NEWLISCOU`**, **`MEDDAYONMAR`**, **`MEDLISPRI`**, **`PRIREDCOU`**, **`PENLISCOU`** — realtor.com national listing series on FRED, monthly

### 4.7 Central Oregon local, non-MLS
These are the ones that make a Bend report local rather than generic. **Bend-Redmond, OR CBSA code = 13460.** Realtor.com FRED series exist at the CBSA level with the code appended:

| Series ID | What it is | Cadence |
|---|---|---|
| `ACTLISCOU13460` | Active listing count, Bend-Redmond CBSA (verify exact ID on FRED before first use; the sibling series below are confirmed) | Monthly |
| `NEWLISCOU13460` | New listing count, Bend-Redmond — https://fred.stlouisfed.org/series/NEWLISCOU13460 | Monthly |
| `PENLISCOU13460` | Pending listing count, Bend-Redmond — https://fred.stlouisfed.org/series/PENLISCOU13460 | Monthly |
| `MEDDAYONMAR13460` | Median days on market, Bend-Redmond — https://fred.stlouisfed.org/series/MEDDAYONMAR13460 | Monthly |
| `MEDLISPRI13460` | Median listing price, Bend-Redmond — https://fred.stlouisfed.org/series/MEDLISPRI13460 | Monthly |
| `PRIREDCOU13460` | Price-reduced count, Bend-Redmond (verify) | Monthly |
| `BEND441UR` | Unemployment rate, Bend-Redmond MSA, seasonally adjusted — https://fred.stlouisfed.org/series/BEND441UR | Monthly |
| `BEND441URN` | Same, not seasonally adjusted | Monthly |
| `BEND441MFG` | Manufacturing employment, Bend MSA | Monthly |
| `BPPRIV041017` | New private housing units authorized by building permits, **Deschutes County** — https://fred.stlouisfed.org/series/BPPRIV041017 | Annual on FRED; monthly county data via Census BPS |

Additional local sources:
- **Census Building Permits Survey**, county and place monthly: https://www.census.gov/construction/bps/ — this gives Bend, Redmond, Sisters, Prineville, Madras permit counts monthly, which FRED's annual county series does not.
- **Oregon Employment Department**, Central Oregon regional economist publications: https://www.qualityinfo.org
- **Portland State University Population Research Center**, annual Oregon county and city population estimates: https://www.pdx.edu/population-research/ — the migration story behind Bend demand.
- **Deschutes County Community Development** permit portal for local construction activity.

These FRED series are a genuine cross-check on our own MLS numbers. If our computed Bend active count and `ACTLISCOU13460` diverge by more than a few percent, one of them is wrong and we need to know why before publishing. That reconciliation should be a pre-publish gate, structurally identical to the existing Spark × Supabase gate.

---

## 5. The standard chart set, in priority order

Priority order means: if the report only has three charts, it has the first three.

| # | Chart | Type | Series | Notes |
|---|---|---|---|---|
| 1 | **Weekly active inventory vs prior year vs 2015–2019 band** | Line, 3 series, with the pre-2020 range as a shaded band | Local actives | The single most important chart. The shaded historical band is what makes it honest. |
| 2 | **Weekly new pendings, current year vs prior year** | Line, 2 series | Local new pendings | The demand chart. Annotate the trailing 2 weeks as preliminary. |
| 3 | **Price-cut share of active listings, with the local normal band shaded** | Line with shaded band | Price-cut % | The leading price indicator. |
| 4 | **New listings vs the 2015–2019 seasonal baseline** | Bar (weekly) with baseline line overlay | New listings | Answers "is supply coming from sellers or from stalling?" |
| 5 | **Mortgage rate with the sensitivity bands shaded** | Line with horizontal band shading at 6.00 / 6.64 / 7.00 | `MORTGAGE30US` + MND daily | Puts every other chart in context. |
| 6 | **Median sold price, 3-month rolling, vs median list price of new listings** | Dual line | Local | The list-price series leads the sold series. Showing them together is the forecast. |
| 7 | **Months of supply with the 4 / 6 thresholds marked** | Line with two horizontal threshold lines | Local | Summary metric. Threshold lines force the verdict to match the number. |
| 8 | **Price distribution of sales, current vs prior year** | Overlapping histogram or violin | Closed sales by price band | This is the mix-shift control. See §6.2. It should be in every report. |
| 9 | **Sale-to-original-list vs sale-to-final-list** | Dual line | Local | The gap between the two lines is the price-cut story in dollars. |
| 10 | **Median CDOM vs median age of active inventory** | Dual line | Local | The survivorship-bias control. |
| 11 | **Sub-market small multiples** | Grid of sparklines, one per geography | Bend / Redmond / Sisters / La Pine / Sunriver / Prineville / Madras + resort communities | One shared y-axis where possible. Shows divergence at a glance. |
| 12 | **Deschutes County permits vs new-home closings** | Dual-axis line or paired bars | Census BPS + MLS new construction | The local construction-recession read. |
| 13 | **Absorption rate by price band** | Horizontal bar | Local | Directly answers "where is my price point?" for a seller. |
| 14 | **Inventory vs the local forced-bidding / buyer-leverage lines** | Line with two annotated horizontal thresholds | Local, per §3.11 | The signature chart. Nobody local has this. |

Charting conventions: tabular numerals everywhere, no dual y-axes unless the units genuinely differ, no truncated y-axis on any price chart, every chart carries its source and pull date, and every chart with an adjusted series says so in the subtitle.

---

## 6. Common analytical errors and the guardrail for each

This section is the license-risk section. Each guardrail is written so it can be implemented as a mechanical check rather than a good intention.

### 6.1 Year-over-year percentages on tiny samples
**The error:** "Sisters median price up 34% YoY" computed on 11 sales versus 9 sales.

**Guardrail:** Set a **minimum sample of 30 closed sales** for any median or percentage-change claim. Between 10 and 29, publish the count and a range, never a percentage. Under 10, publish the raw transactions or nothing. Encode as a hard check: if `n < 30`, the percentage-change field is suppressed and replaced by the count. Additionally, publish a bootstrap confidence interval on any median derived from fewer than 100 sales, and never let a headline claim rest on a change smaller than that interval.

### 6.2 Median-mix shift misread as price change
**The error:** median price rises because more luxury Awbrey Butte and resort homes sold this month, not because any home appreciated. This is the most common serious error in local reporting and it is the one most likely to mislead a client into a bad pricing decision.

**Guardrail:** Never report median price change without a mix control. Report at least one of:
- **Median price per square foot** alongside median price. If the two diverge, mix moved, not value.
```
median_ppsf = MEDIAN("ClosePrice" / "TotalLivingAreaSqFt")
```
- **Price distribution overlay** (chart #8) so the reader sees the mix shift directly.
- **Repeat-sales or paired-sales index** where sample allows: match properties sold twice and compute the median of the per-property annualized change. This is the Case-Shiller method and it is mix-immune.
- **Constant-mix median**: reweight this period's sales to last period's price-band distribution.

Encode as a rule: any sentence containing a median-price change must be adjacent to a ppsf figure or a mix statement.

### 6.3 Seasonality confusion
**The error:** "Inventory fell 22% from September to December, the market is tightening." Inventory falls every fall in Central Oregon. That is a calendar fact, not a market fact.

**Guardrail:** **Ban month-over-month comparisons in narrative entirely.** Every comparison is either same-month-last-year, same-week-last-year, or against a 2015 to 2019 seasonal baseline. If a MoM number appears in a chart, it must carry the prior-year MoM alongside it so the reader sees whether this year's seasonal move is normal. Encode as a grep-level check on report copy for the phrases "from last month," "since last month," "month over month."

### 6.4 Cherry-picked windows
**The error:** choosing the start date that makes the trend line say what the narrative wanted.

**Guardrail:** Fix the windows in advance and publish them as policy. Standard windows for every report, every time:
- Weekly series: trailing 52 weeks plus the same 52 weeks prior year plus the 2015 to 2019 band.
- Monthly series: trailing 36 months minimum on every chart.
- Any long-run price chart: back to 2015 minimum, so 2020 to 2022 is visible in context rather than as the baseline.
The window is never chosen per report. If a chart needs a different window, the reason is printed on the chart.

### 6.5 Peak-of-2022 anchoring
**The error:** "down 12% from peak," where peak is the single most distorted month in Central Oregon history.

**Guardrail:** Any "from peak" claim must be accompanied by the "vs 2019" and "vs 5-year CAGR" figures. Never publish a from-peak number alone.

### 6.6 Confusing level with rate of change
**The error:** "inventory growth slowed to 8%" reported as "inventory is falling."

**Guardrail:** Every inventory statement names both the level and the direction, in that order, in units: "1,240 active listings, up 8% from a year ago, and the growth rate has slowed from 19% in March." Encode: any percentage-change claim about inventory must be adjacent to an absolute count.

### 6.7 Mean where median belongs, and median where mean belongs
**Guardrail:** Median for price, DOM, and ppsf, always. Mean is acceptable only for aggregate volume. State which was used on the chart. Never mix the two within a comparison.

### 6.8 Ratio of medians instead of median of ratios
**The error:** computing sale-to-list as `median(ClosePrice) / median(ListPrice)`.

**Guardrail:** Compute per-property ratios first, then take the median. Same for price per square foot.

### 6.9 Survivorship bias in DOM
**The error:** DOM computed on closed sales only, which excludes every home that failed to sell. In a softening market this makes DOM look better exactly as the market deteriorates.

**Guardrail:** Always publish median age of active inventory next to median CDOM of closed sales. Also publish the **withdrawal/expiration rate**:
```
fail_rate = COUNT(Expired + Withdrawn + Canceled in period)
            / COUNT(Expired + Withdrawn + Canceled + Closed in period)
```

### 6.10 Concessions hiding price decline
**Guardrail:** Report a concession-adjusted effective close price whenever the concessions field is populated on more than 10% of sales, plus the share of sales with concessions and the median concession amount.

### 6.11 Preliminary data reported as final
**Guardrail:** The most recent month of closed data and the most recent two weeks of pending data are always marked preliminary and always revised in the next report. Publish the revision. Silently changing a prior number is worse than the original error.

### 6.12 Property-type contamination
**The error:** mixing SFR, condo, land, and manufactured homes. Bend land and manufactured-home data behaves completely differently and will corrupt every aggregate.

**Guardrail:** Every figure carries its property-type filter in the verification trace. Default is SFR only (`PropertyType='A'`). Any deviation is stated on the chart.

### 6.13 Boundary drift between periods
**The error:** neighborhood or subdivision definitions changing between reports, so YoY compares different geographies.

**Guardrail:** Geography definitions are versioned and frozen. Any change to a boundary triggers a full restatement of the historical series, and the restatement is disclosed.

### 6.14 Verdict-narrative mismatch
**Guardrail:** The market-classification verdict is computed from the number, never written by hand. If MoS is 4.3, the label is "balanced," and no sentence in the report may contradict it. This is already Ryan Realty policy and should be a mechanical check on the rendered report.

### 6.15 The overarching guardrail
Every figure in every report carries a one-line verification trace: source, table, filter, date window, row count, computed value. No trace, no publish. This already exists as Ryan Realty policy; the market report should be the surface where it is most rigorously enforced, because a market report has the highest ratio of numbers to words of anything the brokerage produces.

---

## 7. What a comprehensive market report should include that almost no brokerage does

Ranked by differentiation value.

1. **A published methodology page with versioned definitions.** Every formula, every filter, every threshold, the seasonal index version, the minimum-sample rule. Linked from every report. This alone puts the report in a different category, and it is the strongest defense of Matt's license: the method is auditable.

2. **A falsifiable forecast with a stated trigger.** "If active inventory closes the year above X, we expect price cuts to exceed Y% and median ppsf to be flat to down." Then score it publicly next quarter. Mohtashami's credibility comes entirely from doing this. It is the highest-trust act available to a brokerage and essentially nobody attempts it.

3. **A scorecard of the prior report's calls.** Right, wrong, and why. Publishing your own misses is the single most persuasive thing a market analyst can do.

4. **The local forced-bidding and buyer-leverage inventory thresholds** (§3.11), stated in active-listing counts, updated annually.

5. **The listing-failure rate.** What share of listings expire, withdraw, or cancel without selling, by price band and by sub-market. Sellers desperately need this number and it is never published because it is unflattering to the industry.

6. **Concession-adjusted pricing.** Share of sales with concessions, median concession, and the effective price. This is where price declines hide.

7. **Original-list-to-sale ratio alongside final-list-to-sale.** The spread between them, charted.

8. **Median age of active inventory**, next to closed-sale DOM. The survivorship control.

9. **Price-cut depth, not just price-cut share.** How far sellers are actually moving.

10. **Fall-through rate.** Pendings that return to active, by month. Directly relevant to any seller evaluating an offer.

11. **Weekly cadence.** Monthly reports are structurally 45 days stale. A weekly pendings and inventory read is the format's real competitive edge, and it is exactly what the HousingWire Tracker proved works.

12. **Sub-market divergence made explicit.** Bend, Redmond, Sisters, La Pine, Prineville, Madras, and the resort communities are separate markets. A single "Central Oregon median" is close to meaningless. Small-multiple sparklines plus an explicit divergence callout.

13. **The rate-sensitivity divergence analysis.** Does Central Oregon demand respond to the national rate bands the way the nation does? Given the second-home and cash-buyer share, probably less. Quantifying that is a real finding, defensible and unique.

14. **New-construction versus resale competition.** Deschutes County permits and builder standing inventory versus resale actives. Resale sellers compete with builder incentives and almost no resale market report acknowledges it.

15. **The migration and employment driver.** PSU population estimates and Bend MSA employment as the demand fundamental underneath the rate story.

16. **Explicit uncertainty.** Confidence intervals on medians from small samples, and a stated "we do not know" where the data will not support a claim. The willingness to say a number is not reliable is the thing that makes every other number believable.

17. **Downloadable underlying data.** A CSV behind every chart. It signals that the numbers survive inspection.

---

### Implementation note

The two highest-leverage structural changes, both of which are prerequisites for most of the above:

1. **Start storing weekly Friday snapshots of active inventory, new listings, new pendings, and price-cut share, per geography, today.** None of the weekly charts can be built retroactively. Every week that passes without snapshotting is a permanent hole in the series.
2. **Build the 2015 to 2019 seasonal baselines once**, version them, and store them. They are the reference frame for everything else, and they must exclude 2020 to 2022.

**Sources:**
- [HousingWire Housing Market Tracker](https://www.housingwire.com/housing-market-tracker/)
- [Housing market update: Inventory builds as price cuts persist](https://www.housingwire.com/articles/housing-market-inventory-price-cuts-spring-2026/)
- [Housing inventory just turned negative year over year](https://www.housingwire.com/articles/housing-inventory-just-turned-negative-year-over-year/)
- [Logan Mohtashami on why this is a savagely unhealthy housing market](https://www.housingwire.com/articles/logan-mohtashami-on-why-this-is-a-savagely-unhealthy-housing-market/)
- [The savagely unhealthy housing market is now a nightmare](https://www.housingwire.com/articles/the-savagely-unhealthy-housing-market-is-now-a-nightmare/)
- [Logan Mohtashami's 2026 housing forecast](https://www.housingwire.com/articles/logan-mohtashamis-2026-housing-forecast/)
- [The 2022 housing market forecast from Logan Mohtashami](https://www.housingwire.com/articles/logan-mohtashami-the-2022-housing-forecast/)
- [The impact of lower mortgage rates on housing inventory](https://www.housingwire.com/articles/housing-inventory-growth-2026/)
- [Can the housing market weather Iran conflict 2.0 and higher rates?](https://www.housingwire.com/articles/iran-conflict-664-mortgage-rates/)
- [Mortgage demand resilient in the first half of 2026](https://www.housingwire.com/articles/mortgage-demand-holds-2026/)
- [How is housing demand holding up? Logan Mohtashami answers](https://www.housingwire.com/articles/how-is-housing-demand-holding-up-logan-mohtashami-answers/)
- [New home sales make it clear: Housing is in a recession](https://www.housingwire.com/articles/new-home-sales-make-it-clear-housing-is-in-a-recession/)
- [New-home sales show why permits are falling](https://www.housingwire.com/articles/new-home-sales-show-why-permits-are-falling/)
- [Is housing inventory about to turn negative year over year?](https://www.housingwire.com/articles/is-housing-inventory-about-to-turn-negative-year-over-year/)
- [Altos Research: Straight Talk on the Housing Market](https://blog.altosresearch.com/housingwires-logan-mohtashami-straight-talk-on-the-housing-market)
- [FRED: New Listing Count, Bend-Redmond OR CBSA](https://fred.stlouisfed.org/series/NEWLISCOU13460)
- [FRED: Pending Listing Count, Bend-Redmond OR CBSA](https://fred.stlouisfed.org/series/PENLISCOU13460)
- [FRED: Median Days on Market, Bend-Redmond OR CBSA](https://fred.stlouisfed.org/series/MEDDAYONMAR13460)
- [FRED: Median Listing Price, Bend-Redmond OR CBSA](https://fred.stlouisfed.org/series/MEDLISPRI13460)
- [FRED: Unemployment Rate, Bend-Redmond OR MSA](https://fred.stlouisfed.org/series/BEND441UR)
- [FRED: Building Permits, Deschutes County OR](https://fred.stlouisfed.org/series/BPPRIV041017)
- [FRED API documentation](https://fred.stlouisfed.org/docs/api/fred/)
- [MBA Weekly Applications Survey](https://www.mba.org/news-and-research/newsroom)
- [NAHB/Wells Fargo Housing Market Index](https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index)
- [Census Building Permits Survey](https://www.census.gov/construction/bps/)
- [PSU Population Research Center](https://www.pdx.edu/population-research/)