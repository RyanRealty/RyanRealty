# Money-path design-contract plan

Date 2026-06-04. Status DRAFT (planning lead, read-only, awaiting Matt sign-off before any code lands).

## Thesis

158 routes carry the site. 10 of them are the money pages and the ranking pages, the surfaces that decide whether Ryan Realty gets a buyer, a seller, or an AI citation. 148 of those 158 routes have no parity.json contract, which means the G6 mockup-parity gate is blind to them and any future edit can silently strip a stat band or a breadcrumb with zero CI signal. The site is effectively invisible in search and in AI overviews because the highest-value pages either carry no structured data, carry the wrong structured data, or are explicitly noindex.

This cluster fixes the money and ranking pages first. It covers 9 verified routes: the housing-market flagship and its two hubs, four paid landing pages, plus the buy and contact conversion pages, and the compare utility. The flagship `housing-market/[...slug]` is the lead build because it is the canonical geo surface a competitor with Dataset plus FAQPage schema would otherwise win for every "Bend housing market" query.

Every recommendation in this plan is written as an enforceable contract (a parity.json the G6 gate reads) rather than prose, because a rule that is not a gate does not hold.

## Cluster table

| Route | Mockup | Parity | Composes site blocks | JSON-LD now | Value | Top gap |
|---|---|---|---|---|---|---|
| `app/housing-market/[...slug]/page.tsx` (FLAGSHIP) | yes | no | no | WebPage + BreadcrumbList only | high | No Dataset or FAQPage JSON-LD, zero site blocks, raw stat cards |
| `app/housing-market/page.tsx` (hub) | yes | no | no | CollectionPage (mis-placed) | high | No MarketSnapshot, no PriceChart, plain-Geist H1 |
| `app/housing-market/central-oregon/page.tsx` (region hub) | yes | no | no | CollectionPage + nested BreadcrumbList | high | Entire page raw JSX, plain-Geist H1, 12-call pulse fan-out |
| `app/lp/seller-home-value/page.tsx` | yes | no | no | RealEstateAgent + AggregateRating + Review | high | In coverage allowlist, zero site blocks, no FAQPage. MID-EDIT, see coordination note |
| `app/lp/buyer-listing-alerts/page.tsx` | yes | no | no | none | high | In coverage allowlist, BrokerCard composite-rule violation, no JSON-LD |
| `app/lp/expired-listing/page.tsx` | yes | no | no | none | high | noindex blocks the ranking opportunity, no JSON-LD at all |
| `app/buy/page.tsx` | no | no | no | none | high | No mockup, no JSON-LD, plain-Geist hero, two brand-voice fails |
| `app/contact/page.tsx` | no | no | no | ContactPage (thin) | high | Phone 541.213.6706 absent from the rendered body, no LocalBusiness JSON-LD |
| `app/compare/page.tsx` | no | no | no | none | medium | noindex utility, AICompare dead-wired, raw H1 |

Confirmed against the codebase: zero of the 9 have a parity.json (the 10 existing parity files are `sell`, `city`, `homepage`, `listing-detail`, `about`, `search`, `zip`, `team`, `neighborhood`, `community`). `seller-lp`, `buyer-alerts-lp`, `expired-lp`, and `market-report` all sit in `scripts/mockup-coverage-allowlist.json`, so CI passes today by exemption, not by compliance.

## Ranked apply order

Ranking is reach times gap divided by effort. Quick wins are routes where the mockup already exists and the site blocks already exist, so the work is authoring the parity.json plus wiring a handful of imports. Deeper rebuilds need new components, new JSON-LD wiring, or a noindex policy decision.

1. **`housing-market/[...slug]` flagship (DEEPER REBUILD, highest value).** Reach is every geo query in Central Oregon. Gap is total (no Dataset, no FAQPage, zero site blocks). Effort is the largest in the cluster because two new components (PriceBandTable, CityComparisonTable) must be built, but the payoff is the single biggest AI-citability and ranking win on the site. Build first because it sets the pattern every other market page copies. Full spec below.

2. **`lp/expired-listing` (QUICK-ISH, one-line P0).** Reach is the expired-seller reactivation intent, a high-conversion seller path. The dominant gap is a one-line fix: remove `robots: { index: false, follow: false }` at page.tsx line 25. The page is invisible to search for free. Pair the noindex removal with the FAQBlock swap (auto-emits FAQPage) and a Service JSON-LD block. Mockup and site blocks exist.

3. **`contact` (QUICK WIN with one P0).** Reach is direct buyer and seller inbound. The P0 is that phone 541.213.6706 is absent from the rendered body, a contact page failing its primary job. Wiring HeroBlock, BreadcrumbNav, FAQBlock, CTABar, and the LocalBusiness JSON-LD via the existing `generateBrokerageSchema()` is all reuse. Needs a mockup authored (no existing one) plus parity.json.

