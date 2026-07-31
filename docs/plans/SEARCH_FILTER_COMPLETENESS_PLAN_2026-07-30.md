# Search Filter Completeness — exposing the whole MLS surface, usably

**Date:** 2026-07-30 · **Status:** plan, no code written · **Owner:** search/site
**Supersedes nothing.** Second pass over the surface built by
[`SEARCH_OPTIMIZATION_PLAN_2026-07-29.md`](SEARCH_OPTIMIZATION_PLAN_2026-07-29.md)
(Phases 0-3, shipped as `deed9e4b`), correcting a completeness failure in it.

---

## 0. The goal

A buyer with a very specific need can express that need as a filter, and get
back only the properties that satisfy it.

Concretely, all of these must be one short interaction on ryan-realty.com:

- "duplex" (not "multi-family", the actual sub type)
- "condo, not a townhouse"
- "manufactured on land, not in a park" (a financing distinction, not cosmetic)
- "zoned MUA10" and also "zoned so I can keep horses" without knowing a code
- "detached ADU, permitted"
- "on a well, septic approved, power at the lot line"
- "sold in the last 12 months" with the same filter depth as an active search

Done means the filter exists, is reachable, returns the right set, and a person
who does not know MLS vocabulary can still find it.

## 1. Why this second pass exists

The first pass built 113 registry fields from a hand-transcribed teardown of the
Flexmls UI. Matt found the hole by asking one question: property SUB TYPE was
missing entirely, so "Residential" silently bundled condos, townhomes,
manufactured homes, leased-land and stock co-ops with detached houses, and a
duplex was unsearchable.

Root cause, stated plainly so the fix targets it: the registry was built to a
list a human typed, not to the MLS's own field metadata. Breadth was generated
where it was mechanical (26 amenity booleans) and the taxonomy that buyers
actually shop by was skipped. A field count was reported as if it were coverage.

**The correction is structural, not a longer list:** the filter set is generated
from the Spark field metadata and gated against it, so completeness stops
depending on anyone's diligence.

## 2. Measured baseline (Spark metadata, pulled 2026-07-30)

