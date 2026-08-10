# Goal: 10× Public Product — Executable Plan

**Date:** 2026-08-10 (rev: autonomous continuous grind — **not multi-week**)  
**Status:** ACTIVE — execute via **`EXECUTION_QUEUE.md`** (ordered units only; no calendar)  
**Product:** ryan-realty.com (public site + conversion + measurement + **market/competitive analytics**)  
**Not the goal:** Beat Zillow nationally. **Is the goal:** 10× better *local hyperlocal product* on traffic · UX · engagement · **qualified leads** · **citable market depth** · **competitive clarity**, using the warehouse we already have.

**Expert role:** Owns **the whole plan**. Autonomous until DONE (queue definition). Matt = locks only. See `EXPERT_OWNERSHIP_AND_RESEARCH.md`.  
**Schedule:** Phases G0–G10 below are **priority order**, not week estimates. Do not interpret as multi-week.

**Child docs (do not re-author — execute through them):**

| Doc | Role |
|-----|------|
| `EXPERT_OWNERSHIP_AND_RESEARCH.md` | **Meta-law: full-plan ownership + research tracks + EDA-first** |
| `TOP_SITE_GOAL_SYSTEM.md` | L0–L6 architecture + 90d picture |
| `DATA_FOUNDATION_TOP_SITE.md` | What DB holds; §0 map |
| `MARKET_ANALYTICS_PLATFORM.md` | Working analytics canon (revise when EDA falsifies) |
| `SALES_INTELLIGENCE_EXECUTABLE.md` | G9 ship units (SI/MA waves) |
| `EDA_MARKET_WAREHOUSE_*.json` | Raw EDA artifacts |
| `PAGE_IA_COMPONENT_MATRIX.md` | Slot recipes; parity/moat |
| `SITE_FEATURE_VERIFY_IMPROVE_PLAN.md` | Every feature family F00–F14 grind |
| `VERIFY_LOG.md` | Live status ledger (families + SI units) |
| `MEASUREMENT_DUAL_SOURCE.md` | Scoreboard rules |
| `ENDTOEND_MISSION.md` | Foundation ship log |
| `BOTTLENECKS_AND_FIXES.md` | Historical diagnosis (refresh as V) |

**Invocation:** When Matt says “run the 10× plan” / “continue 10×” / `/goal` on this file → open VERIFY_LOG, run next incomplete wave unit, ship, log. For sales depth: open `SALES_INTELLIGENCE_EXECUTABLE.md` (SI-0…).

---

## 1. What “10× better” means (measurable)

10× is **not** “prettier site.” It is **order-of-magnitude movement** on the bottlenecks we measured — while holding §0 and brand locks.

### 1.1 North-star (12 months)

| Outcome | Baseline (2026-08, approx) | 10× / program target | Source of truth |
|---------|----------------------------|----------------------|-----------------|
| **Qualified leads / week** (organic+owned: valuation, contact, alerts, CMA starts) | Low relative to ~3.7k sessions/day (alerts **6 total**, saved searches **2**) | **~10× weekly qualified lead events** vs baseline week | CRM + form tables + `listing_alerts` |
| **Engaged sessions / day** (engagement_score > 1) | ~350 / day-scale engaged vs ~3.7k sessions | **≥3× engaged rate**, then compound | `visitor_sessions` |
| **Non-brand organic clicks** (GSC) | Thin money-query share vs blog | **≥3–5× non-brand money-query clicks** (12 mo) | GSC API |
| **Task success UX** | Dual chrome was broken; menu CSS regressed | **Zero dual-chrome; LCP city/home green; mobile paths clear** | Lab + `web_vitals` |
| **Alert product** | **6** enrollments lifetime-scale | **≥60 in 90 days** then **≥600 / 12 mo** path | `listing_alerts` |
| **Measurement honesty** | GA4 ~1–2 users vs FP thousands | GA4 within **~2× engaged FP** (not 100× off) **or** dual-source ops permanently trusted | FP + GA4 |
| **Sales intelligence product** | ~377k priced closes in DB; public site ≈ pulse + 2016+ SFR medians; `total_volume` underused | Region **year×$ volume + composition** live from cubes; ≥1 feature-history answer (e.g. fireplace-class) from cube not ad-hoc SQL; zero request-path full closed-sales scans | `sales_cube_*` + GSC market queries + market dwell |
| **Market authority (AEO/GSC)** | Blog/guides lead clicks; market pages thin on “size of market” story | Contestable **market-size / composition** queries + citable Dataset surfaces | GSC + SI surfaces |

