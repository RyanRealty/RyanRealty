# Page IA · Navigation · Component Matrix

**Date:** 2026-08-10  
**Status:** Architecture spec (research-backed). Not implemented until Matt approves.  
**Roles:** senior eng + SEO + IA.  
**Companion:** Layer A/B voice plan (discovery shell vs brand body).

---

## 0. What this document is

Every public surface is considered as **four coupled problems**:

| Layer | Question |
|-------|----------|
| **Navigation** | How does a human (or crawler) *find* this page in ≤2 clicks? |
| **SEO / LLM shell** | What is the title, H1, first fact block, schema, `llms.txt` label? |
| **Page structure** | Which components appear, in what order, why? |
| **Delivery** | SSR/ISR, data sources, performance, mobile chrome |

Competitors define the **minimum** (parity). Ryan Realty must match parity **and** ship **moat components** portals cannot copy (live local depth + named broker + honest CMA path).

---

## 1. Navigation — current state (diagnosis)

### 1.1 Architecture today (disorganized)

There is **not one navigation**. There are **five parallel trees** in `lib/site-nav.ts`, consumed by **two chrome systems**:

| Tree | Consumers | Role |
|------|-----------|------|
| `PRIMARY_NAV` | `SiteHeader`, `MobileNav`, mega menu | Legacy “portal” chrome |
| `FOOTER_NAV` | `SiteFooter` | Portal footer |
| `KB_TOP_NAV` | `KbNav` | Editorial/KB top bar (most public money pages) |
| `KB_MENU_GROUPS` | `KbNav` Menu+ overlay | Mobile / overflow index |
| `KB_FOOTER_COLUMNS` | `KbFooter` | KB footer |

**Problems Matt is feeling:**

1. **Two products, one brand.** Homepage/city/sell use `KbNav`. Some routes still use `SiteHeader`. Labels and groups **do not match** (e.g. PRIMARY merges cities+communities under “Homes”; KB splits “Cities” / “Communities”).
2. **Junk-drawer groups.** `PRIMARY_NAV` “Guides” mixes blog, events, venues, FAQ, videos, two calculators. Not an intent model.
3. **Duplicate destinations.** Price drops under both Homes and Market; Our listings under Sell and About (KB); valuation CTA wording differs by surface.
4. **Orphan money pages** (exist, rankable, weak/no primary nav path):
   - `/pulse`, `/feed`, `/months-of-supply`
   - `/tools/rental-property-calculator`
   - `/zip/*`, `/subdivisions/*` (discoverability via city/community only)
   - Many neighborhoods only via city page, not nav (OK if linked from city — must be guaranteed)
5. **Lifestyle split.** Parks/schools under Cities (KB) but trails/events/venues under Menu+ “Things to do” only — not on top bar.
6. **Reachability gate ≠ good IA.** `ci:nav-reachability` forces links to exist; it does **not** force a clear buyer/seller mental model. Mega-menu stuffing cities for gate compliance is how “Homes” became unreadable.

### 1.2 Competitor navigation patterns (what “good” looks like)

| Player | Top bar model | Notes |
|--------|---------------|--------|
| **Redfin / Zillow** | Search-first; secondary: Buy, Rent, Sell, Mortgages, Agents | Inventory search is the product. Local depth is footer + city page modules. |
| **Local Bend agent sites** (e.g. bendrealestate.com) | Buy / Sell / Communities / About + phone CTA | Heavy community lists; SEO titles exact-match “Homes for Sale”. |
| **Duke Warner** | Simple brokerage: properties, brokers, blog, market reports | Trust + longevity; thinner product nav. |
| **Industry 2026 guides** | Buy \| Sell \| Areas \| Market \| About + search + primary CTA | Intent-first; areas as first-class, not buried under “Guides”. |

**Universal rule:** Top bar = **intents** (Buy, Sell, Areas, Market, Company). Long lists (every community) live in **mega-panel columns or footer**, never as one flat 40-link Homes dump.

### 1.3 Target navigation model (single source of truth)

