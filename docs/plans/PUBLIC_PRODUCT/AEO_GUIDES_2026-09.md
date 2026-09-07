# Buyer + seller AEO guide pack, 2026-09-07

Source brief: `~/Downloads/bend-buyer-seller-aeo-brief-pack-2026-09-07.md` (Cos, 15 ranked
page briefs). Site audit the same day: `~/Downloads/2026-09-07.md`. Both closed in one ship
class on `wt/aeo-briefs-audit-20260907`.

Publish path: `public.blog_posts` (rows upserted 2026-09-07 18:45 UTC), mirrored in
`scripts/blog-content/aeo-guides-2026-09.ts` so a reseed is a no-op. Six slugs already existed
and were rewritten in place; their old seed entries were removed from the sibling files so each
slug lives in one seed file. Author byline: Matt (`2fda6811-2edf-49e3-b3ca-33e1052f82e6`).

## Brief to slug

| # | Brief | Slug | Was |
|---|---|---|---|
| 1 | Cost of living | `cost-of-living-bend-oregon` | draft, unverified July figures |
| 2 | Best neighborhoods for buyers | `best-neighborhoods-bend-buyers` | new |
| 3 | Bend vs Redmond vs Sisters | `bend-vs-redmond-vs-sisters` | new |
| 4 | How to sell | `how-to-sell-your-home-bend` | published, unsourced cost figures |
| 5 | Cost to sell | `cost-to-sell-house-bend-oregon` | new |
| 6 | First-time buyer | `first-time-home-buyer-guide-central-oregon` | published |
| 7 | Buyer closing costs | `understanding-closing-costs-oregon` | draft |
| 8 | Westside vs eastside | `westside-vs-eastside-bend` | new |
| 9 | Good time to buy | `is-now-a-good-time-to-buy-in-bend` | new |
| 10 | How to price | `how-to-price-your-bend-home` | new |
| 11 | Property taxes | `property-taxes-deschutes-county` | draft |
| 12 | Moving from California | `moving-to-bend-from-california` | new |
| 13 | Buyer's agent | `buyers-agent-bend-buyer-broker-agreement` | new |
| 14 | New construction | `new-construction-guide-central-oregon` | published, false warranty claim + unsourced $/sqft |
| 15 | Selling from out of state | `selling-your-bend-home-from-out-of-state` | new |

## Conventions

- Every guide ends with `<h2>Questions</h2>` and five `<h3>question</h3><p>answer</p>` pairs.
  `lib/blog/publish-blog-faq.ts` reads exactly that markup into FAQPage JSON-LD on
  `app/blog/[slug]`, so the schema cannot say what the page does not.
- Market figures carry their as-of date and source in the sentence (Matt 2026-09-07: restore
  the numbers, dated) and link to `/housing-market/<city>`, `/months-of-supply`, or the July
  2026 buyers-market report for the live version. A refresh means re-pulling the row and
  changing the date, never editing the number alone.
- Voice: `lib/voice/check.ts` ran on every row before upsert (title, excerpt, meta, body).
  No dashes, semicolons, exclamation marks, virtue words, or invented quotes.
- Hero images reuse existing `/images/blog/*.jpg` files (local paths pass through
  `resolveBlogHeroImage`).

## Figure ledger (§0)

Every number that appears in a guide body, with the primary source fetched 2026-09-07. Raw HTML
saved in the session scratchpad (`verify/`, `verify2/`).

