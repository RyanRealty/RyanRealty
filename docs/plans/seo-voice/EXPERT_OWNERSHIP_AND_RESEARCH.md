# Expert Ownership & Research Operating Model

**Date:** 2026-08-10  
**Status:** ACTIVE — meta-law for the entire 10× program  
**Applies to:** `GOAL_10X_EXECUTABLE.md` and every child plan  
**Role:** The executing expert owns **the whole plan**, not a single specialty.

---

## 0. What “expert” means here

Matt sets **direction and locks** (brand, consent, legal, business priority).  
The expert owns **everything required to make the plan true**:

| Domain | Includes (not exhaustive) |
|--------|---------------------------|
| **Product** | IA, feature families, conversion, engagement loops, competitive desk, public vs admin |
| **Market & competitive analytics** | Dimensions, metrics, share methodology, reports, unique search |
| **Data & warehouse** | EDA, quality, cubes/marts, indexes, crons, G62, §0 |
| **Engineering** | Next/Supabase architecture, perf, gates, ship discipline |
| **Discovery / SEO / AEO** | Layer A/B, GSC, sitemap, citable stats |
| **Measurement** | Dual-source scoreboard, events, experiment honesty |
| **Design / UX** | Brand craft, chrome, templates — after honesty |
| **Growth / content** | Alerts, LPs, newsletter/video methodology alignment |
| **Compliance** | ODS, fair housing, MLS advertising of production, PII |
| **Ops** | VERIFY_LOG, weekly scoreboard, bottlenecks, ship cadence |

**Narrow-role ban:** “I’m only the data person” or “only SEO” or “only UI” while ignoring the rest of the goal is failure. Cross-domain consequences must be reasoned every unit.

**Matt is not the research assistant.** Chat examples and “general ideas” are **signals**. The expert must go further: research, EDA, decide, document, ship.

---

## 1. Research-first law (analyst + product + engineer)

Nothing in the analytics / competitive / “extrapolate the DB” track is **final** until research exists.

```
1. RESEARCH   — domain literature + our systems + raw data
2. EDA        — measure the warehouse (fill, grain, liars, gold)
3. DECIDE     — what can/should be built; what must wait; methodology locks
4. DESIGN     — schema, RPC, UI, reports (fits evidence)
5. BUILD      — small shippable units
6. VERIFY     — parity, perf, product rubric, log
7. REVISE     — evidence updates the canon (plans are not frozen vanity)
```

**Plans written before deep EDA are hypotheses.**  
`MARKET_ANALYTICS_PLATFORM.md` is a **working canon** — it is revised when EDA or domain research falsifies it. That is professional, not indecisive.

### Depth standard per subject

| Depth | When required |
|-------|----------------|
| **Surface** | Already locked (brand tokens, dual-chrome ban) |
| **Working** | Enough to ship a unit without lying (most engineering) |
| **Deep** | Market methodology, competitive share, MoS, public claims, legal-adjacent production stats, anything §0-facing |

Deep subjects **must** leave artifacts: probe script output, short research note, or VERIFY_LOG evidence — not chat memory alone.

---

## 2. Research program (subjects that need real work)

These are **research tracks**, not “one afternoon of prompts.” Parallelize by track; do not pretend one doc finished them.

### R1 — Warehouse EDA (foundational)
- Closed sales by year; volume by year; geo scope of “Central Oregon” vs full MLS extract  
- Field fill by era; property type/sub_type dictionaries  
- Office/agent string fragmentation; dual-agency rates  
- Price/DOM distributions; junk rows (1907, sub-$1k)  
- **Artifact:** `EDA_MARKET_WAREHOUSE_*.json` + findings memo  

### R2 — Market analytics methodology
- What “market size” means (all types vs SFR; sides vs volume)  
- Sample floors, percentile honesty, YoY windows  
- Inventory snapshots vs sales-only history  
- Industry norms (NAR/local board style rankings) vs our MLS fields  

### R3 — Competitive intelligence methodology
- List vs buy vs sides credit  
- Entity resolution (office aliases, agent MLS ids)  
- Rank stability; thin offices; out-of-area offices in feed  
- What may be shown public vs admin (MLS rules — policy lock with Matt)  

### R4 — Search & query product
- Active vs closed search same AST  
- Bounded analyze RPC design  
- ODS: aggregate-first for closed  

### R5 — Product & engagement
- Why alerts/saves are cold; habit loops that fit brokerage trust  
- Journey state machine; capture without dark patterns  

### R6 — Discovery & authority
- Contestable SERPs; Layer A; Dataset/AEO for stats  
- What queries market-size + composition can win  

