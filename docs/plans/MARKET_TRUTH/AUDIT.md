# Market Truth — adversarial audit brief

**Phase A of `EXECUTE.md`. Your job is to break this work, not to validate it.**

You were sent here by `EXECUTE.md`. Finish this brief, then return there and begin Phase B — unless
your verdict is "not safe to build from," in which case stop and report to Matt.

The package (`PLAN.md`, `SPEC.md`, `REGISTRY.md`, `DDL.sql`, `EXECUTE.md`) was produced by a prior
agent for a licensed Oregon principal broker. It will govern every market number the business
publishes, feeds client-facing CMAs and BPOs, and touches the broker's license. **Assume it is wrong
until your own queries say otherwise.**

During this phase: do not build, do not fix. Audit and report. Fixes happen in Phase B, informed by
what you find here.

---

## 0. Why an adversarial pass is warranted

The prior agent's own numbers, from this project:

- An initial forensic pass produced **116 load-bearing claims**. When each was independently
  re-derived, **9 stood as written, 106 needed amendment, 2 were false** — a **91% correction rate**.
- The agent wrote a first spec on the *unverified* version of those claims and shipped it. The broker
  had to force the re-verification.
- Two of the agent's own headline statements to the broker were later shown wrong by that
  verification: the root cause of the `/sell` defect, and "every days-on-market figure we publish is
  wrong."
- A claim that data was "unrecoverable" survived a full forensic pass and was only caught because the
  broker challenged it — the adjacent table holding the data had never been checked.

**The base rate on this material is that most confident statements need correction.** Treat a
confident sentence as a hypothesis.

---

## 1. Ground rules

1. **Re-derive, never re-read.** A claim is unverified until *your* query returns the number. Do not
   accept a figure because the document cites a query — run it.
2. **Counter-shape every absence claim.** Before accepting "X does not exist / is empty /
   unrecoverable," run a second, differently-shaped check and read
   `docs/DATA_COVERAGE_INDEX.md`, which lists every other table holding the same entity. This is the
   exact failure mode that already occurred here.
3. **A refutation is worth as much as a confirmation.** You are not scored on defects found.
4. **Say "I could not verify this."** Do not soften an unknown into a finding.
5. **Do not fix.** Report.

**Database:** Supabase project `dwvlophlbvvygjfxcrhm`, via MCP `execute_sql`. Prefix raw SQL against
DAL-guarded tables with `-- audit: <reason>`.

**SQL traps** (getting these wrong returns nothing, silently): `public.listings` uses RETS mixed-case
columns that MUST be double-quoted in raw SQL — `"ClosePrice"`, `"CloseDate"`, `"ListPrice"`,
`"ListDate"`, `"OnMarketDate"`, `"City"`, `"StandardStatus"`, `"PropertyType"`, `"SubdivisionName"`,
`"Latitude"`, `"Longitude"`, `"TotalLivingAreaSqFt"`, `"BedroomsTotal"`, `"ListingKey"`,
`"ListNumber"`, `"OriginalListPrice"`. Lower-case bare columns also exist: `property_sub_type`,
`year_built`, `county`, `parcel_number`, `purchase_contract_date`, `off_market_date`, `was_relisted`,
`back_on_market_timestamp`, `buyer_financing`, `concessions_amount`, `close_price_per_sqft`,
`boundary_city`, `mls_source`. 595,379 rows — always aggregate or filter tightly. Read
`docs/DATABASE_SCHEMA_SNAPSHOT.md` rather than querying `information_schema`.

---

## 2. Where the prior agent is weakest — start here

These are self-identified soft spots. They are the most likely places to find real defects.

### 2.1 The registry predicates have never been executed
`REGISTRY.md` §2 and §3 are written SQL that **has never been run**. For each:
- Does it parse and execute?
- Does the `closed` population predicate **over-exclude**? The duplicate-suppression clause uses a
  window function inside a WHERE-shaped context — verify it is even valid where it is placed, and
  measure how many legitimate sales the whole predicate drops versus the naive convention.
- Does the order-of-magnitude typo filter catch real typos without eating genuine sales (a genuine
  10× list-to-close ratio, an auction, a bulk transfer)?
- Do the twelve segment predicates sum to the whole table with no row double-counted and none
  orphaned? Run the partition test.

### 2.2 The DDL has never been applied
`DDL.sql` has not run against any database.
- Does it apply cleanly?
- Is the unique partial index on `place_membership` actually enforceable given real data — i.e. can
  the smallest-polygon rule always pick exactly one winner, or do ties exist (identical areas,
  duplicate polygons)? **Measure the tie rate.**
- Is `market_metric`'s primary key sufficient, or can two definitions of the same stat collide?
- Are the `CHECK` constraints satisfiable by the data as it exists?

