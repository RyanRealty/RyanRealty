# Place content rules — what a subdivision or community page may say

Companion to `REGISTRY.md`. The registry governs the **metric layer** — medians, verdicts,
months of supply. This file governs the **listing-derived content** that fills a place page when
the metric layer refuses it, which at subdivision grain is almost everything.

Every rule below was measured against live data on 2026-08-25, and every one of them exists
because the naive version ships a wrong number onto thousands of pages. The counts are the
point: this is not style guidance.

---

## Why this file exists

Subdivision is the largest surface on the site — **1,595 slugs publish a metric, 3,029 carry
membership** — and the registry permanently withholds price, months of supply and verdict at
that grain. So a subdivision page is built almost entirely from listing-derived facts, which
have none of the metric layer's guardrails. Four traps were found by measuring; each would have
been invisible in review.

---

## R1 — Year-built range: percentiles, never min–max

**Rule.** Publish the **10th to 90th percentile** of `year_built`, over rows where the value is
between 1850 and 2030. Never `min`–`max`.

**Why, measured.** Across the 2,422 subdivisions with at least 10 year-built values:

| | min–max | p10–p90 |
|---|---:|---:|
| Average span | 23 years | **12 years** |
| Spans over 60 years | 214 | **71** |

**151** subdivisions contain a row claiming a pre-1940 home. On **61** of them the tenth
percentile is 1960 or later — meaning a single bad row would have printed "built 1911–2025" on a
subdivision that is materially all post-1960 construction. Deschutes River Woods reads
"1920–2026" on min–max; its typical home is 1993.

**Also required.** State the sample: "based on N homes with a recorded build year." A range with
no denominator is not a fact.

---

## R2 — HOA dues: segment-scoped, never across property types

**Rule.** Compute median dues **within one property type**, and label the type. Never median
`hoa_monthly` across a whole subdivision.

**Why, measured.** Of 1,288 subdivisions carrying at least five dues figures, **840 are
mixed-type**. Computing across all types instead of detached alone:

- **172** land more than $25/month away from the detached figure
- **50** print more than **double** the real detached number
- worst observed all-types median: **$1,852/month**, from condos inside a detached plat
- average distortion: $19/month

A dues figure is one of the most decision-relevant numbers a buyer reads. Being 2× wrong on 50
pages is not a rounding problem.

**Minimum sample.** Five reported figures within the segment, or the figure is withheld.

---

## R3 — HOA presence: report what was counted, never assert absence

**Rule.** Publish as a count of what listings reported:
*"9 of the 12 listings here that reported it have an HOA, median $145 a month (detached)."*

**Never** publish "this subdivision has no HOA," or any equivalent.

**Why.** `association_yn` is null on **38.6%** of listings — coverage of 61.4%, below the **70%
item-response floor set by D16**. D13 already forbids publishing a negative feature class
inferred from missing data, and an HOA is the highest-stakes example on the site: a buyer who
reads "no HOA" and finds dues at closing has been actively misled.

The counted form is honest, it is more informative than a yes/no, and it survives the coverage
problem instead of hiding it.

**What is publishable:** 1,253 subdivisions where reported-yes exceeds reported-no by a clear
margin, and 1,385 with enough dues figures to show a median. At neighborhood grain, 20 of 28.

---

## R4 — Townsite plats are not neighborhoods

**Rule.** A place whose membership carries **6+ distinct property sub-types AND 3+ commercial
listings** is a legacy townsite plat, not a residential subdivision. It does not get the standard
subdivision page.

**Why, measured.** Of 3,029 subdivisions: **51** carry six or more property sub-types, **211**
carry real commercial listings, and **35** meet both tests. `redmond-townsite` and `wiestoria`
each span 10 sub-types across a century — these are the original plats of whole towns, mixing
retail, apartments and houses. Describing one as a subdivision with "a typical home of 1,276
square feet" is a category error, and the character ranges it produces are meaningless.

Separately, **1,135** subdivisions are under 60% detached. Those still work as pages, but every
figure on them must name the segment it describes.

---

## R5 — Minimum substance: a page, or a row on its parent

**Rule.** A subdivision becomes a page when it has **a live listing, or three or more recorded
sales**. Otherwise it is a row on its parent city or neighborhood.

**Why, measured.** Distribution of recorded sales per subdivision:

| Sales | Subdivisions | Treatment |
|---|---:|---|
| none, and nothing for sale | 32 | row |
| 1–2 | 201 (34 have a listing) | row unless it has a listing |
| 3–9 (median 6) | 454 | page |
| 10–24 (median 16) | 680 | page |
| 25–99 (median 48) | 1,359 | page |
| 100+ (median 133) | 303 | page |

That keeps roughly **2,830** pages and demotes about **199**.

The threshold sits at three because Google's scaled-content and doorway policies target
near-duplicate templated pages, and a page carrying six dated sales with real addresses, a real
build-year range, HOA facts and sibling links is not near-duplicate. **This holds only once that
content is actually built.** Publishing 2,830 pages that each show three counts is precisely the
pattern that draws a penalty — the threshold and the content ship together or neither ships.

---

## R6 — Scope: the service area already scopes itself

**Measured, not assumed:** 3,025 of 3,029 subdivisions carrying membership are already inside the
16-city service area, because subdivision membership is only ever assigned from Central Oregon
boundary polygons and aliases. No additional service-area filter is needed at this grain. Listings
outside the area simply never acquire a subdivision.

---

## R7 — Documents: provenance on the face, or it does not publish

Applies to recorded CC&Rs, plats, and HOA documents if and when they are hosted.

**Rule.** A hosted document displays its **instrument number, recording date, and county**, and
states that later amendments may exist and the current chain should be confirmed through title.

**Why.** Oregon's recording statute (ORS 205.160) indexes only party name, document type, date and
instrument number — **there is no subdivision or plat field**, and no structured cross-reference
chaining an amendment to the declaration it amends. Nothing in the county systems marks a
declaration as current or superseded. A hosted CC&R that misses a 2019 amendment looks
authoritative and is wrong, and no statutory safe harbour for that was found.

Matching a recorded declaration to a subdivision is therefore heuristic. Every association is
verified by a human before it publishes, or the document does not publish.

---

## What is NOT governed here

Prices, medians, months of supply, verdicts, and every other statistic remain the metric layer's
business — `REGISTRY.md` and `getMetric()`. Nothing in this file authorises computing a price
statistic at a grain the registry withholds.
