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

**Built 2026-08-26.** `get_place_character()` measures it, `lib/data/places/getPlaceCharacter.ts`
decides what may be said, `components/site/PlaceCharacter.tsx` says it. Wired at all three
grains. The sample floor and the copy live in the same file, and
`lib/data/places/getPlaceCharacter.test.ts` holds the refusals.

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

**Built 2026-08-26**, same three files as R1. Dues are additionally measured over a
36-month window rather than over a place's whole listing history: dues are a current
fact, and a 2008 figure published as this year's median is a wrong number. The window's
actual opening date rides along in the row so the copy states the real one.

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

**Built 2026-08-26**, same three files as R1, and deliberately one notch stricter than
this rule: a reported-yes count of ZERO is not published either. "0 of 161 listings that
reported it have an HOA" is arithmetically a count and is read as "no HOA here", which is
the sentence this rule exists to prevent.

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

Applies to recorded CC&Rs, plats, and HOA documents. **Built 2026-08-26.**

**Rule.** A hosted document displays its **instrument number (or book and page) and county**,
and states that later amendments may exist and the current chain should be confirmed through
title.

**Why.** Oregon's recording statute (ORS 205.160) indexes only party name, document type, date
and instrument number — **there is no subdivision or plat field**, and no structured
cross-reference chaining an amendment to the declaration it amends. Nothing in the county
systems marks a declaration as current or superseded. A hosted CC&R that misses a 2019
amendment looks authoritative and is wrong, and no statutory safe harbour for that was found.

### The trap, measured

The source is the Deschutes County Title public index — 3,787 documents across 971 subdivision
names, each row carrying its recording reference, and 645 names carrying an enumerated
amendment chain.

**It is a title-plant research bucket, not a curated governing-document set.** It files
everything recorded that touches a plat. Across the 2,189 documents ingested:

| Bucket | What is actually in it |
|---|---|
| `Larch Meadows` | a warranty deed |
| `Indian Ford Meadows` | Crooked Horseshoe Homeowner's Association declarations, a water-system sale agreement, an easement, a contract assignment |
| `Awbrey Court` | declarations titled VALHALLA HEIGHTS PHASE IV |

Corpus-wide, instruments that are not governing documents at all: **118 easements, 41 deeds,
40 liens, 16 trust deeds, 12 assignments**. Publishing the bucket verbatim under the heading
"CC&Rs and governing documents" puts another subdivision's declaration, and a warranty deed, in
front of a buyer as this plat's governing documents.

### How R7 is enforced

**Two tables, because one instrument serves many plats.** `place_document` is the recorded
instrument; `place_document_link` is its association to a place. The Tetherow declaration
governs seven phase-level plats and is stored once.

**The gate lives in the database, not in a script** (§6). `place_document_link_publish_gate()`
refuses the write. Two conditions, deliberately asymmetric:

- **`doc_kind` must be a governing instrument** — always, no human override. A warranty deed is
  not this subdivision's CC&Rs no matter who says so.
- **the document's own text must name the subdivision** — unless a human reviewed the link. OCR
  reads the first pages only, so a one-page amendment may never restate the plat name, and a
  reviewer who opened the PDF knows more than the OCR does.

The anon RLS policy is `status = 'published'`, so an unreviewed match is unreadable rather than
merely unrendered.

**The scans have no text layer**, so on-device OCR reads their front matter. Three signals feed
the name check, strongest last: a fuzzy token scan; the county's stamped instrument number
compared against the index reference (887 of the 1,036 applicable documents agree — when they
agree the document is definitively the one the index claims); and a foreign-association check
that flags a document whose front matter names only associations foreign to the plat. The last
is what caught Crooked Horseshoe. It is deliberately narrow — a false flag only sends a real
CC&R to review, while a false pass puts a wrong CC&R on a page.

The clerk's own stamped document-type code (`D-CCR`, `D-BYLAWS`) outranks any inference from
title text and is tried first.

**A parent match clears without a human only on two independent confirmations.** The document's
own text names the place, AND the county's recording mark says this is the instrument the index
filed. For a year-instrument recording that mark is the stamped instrument number
(`two-signal-publish.mjs`). The book-page era has no instrument number, so it uses the mark it
does have — the volume and page the recorder stamped on **every page**, which increments
(`book-page-stamp-publish.mjs`). Requiring the index's book and page on one OCR'd page and the
same book with the next page on the page after it is what separates a stamp from a recital: a
declaration is full of references to other instruments, but only the recorder's header walks
forward one page at a time. Measured over 1,159 book-page documents: 0 fires in 3,476,975
(document, synthetic reference) pairs; 7 in 1,289,967 (document, every other real reference)
pairs, every one of them a stamp the document physically carries.

**Open item — the stamp proves identity, not governance.** A declaration titled ROCKWOOD ESTATES
PHASE IV is genuinely the instrument the index filed, and the parent match would still fan it
across all four Rockwood phases. `book-page-stamp-publish.mjs` holds a link whose document names
a different phase than the plat; `two-signal-publish.mjs` does not, and **99 links it published
sit on a plat whose phase their own document contradicts**. Matt's call whether a phase-specific
declaration belongs on its sibling phases at all.

**OCR text is never rendered as page copy.** Vision misreads microfilm-era type badly enough
that a quoted covenant would risk misstating a legal restriction. It is used for
classification, verification and search only.

| Match | Plats | Treatment |
|---|---:|---|
| At least one document cleared to publish | 1,072 | published |
| Pending only — unconfirmed, or an uncleared parent inference | 107 | `pending_review` at `/admin/place-documents` |
| Ambiguous parent | 0 | rejected — a guess is not a match |
| No CC&R in the index | 2,039 | no documents section |

Measured 2026-08-26 over all 3,218 `geo_type='subdivision'` plats: 4,220 published
links, 2,506 pending. Re-measure rather than quoting these — the pipeline moves them.

Standing check: `scripts/place-documents/verify.mjs` (`ci:place-documents`). It exists because
the trigger fires on the link, not the document — a document reclassified after its link was
published would otherwise leave a published link behind.

## What is NOT governed here

Prices, medians, months of supply, verdicts, and every other statistic remain the metric layer's
business — `REGISTRY.md` and `getMetric()`. Nothing in this file authorises computing a price
statistic at a grain the registry withholds.
