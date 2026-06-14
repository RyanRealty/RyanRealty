# Site Page Standard — content sections per page type

**Purpose.** One source of truth for *what goes on every page*, so a page is an
instance of a template, not a hand-build. Benchmarked against Zillow's page IA
(studied live 2026-06-14), then rebuilt on our data advantage, our funnel, and
our design system. This is the spec the canonical component kit implements and
the render-health gate enforces.

Every page obeys three rules:
1. **One intent.** It targets one real search a Central Oregon buyer or seller types.
2. **Live data or nothing.** Every stat traces to Supabase (§0). A stat we can't verify is omitted, never shown as `—` or faked.
3. **One funnel action.** Buyer path = search / alerts / tour. Seller path = home value / CMA. Phone `541.213.6706` is the universal fallback.

## Design elements applied to every section (non-negotiable)

- **Color:** navy `#102742` + cream `#faf8f4` only. No gold, no greys.
- **Type:** Amboqia Boriango for hero H1 + section display headings (via `DisplayHeading`/`H1`/`H2`), Geist for body/UI/data. Tabular numerals on every number.
- **Components:** only `@/components/ui` + the canonical site kit below. No hand-rolled controls, no bespoke per-page sections.
- **Headings:** sentence case (Title Case only the hero H1). **Voice:** brand rules — no banned words, no smallness/credential positioning, no em-dashes.
- **Hero photography:** real local photo, geo-correct. Brand surfaces use the Old Mill canonical hero. A neighborhood shows that neighborhood, never a generic city aerial.

## Canonical component kit (the only building blocks)

`PageHero` (FlyoverHero) · `MarketStatBand` (LiveMarketBand) · `SectionNav` · `MapLedger` (CommunityMapLedgerPane) · `PriceHistoryScrubber` + `PaymentSlider` · `ListingGrid` · `OpenHousesGrid` · `ActivityFeed` · `ArticleGrid` · `FAQBlock` · `InlineValuationHook` (CTA) · `RelatedAreas` · `Breadcrumb`. Listing pages add `ListingHero`, `PropertySpecs`, `MortgageCalculator`, `SchoolsBlock`, `ClimateRiskBlock`, `NeighborhoodMarketContext`, `ListingAgentCard`.

---

## 1. Geo pages — city / community / neighborhood / zip (`/cities/*`, `/communities/*`, `/cities/*/[hood]`, `/zip/*`)

These are the traffic engine and the page the recovering SEO traffic lands on. All four are the SAME archetype, different data.

**Zillow's region page sections:** search filters + map + results · SEO link clusters (by bedroom, by price, by amenity, by property type, popular searches) · nearby cities / neighborhoods / zips · "estimate your sale proceeds" · rent hook.

**Our Geo page sections (in order):**
1. **PageHero** — geo-correct photo, place name (Amboqia), one live line (active count + median). *We beat Zillow: a real photo of THAT place, not a stock map tile.*
2. **MarketStatBand** — active homes, median list, median days on market, months-of-supply + seller/balanced/buyer verdict. Only verified stats render; an unavailable one is dropped, not dashed.
3. **SectionNav** — sticky anchor rail, offset below the header (no overlap).
4. **About / overview** — what this place is, honest and specific (boundary, character, drive times, HOA for resorts). Our hyperlocal data, not boilerplate.
5. **MapLedger** — boundary polygon + live listing pins + a synced listing ledger. *Our edge: verified boundary polygons Zillow doesn't draw.*
6. **PriceHistoryScrubber + PaymentSlider** — local price trend + "what would the payment be."
7. **ListingGrid** — active homes in this exact geo.
8. **OpenHousesGrid** — this weekend, this area.
9. **ActivityFeed** — recent solds / new / price changes (the "live" proof).
10. **Sub-areas** — neighborhoods within a city / subdivisions within a community (internal links = SEO + navigation).
11. **ArticleGrid** — guides/blog for this place.
12. **FAQBlock** — the questions people ask about buying here (schema-marked).
13. **RelatedAreas** — nearby cities / communities / zips (the SEO internal-link block Zillow leans on, done with our data).
14. **InlineValuationHook** — seller CTA ("what's your home in [place] worth").

**Primary CTA:** save search / listing alerts (buyer). **Secondary:** home value (seller).

## 2. Search / all homes (`/homes-for-sale`, `/search`)

**Zillow:** filter bar · map + result cards (photo carousel, price, beds/baths, address, save) · sort · SEO link block below.

**Ours:** filter bar · clustered map + result grid · save-search / draw-boundary / create-alert · consistent result card (price, beds/baths, sqft, $/sqft, DOM, status) · SEO link block (by city / price / lifestyle) at the bottom.
**CTA:** create alert (captures the lead with no form).

## 3. Listing detail (`/listing/[key]`) — beat Zillow on context

