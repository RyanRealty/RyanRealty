# Ryan Realty — Full Site Audit + Execution Plan (2026-06-14)

Exhaustive go-through of every menu, every public + authenticated page, and every
interactive feature, verified against production (`ryan-realty.com`) and the code.
Then the plan to fix it comprehensively (by class, behind gates), not page by page.

## Progress log (2026-06-14, shipped to `main`)

- ✅ **Traffic / Class A** — `b1d0d347` 152 dead AgentFire URLs → real 301s (the cutover collapse).
- ✅ **Class B (stats)** — `c5339c3a` community/neighborhood stat bands render verified `market_stats_cache` data (days-on-market, median sold), never `—`. LiveMarketBand renders only verified aux stats; FlyoverHero `daysLabel` prop.
- ✅ **Class E (overlap)** — `2da653dd` section-nav no longer overlaps the header (shared `HEADER_HEIGHT_PX` + no-wrap header buttons). Verified by screenshot.
- ✅ **Class A (soft-404)** — `5a890f09` middleware returns a real 404 for invalid `/cities/*` + `/communities/*` slugs (kills the bulk of the 2,992 "crawled, not indexed"). Residual: city-prefixed fakes (`bend-<fake>`) still page-guarded.
- ✅ **Class H (voice)** — `c5339c3a` + `3fe62a89` 17 voice violations fixed across 15 surfaces; homepage block un-exempted from the gate. Working tree 0 violations.
- ✅ **Class C (partial)** — `4598388b` housing-market hero uses city photo, not the Bend Old Mill on every city.
- ✅ **Search Console** — verified live: redirect deployed, sitemap healthy, 21,837 not-indexed is the real lever (soft-404 fix attacks 2,992 of them). No SC action was missing.

### Remaining (in priority order)
1. **Nav rebuild (Class D)** — merge Homes + Explore, kill "Central Oregon, end to end", fix hidden columns / duplicate cities / "List your home" label / dead badge code / header CTA count.
2. **Geo sweep (Class B/C/E, Phase 2)** — convert neighborhood (`/cities/[slug]/[hood]`) + zip pages to the canonical archetype (they still use HeroBlock + bespoke stat cards + no SectionNav).
3. **Class F (SSR)** — `/feed`, `/activity`, market reports, `/guides`, `/videos`, `/our-homes` ship little/no SSR content.
4. **Class C (photos)** — per-neighborhood + per-city hero photography sourcing.
5. **Class G (features)** — mortgage-calc lead capture, CMA auto-delivery, Ask Bar (real or rename), AI Compare, RSVP/favorites guest paths, OAuth cleanup.
6. **Class A residual** — city-prefixed fake community slugs; lock the brand-voice baseline to 0 once the tree is clean.

## Headline numbers
- **Navigation:** ~110 distinct links audited across mega-menu, header, footer, mobile. 0 hard-404s, but 10 structural problems (hidden columns, duplicate cities, label/destination mismatches, dead code).
- **Public pages:** 86 routes audited. Most GOOD. ~12 BROKEN/SOFT-404, ~10 THIN/client-only.
- **Account/dashboard/auth/legal:** ~30 pages, all WORKING (a few UX inconsistencies).
- **Features:** 32 audited. Lead-capture pipeline is solid (every wired form fires FUB + CAPI + GA4). Gaps are concentrated in AI follow-through, auth friction, and one dead-end calculator.

---

## The problems, grouped by CLASS (this is what the plan fixes)

### Class A — Wrong HTTP semantics (soft-404 / 404)
- `/listing/by-address/[...slug]` → 200 + "Page Not Found" (every address URL silently fails — kills SEO + shares).
- `/buy/[intent]` and `/sell/[intent]` invalid slugs → 200 + "Page Not Found" (no real 404, no generateStaticParams fence).
- `/guides/[unknown-slug]` → 200 + blank (no notFound()).
- `/communities|cities|subdivisions/[slug]` → **200 for ANY garbage slug** (soft-404 sprawl across the 10K sitemap → Google distrust).
- `/trails` + `/trails/[slug]` → hard 404 (built locally, never committed/deployed).
- `/schools/bend-la-pine` (district slug) → hard 404.

### Class B — Data-contract gaps (stats show `—` or wrong data)
- Community + neighborhood pages: days-to-pending and months-of-supply render `—` (page queries `market_pulse_live`, which has no neighborhood rows; the real data is in `market_stats_cache`).
- `/housing-market/[city]` pages: 3–6 blank comparison cells (`—`) in the YoY/period table.
- `/cities/bend/awbrey-butte`: missing median sale price.

### Class C — Hero photo + design-system drift
- Wrong hero photos: Bend neighborhoods fall back to a generic Old Mill aerial (Awbrey Butte shows smokestacks); `/housing-market/redmond` + `/sisters` show Bend's Old Mill photo.
- 6 hero components, 3 stat-band components, 3 CTA components coexisting (the "different design system per page" feeling).

