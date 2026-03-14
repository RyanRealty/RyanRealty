# Listing Page Audit — vs. Competitive Instructions (cursor-listing-page-instructions.md)

**Audit date:** Per instructions (early 2026 benchmark).  
**Benchmark:** Zillow, Redfin, Realtor.com + Ryan Realty luxury positioning.

---

## Phase 1 — Current State vs. Required Section Order

### Required order (from instructions)
1. Media Gallery  
2. Price + Address + Status Badge  
3. Key Facts Strip  
4. What Makes This Property Special  
5. Property Description  
6. Property Details  
7. Community Section  
8. Location and Neighborhood  
9. Monthly Cost Estimator  
10. Market Context  
11. Similar Listings  
12. Agent Contact / Schedule Showing  

### Current order on page
1. **ListingHero** — Media (video first, then photos); full width; photo count, keyboard nav ✓  
2. **Header** — BackToSearchLink (when from search or ?return=), "All listings", prev/next nav ✓  
3. **Breadcrumb** — Present ✓  
4. **Area banner** — "Explore homes in {area}" link (optional; competes with section 1–2 focus)  
5. **Title row** — MLS#, address, cityStateZip, **price**, monthly payment link, Save + Share  
6. **Key facts** — Beds, baths, sq ft, acres, year built (no icons; labels only)  
7. **CTA (mobile)** — ListingCtaSidebar  
8. **Location** — Map (CollapsibleSection)  
9. **Floor plans**  
10. **Videos & virtual tours**  
11. **Other listings at this address**  
12. **Similar listings** ("Other homes in this community")  
13. **Documents**  
14. **Price & status history**  
15. **Full details & description** (ListingDetails)  
16. **CTA (desktop)** — Sticky sidebar  

### Gaps (resolved or remaining)
- ~~What Makes This Property Special~~ → **Done** (ListingSpecial).  
- ~~Community Section~~ → **Done** (ListingCommunitySection).  
- ~~Monthly Cost~~ → **Done** (dedicated section + calculator link).  
- ~~Market Context~~ → **Done** (CollapsibleSection with price/sf, DOM, history).  
- ~~Key facts / status~~ → **Done** (icons, dominant price, color status badge).  
- ~~Gallery count/keyboard~~ → **Done** (photo count, arrows + Escape in lightbox).  
- ~~Similar listings empty~~ → **Done** (min 4 fallback by subdivision/city).  
- ~~Save count~~ → **Done** ("X people have saved this home").  
- ~~Agent CTA mailto~~ → **Done** (modals, listing_inquiries + FUB).  
- ~~Back to Search~~ → **Done** (BackToSearchLink when from search or ?return=).  
- **Remaining (optional):** Map satellite/toggle, lot polygon; auto-advance in gallery; social share buttons beyond copy/email/text per agent preference.  

---

## Implementation status (Phase 2)

- [x] **2A Media:** Full-width ✓. Photo count ("1 of N"), keyboard nav (arrows + Escape in lightbox), first image priority; lazy load below fold. Auto-advance and satellite map toggle not implemented.  
- [x] **2B Price/Status/Key facts:** Price dominant, status badge color, key facts with icons, price/sf in strip.  
- [x] **2C What Makes This Property Special:** New section (ListingSpecial: first 3–5 sentences + top feature tags).  
- [x] **2D Property Details:** Accordions (Interior, Exterior, Community, Utilities, HOA & fees, Legal & tax); HOA + rental notice prominent; "More details" fallback.  
- [x] **2E Community Section:** ListingCommunitySection for city+subdivision with description, amenities snippet, link to search.  
- [x] **2F Monthly Cost Estimator:** Dedicated section with estimate + link to calculator (no login).  
- [x] **2G Market Context:** Price/sf, DOM, price history in CollapsibleSection.  
- [x] **2H Save/Like/Share:** Save visible ✓; "X people have saved this home" when count > 0; ShareButton (copy, email, text) on listing page.  
- [x] **2I Agent CTA:** Modals for Schedule Showing + Ask a Question; pre-fill; Supabase `listing_inquiries` + FUB.  
- [x] **2J Similar Listings:** Min 4 fallback (subdivision → city); max 8; section always shown with fallback text when empty.  

---

## Phase 3 — Navigation & quality

- [x] Breadcrumb: present. **Back to Search Results:** `BackToSearchLink` in header when referrer is `/search/` or `?return=...`; supports `searchParams.return` for deep links.  
- Footer: instructions say do not show until past primary content.  
- Typography: price largest; body min 16px, line-height 1.6; section spacing 48px+.  
- Performance: first image priority; lazy load below fold; skeleton for estimator and similar listings optional.