**One tree.** Derive every chrome surface from it.

```
PRIMARY (top bar, ≤6 items)
├── Buy          → /homes-for-sale
│   ├── Search all homes
│   ├── Map search
│   ├── Open houses
│   ├── Price drops
│   ├── Luxury (Bend $1.5M+)
│   ├── Compare homes
│   ├── Video tours
│   └── Listing alerts
├── Areas        → /area-guides  (or /cities)
│   ├── Cities (all + Bend, Redmond, Sisters, Sunriver, La Pine, Terrebonne…)
│   ├── Communities (all + top resorts)
│   ├── Schools
│   ├── Parks
│   └── (footer: trails, events, venues, golf)
├── Market       → /housing-market
│   ├── Overview
│   ├── By city / reports
│   ├── Recent activity
│   ├── Months of supply (glossary)
│   └── Tools: mortgage · rental · appreciation
├── Sell         → /sell
│   ├── Sell your home
│   ├── Free valuation (form page, not LP)
│   ├── Our listings
│   └── Motivated / deadline sellers (if product stays public)
├── About        → /about
│   ├── Team · Reviews · Contact · Join
└── [Search icon]  [Sign in]  [Primary CTA: Value my home]
```

**Menu+ / mobile:** same groups, denser links (full community list, lifestyle, account).  
**Footer:** SEO columns = Areas · Communities · Market · Buy · Sell · Company · Legal.  
**Labels = Layer A language** (“Homes for sale”, not “the list”).

### 1.4 Nav implementation rules (eng)

1. **Deprecate dual trees.** `PRIMARY_NAV` becomes alias of the single IA tree; `KB_TOP_NAV` / `KB_MENU_GROUPS` / footers are **views** (filters/projections), not re-authored lists.
2. **One chrome on all public pages.** Prefer KB chrome (or fully merge SiteHeader onto same data). HideChrome only for LP / sign / admin.
3. **Gate upgrade:** reachability **plus** “every `app/**/page.tsx` public route is either in the tree, in site-index, or explicitly `noindex`/`orphan-ok` in a registry.”
4. **No LP URLs in primary nav** except deliberate growth experiments (buyer alerts may stay; seller LPs stay ad-only).
5. **Breadcrumbs** mirror the tree: Home › Cities › Bend › Northwest Crossing.

### 1.5 Navigation matrix (competitor vs RR target)

| Capability | Portals | Local Bend sites | RR today | RR target |
|------------|---------|------------------|----------|-----------|
| Global search (address/city) | ✓ | sometimes | ✓ KbNav | ✓ unify |
| Buy / inventory entry | ✓ | ✓ | split Homes vs Search | ✓ Buy |
| Areas / communities first-class | footer | ✓ | partial / inconsistent | ✓ Areas |
| Market data entry | weak on agent sites | weak | ✓ but tools misplaced | ✓ Market + tools |
| Sell + valuation CTA | ✓ | ✓ | ✓ | ✓ consistent label |
| Company / team | weak on portals | ✓ | ✓ About | ✓ |
| Lifestyle (trails/events) | rare | rare | Menu+ only | Footer + Areas panel |
| Dual header systems | n/a | n/a | **yes — problem** | **one** |
| Orphan SEO pages | n/a | n/a | several | zero orphans |

---

## 2. Universal component catalog

Every public page is assembled from **slots**. Competitors define which slots exist; we mark parity and moat.

### 2.1 Chrome slots (all pages)

| Slot ID | Purpose | Portals | Local | RR | Notes |
|---------|---------|---------|-------|-----|-------|
| C1 Header / nav | Wayfinding | ✓ | ✓ | dual | **Unify** |
| C2 Global search | Query entry | ✓ | ~ | ✓ | Keep suggest |
| C3 Primary CTA | Value my home / Contact | ~ | ✓ | ✓ | Layer A label |
| C4 Account | Saved searches | ✓ | ~ | ✓ | |
| C5 Breadcrumb | Hierarchy + schema | ✓ | ~ | partial | Required on all non-home |
| C6 Footer sitemap | Crawl paths | ✓ | ✓ | dual | Derive from tree |
| C7 Legal / fair housing | Compliance | ✓ | ✓ | ✓ | |
| C8 Sticky mobile CTA | Conversion | ✓ | ~ | listing yes | Expand to sell/city |