### Class D — Navigation IA
- Homes "By city" + "Type & status" columns are in the data but **never rendered on desktop**.
- Homes and Explore both list the same 8 cities (duplication).
- "Sunriver" appears twice in the Explore panel (city vs resort) with identical label.
- "List your home" → `/lp/seller-home-value` (a valuation page, not a listing intake).
- "Free home valuation" points to two different pages in the same Sell panel.
- Dead code: price-drop badge never renders; Homes promo CTA never renders.
- Mobile fallback drops Powell Butte + Terrebonne.
- `/reports/explore` stale redirect used in footer.
- Madras, Culver, Vandevert Ranch, Three Rivers, `/resources` are live but unreachable from nav.

### Class E — Section-nav overlaps the header
- `SectionNav` and `SiteHeader` are both pinned to `top:0`; they collide on city/community pages. Fix: shared `HEADER_HEIGHT` constant.

### Class F — Client-only rendering (invisible to crawlers)
- `/feed`, `/activity`, `/housing-market/reports/[slug]/[geoName]`, `/guides` index, `/videos`, `/our-homes` ship little/no SSR content.

### Class G — Feature gaps (stub / partial)
- Homepage V6 "Ask Bar" is a plain keyword redirect labeled as AI (stub).
- AI Compare built but disabled.
- CMA: form fires the lead, but no CMA doc is auto-generated/emailed.
- Mortgage calculator: highest-intent buyer tool, captures zero leads.
- Open House RSVP: auth-gated, no confirmation email.
- Favorites: no guest persistence (impulse saves bounce to sign-in).
- Facebook + Apple OAuth declared but no UI button.
- Price-drop nav badge not built. Voice search Chrome-only. No sticky click-to-call.

### Class H — Brand-voice violations
- `HomepageVoiceBlock` ("small, independent brokerage", "Three licensed brokers", "541 Oregon license numbers" as a stat), `/buy` lede, `/team/[slug]` bio template. Violates the locked no-smallness / no-overt-credential rules.

### Class I — Uncommitted, undeployed work
- V6 homepage (built, uncommitted → prod still serves old V5).
- Trails feature + its Supabase migration (built, uncommitted).

### Class J — Minor UX
- `/account/*` redirects unauthenticated users to `/` instead of `/login`.
- `/dashboard/saved` and `/account/saved-homes` are duplicate surfaces.
- `/accessibility` + `/dmca` use wrong fallback emails.

---

## THE PLAN — fix by class, behind gates, in dependency order

**Phase 0 — DONE.** 152 dead AgentFire URLs redirected (shipped, commit b1d0d347).

**Phase 1 — Foundations (the kit + contract + gates everything depends on).**
1. Extract the canonical component kit from `/cities/bend` (one `PageHero`, `MarketStatBand`, `SectionNav`, `MapLedger`, `PriceHistory`, `ListingGrid`, `CTA`). Delete the duplicate generations.
2. Build the single **Geo data contract**: guarantees a real hero photo and only verified stats (omit a stat, never render `—`). Fixes Class B at the source.
3. Fix SectionNav overlap with a shared `HEADER_HEIGHT` constant (Class E).
4. Ship the **render-health gate** + slug-validation/`notFound()` (Class A, forward) and extend the **voice gate** to every surface (Class H).

**Phase 2 — Geo sweep (biggest visible win, ~half the site).**
Convert communities, neighborhoods, and zip pages to the canonical Geo archetype + contract. Fixes Awbrey Butte and every geo page at once: real stats (B), right photos (C), no overlap (E), proper 404s on bad slugs (A). Source per-neighborhood hero photos.

**Phase 3 — Navigation rebuild (Class D).**
Merge Homes + Explore into one "Homes" panel (by place / by search), single nav source of truth, fix every label/duplicate/hidden-column/mismatch, fix the header buttons (one primary CTA + account icon).

**Phase 4 — Hubs, content, listing + SSR (Class F + page fixes).**
SSR the client-only pages; fix `/housing-market/[city]` hero + blank cells; fix `/listing/by-address` soft-404; SSR the market reports.

**Phase 5 — Feature completion (Class G), prioritized by funnel impact.**
Mortgage-calculator lead capture, CMA auto-delivery, Ask Bar (make it real or rename it), AI Compare, RSVP confirmation + guest path, favorites guest persistence, OAuth cleanup, sticky click-to-call.

**Phase 6 — Decisions + cleanup (Class I, J).**
Ship or kill V6 homepage + trails (your call); fix account redirect, duplicate surfaces, fallback emails.

Each phase ends with its gate, so fixes lock and can't drift back. That is the difference between this and the one-off patching that built the mess.
