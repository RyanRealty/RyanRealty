# Site Feature Verify & Improve Plan

**Date:** 2026-08-10  
**Owner:** Design + product (public site) — every existing feature, not “top gaps only”  
**Rule:** Start with **data**. Then **architecture**. Then **verify every surface**. Then **improve** under locked brand.  
**Canon:** `TOP_SITE_GOAL_SYSTEM.md` · `DATA_FOUNDATION_TOP_SITE.md` · `PAGE_IA_COMPONENT_MATRIX.md` · `VOICE.md` · `design_system/ryan-realty/` · `CLAUDE.md` §0–§3  

**Definition of done for a feature:**  
1. **Data true** (§0) — every number has a named DAL/source; empty is honest.  
2. **Discoverable** — ≤2 clicks from PublicNav or intentional orphan registry.  
3. **Layer A clean** — title/H1/meta match intent language.  
4. **Slots complete** — family recipe from matrix (parity + moat).  
5. **UX / design bar** — navy/cream/Amboqia/Geist; hierarchy; mobile; one primary CTA.  
6. **Measured** — first-party path or event exists; conversion path works end-to-end.  
7. **Gated** — relevant CI gates green; live URL spot-checked.

This plan is **exhaustive inventory + verification protocol + improvement standards + grind order**. It is not a punch list of “highest leverage only.”

---

## 0. How we work (non-negotiable)

### 0.1 Order of every pass

```
DATA  →  IA/NAV  →  LAYER A  →  BODY SLOTS  →  CONVERSION  →  DESIGN POLISH  →  MEASURE  →  SHIP
```

Never polish UI before data and Layer A are honest. Never invent a number to fill a slot.

### 0.2 Locked brand (never “refresh”)

| Token | Value |
|-------|--------|
| Navy | `#102742` |
| Cream | `#faf8f4` |
| Display | Amboqia Boriango |
| Body | Geist |
| Chrome IA | Buy · Areas · Market · Sell · About |
| City H1 | `{City}` / `Homes for Sale` |
| Public header | `PublicNav` → `KbNav` only (outside `.kb-root`; styles on `.topbar`) |

### 0.3 Scoreboard (four outcomes)

| Outcome | Primary truth |
|---------|----------------|
| Traffic | GSC + `visitor_sessions` |
| UX | Task success + CWV + zero dual chrome |
| Engagement | `visitor_sessions.engagement_score` |
| Leads | CRM + forms + alerts + CMA |

### 0.4 Pass types (every feature gets all that apply)

| Pass | Code | What you prove |
|------|------|----------------|
| **D** Data | Live count / DAL / freshness | Source named; null handling honest |
| **N** Nav | `lib/site-nav.ts` + live header | Reachable ≤2 clicks or registered orphan |
| **A** Layer A | title, H1, meta, schema | Query language, not poetry |
| **S** Slots | Matrix C/S/M/X | Parity modules present; moat where claimed |
| **C** Conversion | Form → CRM | Submit path works; consent honest |
| **U** UX/design | Mobile + hierarchy | Brand, one CTA, no broken chrome |
| **M** Measure | visitor + CRM | Event or session path exists |
| **G** Gate | CI | Relevant gates green |

### 0.5 Status vocabulary (per feature)

| Status | Meaning |
|--------|---------|
| **V** Verified live | Passes D/N/A/S/C/U/M as required; logged |
| **I** Improve needed | Exists but fails a pass; ticketed with evidence |
| **B** Broken | Errors, wrong data, or conversion dead |
| **O** Orphan intentional | Documented noindex / account-only / LP-only |
| **X** Exclude | Dev, admin, redirect-only |

---

## 1. Design architecture (how the site is built)

