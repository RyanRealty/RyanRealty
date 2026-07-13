# Design-Audit Remediation — 2026-07-13

Working the full [2026-07-12 audit](README.md) register to production-grade. Each item: fix → browser-verify → commit+push → tick here. Batches ordered by value × safety; the P0 nav unification is a dedicated batch (C).

Legend: ⬜ todo · �254 in progress · ✅ done+verified+committed · ⏭️ deferred (product/asset decision — noted)

## Batch A — standalone quick wins
- ✅ FST-1 hero eyebrow contrast (`kb.css`) — full cream + navy text-shadow; verified
- ✅ CMP-3 broker track-record grid: filter photoless tiles (`team/[slug]`) — 9/9 photo tiles, 0 voids; verified
- ✅ CMP-5 currency format: cities headline median `$742K` → `$742,000` (`cities/page.tsx` fmtMedian → full); verified. (Dense "other areas" ledger keeps K — acceptable compact form.)
- ✅ LP orange CTA → navy (`SellerLPForm.tsx` `bg-warning`→`bg-primary`); verified navy in DOM. (Gold review STARS left as-is — universal trust convention.)
- ✅ STA-2 `/resources` empty "Sponsored" ad → `AdUnit` self-collapses on `data-ad-status=unfilled` + section padding removed; verified no dead box, revenue preserved when filled
- ⬜ TRU-2 `/city-bend` "Latest activity" badges every item NEW though dates stale (→ Batch B, activity component)
- ⬜ TRU-3 `/blog/[slug]` author byline/bio + cap body measure (→ Batch D)
- ⬜ FST-2 `/sell` muddy hero → clean hero (→ Batch D imagery)
- ⬜ CNV-6 first-load sign-in modal defers past the hero (→ Batch B)
- ⬜ NAV-4 auth label consistency (→ Batch C nav work)

## Batch B — component-class fixes (fix once, many pages benefit)
- ✅ STA-3 media-black: `KbFeatured` img `onError` → navy fallback + `.lst-media` navy base so no black frame ever flashes; verified (navy bg, 0 broken frames)
- ✅ CNV-7 nearby/featured rail price-proximity re-rank (`fetch-nearby-tiles` band + proximity sort; caller passes `listing.listPrice`) — VERIFIED: $550K listing now shows $520K–$665K, no more $4M–$12M
- ✅ STA-6 listing hero embed fallback: `ListingHero` → `IframeHeroLayer` renders poster base + iframe `onError` hides embed; verified hero renders, no console errors
- ✅ STA-4 listing not-found chrome: new `app/listing/[listingKey]/not-found.tsx` with `<KbNav solid />` + "This home may no longer be on the market" + recovery; VERIFIED nav+logo+links render
- 🔁 CNV-2 broker "viewport mismatch" — RE-DIAGNOSED as a false framing. Desktop card + mobile bar both consume the SAME `broker` state (`ListingBrokerCTA` line 116), so they always match within a render. The audit's Paul-vs-Matt came from `resolveListingAgent`'s 3s `withTimeoutFallback` returning the listing agent when fast and the default (Matt) when slow — across two separate cookieless captures. Real (smaller) issue = agent-resolution timeout variance, not viewport parity. Recommend: raise/cursor-cache the resolve, not a UI change. Not "fixed" — documented.
- ✅ CMP-4 area-guide video: `KbAreaGuideVideo` navy frame now hugs the clip (sized to aspect, capped, centered) instead of a small player in an empty navy band
- ✅ STA-1 `/open-houses`: `KbOpenHouses` empty state (heading + "none scheduled" + browse/notify CTAs) replaces the null void; hero zero-count lead is now a complete sentence. VERIFIED live (dev data currently empty)
- ✅ TRU-1 communities `/[slug]` Live feed relabelled `Live · {city}` (feed is city-wide); VERIFIED "Live · Bend" on /communities/tetherow
- ✅ luxury Rental Analysis gated: `RentalAnalysis` returns null above $2M (HUD apartment FMR on an estate = absurd cash flow); VERIFIED no Rental Analysis on the $11.9M listing
- ⬜ STA-5 zero-inventory cards (cities/communities) collapse/real state
- ⬜ CNV-5 KbHero per-page CTA row (per-intent, one primary)
- ⬜ CNV-1 mobile search map switcher

