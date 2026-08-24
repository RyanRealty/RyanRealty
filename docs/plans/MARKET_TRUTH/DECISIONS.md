# Market Truth — decisions log

Live record of decisions Matt has made and of findings that **correct the other package files**.
Where this file and `SPEC.md` / `REGISTRY.md` disagree, **this file wins** — it is newer.

Read this before Phase A. Two of its entries invalidate questions the older files still ask.

---

## Standing rule (Matt, 2026-08-22) — default to the industry, do not ask

> "Default to what the industry does before asking me any questions."

Applies to every methodology and convention decision in this package. Research the settled industry
answer (RESO Data Dictionary, MLS rulebooks, NAR, published vendor methodology, USPAP / Fannie Mae
UAD, federal statistical suppression standards, Oregon Real Estate Agency rules), adopt it, write it
into `REGISTRY.md` **with its citation**, and tell Matt what was adopted. That is a notification, not
a question.

Escalate to Matt only when:
- the industry genuinely disagrees with itself and no dominant practice exists,
- following the convention would conflict with §0 data accuracy, or
- the choice is business positioning rather than methodology.

A question phrased as four plausible options is a tell that the research step was skipped.

---

## D13 — never publish a negative feature class · **DECIDED** (Matt, 2026-08-22)

A missing value is **unknown**, never **absent**. No surface may publish "X% have no <feature>",
"N homes without <feature>", or any equivalent inferred from NULL.

Positives remain publishable as a **floor** ("at least X%"), per D12.

### What forced it — the full 16-field scan

Measured 2026-08-22 across all 595,380 `public.listings` rows. **This supersedes the
fireplace-only framing in `SPEC.md` §1.8**, which was one example, not the finding.

| Field | true | explicit false | NULL | % NULL | Class |
|---|---:|---:|---:|---:|---|
| `spa_yn` | 0 | 0 | 595,380 | 100.0% | **dead** |
| `carport_yn` | 0 | 0 | 595,380 | 100.0% | **dead** |
| `home_warranty_yn` | 0 | 0 | 595,380 | 100.0% | **dead** |
| `property_attached_yn` | 0 | 0 | 595,380 | 100.0% | **dead** |
| `waterfront_yn` | 1,407 | **0** | 593,973 | 99.8% | positive-only |
| `fireplace_yn` | 175,833 | **0** | 419,547 | 70.5% | positive-only |
| `pool_yn` | 2,623 | 1,430 | 591,327 | 99.3% | has-false, hollow |
| `basement_yn` | 1,003 | 7,759 | 586,618 | 98.5% | has-false, hollow |
| `horse_yn` | 14,959 | 42,067 | 538,354 | 90.4% | has-false, hollow |
| `senior_community_yn` | 6,830 | 122,473 | 466,077 | 78.3% | has-false, hollow |
| `new_construction_yn` | 31,084 | 205,763 | 358,533 | 60.2% | has-false, thin |
| `heating_yn` | 467,786 | 1,316 | 126,278 | 21.2% | has-false, suspect¹ |
| `cooling_yn` | 295,287 | 37,438 | 262,655 | 44.1% | has-false, usable |
| `irrigation_water_rights_yn` | 40,501 | 323,196 | 231,683 | 38.9% | has-false, usable |
| `association_yn` | 143,906 | 221,467 | 230,007 | 38.6% | has-false, usable |
| `garage_yn` | 361,662 | 72,624 | 161,094 | 27.1% | has-false, usable |

¹ `heating_yn` false = 1,316 against 467,786 true. In Central Oregon a home without heating is not
plausible at that rate; treat the false values as data entry, not measurement.

### Why D13 as stated is necessary but **not sufficient**

The presence of an explicit `false` does not make a negative publishable. `pool_yn` records 1,430
explicit falses and would pass a naive "has false" test — off **0.7% coverage**. A "homes without a
pool" share from that is arithmetic on noise.

So the registry needs **two** tests, not one:

1. **Does the field record explicit `false` at all?** No → positives are a floor, negatives never
   publish. (D13, decided.)
2. **Is coverage high enough that a share means anything?** ← **threshold still open**, being
   researched, not to be asked of Matt.

