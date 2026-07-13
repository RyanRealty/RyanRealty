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
- ⬜ STA-3 media renders black while buffering → keep poster until `canplay` (`KbFeatured`)
- ⬜ CMP-3/team voids share the same fallback fix
- ⬜ CNV-7 nearby/featured rail price-proximity re-rank (`fetch-nearby-tiles`)
- ⬜ CMP-4 area-guide video branded chrome (`KbAreaGuideVideo`)
- ⬜ STA-4 listing not-found chrome (`app/listing/[listingKey]/not-found.tsx`)
- ⬜ STA-6 listing hero embed `onError → photos[0]` (`ListingHero`)
- ⬜ CNV-2 listing broker viewport mismatch (desktop vs mobile bar)
- ⬜ STA-1 `/open-houses` empty-state + zero-count copy
- ⬜ STA-5 zero-inventory cards (cities/communities) collapse/real state
- ⬜ TRU-1 communities `/[slug]` Live feed scope (city-wide → community or relabel)
- ⬜ CNV-5 KbHero per-page CTA row (per-intent, one primary)
- ⬜ luxury Rental Analysis gate above a price threshold
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