4. **`housing-market` hub (QUICK WIN).** Mockup exists, all required site blocks exist (HeroBlock, MarketSnapshot, PriceChart, CityGrid, LeadCaptureBlock, ContentSection, CTABar). The work is author the parity.json, swap ContentPageHero for HeroBlock, and wire the region-level MarketSnapshot. PriceRangeTiles or a bespoke price-band table is the only build.

5. **`housing-market/central-oregon` region hub (QUICK WIN).** Same mockup as the hub. CityGrid already reads `geo_snapshot_mv`. The big efficiency win here is replacing the 12-call `getLiveMarketPulse` fan-out with a single MarketSnapshot region call. Author parity.json, wire HeroBlock plus BreadcrumbNav plus MarketSnapshot plus CityGrid plus PriceChart plus LeadCaptureBlock plus CTABar.

6. **`buy` (DEEPER REBUILD).** Reach is the highest-value buyer-intent query set ("homes for sale Bend Oregon"). No mockup and no parity.json exist, so both must be authored from the sell-page pattern. Two brand-voice fails must be fixed before ship. Add RealEstateAgent plus BreadcrumbList JSON-LD and a live market-context line.

7. **`lp/seller-home-value` (DEEPER REBUILD, MID-EDIT).** High value, but the file is currently modified in the working tree (owner in-flight). Do not touch until coordinated. Plan below. Sequencing pushed down so we do not clobber the in-flight edit.

8. **`lp/buyer-listing-alerts` (DEEPER REBUILD).** Mockup exists but the page is fully bespoke. Migrate to LeadCaptureBlock variant='buyer', fix the BrokerCard composite-rule violation, add Service JSON-LD. Remove from the allowlist last.

9. **`compare` (LOW, utility).** Medium value, noindex utility tool. Do not add JSON-LD (would mislead on a noindex page). Swap the raw H1 for the H1 primitive, fix loading.tsx to use Skeleton, and resolve the dead-wired AICompare component (wire or delete). Author mockup plus parity.json.

### Quick wins (mockup exists, mostly author parity.json plus a few imports)

- `housing-market` hub
- `housing-market/central-oregon` region hub
- `lp/expired-listing` (the ranking unlock is a one-line noindex removal)
- `contact` (reuse-only block wiring, mockup needs authoring)

### Deeper rebuilds (new components, new JSON-LD, or policy decision)

- `housing-market/[...slug]` flagship (two new components, Dataset plus FAQPage wiring)
- `buy` (no mockup, no parity, two voice fixes)
- `lp/seller-home-value` (full block migration, blocked by in-flight edit)
- `lp/buyer-listing-alerts` (full block migration)
- `compare` (utility-grade, AICompare decision)

## Per-route bring-up plans

### 1. housing-market/[...slug] flagship

See the FLAGSHIP build spec section below for the full step list, components, data sources, JSON-LD, and the complete proposed parity.json. Summary of the 14 verified steps: create the parity.json, replace the raw `<main>` skeleton with BreadcrumbNav plus DisplayHeading plus MarketSnapshot, add PriceChart (wiring only, `getPriceHistory` already exists), build PriceBandTable and CityComparisonTable as new site blocks, add a dynamically generated ContentSection narrative, add FAQBlock (auto-emits FAQPage), add Dataset JSON-LD via MetadataBlock with `dateModified` equal to the real `refreshedAt`, add LeadCaptureBlock plus RelatedAreas plus CTABar, add `generateStaticParams` for the 11 core city slugs, remove all raw inline-styled HTML, and verify §0 compliance on the Dataset (every `variableMeasured` value equals the on-screen number, `dateModified` is `stats.refreshedAt` not a hardcoded date).

### 2. housing-market hub (app/housing-market/page.tsx)

