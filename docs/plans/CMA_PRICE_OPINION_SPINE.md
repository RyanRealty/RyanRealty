# CMA price-opinion spine

**Graph class:** broker-tools look + sales-insights pricing. Not a Quince one-off.
**Numbers:** `lib/pricing/` only. Do not invent a second list or close.
**Covers:** inbound, expired, FSBO, rebuild. Print HTML and immersive HTML share one chapter order. PDF is that story paginated.

Matt ADD 2026-08-17. Requirement R-218. Version residual G16. Gate `ci:cma-opinion-spine`.

## The ten items (every CMA)

1. Price opinion only. Kill “how we would market” and “what we would do.”
2. One spine. Each section makes the next one necessary.
3. Price first. The number, then why, then everything else.
4. Who they compete with. Same pricing rungs that set the number, applied to Active listings. Named actives only. Not a second product-class dump and not a pending lane.
5. The sales that set the number, next. Five when the search has them, three at the floor. Tap a house, see the pin.
6. This subdivision. The street, not the priced set. Branded polygon, a short talk, then the charts we already have.
7. Then the wider market as citywide cache charts: months of supply, median sold. Not a 90-day sold band from a different set.
8. Mobile first. Same chapters on desktop. PDF is that story paginated. Map and taps work on the web.
9. Seller language. No confidence pills, no “not the ZIP,” no query lines.
10. Rebuild from this spine. Do not CSS-pass the old pitch.

RPR density we absorb (our look, our number, never their AVM):

11. County ownership chain and permits of record, for every county we can resolve — not only the current owner, and not only rural parcels. Deschutes DIAL deed table + permit table. Seller chapter. Agent notes stay on the admin row.
12. Charts are labeled. Caption, Y ends with units, X ends, one series per chart. Dual-axis and unlabeled lines are banned. Draw through `lib/charts/plot` + `print-svg`.
13. Seller net after ownership. Print is a static estimate. The web view lets the owner change sale price, fees, concessions, title, and mortgage payoff. Current loan balance is not a public Oregon record. Remaining principal, when shown, is an 80 percent loan on the last recorded purchase amortized at the Freddie Mac 30-year rate for that week. The owner types the lender payoff.

## What the graph must load

A session that touches a CMA document or the pricing unit reads this file and `lib/pricing/classes.ts` before changing copy or chapter order. `DOMAIN_REQUIRED_READS` for `broker-tools` and `sales-insights` points here so the next loop-brief cannot work the domain cold.

## What stays computed but unpublished

`listingPlan` and `thisHomePlan` may still be built on the row for admin. They do not render on the seller document. First-touch SMS (`composeThisHomeMarketClause`) is outreach, not this document.

## Accept

- `lib/cma/opinion-spine.test.ts` green
- `ci:cma-opinion-spine` green
- Cover leads with expected sale / recommended list
- Named band rivals that pass the same pricing rungs as the priced set, when inventory exists
- No marketing pitch, confidence pill, or ZIP line in seller CMA HTML
- Ownership chapter when DIAL returns a deed or permit row
- Print charts carry a caption and axis ends
