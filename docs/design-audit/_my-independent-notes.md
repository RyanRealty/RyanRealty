# Independent senior-lead notes (my own read, pre-workflow-synthesis)

Baseline formed by directly reviewing: home, search, listing-detail (+rail), sell, contact, reviews, 404, empty-search state. Reconcile the workflow findings against these; a finding I saw with my own eyes and the workflow missed = the workflow under-covered; a finding the workflow raised that contradicts what I saw = verify hard.

## Confirmed with my own eyes

1. **Two navigation systems (P0/P1, understanding+trust).** Homepage/listing/geo/marketing pages use KbNav (UPPERCASE: HOMES · COMMUNITIES · CITIES · SELL · ACCOUNT · MENU+). The **search results page** (`/homes-for-sale`) + legal/report pages use the old SiteHeader (Title Case: Homes · Sell · Market · Guides · About + Sign in · Get listing alerts · What's my home worth). Different items, order, casing, auth entry (ACCOUNT vs Sign in), and CTAs. The seam sits *inside the primary buyer funnel* (click HOMES → land on a differently-chrome'd page). Architectural: 58 pages KbNav, ~28 SiteHeader. Fix = migrate search onto KbNav (or unify) — RECOMMENDATION, large.

2. **Low-contrast hero eyebrow kicker (P2, understanding — QUICK WIN).** `.hero-tag{color:var(--cream-70)}` in kb.css, no text-shadow → the "• CENTRAL OREGON REAL ESTATE" / "• READ OUR REVIEWS" / "• SELL WITH RYAN REALTY" kicker drops below readable contrast over the bright areas of the hero photo. Seen on home, sell, contact, reviews. Fix = bump to full cream + subtle navy text-shadow on `.hero-tag`. Shared component, one CSS rule, safe, verifiable.

3. **Same hero photo reused across KB pages (P2, trust/polish).** The identical Old Mill drone photo is the hero on home, contact, AND reviews. Reads as templated; erodes the premium feel. Fix = vary hero imagery per page (reviews→client/handshake, contact→office/map). RECOMMENDATION, medium.

4. **Same two generic hero CTAs on every KB hero (P2, conversion).** "BROWSE →" and "HOME WORTH?" appear in the hero of home AND reviews regardless of page intent. On a reviews page the relevant CTA is "work with us / leave a review," not "home worth." Fix = page-appropriate hero CTAs. RECOMMENDATION, medium.

## Strong positives (state plainly — do not manufacture problems here)

- **Homepage hero** is excellent: full-bleed Old Mill drone, big Amboqia display H1, natural-language search ("3 bed under $800k in Bend with a shop"), live stat line (1,871 homes · median list $742,000 · pending in 20 days), Browse/Home-worth CTAs.
- **Search results** = Zillow-class: split map + cards, filter pills (For sale/Price/Beds/Baths/Home type/More), sort, Split/List/Map toggle, Save this search. High quality.
- **Listing detail** conversion module is strong: sticky "TALK TO A BROKER" rail — broker headshot + license #, "SCHEDULE A TOUR" primary + CALL/TEXT, phone, email, 5.0★ 25 Google reviews + testimonial. (My earlier "no CTA" worry was wrong — it's below the hero, not in it. Adversarial verify should catch any per-page agent that over-claims this.)
- **Sell page** conversion: single address field + "GET MY HOME VALUE" + "Prefer to talk first? Call 541.703.3095" (FUB-tracked bio number, correct).
- **404 page** is a good recovery experience: clear message + search box + 3 recovery links + homepage link.

## Gaps / caveats to disclose in the report

- **Empty-search zero-results state NOT verified.** My `?priceMin=90000000` probe was ignored by the slug-based search (page rendered full results). Report must say the true zero-results empty state is unverified and recommend a manual check.
- Phone numbers differ by surface (541.213.6706 brand direct, 541.703.3095 FUB bio, 541.502.3436 per-broker on listing rail). Likely intentional (attribution), note only if a single surface is inconsistent.
- Possible listing address-suffix mismatch: listing H1 "225 VINE LANE" vs in-photo label "225 SE Vine St." Flag as a possible data concern, low confidence, out of core UX scope.

## Resolutions after cross-cutting workflow (verified)

- **Empty search state = GOOD (positive, verified).** `/homes-for-sale?minPrice=90000000&beds=8` → "NO MATCHES / No homes match these filters here / Loosen a filter, or zoom out... / [Clear all filters]" + removable filter chips. Captured `state-search-empty-real-desktop/mobile.png`. Code: `components/search/SearchResults.tsx:95` (`showEmptyState = total===0 && hasActiveFilters`), `MapSearchView.tsx:402/421`. My earlier gap is closed — this is a strength, not an issue.
- **"Floating N badge" finding = FALSE POSITIVE → EXCLUDE.** Definitively the Next.js dev-mode indicator: live DOM shows `nextjs-portal` present + dev-tools button in shadow root; no production bottom-left badge element exists (only `.topbar` + `#menu-overlay`). It appears only because capture ran against `next dev`; absent in production. Disclose in methodology. Correct the home first-impression finding to eyebrow-contrast only (drop "obscured by N").
- **Cookie consent = present & compliant (trust positive).** Banner offers Accept all / Essential only / Preferences / "Do Not Sell My Personal Information" — privacy-respecting.
- **Cross-cutting verify outcomes to honor:** the P0 two-headers stands; several nav P1s were correctly DOWNGRADED to P2 by the adversarial pass (casing-not-typeface; auth-label is 2 not 3 ways; persistent-CTA claim overstated because home hero carries search+HOME WORTH). Use the corrected `_severity_final`, not the raw severity. The "ALL-CAPS serif" claim was wrong — both navs are sans (Geist); the real nav delta is casing + header shell + IA + CTAs.
- **Strong cross-cutting catches to keep:** listing broker mismatch desktop (Paul Stevenson) vs mobile sticky bar (Matt) — real P2, same home names two contacts; LP orange CTA/stars off-brand vs navy system (P2); listing-not-found renders headerless/orphaned vs the polished global 404 (P2); sell double-valuation-hero + address re-ask (P2); currency format mix $742,000 vs $742K vs $550K (P3).