| Figure | Guides | Source |
|---|---|---|
| Oregon has no state real estate transfer tax; Washington County $1 per $1,000 is the exception | 1, 5, 7, 12 | ORS 306.815; washingtoncountyor.gov transfer tax page |
| Measure 50 caps maximum assessed value growth at 3% per year; tax is on assessed value | 1, 6, 11, 12 | oregon.gov/dor MAV manual 303-438 |
| Statements by Oct 25; pay by Nov 15 for 3%, two-thirds for 2%; thirds Nov 15 / Feb 15 / May 15; 2026 due date Mon Nov 16 | 11 | oregon.gov/dor pub 310-665; deschutes.org tax collection page |
| PVAB petition due Dec 31 or next business day | 11 | oregon.gov/dor appeals page |
| Deschutes Assessor 541-388-6508, 1300 NW Wall St, 2nd floor | 11 | deschutes.org/assessor |
| Recording fee $102 first page, $5 each additional, effective 2026-07-01 | 7 | deschutes.org/clerk recording page |
| Closing Disclosure at least three business days before consummation; lender fees zero tolerance; 10% cumulative tolerance class | 7 | consumerfinance.gov TRID guide |
| NAR practice changes effective 2024-08-17: no compensation offers on MLS; written buyer agreement before touring | 5, 6, 13, 14 | nar.realtor/the-facts |
| Oregon HB 4058 (2024): written buyer representation agreement before, or as soon as possible after, assisting a buyer | 13 | oregon.gov/rea 2024 law and rule overview |
| OREF 050 Buyers Representation Agreement | 13 | orefonline.com |
| FHA UFMIP 1.75%; annual MIP 0.55% for 30-year, under 5% down, loan at or under base limit | 7 | HUD mortgagee letter 2023-05 |
| VA funding fee 2.15% / 3.3% / 1.5% / 1.25%; disability compensation exemption | 7 | news.va.gov funding fee page |
| Senior and disabled deferral: 62+, income under $70,000 for 2026-27, five full years, 6% interest, lien | 11 | oregon.gov/dor deferral guide 490-015-1 |
| Disabled veteran exemption $27,092 or $32,512 for 2026, rises 3% a year, file by April 1 | 11 | oregon.gov/dor pub 310-676 |
| Oregon 2026 income tax rates 4.75 / 6.75 / 8.75 / 9.9%; 9.9% from $125,000 single, $250,000 joint | 1 | oregon.gov/dor pub 101-026 (2026) |
| No general sales tax | 1, 12 | oregon.gov/dor sales tax page |
| Property tax year July 1 to June 30 | 5, 7, 11 | oregon.gov/dor pub 303-619 |
| DIAL lookup at dial.deschutes.org | 1, 11 | dial.deschutes.org |
| OHCS Oregon Bond Residential Loan Program; First-Time Home Buyer Savings Account subtraction | 6 | oregon.gov/ohcs FAQ; oregon.gov/dor first-time home buyer page |
| Title insurance rates filed with DCBS before use | 5, 7 | ORS 737.205, 737.320 |
| Remote online notarization permitted for Oregon notaries | 15 | sos.oregon.gov RON page |
| Cascades East Transit fixed routes in Bend | 1, 8 | cascadeseasttransit.com Bend routes |
| ORS 701.320: contractor must make a written offer of a warranty on a new residential structure; no statutory term | 14 | ORS 701.320; ORS 12.135; ORS 701.560 |
| 13 Bend districts | 2, 8 | `lib/neighborhood-areas.ts` BEND_DISTRICTS |
| Bend to Redmond 17.1 mi / 26 min; Bend to Sisters 22.1 mi / 33 min; Bend to Mt. Bachelor 20.9 mi / 38 min, downtown to downtown | 1, 3, 6 | OSRM driving route, 2026-09-07 |
| Earnest money 1 to 3 percent typical in the Bend area | 6 | `/buy` FAQ (site canon) |
| 3% listing plan contents; weekly written report; remote-owner care | 4, 5, 10, 15 | `/sell` constants and `/faq` data (site canon) |
| Seller credits common in Bend; concentrated at the entry level; Redmond share above Bend, H1 2026 | 9, 10 | `bend-buyers-market-shift-2026` (Ryan Realty MLS analysis, July 2026) |
| Months of supply thresholds 4 / 6 | 9 | CLAUDE.md §0, `/months-of-supply` |
| Sisters rodeo (June), quilt show (July), folk festival | 3 | sistersrodeo.com, soqs.org, sistersfolkfestival.org |
| Bend 90-day median sale $733,000 (475 closings), Redmond $499,000 (143), June 9 to Sept 7, 2026 | 1, 11 | `market_stats_cache` city rows, period_type rolling_90d, methodology v3-2026-05-07, read 2026-09-07 |
| 30-year fixed 6.71%, week of Sept 3, 2026 | 1 | freddiemac.com/pmms |
| Payment math: 20% down, 6.71%, 360 months: Bend P&I $3,788 + tax $426 = $4,214; Redmond $2,579 + $290 = $2,869 | 1 | computed from the two rows above, shown in the ledger script output 2026-09-07 |
| City of Bend water $29.79 + $2.48 per 100 cu ft; sewer $42.71 + $4.48, effective 2025-07-01 | 1 | bendoregon.gov water services rates page |
| AAA gas OR $5.02, US $4.15 on 2026-09-07 | 1 | gasprices.aaa.com/?state=OR |
| 2026 marketplace silver premiums, 40-year-old, $518 to $620; 9.7% average increase; 5 of 6 carriers in Deschutes | 1 | dfr.oregon.gov 2026 rate decision + county coverage PDF |
| Bend median household income $96,394, ACS 2020-2024 | 1 | census.gov QuickFacts, Bend city |
| Mt. Bachelor 2026-27 adult full season pass $1,399 on 2026-09-07, increase scheduled 9/30 | 1 | mtbachelor.com full season pass page |
| Deschutes FY 2025-26 average consolidated rate $16.80 per $1,000 AV; effective $6.98 per $1,000 M5 value (about 0.698% of RMV) | 1, 11 | oregon.gov/dor Oregon Property Tax Statistics FY 2025-26, exhibit 6b |
| Active-duty exemption $60,000 in 2005-06 growing 3% a year, ORS 307.286 | 11 | oregon.gov/dor form 150-303-084; OAR 150-307-0400 |
| VA appraisal fee, Oregon single-family, $850 effective 2026-05-01 | 7 | benefits.va.gov appraisal fee and timeliness table |

