# Execution Queue — sole live spine

**Mandate (U32):** *All items / plans discussed this session completed /endtoend.*  
**Not allowed:** silently reclassifying plan work as “stretch,” “later,” or “docs only.”  
**Allowed defer:** only a true external blocker (credential, legal lock, Matt veto) — logged on the unit.

**Read first:** `FULL_ARC_SYNTHESIS.md` · `ADVERSARIAL_AUDIT_SESSION_2026-08-10.md` · `SESSION_USER_PROMPTS_FULL.md` · `GOAL_10X_EXECUTABLE.md` · `SITE_FEATURE_VERIFY_IMPROVE_PLAN.md`

**Interrupt rule:** new prompt → **append** unit here. Do not abandon in-flight unit unless user cancels.  
**Done rule (development mode):** checkbox + evidence in `VERIFY_LOG.md` — code on `main` and/or browser/DB proof. **No baseline freeze required** while product is still moving; log a metric **snapshot** when a conversion/engagement unit ships (not a frozen program baseline).  
**10× claim ban:** until north-star metrics move (snapshots can trend without freeze).

---

## How we execute everything (dev mode — no freeze)

Standing orders so the full inventory actually runs (not just exists):

1. **One pointer only** — bottom of this file. Agent always does **that unit next**. Never “what should we do?” menus.
2. **One unit per grind** — open unit → ship or true blocker → update checkbox + VERIFY_LOG → advance pointer. Do not start three units in parallel on chrome/nav/kb.css.
3. **Interrupt = append, not replace** — new Matt prompt adds a numbered unit (or refines the current one). Current unit finishes first unless Matt says cancel.
4. **No silent stretch** — every open `[ ]` stays owed. Priority is order only.
5. **Handoff first** — after any compaction, re-read this file + pointer before new code.
6. **Blockers only when real** — credential, legal/brand/consent lock, Matt veto, or host cannot reach prod. Log on the unit; continue next unit.
7. **Metric snapshots, not freezes** — after B/F/G units, write one VERIFY_LOG line: alerts count, saves, date. Trend later; don’t stop development for a baseline week.
8. **Invocation** — Matt: `continue queue` / `/endtoend` / `run next unit` → agent opens this file, runs pointer, chains until blocked or session ends.

**Matt’s job while developing:** say continue / append new requirements; locks only (legal, brand, consent, public competitor names). Do not re-pick the program each turn.

**Agent’s job:** spine discipline + ship. Idle chat = nothing running — keep chaining turns via `/endtoend` or explicit continue.

---

## Reality board (honest)

| Plan area | Status |
|-----------|--------|
| Analytics marts / size / composition / competition admin | **Partial SHIP** (foundation real) |
| 10× leads / alerts / engagement | **NOT done** (alerts ~6) |
| Exhaustive F00–F12 verify | **NOT done** |
| Design / UI 2026 craft (G7 / P5) | **NOT done** — was plan, **was missing from this queue** (fixed below) |
| Layer A + seo-shell forever | **SHIP** (`ci:seo-shell` locked; C1 residual copy still partial) |
| Competitive entity truth | **Partial** |
| Report factory / feature cubes / inventory snapshots | **NOT done** |
| Habit engagement system | **NOT done** (sticky only) |
| Measurement ops ritual | **NOT done** |
| Grok restyle | **Code partial** |

---

## Full inventory (everything ordered must execute)

Order = ship sequence for leverage. **Empty checkbox = still owed.**  
`[x]` = done to bar · `[~]` = partial / code only · `[ ]` = open.

### Block A — Truth & systems (G0–G1)

1. [x] **A1 Baseline scoreboard** — FP sessions, engaged, alerts, saves, CO mart into VERIFY_LOG via `scoreboard-snapshot.mjs` (2026-08-10). GSC/GA4 still optional ops (access).
2. [~] **A2 F00 chrome systems** — dual chrome kill + PublicNav + menu CSS shipped; **prod browser V** still open
3. [~] **A3 Sitemap / GSC health** — `ci:sitemap-resolvable` + `ci:sitemap-inventory-gate` on every push; GSC console ops still human

### Block B — Conversion 10× (G4) — primary lead lever