### 2.2 Discovery shell slots (Layer A)

| Slot ID | Purpose |
|---------|---------|
| S1 Document title | Query match |
| S2 Meta description | Promise + fact |
| S3 H1 | Query match + entity |
| S4 Hero lead / first paragraph | Count + median + DOM when real |
| S5 JSON-LD | Place / FAQ / WebPage / Dataset |
| S6 `llms.txt` line | Keyword-legible summary |
| S7 Canonical + hreflang if ever multi | |

### 2.3 Body modules (structure)

| Slot ID | Module | Why it exists |
|---------|--------|----------------|
| M1 At-a-glance stats | 4–6 live figures | SEO + LLM extract + trust |
| M2 Inventory grid / featured | Listings | Buy intent |
| M3 Map | Spatial truth | Moat vs thin blogs |
| M4 Market charts / HUD | Trends | Moat vs agent brochure sites |
| M5 Activity / ticker | Freshness | Recency signals |
| M6 Open houses | Time-bound intent | |
| M7 Price drops / motivated | Discount intent | |
| M8 Neighborhoods / related areas | Internal links | Hyperlocal SEO |
| M9 Communities rail | Resort/geo | |
| M10 Schools | Family queries (neutral FH) | |
| M11 Parks / lifestyle | Lifestyle SEO | Fair housing safe |
| M12 About place prose | Local depth | Beat portals |
| M13 FAQ | PAA + schema | AEO |
| M14 Articles / guides | Content cluster | |
| M15 Video | Engagement + YouTube SEO | |
| M16 Testimonials | Social proof (verbatim) | |
| M17 Team / broker cards | Entity + trust | AEO “who to call” |
| M18 Sell / valuation CTA | Dual audience | |
| M19 Buy CTA / alerts | Capture | |
| M20 Compare / tools | Utility | |
| M21 Sources / methodology | §0 honesty | |
| M22 Related searches | SEO | |
| M23 Newsletter | Retention | optional |
| M24 Lead form (contextual) | Conversion | |

### 2.4 Moat modules (RR advantage — portals weak / absent)

| Slot ID | Module | Why portals lose |
|---------|--------|------------------|
| X1 Written CMA path | Free comps, no listing agreement | Portals = Zestimate-class; RR = broker-written |
| X2 Named broker accountability | “Broker you call is broker you get” | Portal agents rotate |
| X3 Live local MoS + verdict band | Transparent formula | Often buried |
| X4 Subdivision GIS + listings | True polygon | Portals approximate |
| X5 Resort community depth | Tetherow etc. | Thin national pages |
| X6 School ↔ homes join | Feed map | Separate silos on portals |
| X7 Park/trail/event ↔ homes | Content engine | Rare on locals |
| X8 Video tours of MLS homes | Own feed | Hit-or-miss |
| X9 Plan / fee transparency on sell | 2.5–3.5% stated | Locals often hide fees |
| X10 llms.txt + AI bots allowed | Already shipped | Many broker sites block bots |
| X11 First-party CRM + alerts | Not a lead marketplace | Zillow Premier Agent conflict |

---

## 3. Page-family recipes

Legend: **P** = parity required · **M** = moat · **R** = RR has today · **G** = gap · **N** = nav requirement

### 3.1 Homepage `/`