**Explicit non-goals:** Zillow head-term #1; inventing 1,848 community pages; brand color/font refresh; thinning sitemap; claiming 1990 market (warehouse has **0** closed+priced that year — floor is data-driven, default **1998** region until SI-0 revises).

### 1.2 10× mechanism (why this can work)

```
WAREHOUSE ALREADY PORTAL-CLASS
  ~595k listings · ~377k priced closes · pulse 45 geos · 69k visitor sessions · 23k CRM · CMA 271
        │
        ▼
GAPS (all required)
  PACKAGING + DISCOVERY + CONVERSION + MEASUREMENT
  + SALES INTELLIGENCE (volume / composition / attribute history — under-leveraged)
  + ENGAGEMENT LOOPS (alerts/save/feed/play — cold)
  (not “need more MLS”)
        │
        ▼
10× LEADS ≈ capture rate ↑ + query mix ↑ + trust/authority moat (sales depth)
  alerts 6 → product that absorbs browse intent
  Layer A → contestable SERPs (community / market / sell)
  sales cubes → “size of market then vs now” + composition no local peer has
  CMA + named broker → quality not just volume
```

---

## 2. All findings (synthesis — evidence base)

### 2.1 Data findings (warehouse)

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **Portal-class depth already exists** | ~595k listings, tile MV, pulse 45 geos, geo_snapshot ~6.9k, activity ~33k | Stop building “more data”; ship packaging |
| **Closed-sales warehouse is the underused moat** | ~377k priced closes; thick from ~1998; 2024 all-type mix A/B/C/D real; fireplace 1998 = 1,575 | **G9 sales cubes** — not more sync |
| **`total_volume` already in cache, barely productized** | `market_stats_cache` monthly region 2016-07+; ~$3B-class 2024 SFR months sum | SI-4 quick win + annual all-type cubes for deep history |
| **Cache floor 2016 ≠ warehouse floor** | Backfill/script FLOOR 2016-07; raw closes earlier | Annual cubes from first publish year; keep monthly modern |
| **SFR methodology is real** | pulse + most cache consumers PropertyType A | Always label `type_scope`; never mix with all-type $ silently |
| **Request-path aggregation is a bottleneck** | G62 TOAST; 377k close scans | Cubes + partial indexes + cron only for rebuild |
| **Resorts ≠ 1,848 communities** | Registry ~19–20 vs communities table | Only curated community product pages |
| **Content already wins organic** | blog 87; GSC leaders are guides | Authority flywheel = content + **sales intelligence** + geo join |
| **Conversion sinks are cold** | `listing_alerts` ≈ 6; `saved_searches` ≈ 2 | Biggest product–traffic mismatch |
| **CMA is moat inventory** | 271 written valuations | Surface path harder than Zestimate |
| **Engagement is measurable** | visitor_sessions ~69k; score + events | Primary product truth |
| **CWV field data exists** | web_vitals ~323k | UX regressions are measurable |
| **HOA / fee / rental not in MLS** | Data foundation gap | Never invent; source or omit |

### 2.2 Product / architecture findings

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **Dual chrome killed (shipped)** | PublicNav in layout; page KbNav removed | Keep gates; never remount SiteHeader |
| **Menu broke after dual-chrome** | CSS scoped `.kb-root .topbar` while nav outside | Design systems must own global chrome tokens |
| **Single IA SSOT exists** | `lib/site-nav.ts` Buy·Areas·Market·Sell·About | All chrome projections only |
| **site-menu still second tree** | Legacy SiteHeader display | Do not re-author; align or delete path |
| **~125 public routes** | app/**/page.tsx inventory | Must verify by **family**, not random pages |
| **KB section library is the page product** | `components/site/kb/Kb*` | Slot parity = wire Kb* + data, not new frameworks |
| **Search + listing + LP + account are separate shells** | layout hide sets | Same rubric, different chrome rules |
| **Mockups lag architecture** | parity.json still “dual chrome” era | Update contracts as families verify |

