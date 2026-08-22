# Market Truth — adversarial audit findings

**Phase A of `EXECUTE.md`.** As-of **2026-08-22**. Hosted project `dwvlophlbvvygjfxcrhm`.
Worktree: `/Users/matthewryan/RyanRealty-wt-market-truth-20260822` at `origin/main` (`a508b828`).
SQL: `node /tmp/market-truth-audit/query.mjs` with `-- audit:` prefixes. Mixed-case listings columns quoted.
Load-bearing numbers were re-derived in this session and, where marked **dual**, independently re-derived by a second agent.

`DECISIONS.md` overrides `SPEC.md` / `REGISTRY.md` where they disagree.

---

## 1. Verdict

**Safe to build from, with the listed blocker fixes applied in the package files before Step 0.**

The spine is sound: one membership table covering listed and sold, one registry, one compute job writing provenance, one `getMetric` read, gates that fail the old path. That is the right architecture for Matt’s directive. Independent overlap, `/sell`, cache, D13, and thin-sample numbers re-derive. D1–D13 stay locked.

It is **not** safe to apply `DDL.sql` or to copy `REGISTRY.md` §2.1 as SQL until the blockers below are patched. Those defects would put a wrong number in front of a client, or fail the backfill, or ship a table the anon role can write.

It is **not** “no — not safe to build from.” The program should proceed.

---

## 2. Findings table

Severity: **blocker** = would put a wrong number in front of a client or a regulator, or would make Step 0’s Done-when false. Ranked first.

