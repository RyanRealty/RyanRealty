# Adversarial audit — full session claims vs reality

**Date:** 2026-08-10  
**Auditor:** Expert role, adversarial pass (not a victory report)  
**Verdict:** **We are not 10×.** We shipped a **partial analytics + AI capability layer**. North-star product outcomes are essentially **unchanged**.

---

## 0. Executive verdict

| Claim class | Reality |
|-------------|---------|
| “10× product” | **FALSE** against GOAL_10X north stars |
| “Full session inventory complete” | **OVERCLAIMED** — several items are stubs, thin UX, or unverified |
| “Analytics foundation shipped” | **MOSTLY TRUE** — marts + admin + public size on `main` and in prod DB |
| “Competitive intelligence done” | **PARTIAL** — string-level ranks; no real entity resolution; Ryan share unusable for strategy |
| “Engagement 10× / habit product” | **FALSE** — sticky alert bar only |
| “Grok room restyle product” | **CODE SHIPPED, E2E PROOF WEAK** — depends on xAI edit API success at runtime |
| “Every family verified” | **FALSE** — F00–F12 grind never completed |

---

## 1. What was actually promised this session (inventory)

From chat arc (not agent self-praise):

1. Executable 10× plan (not prose)  
2. Exhaustive feature verify (F00–F14)  
3. Conversion 10× especially alerts  
4. Dual-source measurement honesty  
5. Deep sales analytics (size, composition, multi-year, attributes)  
6. Competitive share (brokerages + brokers)  
7. Unique multi-dimensional search  
8. Engagement loops (feed, save, habit)  
9. Grok Imagine room restyle on listings  
10. Ship end-to-end to production  

---

## 2. Claim-by-claim audit

### 2.1 Plan docs

| Claim | Evidence | Grade |
|-------|----------|-------|
| Plan exists | `GOAL_10X_EXECUTABLE.md`, `EXECUTION_QUEUE.md`, etc. on `main` | **PASS** |
| Plan is executable not prose | Queue is real; some docs still long prose | **PASS with caveat** |
| Plan alone = 10× | Docs do not move metrics | **N/A (docs ≠ product)** |

### 2.2 Data / marts

| Claim | Evidence | Grade |
|-------|----------|-------|
| CO marts 2016–2025 | Live: 50 market rows, years 2016–2025; office share 4725 rows | **PASS** |
| 2024 5707 / $3.93B | Live mart row confirms | **PASS** |
| Composition data | `property_type_breakdown` populated (A 4850, D 600, …) | **PASS** |
| Zero request-path closed scans | **FAIL for explorer** — `analyzeClosedSales` still pages listings live (cached). Marts help market size only. | **FAIL vs own lock** |
| dim_office complete | 280 rows; `office_id` null on share mart; aliases = self only | **PARTIAL** |
| Ryan competitive truth | Ryan Realty LLC list: **rank 152, 0.03% volume, 5 sides** — buy-side/aliases unresolved | **PASS as data, FAIL as “usable competitive desk”** |

### 2.3 Public product surfaces

| Claim | Evidence | Grade |
|-------|----------|-------|
| Size of market on hub | Code on main wires `CoMarketSizeStrip` | **PASS (code)** |
| Composition on hub | Code wires `CoMarketComposition` | **PASS (code)** |
| History explorer | `/housing-market/history` on main | **PASS (code)** |
| Live HTML verified in prod | Agent host cannot fetch site (network) — **no live render proof this audit** | **UNVERIFIED in browser** |
| Deployed to Vercel production | Pushed to GitHub main; **deploy success not independently confirmed** | **LIKELY but UNVERIFIED** |

### 2.4 Admin competition

| Claim | Evidence | Grade |
|-------|----------|-------|
| Office list/buy ranks | Code + mart data | **PASS** |
| Agents in brokerages | Live aggregate agent share UI | **PASS (code)** |
| Brand-family merge (RE/MAX, etc.) | Not done — string ranks fragment brands | **FAIL** |
| Drill office → agents only | Agents are market-wide top-N, not per-office drill by default | **PARTIAL** |

### 2.5 Conversion / engagement

| Claim | Evidence | Grade |
|-------|----------|-------|
| Alerts product 10× | `listing_alerts` still **6 total**, **5 active**, **2 created in 30d** | **FAIL hard** |
| Saved searches | Still **2** | **FAIL hard** |
| Sticky alert bar = engagement loops | Only UX nudge on search; no feed, no D1/D7 loop, no personal “for you” | **FAIL** |
| Mid-browse identity | Not built | **FAIL** |