### 2.3 Discovery / SEO findings

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **Layer A vs voice fight is real** | Poetry H1s tanked SEO; Buffett body is correct | Layer A shell + Layer B body forever |
| **City H1 lock shipped** | Homes for Sale pattern | Gate it (`ci:seo-shell`) so it never regresses |
| **Homepage exact-match shipped** | Central Oregon Homes for Sale | Keep |
| **Sitemap must not be thinned** | ~9.2k GSC URLs; child errors:1 | Ops fix errors; never delete geo/listing families |
| **Contestable wins** | community / market / sell / lifestyle×homes | Prioritize those SERPs over portal head terms |

### 2.4 Measurement findings

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **GA4 undercount was catastrophic for decisions** | ~1–2 users vs ~3.7k FP sessions | Ban GA4-only “traffic is dead” |
| **MP page_view mirror shipped** | `/api/visitors/track` → GA4 MP when no live gtag | Wait 7–30d for ratio; do not re-litigate consent defaults |
| **Consent Mode denied-by-default locked** | G48 / TRACKING_POLICY | No US default-grant without Matt re-lock |
| **Admin GA4 labels honesty started** | Operations / analytics notes | Keep dual-source everywhere |
| **Reporting identity still UI-only** | Admin API gap | Matt click: Blended |

### 2.5 Conversion findings

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **CTAs wired on many money pages** | KbSell, KbCommunityAlerts, nav valuation | Wire ≠ volume; measure enrollments |
| **Primary/secondary CTA model defined** | TOP_SITE L6 | Enforce per family in verify |
| **LP conversion gates exist** | ci:lp-conversion | Keep LP rails clean |
| **Account product cold but real** | saved searches 2 | Verify E2E; growth after public capture works |

### 2.6 Design / UX findings

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **Brand POV is locked** | navy/cream/Amboqia/Geist | 10× is craft inside lock, not rebrand |
| **Generic-safe risk** | equal cards, weak hierarchy | Senior design ownership: asymmetry, density, one Amboqia moment |
| **P5 order fixed** | chrome → home → city → listing → sell → market → LP | Never redesign all templates at once |
| **Design tokens / brand-voice gated** | ci gates | Every improve pass must stay green |

### 2.7 Process findings

| Finding | Evidence | Implication |
|---------|----------|-------------|
| **Unshipped work was #1 bottleneck** | Mid-run 70+ file trees | Ship after every family unit |
| **Parallel agents on chrome = merge pain** | dual-chrome + unstyled menu | Exclusive file sets; serial chrome |
| **Docs drift** | bottlenecks doc pre-ship | VERIFY_LOG is live truth |
| **“Highest leverage only” is incomplete** | Matt rejection | Exhaustive family grind is mandatory |

---

## 3. Strategy: how we get 10×

### 3.1 Thesis (one sentence)

**Turn portal-class MLS (active + multi-decade closes) + local content into the best Central Oregon *product* — exact-match discovery, one chrome, full slot depth, capture that matches traffic, sales intelligence no peer packages, and a scoreboard that tells the truth — then polish UX until engaged sessions and qualified leads compound.**

### 3.2 Leverage stack (all required — not either/or)

| Layer | 10× contribution | How we execute |
|-------|------------------|----------------|
| **L5 Measurement** | Stop wrong decisions; trust experiments | Dual-source ritual + MP; VERIFY weekly metrics |
| **L1 Discovery** | More of the *right* traffic | Layer A on every money family + GSC ops |
| **L2 Wayfinding** | People find product | PublicNav SSOT; orphan registry |
| **L3 Page product** | Depth beats thin locals | Slot matrix F-grind until V |
| **L6 Conversion** | Traffic → leads (biggest ratio gain) | Alerts + valuation + listing CTAs + LP |
| **L4 Experience** | Engagement rate | P5 craft after L1–L3 honest; engagement loops (save/alert/feed) |
| **L7 Market analytics** | Authority + unique search + report factory + dwell | `MARKET_ANALYTICS_PLATFORM` full catalog; ship via SI/MA waves |
| **P7 Authority** | Non-brand organic + AI | Content engine + AEO FAQs + **cube-backed market claims** + citations |

**Math of 10× leads (illustrative):**  
If traffic holds and capture rate on browse intent goes from ~near-zero alerts to a healthy funnel, **lead volume can move an order of magnitude without 10× sessions**. That is the primary 10× path. Organic mix improvement and engagement are multipliers.

---

## 4. Executable program (phases with exit criteria)

Each phase has: **inputs · work · exit · metric · owner mode**.

### Phase G0 — Truth baseline (Week 0)