1. Create `design_system/ryan-realty/ui_kits/market-report/parity.json` with `route` set to `app/housing-market/page.tsx` and the requiredComponents matching the mockup sections so G6 picks up the route.
2. Replace ContentPageHero with HeroBlock from `@/components/site/HeroBlock` to get the Amboqia DisplayHeading on the H1 (the current ContentPageHero.tsx line 51 renders a plain Geist `text-4xl font-bold` H1).
3. Add BreadcrumbNav below the hero, "Home > Housing market", matching mockup index.html lines 43 to 48.
4. Add MarketSnapshot calling region-level data for the 4-stat card band. Verify each figure against `market_pulse_live` before render per §0.
5. Add PriceChart calling `getPriceHistory` for the 12-month median price trend, completed months only, no smoothing.
6. Add a price-band table component for "Where the activity is", sourced from `market_stats_cache` price-band aggregates, never raw listings.
7. Replace the bare Card city link tiles with CityGrid for live active-count plus median data per city.
8. Add LeadCaptureBlock for the monthly report subscribe form (index.html lines 155 to 164).
9. Add ContentSection for the methodology block with source trace, required for §0 AI-citability.
10. Move the JSON-LD `<script>` to the top of the returned JSX after the hero, add a `dateModified` set to the cache refresh timestamp, and co-emit WebPage alongside CollectionPage.
11. Replace the raw `<h2>` tags at page.tsx lines 95 and 116 with the H2 primitive from `@/components/site/primitives`.
12. Add CTABar at page bottom per the mockup subscribe CTA band.

Note: this hub and the flagship both map to the same mockup directory `market-report/`, but they are different routes. The flagship parity.json route is `app/housing-market/[...slug]/page.tsx`. This hub's is `app/housing-market/page.tsx`. Two parity files can point at one mockup directory, but the gate keys on the route file, so each needs its own contract. Confirm the gate supports two contracts per mockup dir before authoring both, otherwise split the mockups into `market-report/` and a hub-specific kit.

### 3. housing-market/central-oregon region hub (app/housing-market/central-oregon/page.tsx)

Verification note: a scope agent read all 101 lines of this file and confirmed every sub-claim. Zero `@/components/site/*` imports. The H1 at line 73 is `<h1 className="text-3xl font-semibold text-foreground">Central Oregon Market Hub</h1>`, a plain element. City cards at line 79 are raw `<article className="rounded-lg border border-border bg-card p-5">`. The price at line 86 is an inline template literal `$${Math.round(Number(pulse.median_list_price)).toLocaleString()}` with no Price primitive. Token color classes are used, so that one gate is partially passing. The other four (G6 parity, brand primitives, tabular numerals, Amboqia display heading) all fail.

1. Create the parity.json (draft in the scope) to unblock G6 enforcement before any code changes.
2. Replace the raw `<main>` shell (lines 71 to 101) with HeroBlock, headline "Central Oregon housing market", lede scoped to live active count plus median from `getRegionPulse`, Old Mill canonical photo. Wire DisplayHeading via HeroBlock for the Amboqia H1. Update the metadata title to "Central Oregon housing market | Ryan Realty".
3. Add BreadcrumbNav below HeroBlock with `includeJsonLd=true`. Remove the hand-rolled BreadcrumbList from the CollectionPage JSON-LD to avoid duplication, and keep the CollectionPage block for the hasPart graph.
4. Add MarketSnapshot (no citySlug) for the region 4-stat band. This replaces the `getLiveMarketPulse` fan-out entirely, one `getRegionPulse` call versus the current 12-call fan-out.
5. Replace the hand-rolled city card grid (lines 77 to 97) with CityGrid, which already reads `geo_snapshot_mv` via `getCitiesForIndex` and covers all 8 canonical cities with photos.
6. Add PriceChart (geoType='region', geoSlug='central-oregon') for the 12-month median trend.
7. Add LeadCaptureBlock (variant 'buyer' or an 'inquiry' variant titled "Get the monthly Central Oregon report") wired to a report-subscription server action.
8. Add CTABar tone='navy' above the footer.
9. Update the metadata title and description to keyword-match "Central Oregon housing market".
10. Run `npm run ci:gates` to confirm G6 passes.

NeedsVerify flag carried from the scope: the median price at line 86 uses `Math.round(Number(...)).toLocaleString()`, which may differ from the canonical $1k-rounded Price primitive format. Verify the rounding delta when MarketSnapshot replaces the raw cards.

### 4. lp/seller-home-value (MID-EDIT, coordinate before touching)

This file is modified in the working tree right now (`git status` shows `M app/lp/seller-home-value/page.tsx`). Treat the owner as in-flight and coordinate before landing any of the steps below.

1. Author `design_system/ryan-realty/ui_kits/seller-lp/parity.json` mapping each mockup section to the `@/components/site/*` block, which also removes seller-lp from the coverage allowlist.
2. Replace the hand-rolled broker grid (page.tsx lines 505 to 517, 276 to 286) with BrokerCard using the transparent `.png` headshots.
3. Replace the hand-rolled FAQ accordion (lines 554 to 568, 414 to 436) with FAQBlock, which gains automatic FAQPage JSON-LD.
4. Replace the hand-rolled NextStep cards with ContentSection, closing the mockup "What's in the valuation" three-step gap at the same time.
5. Replace the hand-rolled footer CTA band (lines 440 to 464) with CTABar pointing to `#get-value`.
6. Replace inline H1 and H2 `font-display` classes with the H1 and H2 primitives.
7. Replace the bespoke MarketVisuals with MarketSnapshot, or wire MarketVisuals to the MarketSnapshot data shape.
8. Add the proof-strip listing cards via ListingCard instead of inline card divs (lines 325 to 350).
9. Remove the four dead local helpers (Broker, NextStep, FAQ, PhoneIcon) once the site blocks are wired.
10. Remove seller-lp from `scripts/mockup-coverage-allowlist.json` after parity.json is authored and the imports pass CI.

