# Phase 9 Wave 2 — Community page KB rebuild + lock golf/resort/master-planned

**Status:** in progress (2026-06-17). Plan-of-record: [docs/KB_CONVERGENCE_ROADMAP.md].

## END-TO-END GOAL (do not stop at the next step)

Rebuild `/communities/[slug]` — the page class where every golf / resort /
master-planned community lives (Tetherow, Broken Top, Pronghorn, Widgi Creek,
NorthWest Crossing, Awbrey Glen, …) — in the KB (kinetic-brutalist) design system,
reusing the shared `components/site/kb/*` library exactly as the city page does (no
fork). Carry the PAGE CONTRACT (SEO JSON-LD Breadcrumb/Place/Dataset/FAQPage +
section/interaction tracking). **Lock the golf/resort/master-planned definitions
behind gates so the hard-won data work (alias-aware counts, is_resort membership,
RESORT_IMG, boundary-reliability) can never silently regress.** Done = architecture +
implementation + tests + review + the real rendered result all meet the bar, verified
end-to-end in a real browser across resort, unreliable-boundary, and plain-subdivision
cases.

## DECOMPOSITION (independent pieces → parallel agents)

| Piece | Deliverable | Files (no overlap) | Verification | Done standard |
|---|---|---|---|---|
| **A — Page** | KB rebuild of the community page | `app/communities/[slug]/page.tsx` | tsc + build + browser | Full KB section stack, community-scoped, boundary-reliability preserved, alias-aware count, PAGE CONTRACT |
| **B — Tracker** | `CommunityPageTracker` | new component file | imported + renders | mirrors CityPageTracker, fires community view + section events |
| **C — Lock gate** | G53 resort-definition gate | `scripts/check-resort-definitions.mjs` + package.json | gate passes on current tree | asserts registry integrity + alias-aware count + RESORT_IMG coverage + is_resort filter + paginated fetch |
| **D — Chrome/parity** | parity.json + HideChrome + loading | `ui_kits/community/parity.json`, `app/layout.tsx`, `app/communities/[slug]/loading.tsx` | ci:mockup-parity + build | KB component set; default chrome hidden on /communities/[slug] |
| **E — Tests** | community contract tests | `components/site/__tests__/site-contracts.test.ts` (append) | vitest | D-series locks the new page's structure + SEO + tracking |
| **F — Verify+review** | browser e2e + adversarial review | (read-only) | Playwright on prod build | resort + unreliable-boundary + plain cases all correct (§0) |

## INVARIANTS TO PRESERVE (community-specific, do not break)
- **Boundary reliability**: oversized polygons (Broken Top 11,496 acres vs ~450 real)
  must NOT draw + must NOT drive counts; fall back to MLS subdivision-name listings.
- **Resort active count** = alias-aware via `lib/kb/resort-active-counts` (same number
  the city ledger shows). Never the literal-name undercount.
- **Resort vs plain**: `getResortCommunityBySlug` / `is_resort` gates sub-neighborhood
  + HOA rendering; plain subdivisions render the simpler stack.
- **§0 data accuracy**: every figure traces to a DAL source; em-dash when unavailable.

## PROGRESS LOG
- 2026-06-17: goal written, decomposition set, foundations workflow dispatched.

## REVIEW PASS (4-agent adversarial workflow) — fixed + deferred

Fixed (this commit):
- **BLOCKER** compound resort slug `/communities/bend-tetherow` rendered a DUPLICATE page
  with the literal-name undercount → now redirect()s to the canonical bare slug
  (`/communities/tetherow`, count 43). Verified in browser.
- **HIGH** alias match was bare `startsWith` (generic aliases like "Triple"/"Braeburn"
  could over-attribute) → token-boundary `aliasMatches` (=== or `prefix + ' '`). Verified
  against live data: NO current over-match; counts unchanged (Widgi 48, Tetherow 43).
- **HIGH** resort hero showed 0 when the paginated city fetch timed out → gated on a
  non-empty tile set, falls back to boundary/community count.
- **HIGH** G53 only locked the CITY page → extended to also lock the COMMUNITY page wiring
  (alias-aware count + resortTilesForSlug + cityResorts + boundary guard + RESORT_IMG + redirect).
- **MEDIUM** sub-neighborhood ledger (fabricated 0-count, mislabeled parent median, self-links)
  → dropped (registry has no per-sub data; resort/HOA context lives in About facts).
- **MEDIUM** paginated fetch could repeat rows at the page boundary → deduped by listingKey
  (applied to BOTH the city + community pages).
- Deleted the orphaned/stale G32 `check-community-page.mjs` (not wired; asserted the removed
  Experience component set).

Deferred (tracked, NOT a wave-2 regression — pre-existing + shared components):
- **Market HUD YoY pill** ("↑ X% median sale, N mo") sits next to the "Median list price"
  headline — a careful reader could conflate list vs sale basis. Shared KbMarketHud (homepage +
  city + community), shipped earlier. Fix properly in a dedicated pass with a true YoY field
  (`market_stats_cache.yoy_median_price_delta_pct`) + cross-surface re-verification.
- a11y polish on shared components: breadcrumb-over-photo contrast, FAQ redundant landmark,
  MapLibre marker keyboard operability, section landmarks lack accessible names. Batch into a
  dedicated KB a11y pass (affects every KB page, not just community).

Verified after fixes: tsc + prod build + 52 gates + 633 tests; browser e2e confirms the redirect,
Widgi 48/48/48 consistency, plain communities (petrosa), and no neighborhoods section.