`property_attached_yn` at 100% NULL is worth flagging separately: it is the field a naive
implementation would use to split attached from detached housing. It is empty. **D1's
`property_sub_type` predicate is the only viable route** — do not "improve" it by reaching for this
column.

---

## Correction — the unrecoverable-DOM problem is **2021-onward**, not pre-2016

`SPEC.md` §7 Q1 asks about "pre-2016 inventory where history does not recover the span." **That
framing is wrong and the question as written should be discarded.** Measured 2026-08-22, closed
sales by era, classified by whether the on-market span is trustworthy:

| Era | closed sales | clean (no recovery needed) | recovered from history | **span unprovable** | % untrustworthy |
|---|---:|---:|---:|---:|---:|
| 1995–2005 | 109,046 | 94,730 | 12,923 | 1,393 | **1.3%** |
| 2006–2015 | 112,318 | 88,846 | 18,360 | 5,112 | **4.6%** |
| 2016–2020 | 81,130 | 65,472 | 10,379 | 5,279 | **6.5%** |
| 2021–2026 | 76,800 | 62,706 | 812 | **13,282** | **17.3%** |

`OnMarketDate` is non-NULL on every closed row in all four eras, so the gap is entirely the relist
class. History recovery *collapses* in the recent era — 812 recovered against 13,282 unprovable.

The problem is therefore **in the window every published figure actually uses**, not in the archive.
Any treatment that "excludes the unprovable" removes 17.3% of recent sales, and they skew toward
slow-moving listings — so exclusion makes the published market look faster than it is.

**Status: being researched, not escalated.** Matt was asked and answered *"I really don't know the
answer to this, and I guess I'm going to have to ask for what the rest of the industry would do"* —
which is what produced the standing rule above. The industry's own convention (DOM vs cumulative
DOM, and the off-market reset threshold that governs it) is the answer to adopt.

Note for whoever implements: the MLS ships a `CumulativeDaysOnMarket` column and it is **dead** —
500 non-null values out of 595,380, none outside Closed. CDOM must be computed from
`listing_history`, which is what `market_fact_listing_span` exists to do. `CLAUDE.md` was corrected
on 2026-08-22 (`526dac93`) to stop naming that column.

---

## In flight — two research workflows (2026-08-22)

Both were launched to answer the two threshold questions **without** going back to Matt. If this
session ended before they landed, their results are recoverable from disk.

| Question | Run ID | Transcript |
|---|---|---|
| DOM / relist industry standard | `wf_a1275209-fca` | `…/subagents/workflows/wf_a1275209-fca` |
| Feature-coverage publishing threshold | `wf_9cb1e686-ddd` | `…/subagents/workflows/wf_9cb1e686-ddd` |

Transcript root:
`/Users/matthewryan/.claude/projects/-Users-matthewryan-RyanRealty/1bd66673-6a54-4b59-99f7-99a97805f482/`

Read `journal.jsonl` in the transcript dir for each agent's actual return value. Scripts are under
`…/workflows/scripts/` and can be resumed with
`Workflow({scriptPath, resumeFromRunId})` — unchanged agent calls return cached results instantly.

**When the results land:** adopt the industry convention, write it into `REGISTRY.md` with the
citation, resolve `SPEC.md` §7, and tell Matt what was adopted. Do not re-ask him.

---

## Also settled

- **`SPEC.md` §7 Q2** ("publish the no-fireplace class?") — **closed by D13.** No.
- **`SPEC.md` §7 Q1** ("pre-2016 band or refuse?") — **superseded** by the correction above. The
  era is wrong and the answer is the industry convention, not a Matt decision.

So `SPEC.md` §7 has **no open questions for Matt**. Both are now research-and-adopt.

---

## Unrelated open item — Imagine place heroes

**65 of 145 landed.** `public.asset_library` holds 65 rows at `source='grok-imagine'`, all
registered 2026-08-22, all with a live `file_url` and `file_size_bytes`, all `approval='approved'`,
all vision-graded, none with empty `geo_tags`. 145 MB total, 2.2 MB average, spanning 77 distinct
place tags (Bend neighborhoods, the resort communities, the outlying cities).

Two gaps:
1. **80 images are unaccounted for** against the 145 that were generated. Either they were never
   uploaded, or 145 was never the real count. Verify against the generating workspace before
   assuming loss.