Phone note: 541.703.3095 (the FUB-tracked bio phone, page.tsx line 39) is correct on this ad lead-capture surface. Do not revert it to the brand display phone.

### 5. lp/buyer-listing-alerts (app/lp/buyer-listing-alerts/page.tsx)

1. Create `design_system/ryan-realty/ui_kits/buyer-alerts-lp/parity.json` (draft in the scope), then remove buyer-alerts-lp from the coverage allowlist.
2. Replace the raw `<h1 className="font-display ...">` at page.tsx line 78 with `<DisplayHeading as="h1">` from `@/components/site/primitives`.
3. Replace the hand-rolled broker headshot block (lines 57 to 76) with `<BrokerCard variant="compact" broker={MATT_RYAN} />`. The current code recreates a rectangular ring frame via `overflow-hidden rounded-full ... ring-2`, a direct violation of the composite rule.
4. Migrate BuyerLPForm to `<LeadCaptureBlock variant="buyer" onSubmit={submitBuyerLPForm} />`.
5. Add a how-it-works ContentSection matching the three steps in the mockup (index.html lines 141 to 155).
6. Add the sample-digest preview section as a page-local presentational DigestPreview component (no existing block covers it), declared non-blocking in parity.json.
7. Add the "What we DON'T do" reassurance section via FAQBlock or a page-local NegativeTrustCard marked non-blocking.
8. Add a Service JSON-LD block for AI-citability, mirroring the pattern at `app/lp/seller-home-value/page.tsx`.
9. Run `npm run ci:gates`, then remove the allowlist entry only after the gate is green.

### 6. lp/expired-listing (app/lp/expired-listing/page.tsx)

1. Create `design_system/ryan-realty/ui_kits/expired-lp/parity.json` (draft in the scope) so G6 can gate the route.
2. Lift the noindex: remove `robots: { index: false, follow: false }` from metadata (page.tsx line 25). This is the single highest-priority fix, the page is invisible to search for free until it lands.
3. Replace the raw `<h1 className="...font-display...">` (line 49) with `<DisplayHeading as="h1">`, a one-line swap.
4. Add a full-bleed HeroBlock with the locked Old Mill photo, the empathy-first H1 from the mockup, a lede, and a scroll-anchor CTA to `#audit-form`.
5. Replace the bespoke ExpiredLPForm with `LeadCaptureBlock variant="expired"` wired to `submitExpiredLPForm`. The block already carries the correct field set (address plus previousListPrice plus notes).
6. Replace the hand-rolled FAQ divs (lines 200 to 220) with FAQBlock `includeJsonLd={true}`, which emits FAQPage JSON-LD and satisfies G34.
7. Add a BrokerCard for Matt in a ContentSection with eyebrow "Who reads your audit".
8. Replace the raw three-CTA Card grid (lines 173 to 198) with CTABar tone='navy' plus ContentSection.
9. Add a Service JSON-LD block for the expired-listing audit (name, provider Ryan Realty, areaServed Bend, Redmond, Sisters, Central Oregon).
10. Run `npm run ci:gates` to confirm G6 and G34 pass.

Voice note: the metadata title (line 22) and the rendered H1 (line 49) differ slightly ("An honest read" versus "Here's an honest read"). Reconcile when the DisplayHeading swap lands.

### 7. buy (app/buy/page.tsx)