| | |
|--|--|
| **Inputs** | DATA_FOUNDATION, MEASUREMENT_DUAL_SOURCE |
| **Work** | Live data probe into VERIFY_LOG; freeze baseline week metrics (FP sessions, engaged, GSC clicks, leads, alerts count, CWV p75) |
| **Exit** | Baseline table filled; team uses FP+GSC for “is traffic dead?” |
| **Metric** | Baseline snapshot exists |
| **Mode** | Ops + eng 1 session |

### Phase G1 — Systems green forever (Week 0–1)

| | |
|--|--|
| **Inputs** | F00 chrome; layout; site-nav; gates |
| **Work** | Verify PublicNav on 8 URLs; consent; trackers; sitemap resolvable; no dual header; menu styled |
| **Exit** | F00 = **V** in VERIFY_LOG |
| **Metric** | Zero dual-chrome reports; header search works |
| **Mode** | Eng; serial only on chrome |

### Phase G2 — Exhaustive verify (Weeks 1–6)

| | |
|--|--|
| **Inputs** | SITE_FEATURE_VERIFY_IMPROVE_PLAN §4–§7 |
| **Work** | Waves 1–4: every family F01–F12 rubric; dynamic templates = 3 samples; account included |
| **Exit** | Every family **V** or **I** with logged tickets (no “skipped”) |
| **Metric** | VERIFY_LOG complete |
| **Mode** | 1 family / session; ship after each family |

**Wave order (mandatory completeness):**

1. F01 Home → F02 Search → Listing → City → Nbhd → Community → OH/Drops → rest Buy  
2. F05 Market → F06 Tools → F07 Sell → F10 LPs  
3. F03 indexes → F04 lifestyle → F08 content → F09 trust → F12 legal  
4. F11 account (every saved/history/collection path)

### Phase G3 — Close all I/B tickets from G2 (parallel to late G2)

| | |
|--|--|
| **Inputs** | VERIFY_LOG I/B list |
| **Work** | Fix by pass order: Data → Layer A → Slots → Conversion → UX |
| **Exit** | No **B**; **I** only for deferred P5 craft items |
| **Metric** | Ticket burn-down |
| **Mode** | Fix-only PRs; no new features |

### Phase G4 — Conversion 10× engine (Weeks 3–12, overlaps G2)

| | |
|--|--|
| **Inputs** | Alerts 6; saved searches 2; L6 CTA model |
| **Work** | (1) Public capture: search + city + listing + market alerts UX; (2) Valuation path friction; (3) Listing primary CTAs; (4) LP alignment; (5) Account save/search after public capture works |
| **Exit** | Alerts **≥60 / 90d**; weekly qualified leads **≥3×** baseline; then aim **10×** by month 12 |
| **Metric** | `listing_alerts`, valuation submits, contact, CMA starts |
| **Mode** | Product eng; measure weekly |

### Phase G5 — Discovery / SEO shell lock (Weeks 2–8)

| | |
|--|--|
| **Inputs** | Layer A patterns; GSC |
| **Work** | `ci:seo-shell` (or equivalent); finish residual Layer A; GSC coverage triage (**no thin**); internal links from family hubs |
| **Exit** | Money family titles/H1s gated; GSC errors trending down |
| **Metric** | GSC non-brand money clicks ↑ |
| **Mode** | SEO eng + ops |

### Phase G6 — Measurement maturity (Weeks 1–8)

| | |
|--|--|
| **Inputs** | MP mirror live; dual-source docs |
| **Work** | Weekly scoreboard ritual; Tag Assistant; GA4 Advanced Consent Modeling; Reporting identity **Blended** (Matt UI); optional refine MP double-count |
| **Exit** | GA4 usable within ~2× engaged FP **or** written decision to stay FP-primary permanently |
| **Metric** | FP÷GA4 ratio logged weekly |
| **Mode** | Ops + Matt one UI click |

### Phase G7 — Design 10× craft (Weeks 6–16, after G2 honesty)

| | |
|--|--|
| **Inputs** | Brand lock; P5 order; frontend-design skill |
| **Work** | Chrome polish → home → city → listing → sell → market → LP; screenshot-score ≥8; no rebrand |
| **Exit** | Engaged rate ↑; CWV not worse on money templates |
| **Metric** | engagement_score >1 rate; CWV p75 |
| **Mode** | Senior design ownership; one template family at a time |