4. [~] **B1 Capture product** — **2026-08-10 surface ship:** listing (city+price band+beds), neighborhood/OH/price-drops city inline capture; city alerts earlier; `alert_create` on KB form. Search sticky already. **Outcome still open:** enrollments ~6 until traffic proves lift.
5. [~] **B2 Saved search / save path** — **2026-08-10 surface:** navy SaveSearchButton + guest success confirmation on search + slug pages (`1e8cb1ec`). **Outcome open:** saved_searches ~2 until traffic.
6. [x] **B3 Valuation / CMA friction** — **2026-08-10:** verified ValuationForm → insertValuationRequest + FUB/CRM + trackEvent/CAPI/MP; hero CTA → `#valuation-form` + Lenis hash scroll; /sell form-first + link to `/sell/valuation`
7. [~] **B4 Listing primary CTAs** — **2026-08-10 surface:** PriceCtaStrip → `#listing-like-alerts`; RoomRestyle next-step alert + contact (`1e8cb1ec`). Tour/ask/save already on strip + broker CTA.
8. [x] **B5 LP alignment** — **2026-08-10:** `/lp/buyer-listing-alerts` copy + FAQ: same free `listing_alerts` product as `/search` + `/cities/bend`

### Block C — Discovery lock (G5)

9. [~] **C1 Layer A residual** — money families exact-match titles/H1s (partial ship)
10. [x] **C2 `ci:seo-shell`** — `scripts/check-seo-shell.mjs` + `npm run ci:seo-shell` in `ci:gates`; banned poetry + required exact-match H1/title; KbHero defaults Layer A locked
11. [~] **C3 Internal links from hubs** — Buy (+open houses), Market hub (+OH/price-drops/sell); cities already linked; sell form-first residual

### Block D — Exhaustive feature verify (G2–G3) — you rejected skip lists

12. [~] **D1 F00** chrome — code V (PublicNav); browser V **blocked L1 403**
13. [~] **D2 F01** Homepage — static I (seo-shell + structure); browser open
14. [~] **D3 F02** Search + listing — static I (capture/save/restyle wired); outcome cold
15. [~] **D4 F03** Areas — static I (city/community/nbhd capture)
16. [ ] **D5 F04** Lifestyle under Areas — not deep-audited
17. [~] **D6 F05** Market — static I (size/composition/explorer)
18. [ ] **D7 F06** Tools — not deep-audited
19. [~] **D8 F07** Sell / valuation — static I (B3 path verified)
20. [ ] **D9 F08** Content / AEO — not deep-audited
21. [ ] **D10 F09** Trust / brokerage — not deep-audited
22. [~] **D11 F10** Paid LPs — static I (B5 aligned)
23. [~] **D12 F11** Account / saved — portal + ActivityFeed exist; volume cold
24. [ ] **D13 F12** Auth & compliance public — not deep-audited
25. [ ] **D14 Close all B / high I tickets** from D1–D13 (G3)

### Block E — Design / UI craft (G7 / P5) — **was in plan; now on spine**

26. [ ] **E1 UI craft — chrome polish** (brand locked; no rebrand)
27. [ ] **E2 UI craft — homepage**
28. [ ] **E3 UI craft — city**
29. [ ] **E4 UI craft — listing**
30. [ ] **E5 UI craft — sell**
31. [ ] **E6 UI craft — market**
32. [ ] **E7 UI craft — LP templates**  
    Order locked: E1→E7 one family at a time. Exit: engaged rate up, CWV not worse. Skill: frontend-design / Hallmark inside brand.

### Block F — Engagement habit product (U4 + G10)

33. [~] **F1 Sticky / mid-browse capture** — bar shipped; not full habit system
34. [~] **F2 Personal feed / return loop** — **signed-in** `/account` ActivityFeed + “new since” insights exist; guest habit feed not built
35. [~] **F3 Save + alert as default product behavior** — surfaces default on search/listing (B1/B2); not yet product-default identity for all guests
36. [ ] **F4 Demand signals / next-step coach** (as product allows without creepy overreach)

### Block G — Measurement maturity (G6)

37. [~] **G1 Dual-source docs + MP page_view** — prior ship
38. [x] **G2 Weekly scoreboard ritual** — `SCOREBOARD_RITUAL.md` + script; MEASUREMENT_DUAL_SOURCE §3 updated
39. [ ] **G3 GA4 ops** — **BLOCKED Matt UI:** Tag Assistant; Advanced Consent Modeling; Reporting identity Blended
40. [x] **G4 Prove or document** — **2026-08-10 FP-primary permanent** (MEASUREMENT_DUAL_SOURCE §7b): FP+GSC primary forever; GA4 supplementary; not waiting for GA4 parity