2. **`width` and `height` are NULL on all 65 rows.** Crop discipline for the hero aspects cannot be
   checked programmatically until those are backfilled — `file_size_bytes` is populated, so the
   objects are real and the dimensions are simply unread.

Not a blocker for MARKET_TRUTH. Blocks any place-hero design work.

---

## D14 — published region list is the live 16 · **ADOPTED** (audit 2026-08-22)

Default-to-industry plus measured impact. Notify, do not ask.

`market_service_area` is the 16-name `is_central_oregon_city` set (case-insensitive city text), not
the invented 18-city list. Mitchell (Wheeler) is not this housing market. Switching 16→18 moved
trailing-365d type-A median $608,000 → $605,680 on six Mitchell sales; detached median unchanged.

`CENTRAL_OREGON_CITY_SLUGS` (24) stays the **site/SEO allowlist**. `pricing_is_central_oregon_city`
(14) stays the pricing-corpus filter until Metolius is added there (324 type-A / 246 detached in
`listings`, 0 facts rows).

`"City" = 'Crooked River'` (2,460 closed ≥$1k, last qualifying A close 2019) is still out of the
16. AUDIT F16, documented 2026-08-23: keep it as an **analytics city grain** (it is a real MLS
City string; the cube `City IN` list includes it). Do not fold it into Crooked River Ranch, do
not add it to the published 16, do not drop the 2,460 closes from the cube. Tumalo and
Crooked River Ranch remain named-only in the 16 (0 MLS `City` rows) and are retired from the
cube closed-city list.

## D15 — CDOM / first-on-market reset is 60 days · **ADOPTED** (ODS §3-20)

Oregon Data Share Rules (Aug 2024) §3-20: CDOM does not reset unless the property has been off
market 60 days. Cancel-and-relist inside 60 days is forbidden. 90 days remains only as the
`new_listings` de-dupe window, never as a DOM/CDOM reset.

## D16 — feature-share coverage floor · **ADOPTED** (OMB analog)

No RESO/NAR number exists. House analog: OMB Statistical Policy Directive No. 2 item-response
70%. Below that, positives publish only as a D12 floor ("at least") or not at all. Of the 16 YN
fields, only `garage_yn` (72.9% coverage) clears 70%. D13 (never publish a negative from NULL)
stands and is not sufficient by itself.

## D17 — leftover HUD 30-day sold, then stop · **DECIDED** (Matt, 2026-08-24)

Public **Closed · 30 days** is leftover membership `closed_count_30d` when publishable. Pulse
fills that tile only on leftover miss. Do not put leftover 12-month `closed_count` on this tile.
Bend leftover **203** vs pulse **137** is accepted: different population (detached membership vs
the old snapshot), not a leftover bug.

Public **Median to pending** is leftover `median_days_to_contract_90d` (90-day list-to-pending)
when publishable. Pulse fills only on leftover miss. Leftover 12-month days-to-contract stays in
the leftover pace strip, never on this tile.

**Stop leftover expansion there.** YTD, this-month, New · 30 days, and core-chart inventory /
days on market / months of supply / weekly price-cuts stay pulse or cache. County unpublished.
Neighborhood extra MOS omitted while 0 publishable. Subdivision never a price.

Program §5 "getMetric is the only way any surface obtains a market figure" is **not** a grind
target for those remaining tiles. Dual-run on the leftover-miss fill and the locked cache/pulse
windows is the product.

## D18 — How we get our numbers · **DECIDED** (Matt, 2026-08-24)

Leftover detached membership is the documented public definition of the pile. A dedicated
**How we get our numbers** page (`/how-we-get-our-numbers`) spells out each public label, the
houses counted, the window on the label, and when a live MLS snapshot fills a miss. A `?` next
to a public figure jumps to that term. The dictionary is not duplicated on every market page.

Do not expand leftover onto D17-locked tiles. Do not invent live figures on the dictionary page.
MOS formula and thresholds stay imported from `lib/market/classify.ts`. Visitor copy names no
table or SQL.

## D19 — HUD KPI row is one leftover pile · **DECIDED** (Matt, 2026-08-24)

Matt lifted D17 **for the public HUD KPI row only.** Industry standard: one population on
one dashboard row. Public **KbMarketHud** tiles (Active homes, Closed · 30 days, Median to
pending, Sale to list, Months of supply, Median list) are leftover detached membership.
Miss omits. Pulse and cache do not fill those tiles.