### Phase G8 — Authority flywheel (Months 3–12)

| | |
|--|--|
| **Inputs** | Blog winners; lifestyle registries; content engine; **sales cubes (G9)** |
| **Work** | AEO FAQs; lifestyle×homes joins; sourced HOA/local facts where we can prove them; citations/off-site; **blog/video/newsletter pull volume/composition from cubes only** |
| **Exit** | Non-brand organic + AI-visible presence up |
| **Metric** | GSC query mix; referral from AI tools if tracked |
| **Mode** | Content + eng |

### Phase G9 — Market analytics platform (Weeks 1–16, parallel early)

| | |
|--|--|
| **Inputs** | **`MARKET_ANALYTICS_PLATFORM.md` (scope)**; `SALES_INTELLIGENCE_EXECUTABLE.md` (units); ~377k priced closes; ~144 typed cols; ~800 details keys; cache + G62 |
| **Work** | **MA-0:** fact + fill matrix + indexes + analyze RPC. **MA-C (parallel P0):** dim_office/agent, office+agent **market share** marts, admin competitive desk (rankings, drilldown brokerage→broker, Ryan vs peers, city battlefield). **MA-1:** size/composition/distribution + public reports. **MA-2:** unique multi-dim search. **MA-3:** amenity premia + promote. **MA-4:** inventory snapshots. **MA-5:** full report factory + auto-insights. SI-4 anytime. |
| **Exit** | Platform §12 metrics **including** office/agent share ranks and brokerage drilldowns — not “one example report” |
| **Metric** | Analyze p95; share mart freshness; Ryan rank tile; report templates; search chips; no name-only share joins |
| **Mode** | Expert-led backlog from A01–A24 — **do not wait for Matt examples**; data eng serial on migrations |

**Parallelism rule:** SI-0/MA-0 + SI-4 during G0–G2. Heavy migrations exclusive. Do not block chrome/conversion.

### Phase G10 — Engagement loops (Weeks 2–16, overlaps G4)

| | |
|--|--|
| **Inputs** | Cold alerts/saves; visitor_events; account shells; activity_events |
| **Work** | Intent capture mid-browse; personal change feed; notification re-entry; optional listing play (e.g. Grok room restyle) only after capture loops exist |
| **Exit** | D1/D7 return ↑; saves+alerts per 100 listing views ↑ |
| **Metric** | Same as G4 + return rates |
| **Mode** | Product eng; see engagement diagnosis in session notes / VERIFY_LOG |

---

## 5. Weekly operating system (how the plan runs)

### 5.1 Monday scoreboard (30 min) — non-optional

```
Week of YYYY-MM-DD
FP sessions: ___ | Engaged (>1): ___ | Engaged rate: ___%
GSC clicks: ___ | Impressions: ___ | Top money queries: ___
GA4 users: ___ | FP/GA4 ratio: ___
Leads: valuation ___ | contact ___ | alerts new ___ | CMA ___
Sales cubes: last rebuild ___ | annual rows ___ | parity OK Y/N
Market dwell / market-size page views: ___
CWV: LCP p75 ___ | any regression? Y/N
Ship this week: ONE metric owner: ___
```

### 5.2 Mid-week execution unit

- Open VERIFY_LOG → next family not V.  
- Data probe for that family.  
- Rubric on template + samples.  
- Fix B/I.  
- Ship.  
- Update log.

### 5.3 Definition of a good PR under this goal

- Touches **one family** or **one system**.  
- Names the **metric** it should move.  
- §0 clean.  
- Layer A not broken by design.  
- Gates green (`npm run push`).  
- VERIFY_LOG updated.

---

## 6. Automation & gates to build (support completeness)

| Build | Why | Phase |
|-------|-----|-------|
| `ci:seo-shell` Layer A patterns | Prevent poetry H1 regression | G5 |
| Orphan route registry | Every public page classified | G2 |
| Playwright smoke per family | Critical path never dies | G2–G3 |
| Scoreboard admin strip | FP + GSC + leads + ratio one screen | G6 |
| Alerts funnel dashboard | Enroll → open → click | G4 |
| Sales cube parity test (raw vs cube) | §0 + methodology lock | G9 |
| Closed-sales partial indexes + rebuild cron | Perf / no bottlenecks | G9 |
| Pipeline heartbeat: sales cubes | Stale intelligence = silent failure | G9 / SI-7 |
| VERIFY_LOG CI reminder | Fail if log stale >14d during program | optional |

