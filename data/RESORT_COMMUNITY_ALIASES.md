# Resort community aliases

`data/resort-communities.json` is the featured major resort / MPC / golf parents and their correct children. Not every subdivision is in a planned community. Do not dump the 1,645 Bend plats into this file.

**Aliases come from a recorded county plat, a published HOA / TOA name, or an MLS `SubdivisionName` that actually files under that parent.** Do not assign children with Spark `/listings/nearby` plus a 2–6 km ≥80% inside-test. That 2026-05-15 method pulled in neighbors.

## Nest

City › Neighborhood › Planned community › Subdivision › Listings. Skip a level when none.

City of Bend has 13 official Neighborhood Districts (bendoregon.gov/neighborhood-districts). Shevlin is not one of them. Other cities have no official neighborhood set — do not invent realtor names.

Tetherow is a Census CDP, mostly outside Bend city: Deschutes County › Tetherow CDP › Tetherow community › TOA neighborhood or recorded plat. Do not nest Tetherow under Summit West or Century West except the four in-city plats (Tetherow Phase 1, Phase 2, Phase 6, North Forty At Tetherow).

Tetherow Crossing in Redmond is a different recorded plat. Do not mix it with Tetherow.

The Glen, Heath, Tartan Druim, Triple Knot, and Crescent are TOA / marketing names. They live in `sub_neighborhoods` with `kind: toa_marketing` and a `recorded_plat` when known (The Glen → Tetherow Cascades Vista).

Pronghorn and Juniper Preserve are one parent. The resort rebranded in 2022. The club is still The Pronghorn Club.

Seventh Mountain is a Census CDP. Inn of the 7th Mountain and Widgi Creek stay featured tiles under that CDP. Do not copy their MLS aliases onto the CDP parent.

## Kind

Each parent has `kind`:

| kind | Meaning |
|---|---|
| `planned_community` | Master-planned / HOA community without a featured private course |
| `golf_community` | Residential community organized around a course |
| `planned_and_golf` | MPC that also has a private or resort course |
| `public_golf` | Public course plus a small residential cluster |
| `cdp` | Census place that holds nested featured tiles |
| `resort_village` | Destination lodging / village, not a full MPC |

Geographic nest is `nest.kind` (`census_cdp` / `bend_district` / `unincorporated`), not `kind`.

## Parents added 2026-08-20

| slug | kind | nest | Source |
|---|---|---|---|
| `discovery-west` | planned_community | Bend › Summit West | Brooks MPC. Live MLS phases 1–9 (321 Bend rows). Not NWX. |
| `tree-farm` | planned_community | Unincorporated (west of Summit West) | Brooks The Tree Farm. MLS `Tree Farm` (69 Bend). County plat + polygon file. |
| `westgate` | planned_community | Unincorporated (west of Summit West) | MLS `Westgate` Bend only (132). Grants Pass Westgate is a different plat. |
| `seventh-mountain` | cdp | Seventh Mountain CDP | Census CDP. 0 MLS rows under this name. Inn + Widgi nest here. |
| `petrosa` | planned_community | Unincorporated east Bend | Brooks eastside MPC. MLS `Petrosa` (450 Bend). Outside the city district mesh. |
| `shevlin-commons` | planned_community | Bend › Summit West | Brooks PUD. MLS `Shevlin Commons` (266). Not a Shevlin district. |

Public-only courses and south-gap subdivisions are in the JSON `rejected` array (Lost Tracks, Juniper Golf, Quail Run, Aspen Lakes, Bend Golf Club, Meadow Lakes, Deschutes River Woods, River Rim, Woodside Ranch, River Bend Estates, Sunset View Estates).

## When you add an alias

1. Name the plat or HOA source.
2. Confirm the MLS string if you are matching listings (`listings."SubdivisionName"`).
3. Keep this file to major parents. Do not dump the 1,645 Bend plats into it.
4. Apply a `neighborhood_subdivisions` migration in the same delivery as the JSON change.