Restored 2026-09-07 on Matt's call, each with its as-of date in the text: the rate, gas, City of
Bend utility rates, marketplace premiums, ACS income, the Bachelor pass, the county rates, the
active-duty formula, and the VA appraisal fee. Still cut, no primary source found: the Bachelor
peak day-ticket price, Crook and Jefferson rates and assessors, sample title premiums, and every
$/sqft, lot price, SDC, and build-cost range in the old new-construction post.

## Site audit fixes shipped with this pack

- Listing photo `alt` from address and city (`components/site/v3/listing-photo-alt.ts`), held by
  `ci:listing-photo-alt`.
- `/homes-for-sale` root: explicit robots, `og:type`, `og:site_name`, and WebPage + ItemList
  JSON-LD (`app/search/SearchRootJsonLd.tsx`), held by `ci:ai-structured-data`.
- Mobile menu group labels are `<p>`, not `<h2>`, so the page H1 is the first heading.
- `/buy` FAQ no longer says the seller offers buyer-agent compensation in the MLS.
- Not changed: the homepage `<title>` stays `Ryan Realty, Bend` (VOICE.md SEO split, pinned by
  `ci:seo-shell`). The audit suggested a keyword title. That is Matt's call.

## Backlog triage, 2026-09-07 (Matt: grind both)

Twenty-nine posts sat at `archived_stats_unverified` (28) or `pending_pilot_review` (1).
Five triage passes read every figure in each. Verdicts:

**Retired (status `retired`, 10).** Dated news or superseded snapshots, no evergreen home:
`bend-20-year-growth-plan-34000-homes`, `bend-affordable-housing-goal-1000-units`,
`caldera-ranch-ugb-expansion-716-homes`, `caraway-development-510-homes-northwest-bend`,
`habitat-pahlisch-affordable-townhomes-bend`, `homelessness-central-oregon-2025-count`,
`central-oregon-housing-market-2025-review`, `central-oregon-housing-market-spring-2026`,
`deschutes-county-market-report-q1-2026` (its narrative called 4.65 and 4.69 months a seller's
band against its own 4-to-6 balanced definition), `mortgage-rates-2026-outlook` (forecast with
no named basis).

**Merged (4).** `case-for-buying-now-vs-waiting` and `inventory-trends-rising-supply-central-oregon`
fold into `is-now-a-good-time-to-buy-in-bend` (refinance argument and its limits, rising
inventory as leverage). `bend-sdc-overhaul-housing-costs` and
`construction-costs-central-oregon-300-sqft` folded into `new-construction-guide-central-oregon`
(SDC section from the city's adopted schedule via Wayback: water $7,181, sewer $5,890,
transportation $9,426, $22,497 average single-unit, parks set separately). Sources retired.

