# CMA — state of the world (2026-08-27)

**Why this file exists.** Matt, 2026-08-27: "we cannot come to a locked-in process and a
beautiful page/report and we are so tangled that it's impossible to move forward, unfuck this."
The tangle was measured, and it is not missing work — it is **stale claims about finished work**.
Every new session read the stale docs, re-diagnosed, and added another layer. This file is the
reconciliation. When it disagrees with an older plan doc, THIS FILE WINS; when it disagrees with
the code, the code wins and this file gets corrected.

The authorities, unchanged: `docs/plans/CMA_SUNSTONE_CONTRACT.md` (client document),
`docs/plans/CMA_PRICE_OPINION_SPINE.md` (voice + spine), `lib/pricing/` (numbers),
`marketing_brain_skills/producers/cma/SKILL.md` (engine architecture).

---

## What is BUILT and VERIFIED (do not re-diagnose these)

Verified 2026-08-27 by reading the code end to end (two full audit passes with file:line
evidence) and building three live CMAs through the production worker.

- **One engine, three doors.** CMA, expired-audit and BPO share comps → judge → adjust →
  adversarial audit → contract. Gate `ci:valuation-engine` enforces it.
- **The 20-rung comp ladder** (`lib/pricing/ladder.ts`, Matt 2026-08-14): subdivision 3/6/9mo →
  wide-GLA same-subdivision → 1mi → 2mi → similar subdivisions → city/rural. Time widens before
  location at every step (Matt 2026-07-30).
- **The hard cuts hold on every rung:** product class (townhouse ≠ condo ≠ SFR, unknown fails
  CLOSED), whole baths, lot character at 1 acre, resort symmetry (Matt 2026-08-05), water,
  sewer, **US-97/Parkway/Deschutes divide** (`lib/pricing/divides.ts` — the Sunstone contract
  says this was "never built"; it is built), 30% subdivision price-tier, new-vs-resale,
  GIS-neighborhood on non-subdivision rungs.
- **GLA bracketing** exists (`match.ts` post-ladder swap).
- **The judge** (Sonnet) can exclude comps (never below 3), halves weak comps, is
  consistency-checked against its own band with one repair turn, and CODE decides verdicts.
- **The adversarial audit** runs on ~81% of builds (277/343); an unavailable audit forces
  `needs_review`, never a silent pass.
- **The accuracy contract** hard-fails comp floor, comp sanity, three methods, range order,
  product match, bath match; review-fails the rest. It refused all three of today's test
  builds — the refusals were CORRECT (see defects).
- **The renderer prints the recommended list + range on the cover** — pinned by
  `lib/cma/render-sections.test.ts` ("prints the recommended list on the cover"). The stored
  gold-house HTML (`cma-648-se-douglas`, built 2026-08-17) predates this and needs a REBUILD,
  not new code.
- **The gold house implements ~15 of the 16 Sunstone chapters** (verified in the rendered
  document): price-first "Why $513,000", status grid, 90-day sold band, market KPIs, band
  rivals, comp map with the subject polygon drawn, per-comp pages, subdivision, seller net,
  disclosure, next step.

## What is STALE and now corrected

- `CMA_SUNSTONE_CONTRACT.md` "Matcher cuts still required" — items 2 (product split),
  3 (divide cut), 4 (zoning field exists; see defect D4), 5 (GLA bracket), 6 (whole baths) are
  built. Item 1 (`PRICING_QUALITY_STOP`) is deleted from the code; only the gate fixture
  mentions the name.
- `cma-accuracy-pipeline-2026-07-11.md` unchecked boxes — the machinery those boxes describe
  now runs in production (judge, audit, self-repair, contract).
- The build-worker docblock and 340-draft backlog are a DELIVERY problem, not an engine
  problem — owned by the delivery workstream in `CROSS_AGENT_HANDOFF.md` (CMA claim block).

## The REAL defects (ranked by cost, each verified live)

- **D1 — comp starvation, 20 build failures.** The strict ladder cannot reach 3 sales
  (La Pine, Sisters, rural). The build dies with a correct §0 refusal — but the SELLER gets
  silence. Fix is not looser comps; it is the failed-build alert + hand-built path.
- **D2 — address resolution, 13 failures.** Mostly homes never MLS-listed — which is THE
  seller-CMA case. Needs a county/assessor-backed subject resolver, not just `listings`.
- **D3 — the ask-path band mismatch, 3 failures (all currently-listed subjects).**
  `recommended = ask×0.98÷sale-to-list` (deliberate, measured: within 10% on 98.31% of 8,648
  listed closes) but the low/high band stays comp-only and the ordering clamp only runs on the
  comps branch (`estimate.ts:272-275`). Matt's rule 2026-08-27: **show both, never blend** —
  a listed subject's document shows the comp-supported band AND the ask, with the gap stated.
- **D4 — zoning cut is inert.** `zoningCompatible` exists but `sale.zoning` is never populated
  (no column in `FACT_COLS`) and `CmaSubject` has no zoning field → always fails open.
- **D5 — silent fallback to the loose ladder.** `pickCompSource`: facts &lt; 3 comps → falls to
  `lib/cma/comps.ts` (no divide cut, weaker gates) with no disclosure on the document. Spine
  item 13 already specifies the required behavior: say which ring, and why.
- **D6 — distressed/non-arms-length filter unwired.** `extractRemarkFlags` exists; nothing
  calls it. Only the LLM judge's prose prompt sees remarks.