| Order | Slot | Competitors | RR | Action |
|------:|------|-------------|-----|--------|
| 1 | S3 H1 inventory+geo | Portals: “Homes for sale…” | Personality H1 risk | **Layer A restore** |
| 2 | M1 region stats | ✓ Redfin | R via hero stats | Keep |
| 3 | M8 towns | locals | R KbExploreTowns | Keep |
| 4 | M9 communities | locals | R | Keep |
| 5 | M2 featured | ✓ | R | Keep |
| 6 | M3 map | ✓ | R | Keep |
| 7 | M5 ticker | portals | R | Keep |
| 8 | X1 sell strip | locals | R KbSell | Keep |
| 9 | M16 + M17 | locals | R | Keep |
| 10 | M4 market HUD | Redfin | R | Keep |
| N | Buy · Areas · Market · Sell · About | | dual chrome | **Unify nav** |

### 3.2 City page `/cities/[slug]` (money page)

| Order | Slot | Portals (Redfin Bend) | Local SEO best practice | RR today | Gap |
|------:|------|----------------------|-------------------------|----------|-----|
| | S1–S4 | Title/H1: “Bend, OR Homes for Sale” | Exact match | **Weakened by voice pass** | **RESTORE Layer A** |
| 1 | M1 at-a-glance | count + medians | required | partial in hero | **Standardize band** |
| 2 | M3 map + inventory | ✓ | ✓ | R map + featured | Ensure grid depth |
| 3 | M4 charts / market | ✓ “real estate trends” | ✓ | R MarketCoreCharts | |
| 5 | M8 neighborhoods | ✓ neighborhood links | **critical** | R ExploreTowns | |
| 6 | M9 communities | ✓ | ✓ | R | |
| 7 | M6 open houses | ✓ explore link | ✓ | check | Wire if thin |
| 8 | M5 activity | portals | | R activity | |
| 9 | M12 about place | weak on portals | strong on agents | R KbAbout | |
| 10 | M14 articles | | ✓ | R | |
| 11 | M13 FAQ | | ✓ | R | Layer A questions |
| 12 | M16 M17 X1 | agents | ✓ | R | |
| 13 | M21 sources | rare | | R MarketSources | Keep |
| N | Cities under Areas | | | inconsistent | Fix |

**Competitive advantage stack on city:** live SFR-only honesty (§0), MoS methodology, school/park joins, broker CMA, video if present, no lead-marketplace tax.

### 3.3 Neighborhood `/cities/[city]/[nbh]`

Same as city but H1 = `{Neighborhood} Homes for Sale | {City}`.  
**Must:** M1, M2, M3, M4 (or parent city chart labeled), M12, M13, M8 siblings, X1.  
**Moat:** true boundary map + listings inside polygon (portals often soft).

### 3.4 Community / resort `/communities/[slug]`

| Slot | Portal | Local | RR | Notes |
|------|--------|-------|-----|-------|
| Resort overview | thin | marketing fluff | R KbResortOverview | Keep facts |
| Map + inventory | ✓ | ✓ | R | |
| Market HUD | rare | rare | **R moat** | |
| Schools | rare | rare | R | |
| Open houses / activity | ~ | | R | |
| Buy CTA + alerts | ✓ | | R | |
| FAQ | | | R | |

### 3.5 Market report `/housing-market/*`

| Slot | Redfin housing-market | RR | Gap |
|------|----------------------|-----|-----|
| Layer A H1 “{City} Housing Market” | ✓ | personality risk | Restore |
| M1 MoS, median, inventory, DOM | ✓ | R | |
| Charts | ✓ | R | |
| City comparison | ✓ | R CityComparisonTable | |
| Methodology / sources | weak | R | **Feature this** (trust + AEO) |
| FAQ | | R | |
| Lead capture | | R | |
| Sell CTA | | R | |

### 3.6 Sell `/sell` + valuation

| Slot | Locals | RR | Gap |
|------|--------|-----|-----|
| Layer A H1 sell intent | “Sell your home in Bend” | mixed | Align |
| Fee / plan transparency | often hidden | **R moat** | Keep |
| Process steps | ✓ | R | |
| Proof / sold | ✓ | R | |
| Market context | rare | R | |
| FAQ | ✓ | R | AEO closing-cost style answers |
| Form above fold | ✓ | R | |

### 3.7 Inventory utilities

