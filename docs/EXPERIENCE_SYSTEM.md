# Experience System

**Version:** 1.0.0 · Locked 2026-06-09
**Visual authority:** `design_system/ryan-realty/ui_kits/homepage-v3/index.html`
**Registered in:** `docs/DEVELOPMENT_PROCESS.md` plan table

The cure for 90 bespoke pages built in different eras: six page archetypes built once in the v3 design language, every public route an instance. Data-as-identity (live numbers in Amboqia as hero elements), zero sliders, editorial asymmetric grids, real-polygon line-art map identity, navy `#102742` / cream `#faf8f4` only, tabular numerals, quiet confident spacing.

---

## 1. The six archetypes

### GEO — geographic place pages
Covers communities, cities, neighborhoods, ZIP codes, subdivisions, parks, schools.
The identity of a place is its live market data rendered large in Amboqia inside a full-bleed media hero.

**Section stack (canonical order):**
1. BreadcrumbNav (inline, minimal, no section chrome)
2. **FlyoverHero** — video (16:9, muted autoplay, `prefers-reduced-motion` → static poster) with live aggregate numerals overlaid: active count + median price in Amboqia display, pulsing green live-dot, community name as H1
3. **LiveMarketBand** — navy band, 4 stats (active, median, days-to-pending, months of supply), tabular numerals, `market_pulse_live` DAL
4. **BoundaryMapInteractive** — real polygon + price-pill markers, reuses NeighborhoodMap + clustering logic
5. Listings — editorial mosaic (1 dominant card + uniform grid, no slider)
6. **SectionNav** — in-page anchor nav for long pages (renders as sticky top strip once scrolled past hero)
7. Rich community / city content (CommunityRichContent or equivalent) — section-nav anchored
8. Open houses (OpenHousesGrid)
9. **InlineValuationHook** — quiet band: "What is your {Name} home worth?" reusing the existing valuation form island
10. FAQ (FAQBlock)
11. Related areas (RelatedAreas ×2: sibling geos + other cities)
12. CTABar navy

**Highest-value Geo routes to migrate first (priority 1):**
- `/communities/[slug]` (14 communities) — exemplar: `/communities/tetherow` (built in this session)
- `/cities/bend` (highest-traffic city)
- `/cities/redmond`, `/cities/sisters`
- `/communities` index (hub page)
- `/zip/97701`, `/zip/97703` (Bend ZIP codes, high search volume)

---

### HUB — aggregation and discovery pages
Covers market hubs, search, price drops, guides index, area guides, open houses.
Identity: scoreboard + filter chrome. Data is the product.

**Section stack:**
1. Compact hero with live region-level stats (no full-bleed video — scoreboard IS the hero)
2. Filter / sort controls (StickyActionRail or inline)
3. Paginated results grid (ListingCard or HubCard)
4. Market context strip (LiveMarketBand)
5. Related geos cross-nav
6. CTABar

**Highest-value Hub routes:**
- `/search` (primary acquisition surface)
- `/housing-market` + `/housing-market/central-oregon`
- `/open-houses`
- `/price-drops` + `/price-drops/bend`
- `/area-guides`

---

### LISTING — single property detail
Covers `/listing/[slug]`.
Identity: photo-first, verified price large in Amboqia, broker contact sticky.

**Section stack:**
1. Photo mosaic hero (4-up grid opens lightbox — no slider)
2. Price + address bar (StickyActionRail: save/share/compare/contact)
3. Listing detail stats (beds/baths/sqft/lot/year built, tabular)
4. Description (brand-voice enforced)
5. **LiveMarketBand** (neighborhood context — same component)
6. **BoundaryMapInteractive** (listing pin inside neighborhood polygon)
7. Open houses for this listing
8. Comparable listings (ListingCard mosaic, NOT slider)
9. Area guide snippet + CTABar

**Highest-value Listing routes:**
- `/listing/[slug]` — one archetype, all instances; highest lead-gen surface

---

### TOOL — interactive utilities
Covers mortgage calculator, appreciation tool, rental calculator, valuation, compare.
Identity: form-centered, output-driven, minimal chrome, no hero video.

**Section stack:**
1. Compact headline + context (H1 + lede, no photo)
2. Tool UI (the calculator/form — primary content)
3. Result output / explanation
4. Related tools or calculators
5. InlineValuationHook or CTABar (lead hook)