### 1.1 System diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BRAND LOCK  design_system/ryan-realty/  ·  VOICE.md  ·  §0 DAL           │
├──────────────────────────────────────────────────────────────────────────┤
│ app/layout.tsx                                                           │
│   kb.css (global) · PublicNav → KbNav (Buy·Areas·Market·Sell·About)      │
│   PublicClientLayer (trackers, consent, compare) · WebVitals · JsonLd    │
│   #main-content → page                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ IA SSOT  lib/site-nav.ts                                                 │
│   projections: KB_TOP_NAV · KB_MENU_GROUPS · KB_FOOTER · PRIMARY_NAV     │
│   display: lib/site-menu.ts (legacy SiteHeader path — not public chrome) │
├──────────────────────────────────────────────────────────────────────────┤
│ PAGE FAMILIES (templates)                                                │
│   KB shell: main.kb-root · Kb* sections · SmoothScroll · KbFooter        │
│   Search shell: app/search · listing-detail · filters/map                │
│   LP shell: no PublicNav · own CTA · conversion-first                    │
│   Account / dashboard: own chrome (PublicNav hidden)                     │
│   Legal / auth: minimal chrome                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ DATA  lib/data/* only on public pages                                    │
│   listings · listing_tile_mv · market_pulse_live · geo_snapshot ·        │
│   activity · visitor_* · crm · blog · registries (parks/schools/…)       │
├──────────────────────────────────────────────────────────────────────────┤
│ GATES  nav · kb-shared-shell · brand-voice · sitemap · css-layers · …    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component layers

| Layer | Location | Role |
|-------|----------|------|
| **Tokens** | `design_system/ryan-realty/colors_and_type.css` + `kb.css` vars | Color/type/radius/shadow |
| **Chrome** | `PublicNav` · `KbNav` · `KbFooter` · Menu+ | Wayfinding + CTAs |
| **KB section library** | `components/site/kb/Kb*.tsx` | Reusable page body modules |
| **Site modules** | `components/site/*` | FAQ, MetadataBlock, listing-detail, search |
| **UI primitives** | `@/components/ui/*` | Forms, buttons (product surfaces) |
| **Mockup contracts** | `design_system/.../ui_kits/*/parity.json` | Structural parity gates |

### 1.3 KB slot → component map (implementation)

| Slot | Component |
|------|-----------|
| C1–C3 chrome | `PublicNav` / `KbNav` |
| S3–S4 hero | `KbHero` |
| C5 breadcrumb | `KbBreadcrumb` |
| M1 stats | `KbHero` stats · `KbMarketHud` · `KbTimeframeStats` |
| M2 inventory | `KbFeatured` · search grids |
| M3 map | `KbListingMap` |
| M4 market | `KbMarketHud` · `KbMarketChart` · market pages |
| M5 activity | `KbTicker` · `KbActivity` |
| M6 open houses | `KbOpenHouses` |
| M8–M9 places | `KbExploreTowns` · `KbCommunities` |
| M10 schools | `KbSchools` |
| M12 about place | `KbAbout` · `KbResortOverview` |
| M13 FAQ | `FAQBlock` |
| M14 articles | `KbArticles` |
| M16–M17 trust | `KbTestimonials` · `KbTeam` |
| M18–M19 convert | `KbSell` · `KbBuyCta` · `KbCommunityAlerts` |
| M21 sources | `MarketSources` |
| S5 schema | `MetadataBlock` / JsonLd |
| C6 footer | `KbFooter` |
| Tracking | `KbSectionTracker` · VisitTracker |

### 1.4 Surfaces that are NOT the KB shell

| Surface | Chrome | Note |
|---------|--------|------|
| `/lp/*` | None / LP chrome | Paid conversion; PublicNav hidden |
| `/homes-for-sale` · `/search/*` | PublicNav solid | Inventory product UI |
| `/listing/*` | PublicNav | Detail conversion |
| `/account/*` · `/dashboard/*` | Account shell | PublicNav hidden |
| Legal / auth | Minimal | Footer rules apply |
| `/admin/*` | Admin v2 | Out of this plan’s design scope except dual-source honesty |

---

## 2. Data foundation (start here — always)

Every verify pass for a feature opens with its **data contract**.

### 2.1 Canonical stores (must re-probe when auditing)

| Domain | Tables / sources | Public role | Freshness check |
|--------|------------------|-------------|-----------------|
| Inventory | `listings`, `listing_tile_mv`, search RPCs | Buy, map, cards, detail | Active count stable; photo % |
| Market | `market_pulse_live`, `market_stats_cache` | Hero stats, HUD, reports | Pulse ≤15m; SFR-only methodology |
| Geo | `geo_snapshot_mv`, resort registry, boundaries | Cities, communities, sitemap | Counts match pulse where claimed |
| Activity | `activity_events` | Price drops, ticker | Recent events present |
| Open houses | listing OH fields | OH calendar | Count = calendar not inventory |
| Content | `blog_posts`, guides, registries | Organic | Published + unique |
| Lifestyle | parks/schools/trails/events/venues/golf JSON | Authority | Entity count vs index |
| Engagement | `visitor_sessions`, `visitor_events` | Truth | Daily session scale |
| CWV | `web_vitals` | UX | p75 LCP/INP/CLS |
| CRM / leads | `crm_people`, timeline, forms | Conversion | Ingress paths |
| Alerts | `listing_alerts`, `saved_searches` | Capture product | Counts not stuck near zero |
| CMA | `cmas` | Moat | Delivered path |
| Sync | `sync_history` / state | Trust | Not stale |

### 2.2 Data probe checklist (run before each family grind)

```
[ ] Active SFR count (region + money cities) — DAL or pulse
[ ] market_pulse_live row count + max updated_at
[ ] geo_snapshot sample for Bend/Redmond/Sisters/Sunriver
[ ] activity_events last 24h by type
[ ] Open houses with dates this week
[ ] visitor_sessions first_seen last 24h
[ ] listing_alerts total + new 7d
[ ] blog_posts published count
[ ] Resort registry length vs /communities index
[ ] Any page claiming a number that isn’t in this list → fail §0
```

### 2.3 §0 failure modes (instant I or B)

- Hardcoded inventory/median/DOM  
- Hero count from wrong metric (e.g. active homes as open houses)  
- Pulse null rendered as $0 or fake  
- HOA/fee/rental income without source  
- “Updated live” without timestamp source  

---

## 3. Universal verification rubric (every page)

For **each** route in §4, complete this card (store in grind log).

```
FEATURE / ROUTE: _______________
FAMILY: _______________
DATE: _______________
REVIEWER: _______________

D DATA
  [ ] All figures cite DAL/function
  [ ] Empty states honest
  [ ] Freshness acceptable for family

N NAV
  [ ] In PublicNav / Menu+ / footer OR orphan registry
  [ ] Breadcrumb correct (non-home)

A LAYER A
  [ ] Title query-shaped
  [ ] H1 query-shaped
  [ ] Meta description factual
  [ ] Schema present if data page

S SLOTS (family recipe)
  [ ] Parity slots present
  [ ] Moat slots present or N/A documented
  [ ] Section order mobile-sensible

C CONVERSION
  [ ] Primary CTA visible
  [ ] Secondary CTA if dual-intent
  [ ] Form path tested (or N/A)

U UX / DESIGN
  [ ] One header only
  [ ] Brand tokens only
  [ ] Hierarchy: one Amboqia moment
  [ ] Mobile 375: no h-scroll, targets ≥44px
  [ ] Images alt / LCP hero OK

M MEASURE
  [ ] Section tracker or page_view path
  [ ] Lead event if form

G GATES
  [ ] brand-voice / kb-shell / relevant gates

STATUS: V | I | B | O
EVIDENCE: _______________
IMPROVE TICKETS: _______________
```

---

## 4. Complete feature inventory (every existing surface)

**~125 `page.tsx` public-ish routes** (excluding pure admin). Grouped by product family.  
**Grind unit = one family**, not one random page. Dynamic `[slug]` families verify **template + 3 sample URLs** (Bend + thin geo + edge case).

### Family F00 — Global chrome & systems

| Feature | Evidence paths | Passes | Data |
|---------|----------------|--------|------|
| PublicNav / KbNav | `PublicNav.client.tsx`, `KbNav.client.tsx`, live any page | N U G | nav SSOT |
| Menu+ overlay | KbNav overlay + search suggest | N U | site-nav groups |
| Header search | Search suggest → homes-for-sale | N C | search registry |
| Value my home CTA | nav CTA → `/sell/valuation` | C | form |
| Sign in / account link | nav → login/account | N | auth |
| Cookie consent | CookieConsentBanner | C M | consent |
| Visitor tracking | VisitTracker → `/api/visitors/track` | M | visitor_* |
| GA4 dual-source / MP | ga4-mp + GoogleAnalytics | M | GA4 + FP |
| Web vitals | WebVitalsReporter | M U | web_vitals |
| JsonLd org/site | layout JsonLd | A | static brand |
| Stream reclaim / SW reset | layout | U | — |
| Site index | `/site-index` | N A | buildAllUrls |
| Sitemap families | `/sitemaps/*` | A G | listings/geo/content |
| robots / llms.txt | robots, llms | A | crawlers |
| Offline | `/offline` | U | — |

### Family F01 — Homepage

| Feature | Route | Key components | Data |
|---------|-------|----------------|------|
| Homepage product | `/` | KbHero, ExploreTowns, Communities, Featured, Map, Ticker, Sell, Team, Testimonials, MarketHud, Footer | region pulse, tiles, cities, communities, price history |

**Must verify:** Layer A H1 Homes for Sale; region stats; map; sell strip; no dual header.

### Family F02 — Buy / inventory

| Feature | Route(s) | Data |
|---------|----------|------|
| Search / homes-for-sale | `/homes-for-sale`, `/search`, `/search/[...slug]` | searchListingsAll, tiles, facets |
| Map view | `?view=map` | pins from tiles |
| Filters / presets | search UI + presets | field registry |
| Compare | `/compare` | client tray + listings |
| Luxury Bend | `/luxury-homes-bend` | tiles minPrice + propertyType A |
| Our listings | `/our-homes` | broker listings |
| Videos | `/videos` | listing videos |
| Buy intent pages | `/buy`, `/buy/[intent]` | content + CTAs |
| Feed | `/feed` | activity / inventory feed |
| Motivated | `/motivated-sellers`, `/[city]` | motivated DAL |
| Price drops | `/price-drops`, `/[city]` | activity price_drop |
| Open houses | `/open-houses`, `/[city]` | OH fields |
| Listing detail | `/listing/[key]`, by-address, by-key | getListingDetail |
| Listing media / tour / OH | detail modules | details media |
| Similar listings | detail | similar DAL |

### Family F03 — Areas / geo

| Feature | Route(s) | Data |
|---------|----------|------|
| Area guides hub | `/area-guides` | guides + geos |
| Cities index | `/cities` | city snapshots |
| City money page | `/cities/[slug]` | pulse, tiles, OH, activity, blog |
| Neighborhood | `/cities/[city]/[nbh]` | boundary, pulse, tiles |
| Communities index | `/communities` | curated + counts |
| Community / resort | `/communities/[slug]` | resort registry, tiles, pulse |
| Subdivisions | `/subdivisions/[slug]` | GIS + listings |
| Zip | `/zip/[zip]` | geo/listings |
| Areas slug | `/areas/[slug]` | legacy/geo |
| Oregon OOA | `/oregon/[city]` | out-of-area DAL |

### Family F04 — Lifestyle (Areas children)

| Feature | Route(s) | Data |
|---------|----------|------|
| Parks index/detail | `/parks`, `/parks/[slug]` | registry + nearby homes |
| Schools index/detail | `/schools`, `/schools/[slug]` | registry + join |
| Trails index/detail | `/central-oregon/trails`… | registry |
| Events index/detail | `/central-oregon/events`… | registry |
| Venues index/detail | `/central-oregon/venues`… | registry |
| Golf detail | `/central-oregon/golf/[slug]` | golf registry |
| Golf LP | `/lp/central-oregon-golf` | LP conversion |

**Must verify:** fair housing safe copy; homes join when claimed; nav under Areas.

### Family F05 — Market / intelligence

| Feature | Route(s) | Data |
|---------|----------|------|
| Market hub | `/housing-market` | region pulse, city tiles; **(+ G9) market size / volume strip** |
| City/region reports | `/housing-market/[...slug]`, central-oregon | pulse, stats_cache, charts; **(+ G9) annual volume + composition** |
| Annual review | `/housing-market/annual-review` | T12 series; **(+ G9) multi-year volume + type mix** |
| Reports archive | `.../reports/archive/[city]` | monthly archive; **(+ G9) volume not only median range** |
| Reports hub | `/housing-market/reports`, `/reports/*` | report rows |
| Sales report period | `/reports/sales/[city]/[period]` | period metrics |
| Activity | `/activity` | activity_events |
| Pulse | `/pulse` | pulse product |
| Months of supply | `/months-of-supply` | methodology + MoS |
| Resources | `/resources` | links |
| **History explorer (G9)** | `/housing-market/history` (planned) | `sales_cube_*` only |

**Must verify:** SFR-only claims labeled; MoS formula; sources block; tools linked under Market; **`total_volume` / type_scope honesty**; no request-path closed-listings OLAP; methodology footer.

**F05 improve bar (sales leverage):** After SI-3, hub + central-oregon must answer “how big was the market ($, units) by year?” and “what was it made of?” from cubes.

### Family F06 — Tools

| Feature | Route | Data |
|---------|-------|------|
| Mortgage calculator | `/tools/mortgage-calculator` | app_config rates |
| Rental calculator | `/tools/rental-property-calculator` | HUD/FMR / inputs |
| Appreciation | `/tools/appreciation` | history series |

### Family F07 — Sell / valuation

| Feature | Route | Data / rail |
|---------|-------|-------------|
| Sell page | `/sell` | process + KbSell + fees Layer B |
| Valuation form | `/sell/valuation` | CMA / lead path |
| Sell intents | `/sell/[intent]` | content |
| Seller LPs | `/lp/seller-home-value`, sell-your-home, expired, fsbo, tetherow* | Meta/GA4/CRM |

### Family F08 — Content / AEO

| Feature | Route | Data |
|---------|-------|------|
| Blog index/detail | `/blog`, `/blog/[slug]` | blog_posts |
| FAQ index/detail | `/faq`, `/faq/[slug]` | faq data + schema |
| Site index | `/site-index` | universe |

### Family F09 — Trust / brokerage

| Feature | Route | Data |
|---------|-------|------|
| About | `/about` | team, story |
| Team index/detail | `/team`, `/team/[slug]` | brokers |
| Team edit | `/team/[slug]/edit` | auth |
| Reviews | `/reviews` | testimonials source |
| Contact | `/contact` | form → CRM |
| Join | `/join` | form |
| Marketing request | `/marketing/request` | internal-ish |

### Family F10 — Paid LPs

| Feature | Route | Verify |
|---------|-------|--------|
| Buyer alerts LP | `/lp/buyer-listing-alerts` | form → listing_alerts |
| Bend / golf / tetherow LPs | `/lp/*` | conversion gate ci:lp-conversion |
| No PublicNav | all LP | hide set |

### Family F11 — Account / saved (existing product — still verify)

| Feature | Route | Verify |
|---------|-------|--------|
| Account hub | `/account` | auth shell |
| Saved homes / searches / collections | account/* | CRUD, not empty-only bugs |
| Hidden / history / notifications | account/* | wires |
| Dashboard aliases | `/dashboard/*` | redirect or parity with account |
| Buying prefs / areas / cities | account/* | persistence |

**Cold product rule:** still verify end-to-end; improve if broken; growth is separate P6 lift.

### Family F12 — Auth & compliance

| Feature | Route |
|---------|-------|
| Login / signup / forgot | auth pages |
| Auth error | `/auth-error` |
| Privacy / terms / cookies / DMCA / fair housing / accessibility / data-deletion | legal |
| Alerts unsubscribe | `/alerts/unsubscribe` |
| Newsletter unsubscribe | `/newsletter/unsubscribe` |

### Family F13 — Dev / exclude from public grind

| Route | Status |
|-------|--------|
| `/dev/*` | X exclude |
| Admin entire tree | Separate admin design OS |

### Family F14 — Sales intelligence (G9 systems + surfaces)

Not a random page set — **data product** that F05 consumes. Full executable plan: `SALES_INTELLIGENCE_EXECUTABLE.md`.

| Unit | Deliverable | Data path |
|------|-------------|-----------|
| SI-0 | Truth map, first publish year, type map, index inventory | Probe scripts |
| SI-1 | `sales_cube_annual` + rebuild RPC + partial indexes | Service-role only |
| SI-2 | DAL `getSalesCubeAnnual` (+ tests) | Cubes only |
| SI-3 | Market size + composition UI | DAL |
| SI-4 | Expose existing cache `total_volume` (quick win) | `market_stats_cache` |
| SI-5 | Feature cube + constrained explorer | `sales_cube_feature` |
| SI-6 | Embeds (sell/city/listing aggregate) | DAL |
| SI-7 | Cron + pipeline heartbeat | Ops |

**Must verify:** type_scope labels; sample floors; no listings OLAP on request path; parity raw vs cube; rebuild lag ≤36h; G62 (no details fan-out).

**Improve bar:** Region answers multi-year $ volume + composition; ≥1 feature-history cell from cube.

---

## 5. Family recipes — verify matrix (slots every family must pass)

Use this as the **exhaustive** checklist when grinding a family (expand from PAGE_IA matrix).

| Family | Required Layer A | Required body slots (minimum) | Conversion | Moat |
|--------|------------------|-------------------------------|------------|------|
| F01 Home | Homes for Sale + region | M1 M2 M3 M5 M8 M9 M18 M16 M17 M4 | Sell + search | Live region data |
| F02 City | Homes for Sale + city | M1–M6 M8–M9 M12 M13 M14 M18 M19 M16 M17 M21 | Alerts + Sell | Pulse SFR + CMA |
| F02 Nbhd | Homes for Sale + place | M1 M2 M3 M4 M8 M13 M18 | Alerts + Sell | Boundary honesty |
| F02 Community | Homes for Sale + name | M1–M6 M12 M15? M18 M19 M21 | Alerts + Sell | Resort depth |
| F02 Search | Inventory title | Filters map cards | Save/alert | Facets honest |
| F02 Listing | Address H1 | Specs map history CTAs | Tour/contact | §0 media |
| F02 OH / drops | Query H1 | Count + list + city chips | Alerts / browse | Correct counts |
| F05 Market | Housing market H1 | M1 M4 M13 M21 city links + **volume/composition when SI-3+** | Sell / alerts | MoS methodology + **sales cubes §0** |
| F14 Sales intel | N/A (system) | Cubes + DAL + rebuild | Feeds F05 | Perf + parity |
| F06 Tools | Tool name query | Calculator + lead CTA | Contact / browse | Defaults from config |
| F07 Sell | Sell intent H1 | Process + fees + form | Valuation | Fee transparency |
| F04 Lifestyle | Entity name | Prose + nearby homes if claimed | Browse city | Fair housing |
| F08 Blog/FAQ | Query title | Body + related | Soft CTA | Schema FAQ |
| F09 Trust | Clear title | People + contact | Contact form | Real reviews only |
| F10 LP | Ad match | Form above fold | Form submit | Event IDs |
| F11 Account | App chrome | Feature works | — | Data persists |
| F12 Legal | Accurate title | Policy text current | — | Compliance |

---

## 6. Improvement standards (what “improved” means)

When status = **I**, improvements must satisfy:

### 6.1 Data

- Wire real DAL; remove hardcodes.  
- Align hero count to the noun (OH vs homes).  
- Show methodology when MoS/median is displayed.

### 6.2 Discovery

- Fix title/H1 templates.  
- Add internal links from family hubs.  
- Register orphans intentionally.

### 6.3 Product slots

- Fill missing **P** parity from matrix before moat thrills.  
- Empty states: “No open houses this week” not fake cards.

### 6.4 Design (within brand)

- One Amboqia moment per viewport.  
- Dominant navy or cream section, not gray card soup.  
- Fix chrome first if broken (we already learned unscoped CSS).  
- Mobile 375 verified.  
- No new fonts/colors.

### 6.5 Conversion

- Primary CTA per intent.  
- Alerts + valuation on money pages.  
- Form → CRM smoke test once per family.

### 6.6 Measurement

- page_view / section tracker present.  
- Lead events for forms.  
- Never declare traffic dead from GA4 alone.

---

## 7. Grind order (comprehensive, not “top only”)

**Principle:** Complete one family end-to-end (all sample URLs + rubric) before the next.  
**Cadence:** One family per session or until blocked. Log in `docs/plans/seo-voice/VERIFY_LOG.md` (create on first grind).

### Wave 0 — Systems (must stay green while grinding)

1. F00 Global chrome (nav, search, consent, trackers, sitemap, llms)  
2. Data probe (§2.2) snapshot into VERIFY_LOG  

### Wave 1 — Money path (buy + geo)

3. F01 Homepage  
4. F02 Search + homes-for-sale + map + filters  
5. F02 Listing detail  
6. F02 City template (3 cities)  
7. F02 Neighborhood (Bend sample + thin)  
8. F02 Community/resort (3 resorts)  
9. F02 Price drops + Open houses (hub + city)  
10. F02 Luxury, motivated, our-homes, videos, compare, feed, buy  

### Wave 2 — Market + tools + sell

11. F05 Market hub + city report + region + MoS + activity + pulse + resources  
12. F05 Reports / sales / archive  
13. F06 All three tools  
14. F07 Sell + valuation + sell intents  
15. F10 Seller + buyer LPs (conversion gates)  

### Wave 3 — Areas lifestyle + content + trust

16. F03 Indexes (cities, communities, area-guides, zip, subdivisions, oregon)  
17. F04 Parks, schools, trails, events, venues, golf  
18. F08 Blog + FAQ  
19. F09 About, team, reviews, contact, join  
20. F12 Legal + unsubscribe  

### Wave 4 — Account product (existing features)

21. F11 Full account + dashboard alias matrix (every saved/history/collection path)  

### Wave 5 — Cross-cutting after all families V/I logged

22. Internal link / orphan registry complete  
23. Layer A gate (`ci:seo-shell` if built) ratchet  
24. Conversion metrics baseline → P6 lift experiments  
25. Design polish wave per family (P5 UI order: chrome → home → city → listing → sell → market → LP)  
26. Authority flywheel (P7): content depth, AEO FAQs, citations  

---

## 8. Execution mechanics (accuracy + efficiency)

### 8.1 Session protocol

1. State family ID (e.g. F02 City).  
2. Re-run **data probe** for that family’s sources.  
3. Load **3 live URLs** (or all static routes in family).  
4. Fill **rubric card** per template.  
5. Open **I/B** tickets with evidence (screenshot path, wrong number, missing slot).  
6. Implement improvements for that family only.  
7. Re-verify.  
8. `npm run push` when family is V or I-with-shipped-fixes.  
9. Append VERIFY_LOG.  

### 8.2 Parallelization rules

| Safe parallel | Unsafe parallel |
|---------------|-----------------|
| Data probe vs content copy on different families | Two agents on `kb.css` / PublicNav / layout |
| Lifestyle entity pages | City + community slot components same PR |
| Legal pages | Layer A + design rewrite same files |

### 8.3 Automation to add (engineering support for completeness)

| Artifact | Purpose |
|----------|---------|
| `VERIFY_LOG.md` | Status V/I/B/O per family |
| `lib/seo/layer-a-patterns.ts` + `ci:seo-shell` | Fail poetry H1s on money families |
| Orphan route registry | Every public page classified |
| Playwright smoke matrix | One test per family critical path |
| Admin dual-source scoreboard widget | Weekly FP / GSC / GA4 / leads line |

### 8.4 What “comprehensive” is not

- Not one hero redesign and stop.  
- Not skipping account/tools/legal because “low traffic.”  
- Not thinning sitemap for GSC vanity.  
- Not inventing stats for empty slots.  
- Not changing brand tokens.

---

## 9. Success criteria (program level)

| Checkpoint | Criteria |
|------------|----------|
| **Wave 0–1 complete** | Money path families all V or I-logged; dual chrome dead; Layer A city/home |
| **Wave 2 complete** | Market/tools/sell/LP conversion verified |
| **Wave 3 complete** | Lifestyle + content + trust verified |
| **Wave 4 complete** | Account features work end-to-end |
| **Wave 5 complete** | Orphan registry + polish waves + 90d scoreboard movement |
| **12-month top site** | Still `TOP_SITE_GOAL_SYSTEM` outcomes — this plan is the **verify/improve machine** that feeds that |

---

## 10. Immediate start (when you say go)

**Wave 0 + F01 + F02 City** in order:

1. Live data probe snapshot → VERIFY_LOG.  
2. F00 chrome: live header on 5 URLs (home, city, search, sell, community).  
3. F01 homepage full rubric + fix any I.  
4. F02 city template: Bend + Sisters + thin city full rubric.  
5. Ship. Then continue Wave 1 without skipping families.

---

## 11. Related docs

| Doc | Role |
|-----|------|
| This file | **Exhaustive verify + improve program** |
| `TOP_SITE_GOAL_SYSTEM.md` | Outcomes L0–L6 + P0–P7 |
| `DATA_FOUNDATION_TOP_SITE.md` | What data exists |
| `PAGE_IA_COMPONENT_MATRIX.md` | Slot recipes + parity |
| `MEASUREMENT_DUAL_SOURCE.md` | Scoreboard honesty |
| `ENDTOEND_MISSION.md` | Foundation ship log (subset) |
| `design_system/ryan-realty/` | Brand tokens |
| `components/site/kb/*` | Implementation library |

---

*Every existing public feature is in §4. None are optional for verification. Improvement priority within a family follows data → Layer A → slots → conversion → design. Across the site, grind order is §7 so we never claim “comprehensive” while skipping account, tools, lifestyle, or legal.*