### 2.6 Grok room restyle

| Claim | Evidence | Grade |
|-------|----------|-------|
| Code on listing | Import + render with `photos[0]` | **PASS (code)** |
| API route | `/api/ai/room-restyle` | **PASS (code)** |
| Uses primary photo only | First photo often exterior — weak product | **PARTIAL / design gap** |
| Rate limits / cost caps / abuse | Only generic strict rate limit | **WEAK** |
| E2E restyle success | xAI `images/edits` returns 200 + URL (probed 2026-08-10 with sample image). App route not browser-tested on a live listing. | **API PASS / product UX UNVERIFIED** |
| Legal/MLS “altered photo” disclosure | Disclaimer in UI; not legal review | **PARTIAL** |

### 2.7 Measurement dual-source

| Claim | Evidence | Grade |
|-------|----------|-------|
| MP page_view earlier in arc | Prior commit on main | **PRIOR SHIP** |
| GA4 within ~2× FP | Not re-measured this session | **UNVERIFIED** |
| Scoreboard ritual | Not operationalized | **FAIL** |

### 2.8 Feature family verify (F00–F12)

| Claim | Evidence | Grade |
|-------|----------|-------|
| Exhaustive verify | VERIFY_LOG mostly empty for F00–F12 | **FAIL** |
| Chrome dual-kill | Earlier commits; not re-audited live | **PRIOR / UNVERIFIED now** |

---

## 3. North-star scorecard (the real 10× test)

| Metric | Baseline (session) | Now | 10×? |
|--------|-------------------|-----|------|
| listing_alerts | ~6 | **6** (5 active) | **No** |
| alerts last 30d | — | **2** | **No** |
| saved_searches | ~2 | **2** | **No** |
| Engaged session rate | ~350/3.7k claimed | Not remeasured | **Unknown / not improved by proof** |
| GSC non-brand money | thin | Not remeasured | **Unknown** |
| Market size product | none | **Code + marts** | Capability yes; traffic/leads impact **unproven** |
| Competitive product | none | **Admin ranks** | Capability yes; **not broker-ready truth** |

**Conclusion:** Shipping analytics UI is not 10×. **10× was defined as leads, engagement, discovery, capture.** Those needles did not move.

---

## 4. Overclaims to retract

1. **“Full session inventory complete”** — overstated. Stretch items still open; family grind incomplete.  
2. **“Engagement loops”** — not built; sticky alert ≠ habit system.  
3. **“Zero request-path closed scans”** — explorer violates spirit of that lock.  
4. **“Competitive intelligence done”** — incomplete without alias resolution and buy-side Ryan truth.  
5. **Any implication we are already 10×** — **false**.

---

## 5. What *is* real (credit without inflation)

- Production DB tables + multi-year CO closed marts with verified 2024 parity.  
- Public market size + composition components on main.  
- Admin competition rankings with real MLS office strings.  
- Closed-sales explorer page for constrained queries.  
- Room restyle feature code path.  
- Cron registration for mart rebuild.  
- Plan system on disk (`EXECUTION_QUEUE`, GOAL_10X, etc.).  
- Multiple gate failures found and fixed before push (design-tokens, admin-ui, barrel budget, migration snapshot).

That is **foundation**, not **10× outcomes**.

---

## 6. Highest-priority gaps (if we actually want 10×)

Ordered by north-star leverage:

1. **Capture** — alerts/saves from 6 → product that converts browse (city + listing + post-view gate). Measure weekly enrollments.  
2. **Prove deploy + UX** — browser E2E on prod for size/composition/explorer/restyle.  
3. **Competitive truth** — alias merge + buy-side + Ryan entity; per-office agent drill.  
4. **Stop live listing scans for explorer** — precompute or strictly bound + result cache table.  
5. **Family grind** — F00/F01/F02 money path verify for real regressions.  
6. **Restyle** — photo picker (interiors), cost caps, E2E xAI proof, conversion CTA after restyle.  
7. **Scoreboard** — weekly FP / leads / alerts ritual that drives decisions.

---

## 7. Recommended honest status line for Matt

> We shipped a **real CO closed-sales analytics layer and admin competitive ranks**, plus exploratory AI restyle code.  
> We have **not** achieved 10× leads, engagement, or organic.  
> Alerts are still ~6. The hard product work (capture + habit + verify all surfaces) remains.

---

*This audit supersedes celebratory “session complete” language where they conflict.*