1. Author `design_system/ryan-realty/ui_kits/buy/index.html` from the sell mockup pattern: BreadcrumbNav plus HeroBlock plus two ContentSections plus CTABar plus FAQBlock.
2. Create `design_system/ryan-realty/ui_kits/buy/parity.json` listing the six required blocking components.
3. Rebuild the page: remove the ContentPageHero import, replace with HeroBlock, and use `DisplayHeading as="h1"` so Amboqia fires.
4. Add BreadcrumbNav above HeroBlock, matching `sell/page.tsx` line 100.
5. Replace the hand-rolled card divs (lines 106 to 119) with Card plus CardContent, and the CTA link at line 148 with Button asChild.
6. Replace the "Why buy with us" and "How it works" sections with ContentSection blocks.
7. Replace the "Start your search" CTA with CTABar pointing to `/contact?inquiry=Buying`.
8. Add FAQBlock with verified buyer FAQ items (buyer fees, timeline, service area), no invented stats.
9. Add a live market-context line via `getMarketPulse({ geoType: 'city', geoSlug: 'bend' })`, rendering the months-of-supply verdict, the same pattern the sell page uses. This gives AI crawlers a live data signal.
10. Add JSON-LD for RealEstateAgent plus BreadcrumbList in the server component.
11. Fix the two brand-voice fails: line 130 replace "make the journey clear and low-stress" ("the journey" is in the banned family) with plain language, and line 86 replace "a genuine love for our community" (virtue-stating) with a concrete fact such as "We live in Bend and hold active broker licenses here".
12. Export `revalidate = 300` so the market-context line stays fresh.
13. Run `npm run ci:gates`.

### 8. contact (app/contact/page.tsx)

1. Create `design_system/ryan-realty/ui_kits/contact/index.html` composed from HeroBlock, BreadcrumbNav, the ContactForm card, an office-info sidebar with phone 541.213.6706, FAQBlock, and CTABar.
2. Create `design_system/ryan-realty/ui_kits/contact/parity.json` with BreadcrumbNav, HeroBlock, FAQBlock, and CTABar blocking.
3. Replace ContentPageHero with HeroBlock so the hero H1 goes through the Amboqia font-display path.
4. Add BreadcrumbNav above the form section. The `breadcrumbJsonLd` generation at page.tsx lines 53 to 56 already exists.
5. Add FAQBlock rendering the three existing FAQ items visibly below the form grid (today they are JSON-LD only, never rendered).
6. Add CTABar below FAQBlock with "Get a free home valuation" pointing to `/lp/seller-home-value`.
7. Replace the raw `<h2 className="text-xl font-bold">` (line 92) with the H2 primitive.
8. Upgrade the ContactPage JSON-LD (lines 47 to 52) to call `generateBrokerageSchema()` from `lib/structured-data.ts` line 129, which outputs `@type=['RealEstateAgent','LocalBusiness']` with telephone. Add `telephone:'541.213.6706'`, `areaServed:'Central Oregon'`, and an address block.
9. Add phone 541.213.6706 in dotted format to the rendered office-info panel so it appears in the visible body, not just the meta description.
10. Run `node scripts/check-mockup-parity.mjs` to confirm G6 picks up the new contract.

### 9. compare (app/compare/page.tsx)

1. Confirm noindex intent (page.tsx line 11). It is correct for a parametrized comparison utility. Do not add JSON-LD, because structured data would mislead on a noindex tool page. Skip G34 here.
2. Create `design_system/ryan-realty/ui_kits/compare/index.html` showing an Amboqia DisplayHeading H1, a photo grid row, a shadcn Table, a map iframe, an AICompare card, and a bottom CTABar to `/homes-for-sale`.
3. Create `design_system/ryan-realty/ui_kits/compare/parity.json` (draft in the scope).
4. Replace the raw `<h1>` in CompareClient.tsx line 153 with `<H1>` from `@/components/site/primitives`.
5. Replace the raw `<h1>` in the empty-state branch at CompareClient.tsx line 133 with the same primitive.
6. Add a CTABar below the comparison table.
7. Fix loading.tsx: replace the `className="skeleton"` raw divs with `<Skeleton>` from `@/components/ui/skeleton`.
8. Decide on AICompare at `components/compare/AICompare.tsx`. It is a full component (AI chat call, Card, Button, Skeleton, prompt builder) that is never imported anywhere. Either wire it below the comparison table (a high-value AI-citation hook) or delete the file.
9. After mockup plus parity.json land, run `npm run ci:gates`.

## FLAGSHIP build spec: housing-market/[...slug]

The current route (`app/housing-market/[...slug]/page.tsx`, 149 lines, verified read) is a raw skeleton. It imports only `getCachedStats` and `getLiveMarketPulse` from `@/app/actions/market-stats`, `getGuidesByCity`, and `CityClusterNav`. It renders a plain `<h1 className="text-3xl font-semibold">` (line 101), four hand-rolled stat-card divs (lines 105 to 130 using `rounded-lg border border-border bg-card`), a raw breadcrumb (lines 94 to 99), and WebPage-plus-BreadcrumbList JSON-LD only (lines 60 to 89). It bypasses every site block, so Amboqia never fires and the brand identity is absent.

The mockup at `design_system/ryan-realty/ui_kits/market-report/index.html` (verified read, 190 lines) is the visual target. It defines nine sections: breadcrumb, hero with eyebrow plus display H1, a 4-up key-stat band, a 12-month trend chart, a price-band breakdown table, a city-comparison table, a narrative split with an email form, and a methodology block.

