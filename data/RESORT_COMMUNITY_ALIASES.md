# Resort community aliases

`data/resort-communities.json` is the 19 featured parents and their correct children.

**Aliases come from a recorded county plat, a published HOA / TOA name, or an MLS `SubdivisionName` that actually files under that parent.** Do not assign children with Spark `/listings/nearby` plus a 2–6 km ≥80% inside-test. That 2026-05-15 method pulled in neighbors.

## Nest

City › Neighborhood › Planned community › Subdivision › Listings. Skip a level when none.

City of Bend has 13 official Neighborhood Districts (bendoregon.gov/neighborhood-districts). Shevlin is not one of them.

Tetherow is a Census CDP, mostly outside Bend city: Deschutes County › Tetherow CDP › Tetherow community › TOA neighborhood or recorded plat. Do not nest Tetherow under Summit West or Century West except the four in-city plats (Tetherow Phase 1, Phase 2, Phase 6, North Forty At Tetherow).

Tetherow Crossing in Redmond is a different recorded plat. Do not mix it with Tetherow.

The Glen, Heath, Tartan Druim, Triple Knot, and Crescent are TOA / marketing names. They live in `sub_neighborhoods` with `kind: toa_marketing` and a `recorded_plat` when known (The Glen → Tetherow Cascades Vista).

Pronghorn and Juniper Preserve are one parent. The resort rebranded in 2022. The club is still The Pronghorn Club.

## When you add an alias

1. Name the plat or HOA source.
2. Confirm the MLS string if you are matching listings (`listings."SubdivisionName"`).
3. Keep the 19 parents. Do not dump the 1,645 Bend plats into this file.
4. Apply a `neighborhood_subdivisions` migration in the same delivery as the JSON change.