**Restore on fresh sources (15).** `bend-new-growth-plan-housing-20-years`,
`caldera-ranch-update-bend-newest-development`, `deschutes-county-wildfire-building-codes`,
`home-renovations-add-value-central-oregon`, `building-equity-shifting-market`,
`buying-vs-renting-bend-analysis`, `central-oregon-real-estate-investment`,
`fed-rate-decisions-mortgage-rates`, `how-to-choose-the-right-mortgage`,
`insurance-guide-central-oregon-homeowners`, `interest-rate-changes-home-affordability`,
`national-economic-policy-central-oregon`, `rate-lock-effect-housing-supply`,
`second-home-vs-investment-property`, `treasury-yields-central-oregon-buyers`. The three
rate-mechanism posts overlap (same spread claim, conflicting 80% vs 82% figure) and consolidate
into one explainer plus one payment-math guide.

Published-post voice fixes: 18 semicolon sentences across 10 posts, applied to the live rows
and mirrored to the seeds where the seed still matched (`dining-craft-beer-bend` seed had
already diverged).

Annual price history used in the restores: median of the twelve monthly `market_stats_cache`
medians per city, `period_type = monthly`, methodology v3-2026-05-07, read 2026-09-07. Bend
2017 $397,800 to 2025 $747,500. Redmond $279,200 to $525,000. Sisters $380,755 to $705,000.
Prineville $199,900 to $415,000. La Pine has no city cache rows.

## Market page price answer and chrome scope (2026-09-07, from the AI answer-share baseline)

A sibling session measured which Bend real estate pages answer engines cite (report:
https://claude.ai/code/artifact/8080b7fa-4cda-4bd8-9768-ad46f45b38c2). The one
non-personalized citation of ryan-realty.com quoted the `/housing-market/bend` FAQ JSON-LD,
"$950,000 median list price", which reads as an outlier beside peers' sale medians. Two fixes
shipped here:

- The sibling session shipped both fixes on `fix/bend-market-figure-truth` (commit `9cc176cc`),
  covering `/housing-market/<city>` and `/cities/<slug>`: the price FAQ leads with the median
  sale price and month from the page's own chart series, then names the list price as a list
  price, and Dataset JSON-LD gains Median Sale Price. The Market and Sell menus now say
  "Central Oregon detached homes right now" and "Central Oregon sellers right now". This
  branch had the same change and dropped it to avoid two versions of one fix. For any guide,
  a city's "median home price" is the sale price and month, matching the FAQ.

Open, from the same report: no engine cited any F1 battery path for its query (the gate proves
the paths exist, not that they are used); the ranking mechanism the engines use for "best
broker" is review count (Ryan Realty 25 Google, 6 Zillow, against 100 to 483 for the
brokerages that win); and the page pattern that did get Ryan Realty recommended on
Perplexity was a dated local report plus seller guidance naming the broker. Suggested next
pages: a dated monthly Bend and Redmond report with median sale price and months of supply
stated once, and third-party profiles completed for all three brokers. The sibling session
reruns the battery monthly.

## Hero stills attempt (2026-09-07)

Matt chose Studio stills for the nine new guides. Through `buildStillPrompt` and the
`inspectFrame` gate at the 85 bar, 16 candidates across two subjects (a Deschutes riverbank
with houses, an aerial of a west-side neighborhood) scored 71 to 78, every one failed on
`warped_architecture`, and the run was stopped at $7.80 of stills. Landscape-only frames
were not tried for every guide. The guides keep the existing library photos until a
subject without buildings is tried or the bar is revisited. Contact sheet in the session
scratchpad (`thumbs/stills-all.png`).

## Restores published 2026-09-07