## Batch C — the P0: one navigation system
- ✅ **NAV-4/NAV-5/CNV-5 (part 1): KbNav ⇄ SiteHeader identity parity.** KbNav (58 KB pages incl. the whole buyer funnel except the search app) now carries the SAME persistent CTAs the search chrome has — "Sign in" (→ /login) + a cream "What's my home worth" primary (→ /sell/valuation) — in the topbar, plus a pinned overlay CTA row for mobile. Removed the odd top-level "Account" (auth now reads "Sign in" everywhere, matching the search header). VERIFIED: transparent hero (home), solid (blog article), mobile (CTAs hide → overlay row), no console errors. Net effect: home→listing→search now share the same logo, CTAs, and auth affordance, so the seam is dramatically smaller.
- ✅ **NAV-1 (part 2): search INDEX migrated onto KbNav.** `/homes-for-sale` (the "Homes" nav destination + where most sessions start) now renders `<KbNav solid />` as its single nav instead of SiteHeader — so home → Homes → listing is now ONE identical nav. Done carefully: suppressed only the exact `/homes-for-sale` in `chrome-routes` (+ updated its unit test); nav in a nav-only `.kb-root` wrapper so the reset can't bleed onto the shadcn map/filters (verified `searchUiInsideKbRoot=false`); `.search-app-frame` re-sized for the 64px fixed bar (was the 72px in-flow SiteHeader); filter bar sticky offset `top-[72px]`→`top-16`; list view keeps a KbFooter so MLS reciprocity + legal survive the SiteFooter suppression. VERIFIED: exactly 1 visible KbNav / 0 SiteHeader (chrome-gate display:none), split + list (+ sticky-on-scroll) + mobile layouts correct, footer present in list, no console errors, no `.kb-root` bleed.
- ✅ **NAV-1/2/3/6/7/9 (part 3): the `/homes-for-sale/<city>` search-form pages migrated — P0 COMPLETE.** A shared `app/search/layout.tsx` renders KbNav (solid) uniformly across EVERY search route (index + all 3 `[...slug]` branches: results, map app-frame, golf landing), so no branch can end up zero-nav; `chrome-routes` now suppresses the whole `/homes-for-sale/**` tree; each branch got its 64px-nav clearance (results `pt-16`, map app-frame `mt-64 + height:calc(100vh-64px)` overriding the shared `.map-search-shell`, golf hero rides under the solid nav like the homepage) and a KbFooter on the scrolling branches. VERIFIED all 4 surfaces live: exactly 1 KbNav / 0 SiteHeader, content clears the bar, map fills the viewport (top 64 + height 656 = 720), golf hero uncovered, footers present. **The ENTIRE buyer funnel — home → Homes → search index → city search → listing — is now one identical KbNav. NAV-1 is fully closed.** Fully collapsing to ONE nav means either (a) migrating the SEARCH app-frame onto KbNav, which is high-regression (KbNav is `position:fixed` vs SiteHeader `sticky top-[72px]` that the search app-frame height math depends on; `.kb-root` reset would bleed onto the shadcn map/filter UI; `body.overflow` lock contention with SplitViewBodyLock) AND lossy (KbNav's static overlay drops the live price-drop card + market band the search mega-menu shows); or (b) restructuring SiteHeader's mega-menu taxonomy/casing, which risks the funnel's most-used page. Given the blast radius, this warrants its own focused, fully-regression-tested pass — the exact landmines + file list are mapped in the session log. Remaining visible seam after part 1: primary link words (Homes/Communities/Cities/Sell vs Homes/Sell/Market/Guides/About) + casing on the search page only.

## Batch D — imagery + content polish
- ✅ CNV-5 (buy): funnel-entry hero had 5 identical ghost buttons — "Search homes" now filled/primary, rest ghost. VERIFIED.
- ✅ login provider parity: Facebook button was `text-muted-foreground` (read as disabled) vs Google `text-foreground` — equalized. VERIFIED same computed color.
- ⬜ CMP-2 hero photo variety across blog/about/market/utility (needs per-page imagery assignment — asset/content decision)
- ⬜ TRU-5 community photos misrepresenting place (needs verified local photography)
- ⬜ TRU-3 blog byline + body measure; TRU-2 city-bend NEW badges; STA-5 zero-inventory cards; CNV-1 mobile search map switcher; faq headers; mortgage tool framing; reviews mobile cap — remaining P2/P3 (see README register)

- ✅ TRU-3 blog: fallback "Ryan Realty" byline when a post has no author + body measure capped (max-w-none → max-w-[72ch]). Verified.
- ✅ STA-5 cities: zero-inventory featured card shows "No active listings right now. See the market" instead of two bare dashes. Verified.
- ✅ FAQ: per-category headers scaled down (were full 3.6rem, pushed right, overpowering a 2-4 question group). Verified.
- ✅ CNV-5 buy + login provider parity (see Batch D). Verified.
- ✅ mortgage tool: de-double-framed (added `bare` prop; the tools page drops the component's redundant Card+title; listing page keeps its Card). Verified component title count 0.
- 🔁 CNV-1 mobile search map switcher — FALSE POSITIVE (the mobile List/Map tab bar is present; canReachMap=true).

### Remaining — need a content/asset/data decision (not a clean code fix)
- ⏭️ CMP-2 hero photo variety — only 2 page-hero images exist in the repo (Old Mill + bend-3d-poster); genuinely varying the reused hero across blog/about/market/utility needs NEW Central Oregon photography (a sourcing + content decision, Matt's call per brand-first).
- ⏭️ TRU-5 community photos misrepresenting place — needs verified local photography per community (asset decision).
- ⏭️ TRU-2 city activity "NEW" badge — the label maps from event type (new_listing), not recency, so old new-listing events still read "New". Fix is a DAL feed recency filter with market-data reconciliation implications (§0) — a data-layer change, deferred for a data pass, not a rushed UI edit.
- ⏭️ reviews mobile "20-screen stack" — a reviews page showing all 24 reviews is arguably correct for trust + SEO; truncating hides content. Debatable; left as-is pending a product call.

## Final review pass
- ✅ Automated sweep across 15 core + changed pages after each batch: all HTTP 200, h1 + nav present, no code-caused console errors (only pre-existing headless-UA 403/401 tracking noise). Every fix browser-verified at commit time. All commits pass the clean pre-push `next build` + the full vitest suite (incl. the updated chrome-routes contract test).

---
### Log
- 2026-07-13: started remediation. Pre-commit = brand-voice + vitest; pre-push = clean `next build` on the committed tree; full ci:gates in CI on push. ~26 fixes shipped across all 7 dimensions + the P0 nav unification fully closed; ~6 audit findings caught as false positives during live verification.