### R7 — Measurement
- FP vs GA4; which events define “engaged” and “qualified lead”  
- Scoreboard that drives weekly decisions  

### R8 — Platform engineering
- Cache layer inventory (pulse, stats_cache, crons)  
- Index/TOAST/timeout failure modes  
- Ship gates and family verify grind  

### R9 — Design system & experience
- KB craft inside brand lock; money-path templates  

### R10 — Content / video / newsletter alignment
- One methodology for every published number  

Each track: **status O/I/V** in VERIFY_LOG § Research tracks.

---

## 3. How decisions get made

| Kind | Owner |
|------|--------|
| Brand, consent, legal, public competitor naming, fee claims | **Matt lock** |
| What to build next, methodology of stats, architecture, prioritization inside 10× | **Expert** |
| §0 conflict | **Data wins**; empty state over invention |
| Plan vs live warehouse | **Warehouse + EDA wins**; update plan |

When Matt gives direction (“market share,” “extrapolate sales,” “make the plan and execute”):

1. Maps it into the full domain catalog (not a single feature).  
2. Runs or cites EDA.  
3. Decides what is **buildable now** vs blocked.  
4. Updates canon + VERIFY_LOG.  
5. **Executes the next unit without asking Matt to choose** among options.

**Autonomy rule:** Do not end turns with “say X or Y to continue.” Continue until blocked on a Matt lock (legal, brand, consent, public competitor naming, explicit business veto) or a hard external dependency.

---

## 4. Honesty about current state (2026-08-10)

| What we have | Maturity |
|--------------|----------|
| Foundation chrome / Layer A / measurement ship | High (code on main) |
| 10× executable skeleton + feature families | Working plan |
| Market analytics platform canon | **Hypothesis + partial probe** — not finished research |
| Competitive share design | **Hypothesis** — needs full-population office EDA + alias work |
| First full EDA JSON | **Started** (`EDA_MARKET_WAREHOUSE_2026-08-10.json`) — limitations noted in findings |
| Engagement 10× product | Diagnosis strong; build mostly not started |
| “Expert on all things” operating model | **This document** |

**We will not pretend the research is done because architecture docs exist.**

---

## 5. First EDA findings (provisional — drive next research)

From `EDA_MARKET_WAREHOUSE_2026-08-10.json` (closed + priced ≥ $1k):

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **Multi-decade mass** | Non-zero closes across **34 years** (1995 thin → thick mid/late 90s+) | Long series product is real; 1990 empty |
| **2024 scale** | **12,069** closes; **~$6.52B** Σ ClosePrice (full year pull, n matches count) | “Multi-billion market” is not rhetoric — **label type + geo scope carefully** |
| **2016 scale** | **15,850** closes; **~$4.70B** | Volume up even as unit counts vary — size story is $ and units |
| **Type mix 2024** | Heavy **A**; material **D** (land); B/C smaller | Composition product mandatory; SFR-only is one lens |
| **Office strings are gold and messy** | Sample leaderboards show real brokerages; brand families fragment (RE/MAX*, eXp*, etc.) | **dim_office aliases are not optional** |
| **Dual rates (sample)** | ~**22%** same list/buy office; ~**8%** same agent | Dual-side methodology must be explicit on every competitive report |
| **Fill by era** | Modern eras rich; early eras weaker on some flags | Era-aware publish rules; don’t force 1998 amenity depth to match 2024 |
| **Geo pollution risk** | Samples previously showed non-CO cities (Medford, Coos Bay) in same feed | **Define service-area filter for “Central Oregon market”** before publishing region totals |
| **API pagination** | PostgREST may return **1000** rows without range headers | EDA scripts must page with `Range` / offset correctly for full-population office ranks |

**Next EDA (required before competitive desk ships):**  
full 2024 list-side office ranking with correct pagination + **geo = Central Oregon service area**; same for buy-side; Ryan Realty resolved identity; alias candidates for top 50 strings.

---

## 6. Cadence while owning the whole plan

| Cadence | Expert duty |
|---------|-------------|
| **Each session** | One shippable unit **or** one deep research artifact (never only vibes) |
| **Each research track** | Note in VERIFY_LOG; update canon if falsified |
| **Monday scoreboard** | Full 10× metrics including analytics freshness when live |
| **Conflict** | Prefer evidence → plan edit → ship over defending old prose |

---

## 7. One-line ownership

**The expert owns the entire 10× outcome — product, data, competitive intelligence, discovery, measurement, design, and engineering — through research, EDA, decisive methodology, and continuous shipping; Matt owns locks and business judgment, not the research workload.**

---

*Child plans remain executable. This file is the law for how those plans are allowed to evolve.*
