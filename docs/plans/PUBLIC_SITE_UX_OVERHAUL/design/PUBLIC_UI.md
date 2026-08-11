# Public UI language v2 — working visual lock package (P5)

**Date:** 2026-08-11  
**Sacred only:** navy `#102742`, cream `#faf8f4`, Amboqia (display), Geist (body)  
**Mode:** Full reimagine. KB/Experience/legacy are not patterns to copy.

---

## Thesis

Ryan Realty’s public site is a **calm, data-honest decision instrument** for Central Oregon real estate — not a brochure collage and not a carnival. Every screen answers one job first. Live MLS truth is the product. Conversion is progressive, never needy.

## Principles

1. **One job per viewport** — one primary action.  
2. **Data as interface** — big Amboqia numerals only when §0-true; interactive where it helps decide.  
3. **Section rhythm** — never two equal card grids in a row; alternate ledger rows, split spines, full-bleed media, quiet proof.  
4. **Progressive disclosure** — fee matrices, long FAQs, deep filters behind clear openers.  
5. **One chrome** — same nav/footer/account language on every public money path.  
6. **Motion with purpose** — count-ups, map sync, state feedback; honor `prefers-reduced-motion`.  
7. **Empty/loading honesty** — no black video voids, no navy empty tiles as “content”.  
8. **Mobile = desktop job** — map, filters, valuation, tour intent all complete on 390.

## Density & type

- Display: Amboqia for H1 and key metrics only.  
- Body/UI: Geist; tabular nums for prices/stats.  
- Sentence case. No banned words. No emoji.  
- Spacing: large quiet margins; hairline rules (`--edge`) over heavy cards.  
- Surfaces: cream base, navy ink, white raised panels sparingly.

## CTA grammar

| Role | Style |
|---|---|
| Primary | Solid navy on cream (or cream on navy in navy bands) — **one per view** |
| Secondary | Ghost/outline |
| Tertiary | Text link |
| Destructive/rare | not used on public |

Global chrome: primary buy path + secondary “Value my home”.

## Chrome

- Top: logo · Buy · Areas · Market · Sell · About · phone · Value · Sign in  
- Mobile: bottom or sheet consistent with IA Option 1  
- Footer: compact columns from `lib/site-nav` projections — not a second sitemap novel  

## Section library (canonical jobs → primitives)

| Job | Primitive (v2) | Replaces (examples) |
|---|---|---|
| Intent hero | `V2Hero` (variants: buy, sell, geo, content, tool) | KbHero generic dual-CTA |
| Live stats band | `V2StatsBand` | KbMarketHud fragments, ad-hoc stats |
| Place mosaic | `V2PlaceGrid` | KbExploreTowns, KbCommunities |
| Listing results | `V2ListingResults` + map | SearchResults islands |
| Listing media | `V2ListingHero` | ListingHero patchwork |
| Broker sticky | `V2BrokerRail` | dual mobile/desktop broker bugs |
| Proof | `V2Proof` | KbTestimonials walls |
| People | `V2People` | KbTeam |
| Seller capture | `V2Valuation` | SellerLPForm + KbSell dupes |
| Alerts capture | `V2Alerts` | KbCommunityAlerts, RegionalSfrAlertsBand |
| FAQ | `V2Faq` | FAQBlock |
| Market chart | `V2MarketChart` | KbMarketChart |
| Map | `V2Map` | KbListingMap, search map |
| CTA band | `V2CtaBand` | assorted CTAs |
| Footer | `V2Footer` | KbFooter |
| Nav | `V2Nav` | KbNav + any residual SiteHeader |

Every SECTION_LEDGER canonical row maps to one row above (or merge/kill).

## Do / Don’t

**Do:** honest live counts, single broker name, map↔list hover sync, save criteria continuity.  
**Don’t:** tile walls, sliders/carousels as default, off-brand accent orange, invented stats, five equal hero buttons, mid-funnel chrome swaps.

## Reference screens (required before family ship)

Build static HTML under `design_system/public-v2/screens/`:

1. home  
2. search (map+list)  
3. listing  
4. sell  
5. about  

Until HTML exists, primitives implement this doc; screenshots at ship remain mandatory.

## Working visual lock

**Adopt this PUBLIC_UI.md + section library table as working visual lock** for primitive build and family migration. Matt may veto or amend in `decisions.md`.
