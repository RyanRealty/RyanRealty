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
16. [x] **D5 F04** Lifestyle under Areas — **2026-08-10 static I:** parks/schools/trails/events/venues/golf + Areas nav; detail→nearby homes; parks M3 band. Browser V open (L1 403).
17. [~] **D6 F05** Market — static I (size/composition/explorer)
18. [x] **D7 F06** Tools — **2026-08-10 static I:** mortgage/rental `getCalculatorDefaults`; appreciation scenario rate labeled. Browser V open.
19. [~] **D8 F07** Sell / valuation — static I (B3 path verified)
20. [x] **D9 F08** Content / AEO — **2026-08-10 static I:** blog/FAQ hubs; no hardcoded annual volume in templates. Browser V open.
21. [x] **D10 F09** Trust / brokerage — **2026-08-10 static I:** about/team/reviews/contact/join. Browser V open.
22. [~] **D11 F10** Paid LPs — static I (B5 aligned)
23. [~] **D12 F11** Account / saved — portal + ActivityFeed exist; volume cold
24. [x] **D13 F12** Auth & compliance public — **2026-08-10 static I:** login/signup/legal/unsubscribes. Browser V open.
25. [~] **D14 Close all B / high I tickets** — **2026-08-10:** no high-severity **B** in D5/D7/D9/D10/D13 static audit; residual **I** = prod browser V (L1 403)

### Block E — Design / UI craft (G7 / P5) — **was in plan; now on spine**

26. [x] **E1 UI craft — chrome polish** — **2026-08-10:** safe-area topbar/menu, z-index stack (topbar 100 / menu 200), 44px hit targets, cream focus rings, menu dialog a11y, reduced-motion, hover polish. No dual chrome / no SiteHeader remount.
27. [x] **E2 UI craft — homepage** — **2026-08-10:** mid-page `KbCommunityAlerts` (SFR / Central Oregon), hero sub width + search focus craft, sell form focus, Layer A H1 locked. Gates: seo-shell + brand-voice green.
28. [~] **E3 UI craft — city** — **2026-08-10 light:** city alerts moved to after map (inventory). Full city craft pass still open.
29. [ ] **E4 UI craft — listing**
30. [ ] **E5 UI craft — sell**
31. [ ] **E6 UI craft — market**
32. [ ] **E7 UI craft — LP templates**  
    Order locked: E1→E7 one family at a time. Exit: engaged rate up, CWV not worse. Skill: frontend-design / Hallmark inside brand.

### Block F — Engagement habit product (U4 + G10)

33. [~] **F1 Sticky / mid-browse capture** — bar shipped; not full habit system
34. [~] **F2 Personal feed / return loop** — **signed-in** `/account` ActivityFeed + “new since” insights exist; guest habit feed not built
35. [~] **F3 Save + alert as default product behavior** — surfaces default on search/listing (B1/B2); not yet product-default identity for all guests
36. [x] **F4 Demand signals / next-step coach** — **2026-08-10:** listing `ListingAlertCoach` (5s dwell soft bar → `#listing-like-alerts`). Search has SaveSearchButton.

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
46. [x] **H6 Feature cubes / amenity-era queries** — **2026-08-10:** `analytics_mart_feature_annual` + rebuild + `getCoFeatureAnnual` + history amenity strip (fireplace/garage/association typed only)
47. [x] **H7 Report factory R01–R15** — **2026-08-10 registry** `REPORT_FACTORY_REGISTRY.md` (R01 size shipped public, R14 competitive admin; others planned)
48. [x] **H8 Inventory snapshots** — **2026-08-10:** `analytics_inventory_snapshot` + script write + daily cron `snapshot-active-inventory` 08:30 UTC
49. [x] **H9 Cron rebuild marts**

### Block I — Competitive intelligence (U9)

50. [~] **I1 Office list/buy ranks admin** — string-level shipped
51. [x] **I2 Agent ranks** — market-wide top-N + per-office drill (I5)
52. [x] **I3 Brand aliases / entity resolution** — `data/analytics/office-brand-aliases.json` + bootstrap; methodology `DIM_OFFICE_ENTITY_RESOLUTION.md` (share mart still string-level until office_id join)
53. [x] **I4 Ryan buy-side + alias truth** — **2026-08-10:** `getRyanBrandShare` list+buy alias rollup on competition desk; methodology in DIM_OFFICE § I4
54. [x] **I5 Per-office agent drill + CSV export** — `?office=` + `/admin/analytics/competition/export`
55. [ ] **I6 Public competitor naming** — **BLOCKED Matt lock** (policy)

### Block J — Next-gen AI (U2)

56. [x] **J1 Room restyle API + listing UI**
57. [x] **J2 Interior photo pick + rate/cost caps** — default interior heuristic + picker; strict RL notes UI+API
58. [x] **J3 Conversion path after restyle** — city alert (listing_alerts) + contact CTA
59. [ ] **J4 Prod browser E2E proof** — **BLOCKED** same as L1 (host 403)

### Block K — Voice residual (Layer B only)

60. [x] **K1 Buffett Layer B residual inventory** — **2026-08-10:** `BUFFETT_LAYER_B_INVENTORY.md`
61. [x] **K2 No re-sweep of four retired shape rules** — **policy locked** in SESSION_INTENT_SSOT (aphorism / meaning-narration / sermon / obvious restatement; VOICE.md 2026-08-06)

### Block L — Proof & ship hygiene

62. [ ] **L1 Prod browser proof pack** — size, composition, history, competition admin, restyle, chrome on 8 URLs · **BLOCKED this host 2026-08-10:** public site returns **403** (WAF/bot); needs Matt browser or non-blocked egress
63. [x] **L2 Gates green path** — `npm run push` discipline (ongoing)
64. [~] **L3 VERIFY_LOG current** — updated this grind; keep current after each unit

### Block M — Authority flywheel (G8) — still part of 10× plan

65. [x] **M1 AEO FAQs from real cubes only** — **2026-08-10:** hub FAQ appends mart size + composition when `getCoMarketAnnual(2024)` present (§0)
66. [x] **M2 Content engine pulls volume/composition from cubes** — **2026-08-10:** `content-market-claims.mjs` + market-report-blog Step 4a + content_engine Step 3
67. [x] **M3 Lifestyle × homes joins where data exists** — **2026-08-10:** detail nearby→search; parks index M3 band → homes-for-sale

---

## Pointer (what runs next)

| Field | Value |
|-------|--------|
| **NOW** | **E3 UI craft city** (full pass; light ship done) or **E4 listing** |
| **THEN** | E4–E7 UI craft · Matt: G3 + L1 browser · I6 lock |
| **NOTE** | D5/D7/D9–D13 static I + F4/M2/M3/K1 + E1/E2 shipped. **not 10×** (alerts ~6). Blockers: L1/J4 403, G3, I6. D14 residual = browser V. |

**UI craft (Block E)** stays on this queue and is owed — polish path after capture/honesty has solid shells.

---

## Done means (session bar)

All blocks A–M complete **or** each incomplete unit has a logged external blocker.  
Not: “analytics MVP shipped so session complete.”  
**Dev mode:** no program-wide metric freeze. Unit done = shipped + logged proof; conversion/engagement units also log a count snapshot.
