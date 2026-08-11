# Search UX Wave 3 — Mockup gap plan + performance

**Date:** 2026-08-10  
**Status:** ACTIVE — execute through this doc  
**Route:** `https://ryan-realty.com/homes-for-sale` → `app/search/page.tsx`  
**Mockup SSOT:** `design_system/ryan-realty/ui_kits/search/index.html`  
**Parity contract:** `design_system/ryan-realty/ui_kits/search/parity.json`  
**Related:** `docs/ADVANCED_SEARCH.md` (engine) · `docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md` (FlexMLS filter/map depth) · `docs/design-audit/search-audit-2026-07-11.md`

---

## 1. End-to-end goal

When finished, a buyer lands on `/homes-for-sale` and within ~5 seconds:

1. Sees a **clear, calm consumer search chrome** (omnibox + primary chips + Save/Alerts + count/sort) that feels like the rest of ryan-realty.com, not a bolted-on portal.
2. Sees **map + results in lockstep** from one viewport truth (already true for split).
3. Can pan/zoom with **fast pin/list refresh** without redundant cold fetches.
4. Can open **All filters** for FlexMLS-grade depth without paying that cost on every page load.
5. Mobile is **list/map intentional**, not a full viewport of chrome before the first home.

**Done ≠** more filters alone (engine largely shipped).  
**Done =** mockup hierarchy + perf budgets + honest counts.

---

## 2. Mockup inventory (what the kit actually specifies)

| Layer | Mockup | Intent |
|-------|--------|--------|
| Header | Site header (navy) | Site chrome (today: PublicNav — correct post dual-chrome kill) |
| Row 1 | Full-width search input + **Save this search** + **Get daily alerts** | Primary CTAs in the search bar |
| Row 2 | Horizontal **filter chips** (place, price, beds, baths, type, + Filters) | Scannable active filters |
| Row 3 | **Results count + filter summary + sort** | “186 homes · Bend · … · sorted by newest” |
| Body | **50/50 map-split** + 2-col listing cards | Map-first default |
| Cards | Photo, price, address, beds/baths/sqft, badges (Hot/New/Drop/OH) | Editorial listing card |
| Footer | Site footer | List view only today (app-frame omits) |

**parity.json competitive target:** search-as-you-move, list↔map hover sync, photo popups on markers, mobile list/map toggle.

**What the static mockup does *not* define (but live product needs):** draw tools, all-filters sheet, status/sold, voice, geo-scope chips, 87-field registry. Those stay — hierarchy must absorb them without looking like a pro dashboard.

---

## 3. Gap register (mockup + live + perf)

Severity: **P0** trust/block · **P1** main-path friction · **P2** clear defect · **P3** polish.

| ID | Area | Mockup / intent | Live today | Sev | Effort | Notes |
|----|------|-----------------|------------|-----|--------|-------|
| G1 | Bar hierarchy | Omnibox + Save + Alerts primary | Omnibox + voice + sort + view toggle + Save; alerts often second strip | P1 | M | Collapse to mockup row; move sort to count row |
| G2 | Count / sort row | Dedicated “N homes · filters · Sort” | Count lives inside map view / stamp; sort on bar | P1 | S–M | Match mockup row 3 |
| G3 | Chip density | ~6 primary chips | Long chip row + registry chips + status | P2 | M | Primary 4 + “All filters (N)” per optimization plan UX spec |
| G4 | Split proportions | Clean map-split | Works; denser chrome shrinks map | P2 | S | Reclaim vertical space from G1/G2 |
| G5 | Card craft | Badges, $/sqft, clean meta | Cards work; less editorial | P3 | M | Align with listing card language |
| G6 | Hover sync | List↔map highlight | `hoveredKey` exists | P2 | S | Verify both directions + a11y |
| G7 | Photo pins | Marker photo popups | Price pills / clusters | P2 | M | Marker info window photo |
| G8 | Mobile | List/map toggle, sheet | Dual toggles fixed once; still chrome-heavy | P1 | M | Bottom sheet results per plan UX |
| G9 | Empty / zero | Honest | Beyond-viewport count exists | P2 | S | Keep; polish copy |
| G10 | Mockup gate | Visual fidelity | Gate checks **imports only** | P2 | S | Extend parity notes / optional visual checklist |
| **P1** | SSR waterfall | Fast first paint | **Serial** `getSession` → boundary → viewport | **P0** | S | Parallelize session∥boundary |
| **P2** | Cold pan fetch | No redundant work | First map idle still schedules `getViewportSearch` | **P0** | S | Skip fetch on initial settle |
| **P3** | Exact count on pan | Count cheap or sticky | Every pan: `count: 'exact'` + up to 500 tiles | P1 | M | Decouple count; lower pan cap |
| **P4** | Marker rebuild | Smooth pan | Full AdvancedMarker rebuild to 500 | P1 | L | Server cluster / pin-lite payload |
| **P5** | Double debounce | Single timer | Map 200ms + parent 350ms | P2 | S | One debounce layer |
| **P6** | JS weight | Filters light | Eager `AllFiltersSheet` | P2 | S–M | Dynamic import / split exports |
| **P7** | LCP images | First cards priority | Default image loading | P2 | S | `priority` first 2–4 |
| **P8** | loading UI | Split skeleton | Generic 6-card skeleton | P3 | S | Split-shell loading.tsx |