| id | doc | claim audited | verdict | numbers (this session) | severity | fix |
|---|---|---|---|---|---|---|
| B1 | REGISTRY §2.1 | `closed` predicate is executable SQL | **refuted** | Postgres `42P20`: `window functions are not allowed in WHERE` on the `row_number() OVER (...)` duplicate clause | **blocker** | Rewrite as `DISTINCT ON (btrim(parcel_number), "CloseDate"::date) ORDER BY … "ModificationTimestamp" DESC` (or a CTE). Do not paste §2.1 into a job. |
| B2 | DDL / REGISTRY | one `exclusion_reason` + row-level `is_publishable` records SPEC §3.4 | **refuted** | Retroactive entries stay in volume/price and leave speed; `sqft<=0` is $/sqft-only. A single boolean cannot do that. | **blocker** | `exclusion_reasons text[]` (or child table). Apply reasons **per `stat_id`**. Keep the row. |
| B3 | EXECUTE Step 5 | `/sell` “true” number is 988 homes / 4.52 months | **refuted** (and already marked `[was wrong]` in SPEC) | Pulse Bend **488 / 3.54**. MLS-city detached **775 / 4.42 months** (balanced). Type-A city-text **985**. 988 was the A bucket. **D1 is detached.** Live page today: **488 homes · 3.5 months · seller’s.** | **blocker** | Migration #1 target is MLS-city **detached**, not 988. Rewrite the EXECUTE bullet before anyone flips `/sell`. |
| B4 | REGISTRY §2.2 vs live writer | Coming Soon is never inventory | **refuted as implemented** | Live `refresh_market_pulse` counts `StandardStatus IN ('Active','Coming Soon')` (sell-lane read of the hosted function). Registry says exact `'Active'` only. | **blocker** | Registry wins. Change the pulse writer when it migrates; do not copy Coming Soon into `active_count`. |
| B5 | DDL | new `public` tables are not anon-exposed | **refuted as written** | Default ACL `anon=arwdDxtm`. Hosted `ensure_rls` fail-closes SELECT if the trigger runs; any env without it is world-writable. `sale_pricing_facts` already `REVOKE`s. | **blocker** | Copy facts: `ENABLE RLS` + `REVOKE ALL FROM PUBLIC, anon, authenticated` + `GRANT` service_role. `market_metric` may get an anon `SELECT … WHERE is_publishable` like cache. |
| B6 | REGISTRY `new_listings` / D11 | 90-day off-market reset is the industry DOM/CDOM rule | **refuted for CDOM** | Oregon Data Share §3-20 (Aug 2024): CDOM does not reset unless the property has been off market **60 days**. 90 days may stay as a *new-listings* de-dupe only. | **blocker** if 90 is applied to reconstructed CDOM | Adopt **60 days** for span / CDOM reset. Cite ODS §3-20 in REGISTRY. Keep 90 only on `new_listings` if we still want it, and label it. |
| B7 | DDL `place_membership_one_primary` | smallest polygon always unique | **overstated** | Closed SA 2021+ geocoded: **36,537** pts. 2+ subdivision **19.5%**, max **8**, inflate-of-in-any **1.33×**. Equal-area two-smallest: **194** (2.72% of 2+, 0.53% of all). 25 exact-duplicate plat pairs. **dual** | **blocker** for a no-tie-break backfill | `ORDER BY ST_Area, geo_slug`. Collapse `ST_Equals` replats. Unique index stays. |
| B8 | DDL `market_metric` PK | PK is enough if definitions coexist | **refuted** | PK omits `definition_id`. Inserting v2 of the same cell unique-violates. Same last-writer-wins hole as `market_stats_cache`. | **blocker** | Put `definition_id` in the PK, or current-def unique + history table. `getMetric` names the def. |
| B9 | DDL / EXECUTE Step 1 | `complete_through` on `market_fact_sale` | **refuted** (column missing) | Column exists only on `market_metric`. Pricing already reads a half-ingested month as complete (Aug facts 155 vs 286 qualifying). | **blocker** | Watermark on the fact load. A window ending after `complete_through` is non-publishable. |
| F1 | SPEC §1.1 | `/sell` polygon clip, 488/781, 37.5% vs 20.9%, 3.54 seller vs 4.46–4.51 balanced | **confirmed** (live inventory drifted) | Pulse **488 / 3.54** (updated 2026-08-22 22:03Z). City-text detached actives **775** (spec 781). 180d detached closes **1,051**. City-text MoS **4.42** balanced. Excluded-ring ~8 months. **dual** | major (live defect; D5 is the fix) | Membership by MLS city text for cities. |
| F2 | SPEC §1.1 | Redmond 191/277, Prineville 83/183, Sisters 35/113, Terrebonne 6/52, Terrebonne MoS NULL | **confirmed** | Pulse: 191, 83, 35, **6 / NULL**. City-text detached: 275, 181, 111, 51. Terrebonne 180d city-text closes **28**; **0** inside the CDP. CMA 12-month fallback is real. **dual** | **blocker** for Terrebonne CMAs | Same D5 fix. Until then High End clamp is computed off six polygon sales. |
| F3 | SPEC §1.2 | DOM table 25 / 58 / 62 / 63–64 | **confirmed** | Cache Bend `rolling_365d` `median_dom=25`. Pulse `median_active_dom=58`. City-text trailing-365d detached: `"DaysOnMarket"` **62**, list-to-close **63**. DOM = close−list−1 within 1 day on **98.2%** of that window (spec 98.8% all-closed). **dual** | major (label, not cache) | Gate 6. Label cache figure “days to pending.” |
| F4 | SPEC §1.3 | Cache clamped mean S2L 95.7% vs median close/final 99.3% | **confirmed directional** | Cache `avg_sale_to_list_ratio=0.95709`. Independent median close/final on city-text 365d detached **99.12%**; poly-SFR window reported **99.44%**. Price-change share on city-text 365d: **48.8%** (spec 45.2% — window/population). | major | Two registry entries. Ban mean at every grain. |
| F5 | SPEC §1.4 | Pulse 488 / 3.54 seller vs beacon 794 / 4.5 balanced | **confirmed** | Pulse 488 / 3.54. Beacon still `LIKE '%active%'` (admits AUC). Cache `end_of_period_inventory` **452**. “Three defs inside the cache layer” is **overstated**: 488 is pulse, 794 is beacon, 452 is cache eopi. | major | One `active_count`. |
| F6 | SPEC §1.7 | 19.5% / 17.3% overlap, 1.33× / 1.50×, 26.1% / 49.5% uncovered, max 8 / 5 | **confirmed** of-all; inflation is of-in-any | Closed SA 2021+ geocoded **36,537** (spec 36,536). Sub 2+ of-all **19.5%**, max **8**, of-in-any inflate **1.33×**, uncovered **26.0%**. Nbhd 2+ of-all **17.3%**, max **5**, inflate **1.50×**. `listing_boundary_xref_mv` is **on-market only** — closed overlap requires `ST_Within`. Cities never overlap. **dual** | major (summing) | `is_primary` + overlap gate. |
| F7 | SPEC §1.7 | 32.5% of actives in any neighborhood polygon sit in 2+ | **confirmed exact** | xref_mv Active neighborhood: 1,478 listings, 2,154 rows, **32.5%** 2+, max 5, inflate 1.46. **dual** | major | same |
| F8 | SPEC §1.7 [was wrong] | two slug alphabets / six never join | **confirmed as the correction** | La Pine MLS city is `"La Pine"` (19,847 rows), never `la-pine`. Pulse slug `la pine` vs boundaries `la-pine` means **La Pine is not polygon-clipped** (pulse 171 = city-text). Helper + `ci:city-cache-slug` exist. | minor (already fixed in code) | Keep the helper. Do not treat hyphenation as the /sell cause. |
| F9 | SPEC §1.11 / REGISTRY | 1,286 thin medians at n=3–4; none at n≤2 | **confirmed exact** | 708 n=3 + 578 n=4 = **1,286**. n≤2 with median **0**. n<5 with DOM **0**. Neighborhood 4,253/7,390 (57.6%) n<10. Subdivision 89/101 (88.1%). **dual** | major (threshold) | Registry min_n=10 for medians. |
| F10 | SPEC §1.11 | 515 of 680 Bend subs never reach 10 detached in 36 months | **integers confirmed; “detached” is false** | 515/680 is **type A**. Detached is **467/617** (same 75.8% rate). Ladder rescues some neighborhood/city-edge cells; it does not make subdivision a price-stat grain. **dual** | major (D1 mislabel) | Keep REGISTRY §4: subdivision publishes counts and sales, not prices. |
| F11 | DECISIONS D13 | 16-field YN scan | **confirmed exact** | n=**595,380**. spa/carport/home_warranty/attached: 0/0/595380. waterfront 1407/0/593973. fireplace **175,833**/0/419547 (SPEC §1.8 still says 175,832). pool 2623/1430/591327. garage 361662/72624/161094. Matches DECISIONS.md row-for-row. | — | D13 stands. Coverage threshold still open; adopt OMB 70% item-response as the house analog (only `garage_yn` clears). |
| F12 | SPEC §1.9 | G is lease; 4,335; median list $1.25; 98.2% under $10k; 595 clear ≥1000 | **confirmed exact** | 4,335; median list **$1.25**; 4,256 < $10k = **98.18%**; closed ≥1000 **595**. | **blocker** if G enters a sale median | Exclude G from every sale stat. |
| F13 | EXECUTE Step 7 | CDOM 500 non-null; `mls_source` constant; 26 `[object Object]`; 150 zombies | **confirmed** | CDOM **500**, all Closed. `mls_source='central_oregon'` on **595,380 / 595,380**. `buyer_financing ILIKE '%object Object%'` **26**. Zombies **150** (Expired 74 / Canceled 52 / Pending 17 / Closed 6 / Withdrawn 1). | major (repairs) | As written in Step 7. |
| F14 | EXECUTE Step 7 | `close_price_per_sqft=0` on 65,577 rows | **overstated** (drifted) | **67,079**. 66,506 of those have sqft≤0. | minor (count) | NULL them. Recount at repair time. |
| F15 | SPEC §1.10 | Metolius 324 detached closes, 14/yr, 17 actives, 0 in facts | **overstated grain** | All-time **324 is PropertyType='A'**, **246 detached**. Trailing-365d detached **11**. Actives detached **6** (type-A 8; all-status 18). 0 facts rows. **dual** | major (pricing hole) | Add Metolius to `pricing_is_central_oregon_city`. Publish 246 as detached. |
| F16 | SPEC §1.10 | Tumalo and Crooked River Ranch never occur as MLS `City` | **confirmed**; a different hole exists | 0 rows for those two strings. `"City"='Crooked River'` is **3,256** listings / **2,460** closed ≥1000 and is in **none** of the 16/14/18 published-region lists (analytics 24-list includes it). Last qualifying A close 2019 per pricing lane. | major | Decide: treat `Crooked River` as CRR (Jefferson) and include historically, or document the exclusion. Do not silently drop 2,460 closes. |
| F17 | DDL `market_service_area` 18-city list | replaces 16 / 14 / 24 and is the one to publish | **newly invented; wrong as the region list** | Live region = `is_central_oregon_city` **16 names** (includes Tumalo, Warm Springs, Crooked River Ranch as *names*; Metolius in). DDL **adds** Mitchell/Brothers/Paulina/Post/Ashwood (Mitchell is Wheeler) and **drops** Tumalo / Warm Springs / CRR. 16→18 moves trailing-365d type-A median **$608,000 → $605,680** on six Mitchell sales; detached median unchanged. **dual** | **blocker** if 18 ships as region | Keep the live **16** for published region stats (case-insensitive). Add Metolius to pricing. Keep 24 slugs as site/SEO allowlist only. Fringe five are not this housing market. |
| F18 | SPEC / DDL | county is unusable as the region key | **confirmed** | Bend: Deschutes 134,174 / NULL 107 / Crook 66. Terrebonne: Deschutes 3,608 / Jefferson 2,949 / Crook 115. | — | City text (D5). |
| F19 | SPEC §3.2 / EXECUTE Step 2 | 28,169 listings with `off_market_date` before on-market | **confirmed on date truncation; counter-shape differs** | `off_market_date < "OnMarketDate"::date` = **28,169** exact. Uncast timestamptz comparison = 46,538 (timezone artifacts on the same calendar day). Retroactive `CloseDate::date < ListDate::date` = **14,412** (spec 14,360). | major (loader) | Compare **dates**. Do not copy inverted `listings` timestamps into `market_fact_listing_span`. |
| F20 | REGISTRY §1 | twelve segment predicates partition the table | **overstated** | 11 letter/subtype predicates + fractionals + 1,657 `PropertyType='A'` with **NULL** subtype + 1 null PropertyType = 595,380. `all_residential` **overlaps** the A subtypes (428,505). Counts match REGISTRY within ±8 on the large A slices (detached 366,114 vs 366,106). Timeshare is **12** (listed in the exclusion list, omitted from D1’s table). | major (orphans) | Drop `all_residential` from the partition test. Give null-subtype A a named `unclassified_residential` (non-publishable) bucket. |
| F21 | EXECUTE / PLAN | 38 stats from 9 engines | **understated** | REGISTRY §3 has **29** `stat_id`s (not 28). Independent sweep: **~72** named figures that can reach a human; **16** live compute/write paths. PLAN’s 12 writers / 5 stores / 18 read paths is closer (19 modules under `lib/data/market/`). | major (holes) | Freeze a machine inventory before Step 4 “every live figure.” Add or kill the ranked holes (mean S2L, DOM label, all-type mart, JSON-feed extras, FRED/PITI). |
| F22 | SPEC §4 | “industry alignment, verified” on DOM / MoS / floors / S2L | **overstated as consensus** | DOM list-to-contract: vendor+GSE consensus, **not** a RESO/NAR formula (ODS delegates). NAR MoS is **current-month SAAR**, not 12-month closed — do not label `months_of_supply_12mo` “NAR-shaped.” Verdict bins are a **house heuristic**; RPR is ≤5.5 / 5.6–6.5 / ≥6.6. “Industry n≥10” is folklore. Median S2L is the right house override of Redfin’s clamped average. **dual** (primary sources + workflow journals) | major (labels) | Keep D2 and the 4/6 bins. Fix the sentences. Adopt ODS **60-day** CDOM reset. |
| F23 | SPEC §7 | two open questions for Matt | **refuted** (already closed in DECISIONS) | Q2 closed by D13. Q1’s era is wrong: unprovable spans are **2021-onward (17.3%)**, not pre-2016. Industry has no floor/band/exclude convention for the gap; D11’s labeled band is the compliance-safer house rule. Do not drop the 17.3% (makes the market look faster). | major (drift) | Rewrite §7 to “none; see DECISIONS.” Do not re-ask Matt. |
| F24 | SPEC §1.9 / REGISTRY | Sunriver TIC drag $65k / 8.8%; Camp Sherman 17.16% of detached | **mis-transcribed from the 106 amendments** | Verification dump said Sunriver **$67.5k / 10.0%** since 2020. Camp Sherman **18.66% of class A since 2015**, not 17.16% of detached. Crook PIP **0.08%** in the dump; SPEC still says **12.6%** (live subdivision attribution of Crook closed = 0; Brasada neighborhood is the 12% shape). **dual** vs dump | **blocker** for those published sentences | Re-derive before any Sunriver/Camp Sherman/Crook figure ships from this spec. Do not copy the stale numbers into the registry job. |
| F25 | SPEC header | 114 re-checked, 104 amended | **overstated** | Dump: 116 claims, **9 keep / 106 amend / 2 refuted**. AUDIT.md matches the dump. SPEC header does not. | minor | Correct the header. |
| F26 | SPEC §1.10 | 800-cap, dual time models, 0.98 haircut, 23-day sweep | **confirmed** | Bend detached 18mo GLA band **2,411** eligible, cap 800 (33%). Redmond 12-month-old: index **+6.37%** vs smear **−1.54%** (7.91 pts). `ASK_HAIRCUT=0.98` still live for listed close. Cron 8×200; cycle **23.36 days**; facts max close 2026-08-13 vs listings 2026-08-21. **dual** | major (CMA/BPO; outside the metric layer) | Either add EXECUTE Step 7b or waive §1.10 as a named follow-on. Silence is the defect. |
| F27 | DDL `market_in_service_area` | `IMMUTABLE` is honest | **refuted** | Function `SELECT`s a table. Planner may constant-fold. | major | `STABLE`. |
| F28 | DDL one-primary “at a time” | unique `(listing, geo_type, effective_from) WHERE is_primary` | **refuted** | Two current primaries with different `effective_from` and `effective_to IS NULL` both insert. `btree_gist` is not installed. | major | Unique on current (`effective_to IS NULL`) plus a range check. `CHECK (effective_to IS NULL OR effective_to >= effective_from)`. |
| F29 | EXECUTE Steps 5–9 | Done-when clauses are checkable | **refuted** | Steps 0–4 have Done-when. Steps 5–9 have checkboxes and no Done-when. Step 3 “every attribution path” and Step 4 “every live figure” have no frozen lists. | major (brief) | Add Done-when + freeze inventories. |
| F30 | CLAUDE.md / DATABASE_FOR_AI_AGENTS | Step 8 already done | **partial** | SFR restated to D1. CDOM dropped from CLAUDE.md §7. **Not done:** `"DaysOnMarket"` warning; verification-trace example still uses `PropertyType='A'`; `DATABASE_FOR_AI_AGENTS.md` still names CDOM as a normal column. | minor | Finish Step 8. Do not tick it. |
| F31 | SPEC §1.5 | seasonal MoM steps larger than CRM MoM | **overstated** | Aug 607.0 / Jan 346.6 **confirmed** as type-A CO, not D1 detached. Bend complete-month MoM is larger than ±3.3% (−9.4% / +7.2% reported). 6-month denom swing **1.33–1.39×** (spec 1.32×). min_n=30 does not stop a verdict flip; print the 12-month MoS beside the 6-month. | minor | Keep 4/6 bins; print window; store 12-month variant. |