Every number below comes from the live Spark API using our own credentials
(`/v1/standardfields`, `/v1/customfields`, and each field's own resource URI).
Raw artifacts: `spark-standardfields.json`, `spark-customfields.json`,
`spark-field-values.json`.

| Measure | Count |
|---|---|
| Fields in the feed | **1,829** (477 standard + 1,352 custom across 105 groups) |
| Marked **searchable** by the MLS | **1,562** |
| Enumerated filter fields (excl. geography pickers) | **165** |
| Allowed values across those fields | see note below — **do not cite 11,859** |
| Fields whose value set varies by property class | **35 entries / 28 distinct concepts / 22 buyer-facing** |
| Geography pickers (separate UX problem) | Subdivision 8,041 · Elementary School 659 · Postal Code 552 · City 501 |
| **What our registry exposes today** | **113** |

The gap is not 113 vs 1,829 in practice, because much of the feed is broker
plumbing, agent identity, and internal timestamps that no consumer should see.
The honest target is defined in §4: every searchable field that a buyer could
reasonably shop by, minus the confidential and rule-restricted set.

**§0 correction, made against my own figure.** I published "11,859 allowed
values" earlier in this session. An independent pass could not reproduce it:
the raw total across the metadata file is 21,561, and 3,373 once geography and
school pickers are excluded. My number came from a pass whose de-duplication
cannot be reconstructed, so it is withdrawn rather than defended. The counts
that DO reproduce exactly are 1,829 fields, 1,562 searchable, and 165
enumerated filter fields. The value total gets recomputed and printed with its
exclusion rule at build time, and no downstream artifact may cite the retracted
figure.

**Second correction, and it changes a design decision.** §2.1 said the MLS
metadata is authoritative for class conditioning. It is not, quite. Spark's
per-value `AppliesTo` contradicts our own data in places: `Deck` and `Patio`
are marked class-B-only yet appear on 33% and 36% of live class-A listings, and
a `Gas` fireplace is marked class-C. **Class conditioning is therefore built
from observed per-class prevalence in our own database, with `AppliesTo` as a
hint and a tie-breaker, never as the gate.** This is the §2.2 principle applied
to itself: we own the data, so we measure rather than trust.

### 2.1 The hierarchy the MLS already ships as data

Each enumerated value carries `AppliesTo` — the property classes it belongs to.
This is the structure the first pass flattened. Property Sub Type, verbatim from
the metadata:

| Class | Sub types |
|---|---|
| **A** Residential | Single Family Residence · Condominium · Townhouse · Manufactured On Land · Tenancy in Common · Residential Leased Land · Stock Cooperative · Timeshare |
| **B** Manufactured | In Park · On Leased Land |
| **C** Multi-family | Duplex · Triplex · Quadruplex · Multi Family |
| **D** Land | Residential Lots · Agriculture · Commercial · Industrial · Investment · Rangeland · Recreational |

35 fields behave this way. The UI must condition on it: choosing a class changes
which filters and which values are valid, and an invalid selection must be
impossible to submit rather than silently returning nothing.

## 2.2 Architecture: metadata defines the vocabulary, our database answers

**Hard rule, and the reason this can be better than the MLS front end:**

- **Spark metadata is design-time only.** It is the source of truth for what
  fields exist, what values are legal, and which property class each value
  belongs to. It is pulled on a schedule, normalized into a committed artifact,
  and used to GENERATE the filter set. No user request ever reaches Spark.
- **Our Postgres answers every query.** Search already runs against
  `listing_search_mv`. The sync remains the only Spark consumer, so filter
  latency is bounded by our own indexes, not by a third-party API.

Owning the query engine buys capabilities the MLS interface cannot offer, and
the plan treats them as requirements rather than nice-to-haves:

1. **Live counts on every filter value, before the click.** "Duplex (96)",
   "Condominium (178)", "Manufactured On Land (587)". A value that matches
   nothing is visibly zero or hidden, so a dead-end selection is impossible by
   construction. This is the single largest usability gap versus Flexmls, which
   makes the user guess and then discover the empty result.
2. **Counts that react to the current filter set**, so narrowing shows what is
   still reachable, and a zero-result state can name the filter that caused it.
3. **Indexes chosen for our access pattern.** The multi-selects are Postgres
   `text[]` columns queried with overlap; GIN indexes serve those directly.
   Boolean and scalar filters get btree or partial indexes where the selectivity
   justifies one.
4. **Precomputed facets.** Value counts are materialized and refreshed on the
   existing `listing_search_mv` cycle rather than computed per keystroke, with
   the per-request path reading a small facet table.
5. **Denormalization on demand.** If a filter is slow we add a column, an index,
   or a precomputed array. That option does not exist against someone else's API.

Design constraints this imposes, to be honored in §7 and §8: the facet table
must be class-aware (counts differ per property class), it must respect the same
public-visibility rules as the serving view (no Coming Soon, no confidential
fields), and a stale facet must never contradict the result count the user
actually gets — the count shown next to a value is a hint, the query is truth,
and the two are reconciled by refreshing facets in the same transaction cycle as
the MV.

## 3. What "done" means (acceptance, checkable by a reviewer)

1. Every filter in the shipped set traces to a Spark metadata field, and a gate
   fails the build when the registry and the metadata disagree.
2. No filter is reachable that matches zero live listings (coverage gate), and
   no confidential or rule-restricted field is exposed at all.
3. A user can find any filter by typing what they mean, including typing a
   VALUE ("duplex", "MUA10") rather than a field name.
4. Selecting a property class reshapes the filter set and value lists correctly,
   and previously-chosen values that become invalid are surfaced, not dropped.
5. Zoning is usable by someone who does not know zoning codes.
6. A deep multi-filter search can be saved and turned into an alert without
   re-entering anything.
7. Sold search carries the same filter depth as active search.

---

## 6. Zoning: codes in, buyer questions out

Matt's requirement: "the different zoning types, any of the codes that are in
Flex and how they're defined should be built into the interface." The filter
therefore has three layers, and only the first is MLS data.

**Layer 1 — the raw string.** `listing_search_mv.zoning`, sourced from the MLS
with a `ZoningDescription` fallback. Real values are messy: mixed case, city and
county codes colliding, multi-zone strings. Normalization to a canonical
`(jurisdiction, zone_key, display_label)` triple is specified by the zoning
research stream and is a prerequisite for everything below.

**Layer 2 — the definition.** Each canonical zone carries a plain-English
sentence, the jurisdiction, the code section, and the date the code was read.
Sourced from the jurisdiction's own codification, never paraphrased from memory.
This is what turns "MUA10" into something a buyer can act on.

**The codified text can lag the jurisdiction's current policy, and the research
caught a live example.** Jefferson County's still-codified rural-residential ADU
language disagrees with the newer countywide rural-ADU policy the county
publishes on its own website. A definition can therefore be sourced correctly
from the code and still be wrong in practice. Three consequences the build must
honor:

1. Every definition row stores `source_url`, `code_section`, and `verified_on`,
   and the UI shows the verification date rather than implying currency.
2. A definition older than a set staleness window is flagged for re-check, the
   same ratchet idea as the coverage census.
3. Where the code and the jurisdiction's published policy disagree, we record
   **both** and link out. We do not adjudicate between a county's own two
   sources, and we never present one as settled.

**Layer 3 — buyer intent.** The questions people actually ask, mapped to zones:
ADU allowed, short-term rental allowed, livestock/horses, subdividable,
multi-family allowed, commercial use. This layer is the most valuable and the
most dangerous, so it carries hard rules (§6.2).

### 6.0 Four findings that reshape this section

Measured against our own listings, and they make the work smaller and safer.

**1. Do not infer from zoning what the MLS already states.** Four of the seven
buyer intents are answered directly by broker-entered fields with usable fill:
`ccrs_yn` **90.3%**, `str_permit_yn` **63.3%**, `adu_yn` **59.8%**, `horse_yn`
**45.4%**. Those become filters immediately and need no zoning inference at all.
The exception is `adu_permitted_yn` at **2.7% fill**, which is unusable alone and
must never be shown as a standalone filter. Zone inference is reserved for the
questions no field answers.

**2. `str_permit_yn = false` does not mean "short-term rental prohibited."** It
means no permit is on file. Given §6.3, where four of six jurisdictions do not
zone STRs at all, the UI copy must say "no permit on record" and nothing more.

**3. The feed is not Central Oregon only, so a bare zone code is ambiguous.**
Deschutes is **32.5%** of rows; Jackson, Klamath and Josephine together are
**49.4%**. `R2` means four different things across Klamath, Crook and
Deschutes/Redmond; `RR5` is mostly Southern Oregon; `WR` is a Josephine
woodlot zone, not a Deschutes one. `UAR10` is Deschutes County's and `UH-10` is
Redmond's, and merging them would be wrong. The canonical key is therefore
**`jurisdiction:code`**, never the bare code.

**4. Jurisdiction cannot come from the `city` column.** MLS `city` is a mailing
address, so a "Bend" address is routinely unincorporated county with entirely
different rules. Jurisdiction must resolve through PostGIS against the
boundaries table. This is a prerequisite for the zoning layer, not an
enhancement, and it is the single largest misattribution risk in this plan.

Source note for the builder: `details->>'Zoning'` is masked on 9,485 of 9,627
on-market rows. `ZoningDescription` is the canonical source and a strict
superset. The v3 MV coalesce already falls through to it because the mask is
stripped upstream, but the pipeline must pin to it explicitly rather than rely
on ordering.

**Vocabulary reality:** 964 distinct raw strings collapse to 710 after squashing
case and punctuation, and two truncation walls exist at 15 and 25 characters
(the same Crook zone appears as both `Rrm5; Recreatio` and
`Rrm5; Recreational Reside`). 83.4% of Deschutes strings are already clean
uppercase tokens, so the normalization is tractable.

### 6.1 The statewide baseline (verified, sources in-line)

Oregon law settles part of the ADU and middle-housing question above any local
code, which means these answers are defensible statewide rather than
zone-by-zone:

- **Urban ADUs — ORS 197A.425** (SB 1051, 2017; formerly ORS 197.312(5)-(6)).
  A city over 2,500 population must allow at least one accessory dwelling unit
  on each lot zoned for detached single-family dwellings inside the urban growth
  boundary, subject to reasonable siting and design rules. Owner-occupancy and
  extra off-street parking may not be imposed as conditions.
  <https://oregon.public.law/statutes/ors_197a.425>
- **Middle housing — ORS 197A.420** (HB 2001, 2019; formerly ORS 197.758; tiers
  amended by HB 3395, 2023). Cities of 25,000+ must allow duplex, triplex,
  quadplex, cottage cluster and townhouse on lots that allow detached
  single-family. Cities from 2,500 to 24,999 must allow a duplex.
  Applied to our market: **Bend and Redmond fall in the all-types tier;
  Sisters, La Pine, Prineville and Madras fall in the duplex tier.**
  Tier placement uses PSU Population Research Center estimates and is robust to
  revision (every city sits far from its threshold), but the certified table
  must be cited rather than a news secondary before any of this is published.
  <https://oregon.public.law/statutes/ors_197a.420>
- **Rural ADUs — SB 391 (2021) as amended by SB 644 (2023).** Counties MAY allow
  one ADU on rural residential land (2-acre minimum, existing single-family
  dwelling, wildfire conditions). It is a county option, not a mandate, and it
  does not reach EFU land. Deschutes County publishes its own implementation.
  <https://www.deschutes.org/cd/page/rural-accessory-dwelling-units-sb-391>
- **EFU — ORS 215.203** defines exclusive farm use and the farm-use test that
  governs what may happen on EFU-zoned land. Relevant to a large share of our
  acreage inventory. <https://oregon.public.law/statutes/ors_215.203>
- **Statewide Goals 3 and 4** are why EFU and forest zoning exist at all, and
  frame why non-farm development on them is restricted.

Open item carried from the research: the exact operative ORS section for the
SB 391/SB 644 rural-ADU mechanism is not yet pinned (definitions live at ORS
215.501). Resolve before the intent layer ships.

### 6.2 Rules for the intent layer (compliance, not style)

Matt is a licensed principal broker. A confident wrong answer about what can be
built on a parcel is a liability, so the intent layer ships under these rules:

1. **State what the code says, never what a property allows.** The filter finds
   listings in zones where the code permits a use. It does not tell a buyer they
   can build.
2. **Conditional is not yes.** Where a use is discretionary, permit-gated, or
   overlay-dependent, it is labeled conditional and the condition is named.
3. **Every claim carries jurisdiction, code section, and read date**, and the UI
   links to the jurisdiction's own page.
4. **Short-term rental rules usually sit outside the zoning code** (permit caps,
   density, owner-occupancy). Where zoning alone does not settle it, the answer
   is "check the city", not a guess.
5. **Parcel-level questions route to parcel data**, not MLS text. The repo
   already holds Deschutes DIAL parcel work and a PostGIS boundaries table;
   anything needing lot geometry or overlay membership belongs there.
6. **Never source a definition from an aggregator.** The research caught a
   widely-repeated "500-foot separation, RL/RS/RM/RH/MR" rule attributed to
   Redmond that is verifiably **Bend's** BDC 3.6.500 language, cross-contaminated
   by a third-party site and then echoed. Publishing it would have put a wrong,
   confidently-worded rule under our name. Jurisdiction codifications only.
7. **Re-verify anything older than the staleness window before it ships.** The
   best available Deschutes County STR source is from roughly June 2025 (no
   zoning permit, Transient Room Tax under DCC 4.08, licensing program in
   development). Over a year has passed, so it is re-checked before display.

### 6.3 Two treatments, decided by the research (not a style choice)

The jurisdiction research settled a question the first pass would have gotten
wrong. Verified in the Sisters Development Code (SDC 2.15.2700, current through
Ord. 540, 2024): a short-term rental there is not governed by a permit cap. It
is governed by a **500-foot spacing rule from any other licensed STR**, plus an
outright ban in areas annexed after 2026-10-25, plus approvals that **do not run
with the land** — a sale voids the approval and the buyer must re-apply under
whatever spacing situation exists that day.

That means STR eligibility is **parcel-specific and time-specific**. No zoning
code can answer it, and neither can we. So the product splits the intent layer:

| Treatment | What it is | Where it is used | UI behavior |
|---|---|---|---|
| **Zone permits** | The code allows this use in this zone, as written, on a date, with a section cite | ADU allowance, livestock, multi-family, commercial use, minimum lot size | A real filter. Filterable, countable, shown as a chip. |
| **Property eligible** | Whether THIS parcel can actually do it | STR eligibility, subdividability, overlay effects | **Never asserted, never a filter.** Shown as a "what to check" panel linking to the jurisdiction, with the rule named. |

Applied: "zoning where an ADU is allowed" is a legitimate filter, because ORS
197A.425 plus the local code settle it at the zone level (Sisters, for example,
permits one ADU per lot up to 800 sq ft by Type I review with no
owner-occupancy requirement, SDC 2.15.300). "Short-term rental allowed" is
**not** a filter on zoning. What we can filter on is the MLS's own
`Short Term Rental Permit YN` field, which is a statement by the listing broker
about that property, and it is labeled as such.

This is the difference between a search that helps and one that creates
liability for a licensed principal broker.

**Six jurisdictions examined, and they split into two incompatible regulatory
models. That split is the strongest argument for the rule.**

*Model 1, concentration limits.* Sisters bars a new STR within **500 feet** of
another licensed one (SDC 2.15.2700, Ord. 540, 2024). La Pine uses **250 feet**
(LPDC 15.104.100, Ord. 2025-04). Both exempt commercial zones, both cap one unit
per property, and both issue permits that **do not run with the land**, so a sale
voids the approval and the buyer re-applies into whatever the neighbors have
since taken.

*Model 2, tax registration with no zoning restriction.* Jefferson County permits
STRs county-wide subject to transient-room-tax registration (County Code 3.08,
which defines "short-term rental" for tax purposes while Title 17 never zones
it). Madras follows the same shape (MMC 3.30), with a separate and stricter
conditional-use path only for owner-occupied bed-and-breakfasts (MDC 18.30.080).
Prineville and Crook County likewise regulate through a lodging tax with no
STR land-use category found.

One further wrinkle: Jefferson County's rural ADU standard **bars STR use of the
ADU outright** with a 45-day minimum tenancy.

So the answer to "can this property be a short-term rental" depends on the
jurisdiction's model, the neighbors, the transfer date, the structure type, and
a tax registration that is not in any listing field. **No filter can express
that, which is exactly why the product must not pretend to.**

The ADU side corroborates in the opposite direction, which is why it stays a
filter: Sisters allows one ADU per lot up to 800 sq ft (SDC 2.15.300); La Pine
allows one per lot at the lesser of 800 sq ft or 75% of the primary dwelling
(LPDC 15.104.010), permitted outright in RSF, RMF, C, CRMX, CMX and CN. Both
sit on the ORS 197A.425 statewide floor. Zone-level answer, sourced, filterable.

Also recorded from that research, because it is exactly the trap this plan
exists to close: the guessed La Pine zone codes `LPTC`, `LPRSF`, `LPRMP` and
`LPMPR` **do not exist in the code**, and `RMF` is Residential Multi-Family, not
a manufactured-home zone. Zoning vocabulary gets read from the jurisdiction's
codification or from our own data, never recalled.

---

## 7. Interface architecture

Target: the query "duplex with an ADU, on a well, zoned MUA10" costs **1 move by
voice, 4 by omnibox tokens, about 9 in the panel**. Today it costs 20+ moves and
still fails, because zoning is a free-text box where `MUA-10` returns zero with
no correction offered.

**One URL state, three doors into it.** The URL remains the single source of
truth (it already is), so every search stays shareable, bookmarkable, and
savable as an alert.

- **Door 1 — the omnibox**, upgraded to resolve VALUES, not just places. Typing
  `duplex` or `MUA10` resolves to the filter that contains that value. The voice
  parser already maps phrases to registry params; this extends the same idea to
  typed input.
- **Door 2 — tiered chips.** Seed set: Property type · Price · Beds · Baths ·
  **Lot size** · All filters. **Status moves off the chip bar** — it is search
  scope, not a filter, and it silently governs whether other fields work at all.
- **Door 3 — the panel**, rebuilt from a single ~7,000px scroll into a fixed
  category rail plus a scrolling field pane, with Find-a-filter pinned.

Rejected, with the reason recorded so it is not relitigated: a mega-menu (cannot
express class conditionality, no phone form), a wizard (breaks the preset slugs,
the saved-search `filters_hash` dedupe, and re-entrant editing), chat as the
primary surface (unshareable, invisible state, un-auditable against §0), and a
command palette as the primary entry (undiscoverable, hides state). Palette
*mechanics* are adopted inside the omnibox.

### 7.1 The four specs that carry the weight

1. **Find-a-filter matches values, not just field names.** Normalization
   squashes punctuation and spacing so `MUA-10`, `mua 10` and `mua10` collide,
   with results ranked by live listing count. Each row shows field label, value,
   plain-English definition, and count. This is the single highest-leverage
   control for a 165-field surface.
2. **Class conditioning suspends, never drops.** When a chosen value becomes
   invalid for the selected class, it is retained and struck through, excluded
   from the query, and offered two one-tap resolutions. Silently dropping a
   selection is forbidden — the user cannot see what happened, and the result set
   lies. Selecting a class-exclusive value (say Duplex) auto-narrows the class,
   with one-tap undo.
3. **Zero results name the culprit.** A leave-one-out diagnostic identifies which
   filter zeroed the search and shows the count recovered by relaxing it. No
   suggested action may itself return zero.
4. **Tiering is computed, not hand-picked.** A shelf score from demand
   (`search_filter_apply` events, already firing), coverage, and selectivity,
   minus zero-rate, with at most one tier move per recompute so the UI does not
   shuffle under returning users. The seed set above is the starting point, not
   the permanent answer.

### 7.2 Defects found while specifying (all pre-existing, all real)

| # | Defect | Consequence |
|---|---|---|
| 1 | Amenity presets have **no off-switch**. On `/homes-for-sale/bend/with-pool` the pool filter cannot be cleared — `hasPool`, `hasView`, `hasGolfCourse`, `hasFireplace`, `hasWaterfront`, `hasOpenHouse` have no negative URL state | A visitor landing from search is trapped in a filter they can see but not remove |
| 2 | **Drawn shapes do not reach alerts.** `NON_NARROWING_KEYS` (`lib/search-filters.ts:412`) discards `poly` and `shapes` | The deepest search a user can build is not the search they get emailed about. This directly undercuts the map work shipped in `deed9e4b` |
| 3 | `mobileView` is React state, not URL state (`MapSearchView.tsx:284`) | A shared or reloaded link loses the map/list choice |
| 4 | The save dialog collects the least at the moment of intent — the guest strip takes an email and writes the `daily` default. Cadence, events, days and recipients are editable only at `/account/saved-searches`, which a guest cannot reach | Highest-intent moment, lowest-fidelity capture |
| 5 | Registry `coverageNote` on `adu`, `aduPermitted`, `aduSqft` still reads `Backfill pending 2026-07-30` | **Stale label, not missing data** — see correction below |

**Correction to defect 5, verified against production:** the CustomFields
backfill did run. Measured in `listing_search_mv` on 2026-07-30: `adu_yn` is
non-null on 5,776 rows with 332 true, `str_permit_yn` true on 596, `ccrs_yn`
known on 8,720, `zoning` present on 9,222. The data is live; the registry's
coverage notes were never updated after the backfill. That is a one-line fix,
but it is also the argument for §8: **coverage must be a measured number
attached to the field, not a hand-typed string that rots.**

---

## 8. P0 — a live privacy leak of the same class, found during this planning

**Verified with the public anon key on 2026-07-30, before any of this plan is
built.** Broker-only Showing Requirements values are readable by any anonymous
visitor, on 30 of 40 sampled active listings:

| Leaked value | Rows (of 40 sampled) |
|---|---|
| `Call Listing Agent` | 30 |
| `Text Listing Agent` | 27 |
| `Appointment Only` | 22 |
| `See Showing Instructions` | 15 |
| `Lockbox` | 14 |
| `Pet(s) on Premises` | 5 |
| `Listing Agent Must Accompany` · `24 Hour Notice` | 4 each |
| `Key In Office` | 1 |

**Root cause is the same defect I fixed earlier today, one level down.**
`flattenCustomFields` drops the GROUP name, so a group-scoped confidential field
arrives as a bare top-level boolean: not `Showing Requirements → Lockbox`, just
`{"Lockbox": true}`. `PRIVATE_DETAIL_KEYS` redacts by KEY, so it blocks the
parent field and never sees the flattened values. The earlier fix closed the
key-name spelling gap; this is the group-name gap, and the two share a cause.

**Why a blocklist of these values is the wrong fix**, and the plan must not take
that shortcut: the same labels are legitimate elsewhere. `Security System` is a
real interior feature, `To Be Built` and `Under Construction` are real property
conditions, and 196 CF labels are reused across groups (`Other` appears in 34
groups, `None` in 19). Blocking by value would silently destroy legitimate
filters.

**The correct fix, to be specified in the pipeline section:** preserve group
provenance through the flatten — namespace every CF key with its group, or carry
a parallel group map — so redaction and promotion can both reason about
`group → field` instead of a bare label. That single change closes this leak
class permanently and is also a prerequisite for safe `rr_flat_true_keys`
promotion, which is currently only sound for globally unique labels.

This is P0 and precedes every feature item in this plan. It is written here
rather than fixed on the spot only because this mission is explicitly plan-only.

## 9. Nine filters that can never match anything

Measured against 9,651 on-market rows: `spa_yn`, `carport_yn`, `carport_spaces`,
`stories_total`, `fireplaces_total`, `home_warranty_yn`, `walk_score`,
`parking_total`, `laundry_features` are **0 for 0**. Root cause confirmed: those
RESO names carry `MlsVisible: []` in the Spark dictionary or are absent from it,
and no class-A CustomField equivalent exists across all 1,352 CF labels.

Every one of these shipped in the previous pass. They are the exact failure the
coverage gate in §10 exists to prevent: a filter that renders, invites a click,
and returns nothing. They get deleted, not fixed.

**Good news from the same inventory:** the promotion work is far smaller than
feared. The `_expand=CustomFields` merge already lands all 1,352 CF fields in
`details`, and all 477 StandardFields keys are present on sampled class-A rows,
so **Tier 3 (needs new ingest) is essentially empty** — nearly every gap is one
MV column away, not a sync change. Land is 22% of on-market inventory (2,149 of
9,676) and currently has the thinnest filter coverage of any class.

---

## 10. The honest target: 239, not 1,562

A third correction to my own framing, and the most important one. **1,562
searchable fields is the wrong denominator.** Measured from the metadata:
**1,009 of the 1,348 searchable custom fields are `Type: "Boolean"`** — the MLS
publishes one custom field per *allowed value* of a parent enum. `Appliances`
appears as 21 booleans, `Basement` as 7, `Architectural Style` as 15. 754 of
them carry `StandardizedAs` pointing back at 47 standard parents; the remaining
255 sit in 34 groups with no standard parent (`Rooms`, `Flood`, `Easements`,
`Government Overlay`), which is exactly the shape `rr_flat_true_keys()` already
handles.

Collapsed to concepts:

| Measure | Count |
|---|---|
| Distinct filterable concepts | **505** |
| Visible to property class A (residential) | **239** |
| Exposed today | **113** |

**The real gap is 2.1×, not 14×.** That is a buildable target, and stating it
honestly matters more than a dramatic number — the point of this plan is to stop
substituting impressive counts for coverage.

### 10.1 `Searchable: true` does not mean safe to expose

The discriminator that actually works, and the mechanical answer to both privacy
leaks found today: **`Payloads: ["IDX"]`**. 94 of the 214 searchable standard
fields carry it, and every confidential field checked carries `Payloads: []` —
`PrivateRemarks`, `ShowingInstructions`, `OccupantName`, `Phone to Show`,
`Call Owner`. Exposure is gated on the IDX payload flag plus the existing
confidential-key list, not on `Searchable`.

### 10.2 Three traps a naive generator walks into

1. **`Type: "Boolean"` + `MultiSelect: true`** describes 35 standard fields that
   are multi-select enums, not checkboxes (`ArchitecturalStyle`,
   `SpecialListingConditions`). Rule ordering in the kind-mapping table is
   load-bearing.
2. **Spark's own `Label` is sometimes one of the field's values** —
   `ArchitecturalStyle.Label === "A-Frame"`. One field today. The generator must
   **fail loudly** rather than ship it.
3. **`MaxListSize: 2` is not a boolean signal.** 74 custom fields have it; 58 are
   literally `{No, Yes}` and 16 are real two-value enums (`Attached/Detached`,
   `Leased/Vacant`). The value set discriminates, never the size.

## 11. The pipeline

**pull** (`scripts/pull-spark-field-metadata.mjs`, raw ~3.9 MB, gitignored) →
**normalize** (`data/search/spark-metadata.snapshot.json`, ~550 KB, **committed**)
→ **generate** (`scripts/generate-search-registry.mjs` →
`lib/search/field-registry.generated.ts`, **committed**) → **compose**
(`lib/search/field-registry.ts` shrinks to roughly 120 lines, **exports
unchanged**, all 12 importers untouched) → **census** (`data/search/coverage.json`,
refreshed nightly from our own database).

**The generated file is committed, not built at build time.** A build-time pull
would make the MLS a deploy dependency, hide vocabulary changes from code
review, break the secret-less gate chain, and forfeit free `tsc` verification.
Staleness is handled instead by a weekly detect-only cron that writes
`public.search_metadata_drift` and never commits.

### 11.1 The curation layer, designed to survive regeneration

`lib/search/curation.ts`, keyed by stable concept id (`PropertySubType`,
`cf:Walk Score`, `group:Flood`). Humans own labels, categories, chip rank,
buyer-intent tags, voice synonyms, option display order, and `expose: false`
**with a required reason**.

Humans structurally **cannot** own vocabulary membership. There is no field for
it — only subtraction. That single constraint is what makes
`specialConditions` shipping 4 of its 13 real values impossible to repeat.

### 11.2 Gates (the durable part)

| Gate | Asserts |
|---|---|
| `ci:search-registry-generated` | the generated file reproduces byte-for-byte from the snapshot |
| `ci:search-field-completeness` | every IDX-exposed concept is registered or explicitly excluded with a reason — **would have caught PropertySubType** |
| `ci:search-option-parity` | no option list is a subset of the metadata's — **would have caught 4-of-13** |
| `ci:search-mv-columns` | every registry `mvColumn` exists in the MV |
| `ci:search-dal-parity` | every registry field has a DAL predicate |
| `ci:search-confidential-exclusion` | nothing with `Payloads: []` or on the confidential list is exposed |
| `ci:search-coverage` | no filter ships that matches zero live listings — **would have caught the nine dead filters** |

**Numbering collision to fix first:** `docs/MECHANICAL_GATES.md` assigns G58 to
`check-default-chrome-footer.mjs`, while the `check-private-key-parity.mjs` I
added earlier today self-labels G58 and has no table row. Renumber
private-key-parity to G59 with a row before allocating G60 onward.

### 11.3 The migration risk that would not be guessed

`listing_alerts` carries `UNIQUE (email, filters_hash)`, where the hash is
computed from `normalizeSavedSearchFilters` output. **If normalization ever
rewrites an existing payload's key names, the recomputed hash stops matching the
stored row** — producing duplicate alerts and updates that land on the wrong
row, silently, for real subscribers.

Rules, non-negotiable: aliases resolve **on read, never on write**; no URL param
is ever renamed; `data/search/url-params.lock.json` is append-only and gated.
Ship a 200-payload fixture test asserting hash stability before any
normalization change.

### 11.4 Rollout

Five tranches. **T0 ships the entire pipeline reproducing exactly today's 113
fields with zero user-visible change.** If the diff is not zero, T0 is not done.
Everything after that is additive and independently revertible.

T1 the corrections (PropertySubType, the nine dead filters deleted, the stale
coverage notes, `direction_faces` and `levels` wiring). T2 class conditioning
plus find-a-filter. T3 the zoning layer per §6. T4 the long tail toward 239 with
facet counts.

## 12. Phasing, ordered by what unblocks what

| # | Phase | Gate to green | Why here |
|---|---|---|---|
| **P0** | Close the group-name leak (§8) | `ci:search-confidential-exclusion` | Live exposure of broker-only data. Precedes all feature work |
| **P1** | T0 pipeline at zero diff | `ci:search-registry-generated` | Nothing else is safe to build on a hand-maintained registry |
| **P2** | Corrections + PropertySubType (§9, §7.2) | `ci:search-coverage`, `ci:search-option-parity` | Highest buyer value per hour; MV columns already exist |
| **P3** | Class conditioning + find-a-filter (§7.1) | render + interaction tests | Makes the surface usable rather than merely large |
| **P4** | Zoning two-layer (§6) | definition-source presence check | Matt's named requirement |
| **P5** | Long tail to 239 + facet counts (§2.2) | `ci:search-field-completeness` ratchet | Volume, once the frame holds it |

## 13. Measurement

Baseline to stamp before P2 ships, from `user_events` (`search_filter_apply`
already fires): filters used per session, distinct filters ever used,
zero-result rate, and saved-search creations. Targets are set after one week of
baseline rather than invented now — a §0 rule applied to our own goals.