Engine gaps (filters, MV, registry) are **out of Wave 3 scope** unless they block UX — see SEARCH_OPTIMIZATION_PLAN Phases 1–2.

---

## 4. Performance budgets (binding)

| Interaction | Budget (p75) |
|-------------|--------------|
| Cold TTFB `/homes-for-sale` (CDN warm) | &lt; 600 ms |
| First cards visible (mobile field LCP) | &lt; 2.5 s |
| Pan stop → updated pins/count | &lt; 800 ms (incl. debounce) |
| Filter apply (full navigation) | Treat as new page; no false “0 homes” on timeout without message |
| All-filters open (chunk cached) | &lt; 100 ms |

**Timeout honesty:** `withTimeout` empty fallback must not look like “no inventory” without a retry affordance (existing concern from 2026-07 audit).

---

## 5. Execution waves

### Wave 0 — Plan + measurement + G3 close (this ship)

- [x] This plan written to disk  
- [x] G3 Reporting Identity **Blended** confirmed by Matt (already set in GA4 UI)  
- [x] Perf quick wins P1 + P2 (parallel SSR, skip first idle fetch)  
- [x] VERIFY_LOG stamp  

### Wave 1 — Chrome hierarchy (mockup feel)

1. Restack SearchFilters to mockup rows: **omnibox + Save + Alerts** | **chips** | **count + sort** (view toggle secondary).  
2. Single primary alert path (prefer bar CTA → open capture; avoid double sticky strips fighting).  
3. Mobile: one view switcher only; reduce chrome before first card.  

**Exclusive files (start):** `components/search/SearchFilters.tsx`, `app/search/page.tsx`, `components/search/SearchAlertCapture.tsx`, optional CSS.

### Wave 2 — Split body craft

1. Results count stamp always visible in split (mockup row 3).  
2. Card meta: $/sqft, open-house / price-drop badges where data exists (§0).  
3. Hover sync QA + photo-capable marker popup.  

### Wave 3 — Pan performance (structural lite)

1. Single debounce; skip redundant idle fetch (Wave 0 partial).  
2. Pin-lite pan payload or lower cap for dense zooms.  
3. Sticky/approx count on pan; exact count on settle/filter apply.  

### Wave 4 — Map depth (from SEARCH_OPTIMIZATION Phase 2)

Radius live readout, named areas, layer toggles — only after Wave 1–3.

---

## 6. Wave 0 definition of done (immediate)

| Check | Pass |
|-------|------|
| Plan in `docs/plans/SEARCH_UX_WAVE3_PLAN.md` | yes |
| G3 Blended closed in EXECUTION_QUEUE | yes |
| SSR: session and boundary start in parallel for split | yes |
| Client: initial map settle does **not** fire viewport refetch | yes |
| Gates: `npm run push` green | yes |
| Manual: cold load still shows Bend homes; pan still updates | yes |

---

## 7. Explicit non-goals (this wave set)

- Replacing PublicNav with mockup’s static SiteHeader  
- Inventing new filter fields  
- Claiming 10× leads from search chrome alone  
- Full FlexMLS GIS overlay stack  

---

## 8. Pointer

| Field | Value |
|-------|--------|
| **NOW** | Wave 0 code (P1 + P2) then Wave 1 chrome |
| **THEN** | Wave 2–3 |
| **MEASURE** | TTFB, first idle network (no spurious getViewportSearch), pan RTT |