---

## 3. Coverage

### Checked (this session)

- Hosted SQL against `listings`, `market_pulse_live`, `market_stats_cache`, `listing_boundary_xref_mv`, `boundaries` (`ST_Within` on 36,537 closed points), `is_central_oregon_city()`, YN columns, CDOM, `mls_source`, PropertyType G, buyer_financing, `close_price_per_sqft`.
- `REGISTRY.md` §2.1 parse (window function). Segment partition counts. 16 vs 14 vs 18 vs 24 city lists.
- Live `/sell` HTML. Pulse/cache writers as hosted functions (not only on-disk April SQL).
- `DDL.sql` `BEGIN…ROLLBACK` apply (second connection confirmed no leftover objects).
- Code inventory of writers and rendered stats (`app/`, `lib/`, CMA/BPO, JSON-LD, `/data/market`, newsletter).
- Primary sources: RESO DD 2.0, NAR EHS methodology + Policy Statement 7.96, ODS Rules Aug 2024, Redfin Data Center, RPR, Fannie UAD, OMB SPD 2. Workflow journals `wf_a1275209-fca` (DOM/relist) and `wf_9cb1e686-ddd` (feature coverage).
- The 116-claim dump in `~/.claude/projects/…/workflows/wf_{b688,7e96,5b9f,f9b6,813e,a9c0}*` (not in git). All SPEC `[was wrong]` sentences. 15+ amended claims vs current SPEC.