**Zillow's section order:** photo gallery (+ virtual tour / floor plan / map tabs) · price + beds/baths/sqft + status · monthly payment · "what's special" tags · description · commute / street view · room-by-room · facts & features (interior, property, construction, utilities, HOA, financial) · price history · tax history · payment breakdown · Zestimate · climate risks · neighborhood · getting around (walk/bike/transit) · nearby schools · nearby cities · agent contact.

**Ours (same backbone, our differentiators in bold):**
1. **ListingHero** — photo gallery + tour/floorplan/map tabs.
2. Price + specs strip + monthly payment.
3. Highlights ("what's special").
4. Description.
5. **PropertySpecs** — full facts & features.
6. **NeighborhoodMarketContext** — *how this home compares to its neighborhood (our live data — Zillow shows generic "neighborhood," we show the verified stats).*
7. Comparable recent sales.
8. **MortgageCalculator** + payment breakdown.
9. **TransparentCMASummary** — *our honesty play: is it priced right? Zillow won't tell you.*
10. Price + tax history.
11. **SchoolsBlock**, **ClimateRiskBlock**, parks/trails nearby, getting-around.
12. Location map.
13. SimilarListings.
14. **ListingAgentCard** — the actual broker on the listing, headshot, direct text/call. *Zillow sells your inquiry to three strangers; we route to the broker.*

**Primary CTA:** text/call the listing broker, schedule a tour.

## 4. Housing market / reports (`/housing-market`, `/housing-market/[city]`, `/reports/*`)

**Zillow:** "[Place] Housing Market" H1 · ZHVI median · market temperature · "what is ZHVI" · metrics (median sale/list, days to pending, % over/under list, % price cuts) · trend chart · values by bedroom · nearby markets.

**Ours:**
1. PageHero — "[Place] housing market" + the headline median.
2. MarketStatBand — median, YoY, active, days, months-of-supply + verdict.
3. Trend charts (price, inventory, DOM) off our cache.
4. What it means — plain-English read for buyers vs sellers (our voice).
5. By segment (price band / property type) where verified.
6. RelatedAreas — other city/neighborhood reports.
7. CTA — full report / home value.

**Primary CTA:** home value (seller) / listing alerts (buyer).

## 5. Sell / valuation (`/sell`, `/sell/valuation`)

**Zillow:** "sell with confidence" · 4 selling paths (partner agent / cash offer / own agent / FSBO) · Showcase upsell · resources · build a plan · FAQ · address entry.

**Ours (simpler, one path — us):**
1. PageHero — "What's your home worth in today's [market]?" + address entry.
2. Instant estimate → real CMA from the broker who'd list it.
3. Our marketing standard (what every listing gets) — concrete, not "premier."
4. Recent solds / proof.
5. How selling works (timeline).
6. FAQ.
7. CTA — get my home value (becomes a Seller Inquiry in FUB).

**Primary CTA:** free home valuation.

## 6. Lifestyle SEO — schools / parks / trails (`/schools/*`, `/parks/*`, `/trails/*`)

Ranks for "[school] ratings", "best trails in bend". Sections: the detail + map · key facts · **homes for sale near it** (our real-estate hook) · related places · CTA "see homes near here".

## 7. Content — blog / guides / area-guides (`/blog/*`, `/guides/*`, `/area-guides`)

Ranks for "moving to bend", "best neighborhoods in bend". Sections: editorial body · related listings/geo links · author (broker) · CTA contextual (relocation → talk to a broker; neighborhood → see those homes).

## 8. Tools (`/tools/*`)

Calculator · result · **every result routes to "talk to a broker" / "see homes in your budget."**

## 9. About / team (`/about`, `/team`, `/team/[slug]`)

Position on capability, the standard, the data, and direct-broker accountability — never headcount or "licensed" as a selling point. Sections: who we are + the standard · real reviews · the brokers (real headshots, direct contact) · contact. CTA: talk to a broker.

## 10. Landing pages (`/lp/*`)

One problem, one promise, one action. Form above the fold, no nav distractions, single CTA.

---

## What we take from Zillow, and where we beat them

- **Take:** the section completeness of the listing page, and the SEO internal-link blocks on region pages (by bedroom/price/amenity/place). Those are why Zillow ranks.
- **Beat:** hyperlocal verified data (boundary polygons, per-neighborhood stats), honest pricing context (TransparentCMASummary), and direct-broker accountability instead of selling the lead. Zillow is generic and national; we are specific and local, which is exactly what wins local search and local trust.

## Enforcement

Every page composes only from the canonical kit, in the section order above, for its archetype. The render-health gate fails the build if a page's hero photo is the generic fallback, a stat renders `—`/NaN, the map fails to mount, the primary CTA is missing, or an unknown slug returns 200 instead of 404. The voice gate fails the build on banned vocabulary. This is what keeps every page on-standard instead of drifting back to hand-builds.
