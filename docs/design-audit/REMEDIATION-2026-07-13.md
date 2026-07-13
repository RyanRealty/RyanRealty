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
- ⬜ NAV-1..9 + CMP-1: unify KbNav ↔ SiteHeader into one component (transparent/solid variants, one IA, one CTA set, one megamenu, one drawer, one footer)

## Batch D — imagery + content polish
- ⬜ CMP-2 hero photo variety across blog/about/market/utility
- ⬜ TRU-5 community photos misrepresenting place
- ⬜ remaining P2/P3 per-page nits (buy CTA, faq headers, mortgage tool framing, reviews mobile cap, login provider parity, etc.)

## Final review pass
- ⬜ one dedicated end-to-end review over every changed surface

---
### Log
- 2026-07-13: started remediation. Pre-commit = brand-voice + vitest; pre-push = tsc on committed tree; full ci:gates in CI on push.