### Dual-checked (second agent independently re-derived)

Overlap 19.5%/17.3%/1.33×/1.50×/32.5%; area ties 194; thin medians 1,286; `/sell` 488/3.54 vs city-text balanced; pulse city ratios; D13 scan (orchestrator + DECISIONS row match); 515/680 grain; G-lease 4,335/$1.25/595; 800-cap 2,411; ODS 60-day CDOM; 16-city live region.

### Did not finish / did not check, and why

- **Full `REGISTRY.md` §3 formula execution** against Bend detached trailing-365d for every `stat_id`. The `closed` predicate does not parse, so the honest test is the rewritten CTE; a drop-ladder query was still running at findings time. Segment counts and the window-function failure are in. Treat remaining §3 numbers as **unexecuted**.
- **Analytics cube cron stamps, 2025 Bend 2,535 vs 2,182, office “No Office” rank, fireplace 62.89% vs search 74.6%.** Cube lane had not returned a findings file when this document was written. Do not tick those SPEC §1.8 rows confirmed. Counter-shape: `DATA_COVERAGE_INDEX.md` lists `analytics_v_closed_sale_co` (192,812) as the other closed-sales table.
- **DOM-era 4-row table (1.3% / 4.6% / 6.5% / 17.3% unprovable).** DECISIONS.md states it; this session did not re-run the 3.9M-event reconstruction. **Unverified here.** D11 still stands as the house rule pending that re-run in Phase B Step 2.
- **883 structurally bare rows.** Closest shapes 1,031 / 926 / 1,022. **Unverified.** Do not quarantine from memory.
- **Spark × Supabase 1% gate** on these figures. Not run.
- **Oregon Data Share per-field RESO Analytics fill rates** (JS app). Not retrieved.
- Live **ISR / JSON-LD** contents on production beyond `/sell`.

