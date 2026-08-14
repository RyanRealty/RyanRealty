# CMA use-of-property + pricing pages (2026-08-14)

Baselines reviewed:

- Hand-crafted July 2026 CMA (`CMA-3480-SW-45th-Redmond.pdf`). Priced clearly. No zoning or rental answers.
- RPR packet Chris sent (`56628 Sunstone Loop`, 30 pages, 2026-08-12). That is the working sample in the field. It is an AVM plus ZIP 97707 charts, not a CMA. Four of five "comps" are off-market estimates with $0 adjustments. One closed sale. Refined value $2,423,333. Stale CMA value $2,499,000 from 2026-03-17. ZIP months of supply 8.68 labeled seller's market. Live Caldera Springs cache the same day: 39 closed, median $1,790,000, 22.15 months of supply, buyer's market. City=Bend on that listing would have pulled Bend's 3.62-month seller's-market read. The generator now reads the resort neighborhood first.

What changed in the generator:

- **What this property can do.** Zone masthead, glance row (add a unit, split the lot, long / mid / short rent), then Build and Rent boards with the full cited detail. Short-term rental stays under Rent. No invented nightly rate.
- **How this home is priced.** Recommended list, matcher rules we can defend (close = contract, quality stop, 15% / 30% neighborhood cut), adjustment table, three tiers, three checks.

Preview uses the live Redmond R-2 resolver at 0.23 acres (3480 SW 45th facts). Existing stored CMAs do not change until rebuilt.

Regenerate: `npx tsx scripts/_preview-cma-use-pricing.ts`

Looks live under the Public Product package so they are not a rogue plan.
