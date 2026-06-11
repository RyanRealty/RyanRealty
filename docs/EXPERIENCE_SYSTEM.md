# Experience System

**Version:** 1.0.0 · Locked 2026-06-09
**Visual authority (homepage):** `design_system/ryan-realty/ui_kits/homepage-v6/index.html` (LOCKED 2026-06-11, Linear finish). All other routes: `homepage-v3` archetype language until migrated.
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
| `/communities/[slug]` (×14) | P1 | Exemplar built (tetherow) — awaiting Matt approval |
| `/communities` | P2 | Pending |
| `/cities/bend` | P1 | **Built 2026-06-10 — awaiting Matt approval** |
| `/cities/redmond` | P1 | **Built 2026-06-10 (inherits from [slug])** |
| `/cities/sisters` | P2 | Inherits from [slug] rebuild |
| `/cities/[slug]` remaining (×6) | P3 | Inherits from [slug] rebuild |
| `/cities` index | P2 | **Built 2026-06-10 — awaiting Matt approval** |
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

## Campaign work claims (sessions coordinate here — claim before touching)

- **P0-1 search map: SHIPPED 832c9cca, PROD VERIFIED 2026-06-11 (Cursor, main @ 3a95af7).** Dual-path marker layer (OverlayView pills without Map ID — prod today; AdvancedMarker when NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID lands, zero code change), effect de-duped (was 1,160 warnings/load). Prod Playwright on ryan-realty.com: 58/58 visible price pills, 0 degraded dialogs, 0 Map ID console warnings, gm-style present. Setting the env var in Vercel later = vector-map upgrade.
- **P0-4 + P0-6: SHIPPED 3398ec91, PROD VERIFIED 2026-06-11 (Cursor, main @ 3a95af7).** All 45 blog heroes now verified local A-grade photos via lib/blog-hero-images.ts resolver (remote URLs can't reach a page); mobile horizontal scroll fixed on /price-drops + /homes-for-sale (sr-only honeypot width bug). Prod: 0 Unsplash refs on /blog, 12 local `/images/blog/` refs; scrollWidth=390 on /price-drops and /homes-for-sale/bend at 390px viewport. Manifest geo_tags from the photo curation landed with it (live cities pages stop resolving wrong-city imagery; layout rework still draft).
- **P0-3: SHIPPED b49d85b9 by the /loop session 2026-06-10 18:25.** Service-area guard (lib/data/listings/service-area.ts, city allowlist — county column verified unreliable) default-on across tile/feed DALs, every caller audited, cache keys bumped. Homepage mosaic + price-drops verified all-service-area card-for-card.
- **P0-5: split 2026-06-10 19:15.** Hydration-race class fixes SHIPPED e37ea509 (AdSense lazyOnload + ShareButton interaction-time URL resolution). The /communities REBUILD (62,204px → 9,435px, 14 resort ledger rows + searchable A-Z index, all 530 links kept, 0 hydration errors) is DRAFT in tree, **held as the HUB representative for Matt's one sweep review** per the scope-change review model. Files: app/communities/page.tsx (rewritten), components/community/CommunityIndexBrowser.tsx (new), CommunitiesFilter.tsx (delete), .design-token-lint-ignore hunk. Screenshots: scratch/p05-communities-fix/. Note: communities-index parity contract still needs authoring.
- **SWEEP REVIEW SET forming (per scope-change review model):** preset = family 3 (built), geo = family 4 rework (built), hub = /communities rebuild (built). Tool + content representatives not yet built.
- Homepage concepts (film/magazine/terminal/v4): owned by the interactive orchestrator session (concept-v4 shots 16:54). /loop session HANDS OFF.

## Rollout status

| Family | Route | State | Notes |
|---|---|---|---|
| 1 | `/communities/[slug]` + menu | Shipped 58f95ff4 | Live, verified |
| 2 | `app/page.tsx` (homepage) | **LOCKED v6 Linear** (Matt 2026-06-11 concept #3) | Mockup at `ui_kits/homepage-v6/`. Production still HomepageHeroV3 until finished-draft approval. See Family 2 LOCKED block. |
| 3 | Search-preset content depth | **Awaiting review** (built + verified 2026-06-10 ~16:00) | ~320 preset URLs get honest intro (verified count + labeled city context), 2-4Q preset FAQ + FAQPage JSON-LD (new lib/site/preset-faq.ts, 17 tests), price-band + cross-city links, sort-only presets skipped, G34 gate extended to search/[...slug]. Change set: 4 files exactly. Orchestrator verified: tsc, tests 588 green, G34 OK, screenshots eyeballed. LP slice (LeadLandingPage FAQ swap + golf landing) EXCLUDED — queued for Matt's explicit approval. Screenshots: scratch/family3-preset-depth/. Builder note: la-pine has no market_pulse_live row (null-guard works; slug coverage worth a look) |
| 4 | `/cities/[slug]` + `/cities` index | **Rework awaiting review** (re-presented 2026-06-10 ~14:35) | All 3 verdict items addressed: city-verified photos tagged in manifest (every seeded city covered, provenance via Area Guide source metadata + Matt-approved picks + verified Unsplash), phone-first layout iteration, index depth (per-city editorial rows + live stats). Orchestrator verified: tsc clean, geo-images tests 5/5, manifest provenance audit OK, screenshots eyeballed. NOTE: builder was killed at the very end by the Claude monthly spend limit — its final report was lost; full `npm test` + `npx next build` must re-run at ship time. Screenshots: scratch/family4-rework/ |
| 5 | `/cities/bend/[neighborhoodSlug]` | Pending | |
| 6 | `/listing/[listingKey]` | Pending | |
| 7 | Hubs (`/buy`, `/sell`, `/homes-for-sale`, etc.) | Pending | |
| 8 | Tools (mortgage / rental / appreciation) | Pending | |
| 9 | Content (`/blog`, `/guides`, `/about`, `/team`) | Pending | |
| 10 | LPs (touch only with explicit approval) | Pending | |

## SCOPE CHANGE — full-site unification campaign (Matt directive, 2026-06-10 ~16:00)

Matt, on /homes-for-sale/bend/over-2m: "this layout is literally so old but yet we
keep it around... why cant every page on the site be gone through... its so goddamn
inconsistent. what we are doing is exactly what i tried to avoid."

**The serial family-by-family rollout is DEAD.** Its review-gated sequencing is the
direct cause of the half-migrated, inconsistent site. New operating model:

1. **One campaign, every public page.** Families 3-10 collapse into a single
   full-site unification sweep. Every page — search presets (over-2m included),
   hubs, listing detail, tools, content pages, /join — moves onto ONE system
   language: same breadcrumbs, same heading treatment (Amboqia display), same
   section rhythm, same cards, same spacing scale, verified photography only.
2. **The spec is the polish audit** at out/site-polish-audit-2026-06-10.md (crawler
   running 2026-06-10) + the existing archetype kit. Fix CLASSES across all pages
   at once (one breadcrumb commit for the whole site, one typography commit...),
   not page-by-page rework.
3. **Review model: ONE sweep review.** Matt reviews the unified system once on a
   representative page set (one preset, one hub, one tool, one content page) —
   not ten sequential family reviews. Exception: the homepage concept choice
   (film/magazine/terminal) stays a separate explicit pick, and LPs stay
   approval-gated (money paths).
4. **Consistency outranks novelty.** Where the v3 archetype isn't settled (homepage
   rejected), pages adopt the SHARED LANGUAGE (type, spacing, breadcrumbs, cards)
   now and inherit concept-level changes later. No page keeps 2010 layout because
   its family was "pending."

## Family 2 verdict (Matt, 2026-06-10 — recorded by the orchestrator)

Matt reviewed the v3 homepage draft at the mini and rejected it flat: "i hate the
home page." He declined the itemized-feedback question — read that as: do not
iterate v3 incrementally, the draft is far enough from his taste that adjustment
rounds would waste his review cycles.

**Directed next move: concept-first, options, fast to judge.** Three alternate
homepage concept kits already exist in the tree (`ui_kits/homepage-film/`,
`ui_kits/homepage-magazine/`, `ui_kits/homepage-terminal/`). Present Matt a
side-by-side of DISTINCT concepts (the three kits + v3 for reference) as static
mockups/screenshots he can pick from in one glance — phone-friendly. Build
NOTHING until he picks a direction. One concept approval, then one finished-draft
approval (per feedback_no_intermediate_creative_questions). The live homepage
stays on the current production version meanwhile.

### Family 2 — LOCKED (Matt, 2026-06-11)

**Concept #3: v6 with Linear finish.** Tagline: *the city is the homepage.*

Matt locked the direction after concept review: keep v6 bones (live 3D city, ask
bar, deal flow, neighborhood ledger, coords readout) but finish like engineered
software, not cinema — Linear discipline (hairline borders, glass panels,
micro-tracked labels, one Amboqia moment, Geist interface, terminal-grade data
UI, 150ms motion only).

**Canonical mockup:** `design_system/ryan-realty/ui_kits/homepage-v6/index.html`
**Spec:** `design_system/ryan-realty/ui_kits/homepage-v6/CONCEPT.md`

Production `app/page.tsx` stays on HomepageHeroV3 until the v6 mockup passes
Matt's finished-draft approval and a production build is scheduled.

## Family 4 review verdict (Matt, 2026-06-10 — recorded by the orchestrator session)

Matt reviewed the LIVE cities pages on his phone. Verbatim verdict: "We need grade A
city photos, I'm not even sure if the hero is of Bend, I don't like the layout and we
need to revisit, the cities page is also ultra thin."

**Photo diagnosis (verified against the asset manifest, 2026-06-10):** Matt is right.
`cities.hero_image_url` is NULL for Bend, the page requests asset-library heroes with
`geoTags:['bend']`, and ZERO assets carry a per-city geo tag — every photo rendering on
/cities/bend is tagged only `central-oregon`. Vision grades on the rendered set: two A
(one identified as **Three Sisters**, not Bend), two B, two C. The same failure holds
for every city (no city has per-city-tagged assets).

**Update (same day): Matt directed two-act Google Maps flyover videos** (Central
Oregon context shot descending into each city/neighborhood/community, clean +
bright grade) via the proven tumalo-aerial 3D-tiles pipeline — task spawned, Bend
exemplar draft-first. Once approved, every city gets a REAL city-specific flyover
hero at /videos/flyovers/<slug>/ (unambiguously the right place — solves the
wrong-city-hero complaint for the HERO slot). Photo sourcing below still covers
cards, strips, and non-hero imagery.

**What the rebuild needs, in order:**
1. **Photo sourcing prerequisite (blocks the visual rework):** curate a grade-A,
   city-VERIFIED hero + supporting set per seeded city into the asset library with
   per-city geoTags (`bend`, `redmond`, `sisters`, ...). Route via
   `video_production_skills/media-sourcing/SKILL.md` (asset library → Unsplash →
   Shutterstock → AI banned for real-place claims). Provenance discipline: a photo only
   gets a city geoTag when its location is verified (vision_location or source
   metadata) — never inferred from a filename or search query. Beware: 92 watermarked
   Shutterstock files sit in `curated/` (memory `reference_asset_library_visual_catalog`)
   — never ship those.
2. **Layout revisit:** Matt does not like the current Geo-archetype rendering on
   cities. Treat as a design iteration on the archetype, not a tweak — re-present with
   desktop + phone screenshots (he reviews on his phone; phone-first this time).
3. **/cities index depth:** "ultra thin" — needs real content (per-city market stats
   from the cache, editorial intro, internal links), not just tiles.

---

## Changelog

- **1.0.0 (2026-06-09)** — Initial. Six archetypes defined, full route map (91 public routes), module kit (9 modules, 5 built in session 1), engagement telemetry spec, never-regress mechanics. Exemplar: `/communities/tetherow`.
- **1.1.0 (2026-06-10)** — Family 3: `/cities/[slug]` + `/cities` index rebuilt to Geo archetype v3.1.
- **1.2.0 (2026-06-10)** — Family 2: Homepage v3. 9 new components (HomepageHeroV3, HomepagePulseTicker, HomepageListingsMosaic, HomepageNeighborhoodMap, HomepageMarketBand, HomepageVoiceBlock, HomepageToolsRow, HomepageTrustBand, CtaDuo). Old Hero/MarketSnapshot/FeaturedListings replaced. getRegionPulse + getBendNeighborhoodStats + getActivityFeed + getListingTiles + getBrokers parallel fetched. DAL index refreshed. Build clean (296 pages). All gates pass. Awaiting Matt approval. FlyoverHero (POSTER mode, videoSrc=null), LiveMarketBand (-mt-12 overlap), CommunityMapLedgerPane (split-scroll), ListingLedger (top 8 newest), PriceHistoryScrubber (scrubbable AreaChart), PaymentSlider, SectionNav (conditional items), InlineValuationHook (replaces CTABar), neighborhoods/communities as editorial index rows (no tile walls, separate sections D85), all JSON-LD retained (City/Dataset/FAQPage/Breadcrumb). parity.json updated (13 blocking components). Gates: tsc clean, npm test 570 green, check-ai-structured-data OK, check-heading-display 0 new, check-poison-null 0 new, check-dal-boundary 0 violations, check-mockup-parity 16/16 pass.

## Family 3 build brief — search-preset content depth (scouted 2026-06-10)

**Scale:** 32 presets × 10 seeded cities ≈ 320 indexable URLs (~800 with the dynamic city tail), all canonical+sitemapped at priority 0.8, all rendering ONLY count headline + grid + chips today. The depth blocks (MarketSnapshot/FAQ/Dataset) are explicitly gated to plain city pages by `isPlainCityPage` at app/search/[...slug]/page.tsx:661 — that guard is the single extension point.

**Honest-data rule per segment:** `totalCount` is ALREADY fetched on every preset page (zero new DB calls for the count layer). City-level pulse stats may be cited only as labeled city/regional context — NEVER as the band's own median (a per-band median does not exist in the cache). Fast-path counts (listing_tile_mv) cover price bands, new-construction, acreage, condos/townhomes, pending, pool; keyword/view presets already use the advanced RPC.

**The treatment (per type):** 2-3 sentence honest intro (count + city character from getCityContent) · 2-4 Q preset-scoped FAQ via NEW `lib/site/preset-faq.ts` (`buildPresetFaq(city, preset, totalCount, cityPulse)` — null-guarded, modeled on market-faq.ts) · FAQPage JSON-LD via FAQBlock/MetadataBlock · cross-links to adjacent bands + same preset in other cities. Buy/sell intent LPs: expand config.faq 2→4-5 Qs + swap the hand-rolled FAQ card loop in LeadLandingPage.tsx:107 for `<FAQBlock>` (auto-emits FAQPage; also fixes the P2.11 h3). Golf landing: add 3-Q FAQ + FAQPage. Sort-only presets (price-low/high): skip depth.

**Priority 5:** bend/under-750k · bend/new-construction · bend/on-golf-course · la-pine/acreage · bend/luxury.

**Gate on ship (P1.13):** add `search/[...slug]` to check-ai-structured-data CHECKS requiring SearchPageJsonLd/MetadataBlock/buildPresetFaq so stripped JSON-LD fails CI.

---

## Beat-Beacon brief (2026-06-10)

**Research note:** beaconappraisalgroup.com was unreachable via DNS from the sandbox on 2026-06-10 (NXDOMAIN — network restrictions). All Beacon content below is sourced from the repo's own prior research: `marketing_brain_skills/research/bend-market-bible.md` §9 (documented from a live fetch of beaconappraisers.com/market-overviews/ in phase-2.6 research), supplemented by the phase-2.6 log and internal references. That research noted the correct domain as `beaconappraisers.com` (not `.com/market-overviews`), with PDF archive at `beaconappraisers.com/wp-content/uploads/YYYY/MM/BEACON-REPORT-Month-YYYY.pdf`.

---

### Part 1 — What the Beacon Report is and what it publishes

**Publisher:** Donnie Montagner, state-certified residential appraiser, Beacon Appraisal Group LLC, Bend, Oregon.

**Format:** Monthly PDF, publicly downloadable. Archive available from January 2015 to present. Example canonical URL: `beaconappraisers.com/wp-content/uploads/2025/10/BEACON-REPORT-October-2025.pdf`.

**Geographies covered:** Bend, Redmond, Sisters, Sunriver, La Pine — the five primary Central Oregon SFR markets.

**Metrics published per report:**
- Median sale price by community (SFR, typically)
- Year-over-year median price comparison
- Active listing inventory (count)
- Sales volume (closed transactions count)
- Median days on market
- Long-term price trend charts — Donnie maintains Bend SFR data back to 1997, making this the deepest historical series in the region

**Special studies (periodic):**
- SFR by square footage range (e.g. 1,800–2,200 sq ft Bend study, July 2023)
- Notice of Default / distressed sale tracking for Deschutes County

**Chart types:** Static PDF charts. Likely bar/line charts for trend data; exact chart styles not confirmed from the sandbox (the PDF is a print/scan artifact at low resolution typical of appraisal reports, not an interactive web page).

**Data freshness at publish time:** Published with data through the prior calendar month. So the June 2026 report shows May 2026 closed data. That is a 1–4 week lag depending on when in June it publishes. By contrast, Ryan Realty's `market_pulse_live` refreshes every 10–15 minutes from the MLS feed.

**Distribution model:** Every local brokerage reshares the PDF. It circulates via email, broker newsletters, and social. It functions as the region's shared market "newspaper" — agents forward it to clients, post it on Instagram stories, and cite it in listing presentations. That reach is the Beacon Report's true moat.

**Readability:** Designed for appraisers and sophisticated real-estate professionals. It is not consumer-first — the format is a PDF table with bar charts, not an interactive or plain-English narrative product. A first-time buyer reading the Beacon Report needs to understand what "median DOM" means. Brokers interpret it for their clients.

---

### Part 2 — What we have today

#### Market surfaces inventory

**`/housing-market`** (hub page, `app/housing-market/page.tsx`)
- What it shows: 8-city navigation tiles with live active counts, region glance (active count + median list price + MoS verdict), cross-links.
- Chart quality: no charts on this page — pure nav hub.
- Readability: good. Plain-English lede driven from `market_pulse_live`. Plain-English MoS verdict ("seller's market / balanced / buyer's market").
- Data freshness: 10–15 min via `market_pulse_live` (`revalidate = 300`).
- Grade: **B** — clean hub but no depth or charts.

**`/housing-market/central-oregon`** (region report, `app/housing-market/central-oregon/page.tsx`)
- What it shows: region stat band (4 metrics), 24-month median sale price area chart, city comparison table (8 cities × 4 columns), FAQ section (4–5 Q&A from `buildMarketFaq`), methodology trace, lead capture.
- Chart: one area chart — median sale price over 24 months (`market_stats_cache` monthly). Single-series, no YoY overlay, no sold volume series.
- Readability: good prose narrative generated from verified data. Methodology trace shown to user.
- Data freshness: area chart from `market_stats_cache` (6h freshness); stats from `market_pulse_live` (10–15 min).
- Grade: **B+** — correct, honest, but one chart is thin and the chart itself is not annotated or interactive beyond hover tooltip.

**`/housing-market/[...slug]`** (per-city flagship, `app/housing-market/[...slug]/page.tsx`)
- What it shows: city-level stat band (active, median list, MoS, days-to-pending), price area chart (24 months), price-band table (stubbed — DAL not ready per code comment), city comparison table, FAQ, methodology trace, related areas.
- Chart: same area chart as the region page — median sale price over 24 months. Price-band section is stubbed.
- Scrubber: `PriceHistoryScrubber` deployed on `/cities/[slug]` (the geo archetype), but NOT on `/housing-market/[slug]` yet.
- Readability: strong — same pattern as region page.
- Grade: **B** — correct but thin chart depth; price-band table never rendered.

**`/reports/explore`** (open data explorer, `app/reports/explore/ExploreClient.tsx`)
- What it shows: a powerful raw data tool — location search (city + subdivision), date-range presets (7d to 10y), property-type filters, YTD comparison, median price + volume line charts, price-band bar chart. HousingWire market context card.
- Chart types: recharts `LineChart` (median price + sold count time series), `BarChart` (price bands), YTD comparison table.
- Readability: low for a consumer. This is a power tool, not a market report. No plain-English verdict. No "what this means" annotation.
- Grade: **A-** for data power, **D** for readability.

**`/reports/sales/[city]/[period]`** (sales report, `app/reports/sales/[city]/[period]/page.tsx`)
- What it shows: closed + pending listings table for a city + period. Charts: sales-by-day bar chart, price-distribution bar chart, DOM distribution bar chart (all from `SalesReportCharts`).
- Readability: moderate — more a raw data dump than a narrative report. Three bar charts are present but unlabeled with plain-English takeaways.
- Grade: **C+** — useful raw data, no consumer narrative.

**`components/site/PriceChart` + `PriceHistoryScrubber`**
- `PriceChart`: area chart, median sale price, 24-month history from `market_stats_cache`. Navy fill gradient, cream card. No YoY overlay, no sold-count series, no annotation.
- `PriceHistoryScrubber`: same chart with touch/mouse scrub for drag-to-read interaction. Fires `chart_scrub` engagement event. Hero stat readout above chart updates on scrub. Built and deployed on `/cities/[slug]`.
- Both: honest y-axis (industry-standard windowed range with labeled pad, not $0 baseline), tabular numerals, brand colors.

**`components/reports/MarketHealthGauge`**
- 0–100 score badge + progress bar. Cold/Cool/Warm/Hot/Very Hot labels. Used in reports internals.
- Not deployed on consumer-facing market report pages.

**`components/reports/MiniSparkline`**
- Tiny SVG polyline sparkline. Not animated. Used for inline trend indicators.

**`components/reports/SalesReportCharts`**
- Three recharts bar charts: sales-by-day, price-distribution, DOM-distribution. Used only on `/reports/sales/[city]/[period]`.

**`components/site/experience/LiveMarketBand`**
- Navy band with one giant living number (active count animated via `useCountUp`) + 3 quiet aux stats. Market verdict dot. Link to full report. Deployed on `/cities/[slug]`.

**`lib/site/market-faq.ts` (`buildMarketFaq`)**
- Generates FAQ + FAQPage JSON-LD + Dataset variableMeasured from verified pulse data. Single source of truth for all three surfaces. Solid architecture.

**Data depth available (confirmed from schema):**

`market_stats_cache` (~12,234 rows, 6h freshness) carries:
- `sold_count`, `median_sale_price`, `avg_sale_price`, `total_volume`
- `median_dom`, `speed_p25`, `speed_p50`, `speed_p75` (DOM percentile distribution)
- `median_ppsf`, `avg_sale_to_list_ratio`
- `price_band_counts` (jsonb — inventory by price tier)
- `bedroom_breakdown`, `property_type_breakdown` (jsonb)
- `market_health_score`, `market_health_label`
- `yoy_sold_delta_pct`, `yoy_median_price_delta_pct`, `yoy_dom_change`, `yoy_inventory_change_pct`, `yoy_ppsf_change_pct`
- `mom_median_price_change_pct`, `mom_inventory_change_pct`
- `dom_distribution` (jsonb — full histogram)
- `median_concessions_amount`, `cash_purchase_pct`
- `affordability_monthly_piti`
- `end_of_period_inventory`

Period types: `rolling_30d`, `rolling_90d`, `rolling_365d`, `monthly`, `quarterly`, `ytd`.

Geographies: city + region + 14 resort communities + 14 Bend neighborhoods.

`market_pulse_live` (~17 rows, 10–15 min freshness) carries:
- `active_count`, `pending_count`, `new_count_7d`, `new_count_30d`
- `median_list_price`, `months_of_supply`, `absorption_rate_pct`
- `market_health_score`
- Today: city + region only (not neighborhoods).

**Honest conclusion:** We are sitting on an extremely rich data warehouse that our current charts barely touch. We render one series (median sale price over time) when the cache holds YoY deltas, DOM distributions, price-band counts, sale-to-list, affordability PITI, and cash-purchase rates — all pre-computed, verified, refreshed every 6 hours. The data gap is not in our database. It is in our chart layer.

---

### Part 3 — The beat-Beacon brief

#### 3a. Scorecard: Beacon vs Ryan Realty today

| Dimension | Beacon Report | Ryan Realty today | Winner |
|---|---|---|---|
| **Data freshness** | Prior calendar month (1–4 week lag) | 10–15 min (`market_pulse_live`); 6h historical (`market_stats_cache`) | **Us, by a lot** |
| **Geography depth** | 5 cities (Bend, Redmond, Sisters, Sunriver, La Pine) | 8 cities + 14 resort communities + 14 Bend neighborhoods | **Us** |
| **Historical depth** | Bend SFR back to 1997 (Donnie's own data) | 24 months rendered; full cache history available | **Beacon** (for now — we have the data, just not the chart) |
| **Interactivity** | None (static PDF) | PriceHistoryScrubber (scrub), ExploreClient (full power tool) | **Us** |
| **Readability for consumers** | Low — appraiser format, no plain-English verdict | Moderate — plain-English narrative + FAQ + methodology | **Draw / slight edge to us** |
| **One-glance verdict** | None explicit (data tables) | Stat cards with badge verdict (seller/balanced/buyer) | **Us** |
| **Print/share artifact** | Yes — PDF the whole region reshares | No — no PDF export, no shareable monthly artifact | **Beacon** |
| **Distribution reach** | Every brokerage reshares it; it IS the regional paper | Zero distribution (only people who visit our site) | **Beacon, by a lot** |
| **Chart quality** | Static bar/line in PDF; no interaction | recharts area chart, honest axis, brand styled | **Us** |
| **Metrics rendered** | 5–6 per city (median, inventory, DOM, sales volume, YoY) | 4 stats live + 1 chart; price-band stubbed | **Draw** |
| **Neighborhood depth** | None | 14 resort + 14 Bend neighborhoods in cache | **Us** |
| **Authority / brand** | Decades-old institution; state-certified appraiser byline | Unknown to most of the region | **Beacon, by a lot** |

**Beacon's two real advantages to neutralize:**
1. The shareable monthly PDF artifact — the vehicle for distribution. Every broker, every agent, every newsletter forwards the Beacon PDF. Until we have a shareable monthly artifact, we are invisible to that channel.
2. Historical depth + institutional authority — 1997 Bend data is a genuine differentiator. We can close this gap by rendering longer histories from our cache and citing methodology versions explicitly (we already have `cache_methodology_definitions`).

**Our three structural wins that Beacon can never have:**
1. **Live data** — 10–15 min freshness vs prior-month. Every statistic on our site is closer to true than anything in a PDF that took 2 weeks to produce.
2. **Neighborhood + community depth** — 14 resort communities + 14 Bend neighborhoods, each with a dedicated stats row. Beacon covers only the five city-level markets.
3. **Interactive and linkable** — every market page is a URL, an SEO target, a structured Dataset for Google's AI citations, and a linkable shareable fact. A PDF is none of those things.

---

#### 3b. The win plan

The Beacon-killer is not beating them on breadth or polish. It is beating them on three fronts simultaneously:

**Front 1 — The monthly Central Oregon Market Report page (the artifact that kills the PDF)**

Create `/housing-market/reports/[year]/[month]` — e.g. `/housing-market/reports/2026/06`. This is the Beacon-killer artifact.

Structure:
1. Hero: plain-English verdict first ("Central Oregon: buyer's market" or "seller's market tightening"), month + year prominent. One pull-stat in Amboqia display (median price or MoS) that tells the whole story in 2 seconds.
2. Story charts section (the new chart system — see §3c below): 3–4 charts sequenced as a narrative, each with a "What this means" annotation.
3. City-by-city comparison table (already built as `CityComparisonTable`) — extend to add YoY deltas from `market_stats_cache.yoy_median_price_delta_pct`.
4. Neighborhood deep-dives (2–3 featured communities with their own stat cards).
5. Methodology + data trace section (builds trust, differentiates from unverified PDF).
6. "Share this report" — one-click copy of the URL + a rendered social share image (OG image with the hero verdict + key stats baked in at build time).
7. **PDF export button** — server-side rendered PDF via `@react-pdf/renderer` or a headless Chromium route. The PDF uses the same data, same verification trace. Brokers can forward our PDF the way they forward Beacon's.

This page builds every month from `market_stats_cache` monthly rows (already populated). No new data work — only rendering.

**Front 2 — Per-city report pages upgraded with the new chart system**

Upgrade `/housing-market/[city]` with the 5 priority charts from §3c. Replace the single area chart + stubbed price-band table with the full chart stack. Each chart carries a "What this means" annotation and a source trace line.

**Front 3 — Distribution**

- Monthly report OG image auto-generated (the share card brokers will post).
- "Get the monthly report" email capture — one-field form, delivers the report URL (not a PDF attachment). Converts monthly distribution to an owned email list.
- Social video pull (already in the video production pipeline): the monthly market report video uses the same verified data as the web report and cross-links to it.

---

#### 3c. The next-level chart system (7 charts)

All charts: recharts (already installed), brand tokens (navy `#102742`, cream `#faf8f4`, design-system token colors), Amboqia for callout numerals, Geist for axis labels and annotations, tabular numerals, honest axes (domain auto-fit with labeled padding — industry standard per existing `PriceChartClient`), reduced-motion fallbacks (static final-state render when `prefers-reduced-motion: reduce`). No pie charts. No 3D. No chartjunk.

---

**Chart 1 — MedianPriceTrendChart**
*"Is the market going up, down, or sideways?"*

What it renders: dual-series area chart — monthly median sale price (filled area, navy) + 12-month rolling average (dashed line, muted). Optional YoY comparison series (prior year, cream/dashed).

Data source: `getMarketStatsCacheRowsByGeoType` → `market_stats_cache`, `period_type = 'monthly'`, columns `median_sale_price`, `yoy_median_price_delta_pct`, `period_start`. 24–36 months.

Engagement mechanic: hover tooltip shows exact month, median, and YoY delta in the same tooltip. Click a data point to filter the city comparison table below to that month. Animated draw-in on first viewport entry (stroke dash-offset animation, ~600ms ease-out, respects `prefers-reduced-motion`).

Plain-English takeaway slot: auto-generated from the most recent `yoy_median_price_delta_pct` — e.g. "Bend median sale price is up 4.2% from a year ago" or "down 1.8% from last June."

Reuses: `PriceChart.client.tsx` as the base. Add the rolling-average series and YoY series.

---

**Chart 2 — SupplyDemandBalanceDial**
*"Is this a buyer's or seller's market right now, and how extreme?"*

What it renders: a horizontal diverging bar (not a circular gauge — simpler to read and less gimmicky). Left side = buyer's market zone (navy, extending left from center). Right side = seller's market zone (cream/warm, extending right). The current MoS value pins a dot on the axis. Labeled: "Buyer's (<6mo)", "Balanced (4–6mo)", "Seller's (<4mo)" with the 4 and 6 month thresholds marked as tick lines.

Data source: `market_pulse_live.months_of_supply` (10–15 min freshness). Secondary: 12-month history from `market_stats_cache` monthly `end_of_period_inventory / (sold_count / period_days * 30)` to show the trend arrow (is MoS rising or falling?).

Engagement mechanic: animated fill from center to current value on first viewport entry. Hover tooltip: "X months of supply. At this rate, all active listings would sell in X months if no new listings came on the market." No scrub needed — one meaningful number.

Plain-English takeaway slot: auto-generated from the MoS thresholds — "3.8 months of supply. Sellers have the advantage."

New component — no reusable base. ~120 lines of recharts `ComposedChart` with a custom reference area.

---

**Chart 3 — PriceBandFlowChart**
*"Where is the action? Which price tier is moving fastest?"*

What it renders: horizontal stacked bar chart, one bar per price tier ($0–300K, $300–400K, $400–500K, $500–600K, $600–700K, $700–800K, $800K–$1M, $1M+). Each bar is split: left segment = active inventory count (lighter fill), right segment = sold count in period (darker fill). The ratio of sold/active is the "velocity" — a tight bar = low activity, a long bar = high activity.

Optionally: overlay a small numeric badge on each tier showing median days-to-pending for that band (from `dom_distribution` jsonb in `market_stats_cache` if granular, or approximated from the speed percentiles).

Data source: `market_stats_cache.price_band_counts` (jsonb, already populated per the schema snapshot), `sold_count`, `end_of_period_inventory`. Period: `rolling_90d`.

Engagement mechanic: hover tooltip per tier shows: active count, sold count, velocity ratio ("1 in 3 listings sold this quarter"). Bars animate width from zero on viewport entry.

Plain-English takeaway slot: auto-identifies the fastest-moving tier — "The $400K–$500K range has the highest turnover: 42% of active listings sold in the last 90 days."

New component. `price_band_counts` jsonb already stored — DAL function `getMarketStatsCacheRowForGeo` already fetches the whole row. Just need a parser + chart component.

---

**Chart 4 — DomSpeedHistogram**
*"How quickly do homes actually sell here?"*

What it renders: a vertical bar histogram showing the distribution of days-to-pending across 5 buckets (0–14 days, 15–30, 31–60, 61–90, 90+). Each bar height = count of sales in that bucket. The 50th percentile line is drawn as a vertical annotation line with a label ("Half of homes go pending within X days").

Optionally: overlay a YoY comparison series (prior-year same buckets in a lighter fill behind the current year) to show whether the market is accelerating or decelerating.

Data source: `market_stats_cache.dom_distribution` (jsonb, already stored in schema). `speed_p25`, `speed_p50`, `speed_p75` for the percentile annotation. Period: `rolling_90d` or `monthly`.

Engagement mechanic: hover tooltip shows exact count and pct of sales in that bucket. The p50 annotation line is the "aha" — the user finds out concretely whether "fast market" means 10 days or 45 days.

Plain-English takeaway slot: "In the last 90 days, half of Bend homes went pending within 18 days. Slower than last year (14 days)."

Partially reusable: `SalesReportCharts` already has a DOM histogram (`buildDomData`) but uses coarser 5 buckets (0–30, 31–60, etc.) and only has counts — no percentile line, no YoY overlay, not styled to brand. Extend this component rather than starting fresh.

---

**Chart 5 — SaleToListRatioSparkGrid**
*"Are sellers getting their asking price? And is it changing?"*

What it renders: a small-multiples grid — one sparkline per city (6–8 cities). Each sparkline shows `avg_sale_to_list_ratio` over the last 12 months. Below each sparkline: city name + the current month's ratio as a badge (e.g. "99.2%"). The grid is 2×4 or 3×3 depending on viewport. Color-coded badge: green ≥ 100%, yellow 97–99%, red <97%.

Data source: `market_stats_cache.avg_sale_to_list_ratio`, 12 monthly rows per city. DAL: `getMarketStatsCacheRowsByGeoType` (already exists per the DAL index — `getReportingCacheMonthlyRows`).

Engagement mechanic: hover on any sparkline shows the full month-by-month tooltip. The small-multiples format lets a user compare cities at a glance in a way the table cannot.

Plain-English takeaway slot: "Bend sellers received 99.1% of asking price on average last month. Redmond: 98.4%. Sisters: 101.2% — sellers in Sisters are getting above asking."

New component — uses the existing `MiniSparkline` SVG component as the base. Wrap in a grid container, add badges, city labels, and a shared tooltip.

---

**Chart 6 — AffordabilityIndexLine**
*"Can a typical buyer actually afford a home here, and is it getting better or worse?"*

What it renders: dual-axis line chart. Left axis: monthly PITI payment estimate (from `market_stats_cache.affordability_monthly_piti` — this is already computed and stored). Right axis: median sale price. The two lines show whether payment and price are moving together or diverging (they diverge when rates move independently of price).

Optionally: add a third series for 30-year mortgage rate (from FRED API or hardcoded monthly — confirm source availability before building). A rate spike that causes payment to soar while price stays flat is the most important story of 2022–2024 and it plays out visually in this chart.

Data source: `market_stats_cache.affordability_monthly_piti`, `median_sale_price`. 24 months. DAL: `getReportingCacheMonthlyRows`.

Engagement mechanic: animated draw-in. Hover tooltip shows both axes at any month. "What this means" annotation is auto-generated: if PITI is rising faster than price → "Affordability is declining even though prices are stable — mortgage rates are the driver."

Plain-English takeaway slot: "Monthly payment on a Bend median-priced home: $3,240. A year ago: $3,090. The home costs about the same — but rates are up."

Partially reusable: extends `PriceChart.client.tsx` to a two-series, two-axis recharts `ComposedChart`. New Y-axis config + Tooltip formatter.

---

**Chart 7 — CityHeatTable (annotated comparison)**
*"Which city is the best market for buyers right now? For sellers?"*

What it renders: a data table (not a chart) but with inline visual encoding. Each row is a city. Columns: Active inventory, Median price, MoS, DOM p50, Sale-to-list, YoY price delta. Each cell is color-coded on a continuous navy-to-cream scale per column (navy = favorable-for-buyers, cream = favorable-for-sellers). The row with the most "buyer-favorable" cells gets a small badge. The row with the most "seller-favorable" cells gets a separate badge.

This replaces/upgrades the existing `CityComparisonTable` which shows raw numbers but no visual encoding.

Data source: same `getMarketPulseCitySnapshots` + `getMarketStatsCacheRowsByGeoType` for YoY deltas. No new DB calls beyond what the region report already makes.

Engagement mechanic: click a city row → navigates to that city's full market report. Hover on a cell shows the plain-English context ("3.1 months of supply = seller's market"). Mobile: horizontal scroll with sticky city-name column.

Plain-English takeaway slot: auto-generated summary badge per row, no prose needed — the visual encoding IS the takeaway.

Reuses: `CityComparisonTable` as the structural base. Add cell-level color encoding (CSS custom property per value), YoY delta column, row badges.

---

#### 3d. Effort map

**Reusable today (zero new work needed):**
- `PriceHistoryScrubber` — deploy on `/housing-market/[slug]` (it is deployed on `/cities/[slug]` but not on the housing-market route). One import change.
- `CityComparisonTable` — foundation for Chart 7. Extend in place.
- `MiniSparkline` — foundation for Chart 5's sparklines.
- `SalesReportCharts` DOM histogram — foundation for Chart 4. Extend with p50 line and YoY overlay.
- `buildMarketFaq` + `market_stats_cache` rows — all data needed for "What this means" annotations already exists in verified, pre-computed form.
- `getReportingCacheMonthlyRows` + `getMarketStatsCacheRowsByGeoType` DAL functions — cover Charts 5, 6, 7.

**New work required (by chart, small to large):**
1. **Chart 7 CityHeatTable** — extend `CityComparisonTable`. +60 lines. Smallest.
2. **Chart 5 SaleToListRatioSparkGrid** — wrap `MiniSparkline` in a grid + badges. +90 lines.
3. **Chart 4 DomSpeedHistogram** — extend `SalesReportCharts` DOM histogram. +80 lines (+ p50 annotation, YoY series, brand styling).
4. **Chart 1 MedianPriceTrendChart** — extend `PriceChart.client.tsx` with rolling-average series and YoY series. +70 lines.
5. **Chart 6 AffordabilityIndexLine** — extend `PriceChart.client.tsx` to dual-axis `ComposedChart`. +100 lines.
6. **Chart 3 PriceBandFlowChart** — new component, parse `price_band_counts` jsonb. +150 lines.
7. **Chart 2 SupplyDemandBalanceDial** — new diverging-bar component. +120 lines.
8. **Monthly report page** `/housing-market/reports/[year]/[month]` — new route that assembles charts 1–7 into a narrative page. +300 lines (page + data fetching).
9. **PDF export route** — headless Chromium or `@react-pdf/renderer`. Largest piece; defer to build order Phase 3.

**Build order (recommended):**

Phase 1 — "The upgrade" (charts on existing pages, no new routes):
1. Deploy `PriceHistoryScrubber` on `/housing-market/[slug]` (1 import, immediate win).
2. Build Chart 7 CityHeatTable, replace `CityComparisonTable` on region + city pages.
3. Build Chart 4 DomSpeedHistogram, deploy on city pages.
4. Build Chart 3 PriceBandFlowChart, replace the stubbed `PriceBandTable` on city pages.

Phase 2 — "The report" (the artifact that kills the PDF):
5. Build Chart 1 MedianPriceTrendChart (upgraded area chart with YoY series).
6. Build Chart 2 SupplyDemandBalanceDial.
7. Build Chart 5 SaleToListRatioSparkGrid.
8. Build Chart 6 AffordabilityIndexLine.
9. Build `/housing-market/reports/[year]/[month]` assembling all charts + plain-English verdict + narrative.
10. Add "Share this report" OG image generation.

Phase 3 — "The distribution" (closing Beacon's reach advantage):
11. PDF export route — broker-shareable artifact.
12. Monthly report email capture + delivery workflow.
13. Social share card auto-generation tied to monthly report publish.

---

**Summary:** Beacon wins on institutional authority and PDF distribution reach. We win on data freshness (months vs minutes), geography depth (5 cities vs 28 geographies), and interactivity. The gap to close is the monthly shareable artifact — the PDF brokers forward. Build the 7 charts in Phase 1–2, ship the monthly report page, add PDF export in Phase 3. At that point every broker who forwards a Beacon PDF could forward ours instead — and ours would be 3 weeks fresher, cover neighborhoods Beacon doesn't, and carry interactive versions of every chart.