---

## 4. Simpler alternatives

Keep the spine. Do not invent a different program.

**Do not ALTER `sale_pricing_facts` into the publishable all-segment corpus.** That table is `property_type='A'` with product/lot/story/water/sewer/HOA classes and is the CMA/BPO pricing pool. D7 needs G/H/land/farm. A twin closed-sale table that is also the pricing pool splits the brain. **`market_fact_sale` as a new publishable layer** (DDL) plus **keep facts as the pricing moat** is the split that matches both jobs. Recency lane still has to land on facts (EXECUTE Step 1 / §1.10).

**Do not cartesian 3,213 subdivisions × 13 segments × 3 windows × 28 stats on day one** (~3.6M current cells; history is 10⁹). Shadow first on **region + cities + 28 neighborhoods**. Subdivision stays counts and individual sales (REGISTRY §4).

**`getMetric` during dual-run wraps old store + shadow**, publishes old until Matt signs the recon report (D3). Gate 2 is a counted allowlist, not a boolean on day one.

---

## 5. Missing

Stats / surfaces the package does not cover, that still render:

1. Public **mean** sale-to-list (`avg_sale_to_list_ratio`) — registry bans mean; it is what `/housing-market`, homepage, and CMA print.
2. **“Days on market”** as a label on cache `median_dom`, listing `"DaysOnMarket"`, CMA `CumulativeDaysOnMarket` (falls through to `"DaysOnMarket"`).
3. **ALL-TYPE** mart volume/composition on the hub (not `detached`, not even `all_residential`).
4. `/data/market` JSON feed extras (health score, pct over asking, 30d absorption, avg list, …).
5. **FRED / Case-Shiller / PITI** on `/housing-market` and listings — not MLS; still published figures. Registry is MLS-only.
6. Active-inventory **price-cut share** (weekly history) vs closed `pct_with_price_cut`.
7. Zip pages: inline median of `listing_tile` actives, DOM from tile `dom`.
8. JSON-LD Dataset + FAQ on housing/cities — same numbers Google already ingested; D1/D5 will change them.
9. SPEC §1.10 pricing engine (800-cap, dual time models, 0.98 haircut) — EXECUTE does not own it.
10. Feed-break detector (April 2026 class). Ingest still maps `[object Object]` → null and swallows it.
11. `Crooked River` as an MLS city (2,460 closed ≥1000) sitting outside every published-region list except the analytics 24.