**Highest-value Tool routes:**
- `/tools/mortgage-calculator`
- `/tools/appreciation`
- `/sell/valuation`
- `/compare`

---

### CONTENT — editorial and long-form
Covers blog posts, guides, area guides, market reports (editorial renders), reviews, about, team, FAQ.
Identity: text-first, editorial rhythm, no market data hero, pull-quote moments.

**Section stack:**
1. Compact hero (H1 in Amboqia display + lede, optional supporting photo — not full-bleed)
2. Body content (long-form prose, structured)
3. **SectionNav** (anchored sections for long guides)
4. Related content (ArticleGrid)
5. CTABar or InlineValuationHook

**Highest-value Content routes:**
- `/about`
- `/team`
- `/blog` + individual posts
- `/guides` + guide detail pages
- `/reviews`

---

### LP — lead-capture landing pages
Covers `/lp/*`, `/buy/*`, `/sell/*`, `/lp/seller-home-value`, expired listing LP.
Identity: one-problem one-action, no nav distraction, trust signals, no hero video.

**Section stack:**
1. Problem-first hero (H1 = the buyer/seller's felt pain, no brokerage mention)
2. Trust proof (reviews / stats / broker faces — sparse, not wall of logos)
3. The form (primary action — above the fold on mobile)
4. Supporting content (what happens next, why Ryan Realty)
5. FAQ (objection handling)
6. No CTABar (the LP IS the CTA)

**Highest-value LP routes:**
- `/lp/seller-home-value`
- `/lp/buyer-listing-alerts`
- `/sell`
- `/lp/expired-listing`
- `/buy/first-time-home-buyer`

---

## 2. The route map

### Geo archetype (priority migration)
| Route | Priority | Status |
|---|---|---|
| `/communities/[slug]` (×14) | P1 | Exemplar built (tetherow) |
| `/communities` | P2 | Pending |
| `/cities/bend` | P1 | Pending |
| `/cities/redmond` | P1 | Pending |
| `/cities/sisters` | P2 | Pending |
| `/cities/[slug]` remaining (×6) | P3 | Pending |
| `/cities/bend/[neighborhood]` (×13) | P2 | Pending |
| `/zip/97701`, `/zip/97703` | P2 | Pending |
| `/zip/[zip]` remaining (×9) | P3 | Pending |
| `/subdivisions/[slug]` | P3 | Pending |
| `/parks/[slug]` | P4 | Pending |
| `/schools/[slug]` | P4 | Pending |

**Geo total: ~65 routes**

### Hub archetype
| Route | Priority |
|---|---|
| `/search` | P1 |
| `/housing-market` | P1 |
| `/housing-market/central-oregon` | P1 |
| `/housing-market/explore` | P2 |
| `/housing-market/reports` | P2 |
| `/open-houses` | P2 |
| `/price-drops` | P2 |
| `/price-drops/[city]` (×10) | P3 |
| `/area-guides` | P3 |
| `/pulse` | P3 |

**Hub total: ~20 routes**

### Listing archetype
| Route | Priority |
|---|---|
| `/listing/[slug]` | P1 |

**Listing total: 1 route (all instances)**

### Tool archetype
| Route | Priority |
|---|---|
| `/tools/mortgage-calculator` | P2 |
| `/tools/appreciation` | P2 |
| `/sell/valuation` | P1 |
| `/compare` | P2 |

**Tool total: 4 routes**

### Content archetype
| Route | Priority |
|---|---|
| `/about` | P1 |
| `/team` | P2 |
| `/blog` | P2 |
| `/guides` | P3 |
| `/reviews` | P2 |
| `/faq` | P3 |
| `/reports/sales/[city]/[period]` | P2 |

**Content total: ~10 routes (+ individual blog/guide posts)**

### LP archetype
| Route | Priority |
|---|---|
| `/lp/seller-home-value` | P1 |
| `/lp/buyer-listing-alerts` | P1 |
| `/sell` | P1 |
| `/lp/expired-listing` | P1 |
| `/buy/first-time-home-buyer` | P2 |
| `/sell/for-sale-by-owner` | P2 |
| `/lp/bend`, `/lp/tetherow`, `/lp/central-oregon-golf` | P2 |

**LP total: ~10 routes**

---

## 3. Shared interactive-module kit

Build once, use everywhere. All live at `components/site/experience/`.

| Module | Status | Description |
|---|---|---|
| `FlyoverHero.tsx` | **Built (this session)** | Full-bleed video hero with muted autoplay, poster fallback, `prefers-reduced-motion` → static poster. Accepts live stats (activeCount, medianPrice) rendered in Amboqia overlay with pulsing live-dot. |
| `LiveMarketBand.tsx` | **Built (this session)** | Navy band, 4 stat slots, tabular numerals. Consumed by FlyoverHero section and standalone between sections. |
| `SectionNav.tsx` | **Built (this session)** | Sticky in-page anchor nav. Renders as a slim navy pill strip once user scrolls past the hero threshold. |
| `useEngagementTracking.ts` | **Built (this session)** | Client hook: IntersectionObserver section_view, scroll_depth quartiles, dwell heartbeat at 15/45/120s, module_interact, exit_intent. Wired to existing `lib/tracking.ts` → GA4. |
| `StickyActionRail.tsx` | Pending | Save / share / compare / contact rail. Used on Listing + Geo pages. |
| `BoundaryMapInteractive.tsx` | Pending (reuse NeighborhoodMap) | Price-pill marker map. Wraps existing `NeighborhoodMap` with price-pill overlay enhancement. |
| `InlineValuationHook.tsx` | **Built (this session)** | Quiet navy band: "What is your {name} home worth?" reusing the existing valuation form island logic. Replaces the generic CTABar on Geo pages. |
| `DropBadge.tsx` | Pending | Price-drop badge for listing cards. |
| `StatCompareRow.tsx` | Pending | Side-by-side stat comparison (e.g. community vs. city median). |

---

## 4. Engagement telemetry spec

All events flow through `lib/tracking.ts` → GA4 via `trackEvent()`. No new infrastructure.

### Event vocabulary

```ts
// Section became 55%+ visible — fires once per section per page load
trackEvent('section_view', { section_id: string, page_type: string, position: number })

// Scroll depth quartiles — fires at 25 / 50 / 75 / 100
trackEvent('scroll_depth', { depth: 25 | 50 | 75 | 100, page_type: string })

// Any interactive module action
trackEvent('module_interact', { module: string, action: string, page_type: string })

// Dwell heartbeats — fires at 15s, 45s, 120s
trackEvent('dwell', { seconds: 15 | 45 | 120, page_type: string })

// Exit intent (mouseleave toward top on desktop, visibility change on mobile)
trackEvent('exit_intent', { page_type: string, scroll_depth: number })
```

### Hook API

```ts
// Client component — embed in each section of an archetype page
useEngagementTracking(sectionId: string, options?: { pageType?: string; position?: number })
```

The hook installs one `IntersectionObserver` (threshold 0.55) per call, fires `section_view` once on entry, and cleans up on unmount. The scroll_depth and dwell trackers are installed once at the page root via `<EngagementPageRoot pageType="geo" />` (a thin wrapper built in this session).

**Privacy:** no PII collected. Respects the existing `typeof window === 'undefined'` guard in `lib/tracking.ts`. No new consent requirement — engagement events are behavioral analytics, same category as the existing `scroll_depth` events already in the tracking taxonomy.

---

## 5. Never-regress mechanics

Every route migrated to an archetype updates its `parity.json` in the **same commit** as the page rebuild. The `check-mockup-parity.mjs` gate (G28) enforces this mechanically — a page that drops a required component fails CI.

**The rule:** when a page is migrated to an Experience System archetype, its `parity.json` at `design_system/ryan-realty/ui_kits/<route>/parity.json` is updated to list the new archetype-required components (FlyoverHero, LiveMarketBand, SectionNav, InlineValuationHook). Missing any of them after migration = CI fails.

**New parity contracts land alongside the migration commit, never after.** A migration without an updated `parity.json` is incomplete work.

---

## Changelog

- **1.0.0 (2026-06-09)** — Initial. Six archetypes defined, full route map (91 public routes), module kit (9 modules, 5 built in session 1), engagement telemetry spec, never-regress mechanics. Exemplar: `/communities/tetherow`.