| Page | Must modules | Nav |
|------|--------------|-----|
| Open houses | H1 calendar language, map, list, city filter, sell CTA | under Buy |
| Price drops | H1 “Price drops”, definition, grid, map, alerts | under Buy |
| Motivated | honest definition (no hype), grid | Sell or Buy (pick one) |
| Videos / feed | H1 “Video tours”, grid/player | Buy |
| Compare | tool UI + SEO meta | Buy |
| Luxury Bend | H1 price floor explicit, grid, communities | Buy |

### 3.8 Lifestyle entities (parks, schools, trails, events, venues)

| Slot | Industry | RR | Gap |
|------|----------|-----|-----|
| Entity H1 = name | ✓ | R | |
| Map + nearby homes | rare | **R moat** | Ensure every slug |
| Facts / amenities | ✓ | R | |
| FAQ | rare | partial | Add where thin |
| Nav path | rare | weak | **Areas / Things to do** |

### 3.9 Tools

| Tool | Layer A H1 | Modules | Nav |
|------|------------|---------|-----|
| Mortgage calculator | exact name | inputs, assumptions, disclaimer, related market links | Market → Tools |
| Rental calculator | exact name | same | Market → Tools (**orphan today**) |
| Appreciation | exact name | same | Market → Tools |

### 3.10 Trust: about, team, reviews, contact, join

Portals lose here. Locals win on longevity stories.  
RR: keep accountability proof; Layer A titles still keyword-light OK (“Bend Real Estate Team”).  
**Nav:** top-level About panel — never buried.

### 3.11 Listing detail (brief)

Parity with portals: photos, price, specs, map, history, schools, similar, mortgage calc, agent card.  
**Moat:** published CMA download if exists, rental analysis, Text Matt CTA, neighborhood market context, video.

---

## 4. Master parity matrix (compressed)

Rows = modules. Columns = presence.

| Module | Redfin city | Zillow city | Local agent | RR city | RR must |
|--------|:-----------:|:-----------:|:-----------:|:------:|:-------:|
| Exact-match H1/title | ✓ | ✓ | ✓ | ⚠ | **P** |
| Live listing count | ✓ | ✓ | ✓ | ✓ | P |
| Median / trends | ✓ | ✓ | ~ | ✓ | P |
| Map | ✓ | ✓ | ~ | ✓ | P |
| Listing cards | ✓ | ✓ | ✓ | ✓ | P |
| Neighborhood links | ✓ | ✓ | ✓ | ✓ | P |
| Open houses link | ✓ | ✓ | ~ | ~ | P |
| Schools module | ~ | ✓ | ~ | ~ | P on nbh |
| FAQ | ~ | ~ | ~ | ✓ | P+AEO |
| Broker identity | ✗ | lead form | ✓ | ✓ | **M** |
| Written valuation CTA | Zestimate | Zestimate | form | **CMA** | **M** |
| Methodology/sources | weak | weak | ✗ | ✓ | **M** |
| Lifestyle join | ✗ | ✗ | ✗ | ✓ parks etc | **M** |
| Video tours | ~ | ~ | ~ | ✓ | M |
| Unified nav IA | n/a | n/a | simple | **dual** | **Fix** |

---

## 5. Delivery architecture (how pages are built)

### 5.1 Principles

1. **Template families, not one-off pages.** City / neighborhood / community / market / utility / lifestyle / sell / trust share slot contracts.
2. **Data before copy.** Every M1 number from DAL; empty → honest empty state, never invent.
3. **ISR + freshness stamps.** Show “Updated …” where pulse exists (AEO + trust).
4. **Mobile-first section order.** Stats → inventory/map → market → local depth → FAQ → CTAs.
5. **Performance budget.** Maps and charts lazy below fold; hero LCP image/video controlled.
6. **Chrome single mount.** One nav data module; no HideChrome double-header regressions.

### 5.2 Slot → component map (RR codebase)