### Block H — Market analytics residual (G9 / SI) — foundation ≠ full platform

41. [x] **H1 CO EDA + geo lock**
42. [x] **H2 Marts 2016–2025 + 2024 parity**
43. [x] **H3 Public size strip**
44. [~] **H4 Public composition** — shipped; verify prod
45. [x] **H5 History explorer** — mart/result_cache first; SQL aggregate RPC on miss only; **no Node listings paging**
46. [ ] **H6 Feature cubes / amenity-era queries**
47. [x] **H7 Report factory R01–R15** — **2026-08-10 registry** `REPORT_FACTORY_REGISTRY.md` (R01 size shipped public, R14 competitive admin; others planned)
48. [~] **H8 Inventory snapshots** — **2026-08-10 skeleton** `scripts/analytics/snapshot-active-inventory.mjs` (JSON counts by city; no warehouse table yet)
49. [x] **H9 Cron rebuild marts**

### Block I — Competitive intelligence (U9)

50. [~] **I1 Office list/buy ranks admin** — string-level shipped
51. [x] **I2 Agent ranks** — market-wide top-N + per-office drill (I5)
52. [x] **I3 Brand aliases / entity resolution** — `data/analytics/office-brand-aliases.json` + bootstrap; methodology `DIM_OFFICE_ENTITY_RESOLUTION.md` (share mart still string-level until office_id join)
53. [ ] **I4 Ryan buy-side + alias truth** (strategy-grade share)
54. [x] **I5 Per-office agent drill + CSV export** — `?office=` + `/admin/analytics/competition/export`
55. [ ] **I6 Public competitor naming** — **BLOCKED Matt lock** (policy)

### Block J — Next-gen AI (U2)

56. [x] **J1 Room restyle API + listing UI**
57. [x] **J2 Interior photo pick + rate/cost caps** — default interior heuristic + picker; strict RL notes UI+API
58. [x] **J3 Conversion path after restyle** — city alert (listing_alerts) + contact CTA
59. [ ] **J4 Prod browser E2E proof** — **BLOCKED** same as L1 (host 403)

### Block K — Voice residual (Layer B only)

60. [~] **K1 Buffett Layer B residual inventory** — full rewrite was SEO-rejected in shell; finish body inventory under Layer A law
61. [x] **K2 No re-sweep of four retired shape rules** — **policy locked** in SESSION_INTENT_SSOT (aphorism / meaning-narration / sermon / obvious restatement; VOICE.md 2026-08-06)

### Block L — Proof & ship hygiene

62. [ ] **L1 Prod browser proof pack** — size, composition, history, competition admin, restyle, chrome on 8 URLs · **BLOCKED this host 2026-08-10:** public site returns **403** (WAF/bot); needs Matt browser or non-blocked egress
63. [x] **L2 Gates green path** — `npm run push` discipline (ongoing)
64. [~] **L3 VERIFY_LOG current** — updated this grind; keep current after each unit

### Block M — Authority flywheel (G8) — still part of 10× plan

65. [x] **M1 AEO FAQs from real cubes only** — **2026-08-10:** hub FAQ appends mart size + composition when `getCoMarketAnnual(2024)` present (§0)
66. [ ] **M2 Content engine pulls volume/composition from cubes**
67. [ ] **M3 Lifestyle × homes joins where data exists**

---

## Pointer (what runs next)

| Field | Value |
|-------|--------|
| **NOW** | **E1 UI craft chrome polish** (or H6 feature cubes / I4 Ryan buy-side / D5–D13 residual) |
| **THEN** | E2–E7 UI craft · F4 · M2–M3 · H6 full cubes · K1 body inventory · Matt: G3 + L1 browser |
| **NOTE** | Large batch shipped this /endtoend; **not 10×** (alerts still 6). Blockers: L1/J4 host 403, G3 Matt UI, I6 Matt lock. |

**UI craft (Block E)** stays on this queue and is owed — polish path after capture/honesty has solid shells.

---

## Done means (session bar)

All blocks A–M complete **or** each incomplete unit has a logged external blocker.  
Not: “analytics MVP shipped so session complete.”  
**Dev mode:** no program-wide metric freeze. Unit done = shipped + logged proof; conversion/engagement units also log a count snapshot.
