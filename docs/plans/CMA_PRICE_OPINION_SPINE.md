# CMA price-opinion spine

**Client chapters:** `docs/plans/CMA_SUNSTONE_CONTRACT.md` wins. This file is voice + no-pitch + numbers-from-pricing. It does not override Sunstone's 16 chapters. Do not clone Tumalo.

**Graph class:** broker-tools look + sales-insights pricing. Not a Quince one-off.
**Numbers:** `lib/pricing/` only. Do not invent a second list or close.
**Covers:** inbound, expired, FSBO, rebuild. Print HTML and immersive HTML share one chapter order. PDF is that story paginated.

Matt ADD 2026-08-17. Requirement R-218. Version residual G16. Gate `ci:cma-opinion-spine`. Client-spec gate `ci:cma-exemplar`.

## The ten items (every CMA)

1. Price opinion only. Kill “how we would market” and “what we would do.”
2. One spine. Each section makes the next one necessary.
3. Price first. The house photo is the cover. The recommended list sits on it. The list range sits under that number. Expected close stays off the seller page. Then why, then the Sunstone chapters.
4. Who they compete with at that price. Named actives and pendings in the same band. Not a city dump.
5. The sales that set the number, next. Every priced sale, not a hard stop at three. Tap a house, see the pin.
6. This subdivision. Branded polygon, a short talk, then the charts we already have.
7. Then the wider market as charts: 90-day sold band, months of supply, new-list trend. Not a table of every closed sale.
8. Mobile first. Same chapters on desktop. PDF is that story paginated. Map and taps work on the web.
9. Seller language. No confidence pills, no capsule chrome (pills, chips, badges), no “not the ZIP,” no query lines. The document is a principal-broker letter on cream stock. Type and hairline rules carry status. Not rounded capsules.
10. Rebuild from this spine. Do not CSS-pass the old pitch.

## What the graph must load

A session that touches a CMA document or the pricing unit reads this file and `lib/pricing/classes.ts` before changing copy or chapter order. `DOMAIN_REQUIRED_READS` for `broker-tools` and `sales-insights` points here so the next loop-brief cannot work the domain cold.

## What stays computed but unpublished

`listingPlan` and `thisHomePlan` may still be built on the row for admin. They do not render on the seller document. First-touch SMS (`composeThisHomeMarketClause`) is outreach, not this document.

## Accept

- `lib/cma/opinion-spine.test.ts` green
- `lib/cma/letter-register.test.ts` green
- `ci:cma-opinion-spine` green
- Cover leads with expected sale / recommended list
- Named band rivals when inventory exists
- No marketing pitch, confidence pill, capsule chrome, or ZIP line in seller CMA HTML