### Sections, components, and data sources

| Mockup section | Component | Data source (lib/data) | Notes |
|---|---|---|---|
| Breadcrumb (lines 43 to 48) | `BreadcrumbNav` (`includeJsonLd=true`) | none | Emits BreadcrumbList JSON-LD, replaces raw nav lines 94 to 99 |
| Hero H1 (line 54) | `DisplayHeading as="h1"` from `@/components/site/primitives` | none | Amboqia Boriango, replaces plain h1 line 101 |
| Key stats band (lines 65 to 81) | `MarketSnapshot citySlug={citySlug}` | `getMarketPulse({geoType:'city', geoSlug})` via `lib/data/market/getMarketPulse.ts` | Confirmed: MarketSnapshot accepts a `citySlug` prop and reads `market_pulse_live`. Replaces hand-rolled cards lines 105 to 130 |
| 12-month trend (lines 83 to 95) | `PriceChart` | `getPriceHistory(geoType, geoSlug, 'monthly', 24)` via `lib/data/market/getPriceHistory.ts` | Component and DAL both exist (verified present). Wiring only. Render when series >= 6 complete months |
| Price-band breakdown (lines 97 to 116) | `PriceBandTable` (NEW) | `getMarketStats` price-band aggregates via `lib/data/market/getMarketStats.ts` (`market_stats_cache`) | Build at `components/site/PriceBandTable.tsx`. Props `items: Array<{label, active, sold90d, medDom, mos}>`. Use `@/components/ui/table`. Footnote renders the MoS formula |
| City comparison (lines 119 to 141) | `CityComparisonTable` (NEW) | per-city `getMarketPulse` fan-out / `getRegionPulse` | Build at `components/site/CityComparisonTable.tsx`. Every figure traces to `market_pulse_live`, never hardcoded |
| Narrative (lines 143 to 153) | `ContentSection` | derived from the stats above | Body copy dynamically generated from the MoS verdict (sub-$1M / $1M to $2.5M / $2.5M+ paragraphs), no hardcoded prose |
| Email form (lines 155 to 165) | `LeadCaptureBlock variant="inquiry"` | existing inquiry server action | "Get the {geoName} report every month" |
| Methodology (lines 167 to 174) | `ContentSection` | `market_stats_cache` trace fields | Methodology trace cites geo_type, geo_slug, methodology_version, refreshed_at |
| (added) cross-nav | `RelatedAreas cols={4}` | per-city `getMarketPulse` active counts | Nearby Central Oregon cities for city pages, sibling communities for subdivision pages |
| (added) bottom CTA | `CTABar tone="navy"` | none | "Questions about {geoName}?", primary `/contact`, secondary `tel:5412136706` |

Data-layer note: the current page imports `getCachedStats` and `getLiveMarketPulse` from `@/app/actions/market-stats` (line 4). These delegate to `lib/data`, so they are DAL-compliant but indirect. When rebuilding, prefer the direct `lib/data/market/*` imports for clarity and to satisfy the G8 check-page-dal gate. `getMarketStats` reads `market_stats_cache` (6h freshness), `getMarketPulse` reads `market_pulse_live` (10 to 15 min freshness), `getPriceHistory` reads `market_stats_cache` monthly sequence.

### JSON-LD (G34)

Three schema types, all emitted through `MetadataBlock` or the breadcrumb component, all backed by builders verified present in `lib/site/json-ld.ts`:

- **BreadcrumbList** via BreadcrumbNav `includeJsonLd=true`.
- **Dataset** via `<MetadataBlock schema={{ type: 'dataset', ... }} />`. The `dataset` builder exists at `lib/site/json-ld.ts` line 258, with `dateModified`, `spatialCoverageName`, and `variableMeasured` (line 271, mapped from `StatValue`). This is the primary AI-citability signal. `dateModified` MUST equal `stats.refreshedAt` from `market_stats_cache`, never a hardcoded string. Each `variableMeasured` value must equal the number shown on screen (§0).
- **FAQPage** via `<FAQBlock items={faqItems} includeJsonLd={true} />`. The `faqPage` builder exists at `lib/site/json-ld.ts` line 72 and the FAQBlock emits it automatically through MetadataBlock. Five to six geo-specific questions sourced from real search queries (how fast homes sell in {geoName}, buyer's or seller's market, median price, homes for sale, months of supply).

`generateStaticParams` is required: the 11 core Central Oregon city slugs (bend, redmond, sisters, sunriver, la-pine, tumalo, prineville, terrebonne, black-butte-ranch, eagle-crest, crooked-river-ranch) pre-heat the most-searched geo pages at build time and prevent the cold-start penalty on first organic visit.