- **D7 — request source is prose.** `cmas` has no `request_source` column; provenance lives in
  a `generation_reason` sentence. 194 of 359 rows cannot name their own origin. Five sources
  exist (seller-form, expired-cron, fsbo-cron, broker-kickoff, buyer — the last not yet built).
- **D8 — contract failures persist nothing.** A failed build leaves an empty row: no comps, no
  pricing, nothing to review or rebuild from. The rebuild-with-notes flow needs the failed
  state persisted.

## The locked build order (Matt 2026-08-27: quality first, delivery after)

1. **D3** — show-both-never-blend for listed subjects (+ run the ordering clamp on every path)
2. **D5** — fallback keeps the hard cuts + tier disclosure on the document (spine item 13)
3. **D8** — persist failed builds so review/rebuild has something to work from
4. **D7** — structured `request_source` column + backfill from prose
5. **Rebuild the gold house** with the current renderer; tick all 16 chapters against the
   Sunstone PDF; then R-068 moves from PARTIAL
6. **Delivery** (already specified): failed-build alert LOUDER than success → SMS with review
   link → approve / rebuild-with-notes (structured controls) / send → auto-send OPTION per
   source (form requests first) → seller-sequence enrollment after delivery
7. D2 (assessor-backed subject resolver), D4 (populate zoning), D6 (wire the distressed flag
   into selection or explicitly record why not)

## What the reference PDF actually teaches (read page-by-page 2026-08-27)

RPR's Sunstone packet is beatable on substance: its "comps" for a Caldera Springs home are RVM
estimates on OFF-MARKET properties (an AVM stacked on an AVM), its market grain is the whole
97707 ZIP (Sunriver to La Pine), and its 90-day sold band is $650K–$1.69M. What it wins on is
COMPOSURE: 30 pages, one idea per page, a chart for every claim, consistent chrome, and a
confidence meter on every number. The contract's chapters ARE that composure. Our engine's
honesty (real closed sales, resort symmetry, §0 refusals) is the differentiator — the document
just has to look as finished as theirs.

---

## The field, researched 2026-08-27 (primary sources, vendor claims flagged)

Full briefing in the session record; what changes OUR decisions:

**The number that wins the listing conversation.** Zillow's own accuracy table (read
2026-08-27, stamped 2026-08-14): Oregon **off-market** Zestimate median error **6.40%** — 41%
within 5%, one in three off by more than 10%, one in seven off by more than 20%. The 1.48%
on-market figure is measured AFTER the list price is public and partly derived from it (Zillow's
engineering post says the Zestimate ingests the list price). A seller deciding what to list at
is by definition off-market. **Attack the off-market number specifically; never say "Zestimates
are inaccurate" flat — on-market they are not, and a seller who checks will catch it.**
Oregon is full-disclosure (ORS 93.030): the "AVMs can't see our prices" argument does NOT work here.

**The competitive floor is free.** RPR's AI CMA (Nov 2025, beta) ships four named pricing
strategies with LLM-written rationale, AI-scored comps, and a 20+ page branded report — free to
every NAR member, on every competing agent's phone. Cloud CMA produced 5.4M reports for 650K
agents last year with NO AI. "We generate a narrative" clears nothing.

**Where the AVMs stop is where our inventory starts.** Zillow: vacant land not eligible. RPR:
no RVM for agricultural/rural-incomplete-records, AI CMA supports no land or acreage. The 2026
CMA survey's top two comp problems — thin sales, unique rural/oversized-lot properties — are
Central Oregon's default condition. An AVM widens the radius silently; our engine names the
tier and says why (spine item 13). **That disclosure IS the product.**

**What the 2026 survey (n=2,165) says the winning report does** — and it maps 1:1 onto
decisions Matt already made:
- Pricing is the #1 seller objection (63.7%) and #2 reason listings are lost. **Lead with the
  number and its defense** — Matt's cover rule (2026-08-19) already says this.
- Comps: average min fell to 3.7, max to 8.7 — "curated, not comprehensive." Our floor 3 /
  target 8 / max 10 is already right. Show each comp's DOM and price cuts.
- "Too many pages" is a named complaint. One idea per page (the RPR packet's actual virtue).
- A dedicated **AVM-rebuttal chapter** — the property-specific reason the algorithm is wrong,
  not a generic slide. We can compute this: unreported condition, land, resort membership,
  divide-crossing comps the AVM used.
- **Nobody states a per-property uncertainty band** except RPR's star scale (5 stars = ±10% at
  90% — on a $750K Bend home that is ±$75K). Stating an interval EARNED from our own comp set
  is the widest open gap in the category.
- 59% of sellers hire the first agent they speak with; 76% of CMAs are delivered in person.
  Speed of the draft matters more than polish of the tenth revision.

**The unoccupied ground, verbatim from the research:** no shipped product runs
photos → condition → condition-adjusted comps → narrative → seller report with a stated
confidence interval. Clear Capital just paid to acquire Restb.ai for the condition signal
(May 2026). Our engine already has the honest half; the missing halves are the condition signal
and the stated interval.

**Immediate additions to the build order** (fold into the chapters work, not new workstreams):
- Chapter: "What the algorithms say, and why they're wrong about this home" — subject's
  Zestimate/RVM beside our number, with the named property-specific reasons.
- The recommended list ships with a supported interval derived from the comp band, stated in
  seller language, on the cover.
- Per-comp rows always show DOM and price-cut history (we already store listing_history).