---

## 6. Phase B entry conditions

Do these **in the package files**, then tick Step 0. Not optional:

1. Rewrite `REGISTRY.md` §2.1 without a window function in `WHERE`.
2. `exclusion_reasons text[]` + per-stat application; nullable city/price on excluded rows.
3. `complete_through` on the sale fact (or a job watermark table).
4. `definition_id` in `market_metric` PK (or equivalent).
5. `ORDER BY area, geo_slug` documented as the `is_primary` tie-break; unique current-primary.
6. RLS + `REVOKE` on facts/membership/spans; optional anon SELECT on publishable metrics.
7. `market_in_service_area` `STABLE`. Seed **the live 16**, not the invented 18. Metolius stays in.
8. CDOM/span reset **60 days** (ODS §3-20). Coming Soon never in `active_count`.
9. EXECUTE Step 5 `/sell` target = MLS-city **detached** (~775 / ~4.4 months today), not 988 / 4.52.
10. SPEC §7 closed; Sunriver TIC / Camp Sherman / Crook PIP numbers re-derived before they back a figure.
11. `IMMUTABLE` / header “three objects” / Steps 5–9 Done-when clauses.

Then apply `DDL.sql` as a real migration, recency lane on facts, and the rest of EXECUTE §4 top to bottom. Nothing public moves until the recon report (D3).