### Proposed parity.json (full)

Path: `design_system/ryan-realty/ui_kits/market-report/parity.json`. Route key `app/housing-market/[...slug]/page.tsx`. The shape matches the existing `city/parity.json` contract (requiredComponents with `name` plus `section` plus `blocking`, plus layoutComponents, deferredComponents, and jsonLd metadata).

```json
{
  "route": "app/housing-market/[...slug]/page.tsx",
  "mockup": "design_system/ryan-realty/ui_kits/market-report/index.html",
  "competitiveTarget": "Beat Zillow / Redfin / Windermere geo market pages. Live per-geo stat band, 12-month price trend chart, price-band inventory breakdown, city-comparison table, market FAQ plus FAQPage JSON-LD, Dataset JSON-LD for AI citability, and a broker lead-capture form no aggregator site carries.",
  "note": "FLAGSHIP ranking route. This file creates the contract. The page must be rebuilt from scratch on @/components/site/* blocks before G6 passes. The page currently has zero site-block imports and only WebPage plus BreadcrumbList JSON-LD.",
  "requiredComponents": [
    { "name": "BreadcrumbNav", "section": "Home > Housing market > {geoName}, includeJsonLd=true so BreadcrumbList JSON-LD fires via MetadataBlock", "blocking": true },
    { "name": "DisplayHeading", "section": "Hero H1, '{geoName} housing market' in Amboqia Boriango (as='h1'). Replaces the plain h1 line 101", "blocking": true },
    { "name": "MarketSnapshot", "section": "Key stats band, 4 live SFR cards (active, median list, median DOM, months of supply plus verdict). citySlug prop reads market_pulse_live via getMarketPulse. Replaces hand-rolled cards lines 105 to 130", "blocking": true },
    { "name": "PriceChart", "section": "12-month median sale price trend, getPriceHistory(geoType, geoSlug, 'monthly', 24) from market_stats_cache. Renders only when series >= 6 complete months. eyebrow '12-month trend', tone 'muted'", "blocking": true },
    { "name": "FAQBlock", "section": "Market FAQ, 5 to 6 geo-specific Q and A pairs. includeJsonLd=true auto-emits FAQPage JSON-LD via MetadataBlock (G34). tone='muted'", "blocking": true },
    { "name": "MetadataBlock", "section": "Dataset JSON-LD (G34 AI-citability), schema type 'dataset' with variableMeasured from verified market_stats_cache stats. dateModified MUST be stats.refreshedAt, never hardcoded", "blocking": true },
    { "name": "ContentSection", "section": "Market narrative, dynamically generated prose ('What the numbers say') driven by the MoS verdict and price-band stats. Methodology trace line citing market_stats_cache, geo_type, geo_slug, methodology_version, refreshed_at", "blocking": true },
    { "name": "LeadCaptureBlock", "section": "Monthly report subscription form, 'Get the {geoName} report every month', variant='inquiry', tone='muted', wired to the inquiry server action", "blocking": true },
    { "name": "RelatedAreas", "section": "City cross-navigation, nearby Central Oregon cities with activeCount from market_pulse_live. eyebrow 'Central Oregon cities', cols=4", "blocking": true },
    { "name": "CTABar", "section": "Broker contact band, tone='navy'. eyebrow 'Questions about {geoName}?', primary '/contact' Schedule a call, secondary 'tel:5412136706' 541.213.6706", "blocking": true },
    { "name": "PriceBandTable", "section": "'Where the activity is' inventory-by-price-band table (mockup lines 97 to 116). NEW site block at components/site/PriceBandTable.tsx. Data from market_stats_cache grouped by price band. Footnote renders the MoS formula per §0", "blocking": true },
    { "name": "CityComparisonTable", "section": "'How Bend compares' city-level table (mockup lines 119 to 141). NEW site block at components/site/CityComparisonTable.tsx. Data from per-city market_pulse_live rows, never hardcoded", "blocking": true }
  ],
  "layoutComponents": [
    { "name": "SiteHeader", "section": "renders from app/layout.tsx", "note": "gate checks the route file" },
    { "name": "SiteFooter", "section": "renders from app/layout.tsx", "note": "gate checks the route file" }
  ],
  "deferredComponents": [
    { "name": "ActivityFeed", "reason": "Live transaction events for the geo. Deferred until geo-scoped activity feed data is verified for subdivision and community levels." }
  ],
  "jsonLd": {
    "required": [
      { "type": "BreadcrumbList", "emittedBy": "BreadcrumbNav includeJsonLd=true", "gate": "G34" },
      { "type": "Dataset", "emittedBy": "MetadataBlock schema type='dataset'", "gate": "G34", "note": "Primary AI-citability signal. dateModified must equal stats.refreshedAt from market_stats_cache." },
      { "type": "FAQPage", "emittedBy": "FAQBlock includeJsonLd=true", "gate": "G34" }
    ]
  },
  "dataLayer": {
    "getMarketStats": "lib/data/market/getMarketStats.ts, market_stats_cache 6h freshness, periodType='monthly'",
    "getMarketPulse": "lib/data/market/getMarketPulse.ts, market_pulse_live 10 to 15 min freshness, used by MarketSnapshot and CityComparisonTable",
    "getPriceHistory": "lib/data/market/getPriceHistory.ts, market_stats_cache monthly, limit 24, used by PriceChart",
    "note": "Current page imports getCachedStats and getLiveMarketPulse from @/app/actions/market-stats. These delegate to lib/data, DAL-compliant but indirect. Prefer direct lib/data imports to satisfy G8 check-page-dal."
  },
  "generateStaticParams": {
    "required": true,
    "coreSlugs": ["bend", "redmond", "sisters", "sunriver", "la-pine", "tumalo", "prineville", "terrebonne", "black-butte-ranch", "eagle-crest", "crooked-river-ranch"]
  }
}
```