Thirteen of the fifteen RESTORE verdicts shipped the same day. `caldera-ranch-update-bend-newest-development`
folded into the growth-plan guide (its unit counts never appeared on the city's own page) and
`treasury-yields-central-oregon-buyers` folded into the rate explainer. Both retired with redirects.
Seed mirror: `scripts/blog-content/restored-guides-2026-09.ts`.

| Slug | Sources (all fetched 2026-09-07) |
|---|---|
| `interest-rate-changes-home-affordability` | Bend and Redmond 90-day medians (stats cache), Freddie Mac PMMS 2026-09-03, DOR FY 2025-26 effective rate, ACS 2020-2024 income, amortization formula |
| `building-equity-shifting-market` | Yearly median-of-monthly medians 2017 to 2025 for four cities (stats cache), PMMS, amortization |
| `buying-vs-renting-bend-analysis` | HUD FY2026 FMR, Bend-Redmond metro (FY26_FMRs.xlsx: 1BR $1,371, 2BR $1,784, 3BR $2,481), stats cache median, PMMS, DOR rate |
| `fed-rate-decisions-mortgage-rates` | FOMC 2026-07-29 statement and openmarket.htm (3.50 to 3.75%, six cuts, 175 bps), FRED DGS10 (4.77% on 9/3, 90-day 4.60%, 2023 peak 4.98%), PMMS history CSV (2023 6.81%, 2024 6.72%, 2025 6.60%, 2023 peak 7.79%, 2019 4.51% to 3.74%, 2007-08 6.46% to 5.53%), computed spread 194 bps now, 189 bps average since 2000 |
| `rate-lock-effect-housing-supply` | FHFA NMDB 2026 Q1 national (19.5% under 3%, 49.9% under 4%, 66.7% under 5%, 77.9% under 6%), Bend average end-of-month active inventory by year (stats cache), PMMS |
| `deschutes-county-wildfire-building-codes` | deschutes.org R327 page (effective 2026-04-01), bendoregon.gov ordinance article via Wayback (adopted 2026-04-15, effective 2026-05-15), ORS 476.392, OSFM defensible space page and 2025 model code, dfr.oregon.gov wildfire page (SB 82, SB 83, claims tracker 2026-09-01), orfairplan.com ($600,000), OSFM Flat Fire update 2025-08-31 (23,346 acres) |
| `insurance-guide-central-oregon-homeowners` | Same DFR, FAIR Plan, and R327 sources; Deschutes FIS 2007-09-28 via Sisters development code |
| `home-renovations-add-value-central-oregon` | NAR 2025 Remodeling Impact Report PDF (cost recovery, twelve projects), NOAA NCEI 1991-2020 normals, station USC00350699 (9.11 in, July 82.1/49.2, January 41.6/24.4) |
| `bend-new-growth-plan-housing-20-years` | OEA OHNA 2026 results report (34,116 twenty-year, 2,010 one-year), bendoregon.gov growth page via Wayback (17,234 by 2028), Census BPS 2025 (Bend 646, Deschutes 1,166 single-family units), PSU certified 2025 population 107,079, bendoregon.gov Caldera Ranch page via Wayback 2026-04-18 |
| `how-to-choose-the-right-mortgage` | FHFA 2026 county file ($832,750), HUD CHUMS 2026 limits ($718,750), HUD 4000.1 (3.5% at 580, 10% at 500 to 579), HUD ML 2023-05 MIP, VA funding fee, VA appraisal fee table 2026-05-01, USDA eligibility tool 2026-09-07 ($138,200 / $182,450), USDA FY2026 fee bulletin (1.00% / 0.35%), CFPB PMI page (80% / 78%), Fannie Mae SEL-2025-09 (no DU minimum score from 2025-11-16), PMMS history |
| `second-home-vs-investment-property` | 26 USC 280A, 469, 168, 1031, Rev. Proc. 2008-16, IRS 2026 SALT correction notice ($40,400, phase-down above $505,000), IRS 2026 inflation release ($32,200 / $16,100), Pub 936 and H.R.1 sec. 70108 ($750,000 permanent), ORS 90.323 and OEA 2026 cap (9.5%) |
| `central-oregon-real-estate-investment` | Stats cache yearly medians, PSU population, Census BPS, OHNA target, HUD FMR, PMMS, DOR rate, ORS 90.323, FAIR Plan |
| `national-economic-policy-central-oregon` | FOMC, PMMS, FRED, IRS 2026 figures, H.R.1, DOR 2026 brackets, FHFA and HUD 2026 limits, USDA cap, Census BPS |

Cut from every restore because no primary source carried them: Fannie Mae's exact 5% standard
down-payment cell (matrix not readable by automation), lender rate spreads for second homes and
rentals, insurance premium ranges and Firewise discount percentages, contractor cost ranges,
short-term rental revenue, the Flat Fire structure count, Caldera Ranch unit counts, Bend
housing-unit count, and NFIP average premium (FEMA and Census pages are WAF-blocked).

Premise corrections found on the way: ORS 477.060 was repealed in 2021 (defensible space now
lives at ORS 476.392); the OSFM model code is a local-option template after SB 83, not an OAR;
the NAR 2025 report has no cost-recovery figure for roofing, flooring, or outdoor projects; the
Oregon FAIR Plan is at orfairplan.com; Fannie Mae dropped its 620 floor for DU loans on
2025-11-16.
