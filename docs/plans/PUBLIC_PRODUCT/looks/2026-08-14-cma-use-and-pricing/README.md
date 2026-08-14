# CMA use-of-property + pricing pages (2026-08-14)

Baseline reviewed: `~/Downloads/CMA-3480-SW-45th-Redmond.pdf` (hand-crafted July 2026). That document priced clearly and had no zoning or rental answers.

What changed in the generator:

- **What this property can do.** Zone masthead, glance row (add a unit, split the lot, long / mid / short rent), then Build and Rent boards with the full cited detail. Short-term rental stays under Rent. No invented nightly rate.
- **How this home is priced.** Recommended list, matcher rules we can defend (close = contract, quality stop, 15% / 30% neighborhood cut), adjustment table, three tiers, three checks.

Preview uses the live Redmond R-2 resolver at 0.23 acres (3480 SW 45th facts). Existing stored CMAs do not change until rebuilt.

Regenerate: `npx tsx scripts/_preview-cma-use-pricing.ts`

Looks live under the Public Product package so they are not a rogue plan.