| Slot | Primary implementation |
|------|------------------------|
| Nav | `lib/site-nav.ts` → unify → `KbNav` / one header |
| Hero Layer A | `KbHero` (defaults locked by registry) |
| M1 stats | hero stats + future `AtAGlance` band |
| M2 | `KbFeatured` / listing grids |
| M3 | `KbListingMap` |
| M4 | `KbMarketHud`, `MarketCoreCharts`, `PriceChart` |
| M5 | `KbTicker`, `KbActivity` |
| M6 | `KbOpenHouses` |
| M8–M9 | `KbExploreTowns`, `KbCommunities` |
| M10–M11 | `KbSchools`, parks/trails pages |
| M12 | `KbAbout` |
| M13 | `FAQBlock` |
| M14 | `KbArticles` |
| M16–M17 | `KbTestimonials`, `KbTeam` |
| X1 | `KbSell`, valuation routes |
| M21 | `MarketSources` |
| Schema | `MetadataBlock` / `lib/site/json-ld.ts` |

### 5.3 SEO shell registry (to build)

`lib/seo/layer-a-patterns.ts` (or docs + gate):

- Per family: title template, H1 template, lead template, required entities.
- `ci:seo-shell` fails if city H1 lacks “Homes for Sale” + city name.
- Nav labels must use same lexicon as Layer A (no “on the market now” in nav).

---

## 6. Phased execution (nav + pages together)

### Phase N0 — Navigation unification (blocks everything else)

1. Design final tree (§1.3) with Matt sign-off on labels.  
2. Collapse `PRIMARY_NAV` / `KB_TOP_NAV` / menus / footers into **projections** of one `SITE_IA` object.  
3. One public header component on all non-LP pages.  
4. Orphan audit: every public route → nav, footer, or site-index + intentional.  
5. Upgrade reachability gate.

### Phase N1 — Layer A restore on money templates

City, nbh, community, market, tools, open houses, price drops — titles/H1s/meta only.

### Phase N2 — Slot parity per family

Fill G gaps from §3 (at-a-glance band, open houses on city, rental tool in nav, etc.).

### Phase N3 — Moat amplification

Methodology blocks, CMA prominence, lifestyle joins, llms.txt keyword lines, FAQ AEO pass.

### Phase N4 — Measure

GSC head queries, nav click events (if analytics), orphan impressions, AI citation spot checks.

---

## 7. Decisions for Matt

1. **Single top-bar set (pick labels):** Buy | Areas | Market | Sell | About — OK?  
2. **Lifestyle:** under Areas panel vs separate “Local life” top item (only if bar not crowded).  
3. **Motivated sellers:** keep public under Sell, or noindex/de-emphasize?  
4. **Kill dual chrome now** (engineering cost) vs phased? **Recommend: now.**  
5. **City H1 form:** `{City}` + `Homes for Sale` (matches Redfin/local SERP language).

---

## 8. Success criteria

- [ ] One nav source of truth; Kb and portal chrome identical in structure  
- [ ] No orphan public money URLs  
- [ ] Every page family has a written slot recipe (this doc) and implements P slots  
- [ ] Layer A titles/H1s match query language on all inventory geos  
- [ ] Moat slots X1–X11 visible on appropriate templates  
- [ ] Gates: reachability + seo-shell + brand-voice  

---

## 9. Research basis (summary)

- **Portals** own head terms with boring exact-match H1/titles (Redfin: “Bend, OR Homes for Sale & Real Estate”); RR must not abandon that shell.  
- **Locals** that rank use “Homes for Sale” + community lists + phone CTA (e.g. bendrealestate.com).  
- **AEO / HousingWire 2026:** specific facts, FAQs, consistent NAP, detailed reviews — not slogan H1s.  
- **Hyperlocal playbook:** beat Zillow on neighborhood depth, not on national “homes for sale” alone.  
- **RR already has** unusual surface area (market HUD, lifestyle joins, CMA, llms.txt); **nav and Layer A** are currently under-selling it.

---

*Next implementation step after approval: Phase N0 PR (nav tree only), then N1 Layer A restore on cities.*