Note on the draft from the scope: the scope's draftParityJson placed PriceBandTable and CityComparisonTable under `deferredComponents` because they need building. This plan promotes both to `requiredComponents` with `blocking:true`, because the flagship is not the flagship without them, and the bring-up plan builds them in the same wave. If the wave is split, demote them to deferred for the first commit and promote them in the second, but do not ship a flagship parity that does not name them at all.

## P0s and voice flags surfaced for immediate attention

P0 (immediate):

- **`lp/expired-listing` is noindex (page.tsx line 25).** A high-value seller-reactivation ranking page is invisible to search. The fix is one line. Nothing else on that route matters until it lands.
- **`contact` has no visible phone number.** Phone 541.213.6706 is absent from the rendered body (page.tsx lines 83 to 109), present only in the meta description. A contact page failing its own primary job.
- **Flagship and both hubs carry no Dataset or FAQPage JSON-LD (G34).** AI crawlers (Perplexity, ChatGPT, Google AI Overview) cannot extract structured market statistics from the highest-value ranking surfaces. A competitor with Dataset plus FAQPage wins the AI citation for "Bend housing market".
- **`buy` has no JSON-LD and no parity (G6 plus G34 blind) on the highest-value buyer-intent route.**
- **No parity.json on any of the 9 routes.** G6 is blind to the entire money path, so any edit can regress silently. This is the systemic P0 the whole plan closes.

§0 data-accuracy flags:

- Flagship Dataset JSON-LD: every `variableMeasured` value must equal the on-screen number, and `dateModified` must be `stats.refreshedAt` from `market_stats_cache`, never a hardcoded date. The current raw stat cards carry no methodology trace and no freshness timestamp.
- `central-oregon` hub: the line-86 median uses `Math.round(...).toLocaleString()`, which may diverge from the canonical $1k-rounded Price primitive. Verify the rounding delta (needsVerify).
- All new live-data surfaces (MarketSnapshot, PriceChart, CityGrid, PriceBandTable, CityComparisonTable) must trace every figure to `market_pulse_live` or `market_stats_cache` via DAL functions. Raw `.from('listings')` aggregation is forbidden (G1).

Brand-voice (§Brand Voice) flags:

- `buy` line 130 "the journey" is in the banned family ("your real estate journey"). Must fix before ship.
- `buy` line 86 "a genuine love for our community" is virtue-stating (Matt directive 2026-06-02). Replace with a concrete fact.
- Plain-Geist H1s instead of the Amboqia DisplayHeading primitive on the flagship (line 101), both hubs, `buy`, `contact`, and `compare`. Amboqia never fires on these pages, so they read as a different site.
- `buyer-listing-alerts` BrokerCard composite-rule violation (recreates a rectangular ring frame).
- `central-oregon` lede uses "momentum" (marketing slop) and an impersonal voice. Replace when HeroBlock is wired.
- `expired-listing` meta title and rendered H1 differ slightly. Reconcile them.

## Coordination note (do not clobber in-flight work)

`app/lp/seller-home-value/page.tsx` is **modified in the working tree right now** (confirmed via `git status`: `M app/lp/seller-home-value/page.tsx`, alongside `M app/lp/sell-your-home/page.tsx`). An owner is mid-edit on the seller LP. Do not start the seller-home-value rebuild (route 7) until that edit is committed or the owner hands off. Coordinate first. The other 8 routes in this cluster are clean in the working tree and safe to start, subject to Matt's sign-off on this draft.