### 2.3 The stat inventory may be incomplete
The claim "38 statistics from 9 engines" came from **one agent's sweep** and was never independently
re-derived at the inventory level. Do your own sweep of `app/`, `components/`, `lib/`, `video/`,
`scripts/` and the CMA/BPO/newsletter builders. **Is anything rendered that the registry does not
cover?** A stat that exists on a surface but not in `REGISTRY.md` is a hole in the whole design.

### 2.4 The floors and the ladder are proposals, not findings
`min_n` of 5/10/30 and the 12→24→36 window cap were **chosen by the prior agent**, not derived.
- At each floor, what fraction of cells publish at city, neighborhood, community grain?
- Does a 36-month cap actually rescue subdivision grain, or is the claim that 515 of 680 Bend
  subdivisions never clear 10 sales in 36 months correct — and does that make the ladder pointless
  at that grain?
- Is 30 the right floor for a verdict that can flip on seasonality alone?

### 2.5 The service-area list is newly invented
`market_service_area` in `DDL.sql` replaces three existing definitions with a new 18-city list.
- Does switching to it move any currently published number, and by how much?
- Are the five `fringe` cities right, and is Mitchell (Wheeler County) genuinely in this market?
- Is Metolius really absent from the pricing corpus, and is that really a defect rather than a
  deliberate exclusion?

### 2.6 The corrections may have been mis-carried
106 claims were amended. The prior agent then rewrote `SPEC.md` by hand from those corrections.
**Sample at least 15 corrected claims and check the spec states them faithfully** — right number,
right scope, right direction. A correction that was itself mis-transcribed is invisible otherwise.

### 2.7 Best-practice claims are the least verifiable
The industry-standard definitions (NAR, Redfin, Altos, Case-Shiller) came from web research. Check
them against primary sources and flag anything asserted as consensus that is actually contested.

---

## 3. What to attack, by document

**`SPEC.md`** — every number. Especially: the `/sell` figures (488 of 781, 37.5%, 3.52–3.54 vs
4.46–4.51, the 20.9%-of-closes asymmetry, 8.03 months in the excluded ring); the days-on-market table
(25 / 58 / 62 / 63–64); sale-to-list (95.7% vs 99.3%, the 1.90 + 1.67 decomposition); the polygon
overlap rates and the 1.33×/1.50× inflation; the neighborhood polygon pathologies (57 pairs, 11,496
acres, `ST_IsValid`); the cube's never-run cron; **and every sentence marked `[was wrong]` — verify
the correction, not just the original.**

**`REGISTRY.md`** — every predicate and every earliest-year floor. Is `days_to_contract` really
untrustworthy before 2006? Is sale-to-original-list really unusable before 2002? Do the exclusions
belong where they are placed?

**`DDL.sql`** — as §2.2.

**`EXECUTE.md`** — are the "done when" clauses actually checkable, or do any require judgment? A step
whose completion is a matter of opinion is a defect in the brief.

**`PLAN.md`** — is the architecture sound, or is there a materially simpler design that meets the
same constraints? Say so if there is.

---

## 4. Also look for what nobody asked about

The prior agent worked from a fixed question set. Independent risks it may never have considered:

- **Does the layer break anything downstream** — SEO/JSON-LD structured data, the sitemap, cached
  ISR pages, email templates already sent, the video producers' hardcoded as-of dates?
- **Does D1 (single family = detached only) break existing content** — blog posts, published market
  reports, YouTube descriptions asserting numbers computed the old way?
- **Is restating days-on-market history a compliance problem** — figures already published to clients
  in CMAs will not match a restated series.
- **Row-level security and anon exposure** on the new tables.
- **Cost and runtime** — will the compute job finish, and what does it cost per run?
- **What happens on the day the feed changes again?** April 2026 already broke `buyer_financing`
  format and `property_sub_type`. Does this design detect that class of break, or absorb it silently?

---

## 5. Deliverable

Write `docs/plans/MARKET_TRUTH/AUDIT-FINDINGS.md`:

1. **Verdict** — is this package safe to build from, as-is / with the listed fixes / no.
2. **Findings table** — id · document · claim audited · your verdict (`confirmed` / `overstated` /
   `refuted` / `unverifiable`) · your numbers · severity (`blocker` / `major` / `minor`) · fix.
3. **Coverage** — what you checked and, explicitly, **what you did not check and why**.
4. **Simpler alternatives** — anything the design over-builds.
5. **Missing** — stats, surfaces or risks the package does not cover.

Rank blockers first. A blocker is anything that would put a wrong number in front of a client or a
regulator.

Commit the findings file, register it if the process-canon gate asks, and push. Do not modify the
other five files during Phase A — the build phase does that, informed by your findings.

Then return to `EXECUTE.md` and begin Phase B at Step 0.

---

## 6. Scale

This is foundational and the broker has been explicit that thoroughness beats speed. Use parallel
agents freely: one per document, one per weak spot in §2, plus an independent stat-inventory sweep.
Verify each of your own load-bearing findings with a second agent before writing it down — that is
the step whose absence caused the 91% correction rate in the first place.