**New · 30 days** is omitted until leftover has a true 30-day new-listings cell. Do not print
12-month leftover `new_listings` under that label.

## D20 — leftover HUD charts and housing-market instrument · **DECIDED** (Matt, 2026-08-24)

Same one-pile rule as D19, applied to the rest of the leftover HUD story. Core-chart tabs
inside the HUD are leftover monthly median close and leftover closed count only. Cache
inventory / DOM / MOS / weekly price-cut tabs are omitted. Cache YTD and this-month figures
are omitted from the housing-market instrument. Housing-market live inventory / MOS / median
list are leftover membership.

County unpublished. Subdivision never a price. Unadjusted MoM off public. New · 30 days still
omitted until leftover has a 30-day new-listings cell.

## D21 — leftover MOS destinations and leftover remainder · **DECIDED** (Matt, 2026-08-24)

Same one-pile rule as D19/D20, applied to remaining public visitor MOS and inventory
tables that sat next to leftover HUD. `/months-of-supply`, `/housing-market`,
`/housing-market/central-oregon`, `/housing-market/annual-review`, `/housing-market/reports`,
`/cities`, and search MarketSnapshot print leftover MOS / leftover inventory /
leftover 90-day median to pending / leftover Closed · 30 days. Miss omits. Pulse
does not fill.

Region vs city remainder is leftover membership: omitted leftover cities are named,
and leftover region minus leftover city rows is leftover remainder, not a
city-limits pin gap.

CRM reports, blog MOS rewriter, and report export stay pulse-gated through
`publishMonthsOfSupply`. They are not leftover HUD visitor destinations.

## D22 — leftover listing context, about, JSON, OG · **DECIDED** (Matt, 2026-08-24)

Same one-pile rule on remaining leftover-eligible public visitor figures. Listing
place market, `/about` city rows, `/data/market/...` HUD-family fields, and city
OG inventory are leftover membership. Miss omits. Pulse and cache do not fill
Closed · 30 days, Median to pending, Active homes, or Months of supply there.

New · 30 days stays omitted on the JSON HUD until leftover has a true 30-day
new-listings cell. CRM / blog / report export stay pulse-gated.

## D23 — leftover FAQ DTP and seller LP HUD · **DECIDED** (Matt, 2026-08-24)

Same one-pile rule on leftover-eligible FAQ and seller LP HUD-family figures.
City, neighborhood, community, and housing-market FAQ Median to pending is
leftover 90-day list-to-pending. Pulse DTP and cache days-on-market do not
fill. `/lp/seller-home-value` HUD-family tiles are leftover membership.
Leftover has no 90-day median close; that tile is omitted rather than filled
from pulse or leftover 12-month median close. New · 30 days omitted.
County unpublished. CRM / blog / report export stay pulse-gated.

## D24 — leftover remaining public visitor HUD-family · **DECIDED** (Matt, 2026-08-24)

Same one-pile rule on the leftover-eligible public visitor figures that still
sat next to leftover HUD.

City, neighborhood, and community heroes print leftover HUD inventory and leftover
median list. Pulse, tiles, and cache do not fill those published counts.

`countyMedian` is omitted. County is unpublished. Region pulse does not fill a
county label.

Town MOS / DTP charts inside the leftover HUD use leftover membership. Pulse
weekly price-cut charts are omitted. JSON HUD-family fields overlay leftover
equivalents; leftover miss omits pulse fill. Site header and mega menu leftover
inventory / leftover MOS / leftover 90-day DTP.

CRM / blog / report export stay pulse-gated. New · 30 days omitted.

## D25 — leftover pending HUD + leftover remaining visitor HUD-family · **DECIDED** (Matt, 2026-08-24)

Leftover pending is a leftover HUD-family inventory fact. Bend leftover pending is
the published count. It prints on leftover-eligible public HUD KPI rows next to
Active homes, not JSON-only.

Same one-pile rule on leftover-eligible public visitor HUD-family figures that still
mixed: search city FAQ, and event / golf / trail / venue city market bands. Miss
omits. Pulse does not fill.

CRM / blog / report export stay pulse-gated. New · 30 days omitted. County unpublished.