---

## 7. Risks & anti-patterns

| Risk | Mitigation |
|------|------------|
| Redesign theater without capture | G4 metrics gate P5 |
| Parallel chrome edits | Serial F00 ownership |
| Invent numbers for empty slots | §0 + empty states |
| Thin sitemap for GSC vanity | Explicit ban |
| GA4-only panic | Dual-source ban line |
| Skip account/tools/legal | Family inventory mandatory |
| Brand “refresh” | Token lock |
| Infinite verify without ship | Ship every family unit |
| Request-time sales OLAP | G9 cubes only; SI locks |
| Claiming pre-floor history (e.g. 1990) | SI-0 floor; honest empty |
| Unlabeled SFR vs all-type $ | type_scope on every cell |

---

## 8. 90-day and 12-month checkpoints

### Day 30

- [ ] G0–G1 done  
- [ ] VERIFY_LOG ≥50% families touched  
- [ ] Alerts new ≥10  
- [ ] Scoreboard ritual run 4×  
- [ ] GA4 Blended set  
- [ ] **SI-0 done; SI-4 volume strip shipped or scheduled; SI-1 migration started/shipped**  

### Day 90

- [ ] All families V or I-closed  
- [ ] Alerts ≥60  
- [ ] Qualified leads ≥3× baseline week  
- [ ] GSC non-brand money queries up or stable with better mix  
- [ ] Engaged rate up  
- [ ] City/home LCP green  
- [ ] **G9: region market size + composition live; annual cubes fresh; parity tests green**  

### Day 365

- [ ] Qualified leads ~**10×** baseline week (primary)  
- [ ] Contestable SERP positions #1–2 on priority clusters  
- [ ] Alert + save products healthy  
- [ ] Design craft at 2026 bar on money path  
- [ ] Measurement trusted permanently  
- [ ] **Sales intelligence: feature explorer + embeds; methodology is the local standard**  

---

## 9. First three executable sessions (start here)

### Session 1 — G0 + G1 + SI-0 start

1. Live data probe → VERIFY_LOG baseline row (include closed-sales counts + cache floor).  
2. F00: home, city Bend, search, sell, community Caldera, market, blog, contact — one header, Menu+, valuation CTA, search.  
3. SI-0: annual count/volume probe + PropertyType map stubs + index inventory → VERIFY_LOG SI-0.  
4. Fix any B. Ship.

### Session 2 — F01 Home + F02 Search (+ SI-4 if free)

1. Full rubric homepage.  
2. Full rubric homes-for-sale (list + map + one preset).  
3. Optional: surface existing `total_volume` on one market surface (SI-4).  
4. Fix I/B. Ship.

### Session 3 — F02 City + Conversion seed **or** SI-1 if data-eng focus

1. Default path: City template Bend/Sisters/thin + alerts path.  
2. Alt path (Matt “sales first”): SI-1 cube migration + backfill region.  
3. Ship. Log.

Then continue SITE_FEATURE Wave 1 without skipping; keep G9 units on the board every week until SI-3 ships.

---

## 10. Ownership

| Role | Owns |
|------|------|
| **Matt** | Business priority; brand/consent/legal locks; GA4 Blended UI; public competitor-naming policy; LP creative judgment |
| **Executing expert** | **Entire 10× plan:** research tracks R1–R10, EDA, methodology, product decisions inside locks, architecture, family grind, G9 analytics/competitive, G10 engagement, measurement honesty, ship + VERIFY_LOG + scoreboard |
| **Design (under expert)** | L4 craft inside brand; chrome quality; no dual systems |
| **Data (under expert)** | §0; warehouse truth; cubes/marts; never invent |

See `EXPERT_OWNERSHIP_AND_RESEARCH.md` for research depth standards and anti–narrow-role rules.

---

## 11. One-line executive summary

**We already have portal-class active inventory, multi-decade closes, and a foundation chrome/Layer A/measurement ship; 10× is an executable grind: verify every feature, fix conversion (alerts), lock discovery, run a truthful scoreboard, productize closed-sales intelligence as fast cubes (not request-path OLAP), then design and engagement loops — measured by qualified leads, engaged sessions, and citable market depth.**

---

*When in doubt: open VERIFY_LOG, run the next incomplete family **or** next SI unit, ship, scoreboard Monday. That is the plan.*
