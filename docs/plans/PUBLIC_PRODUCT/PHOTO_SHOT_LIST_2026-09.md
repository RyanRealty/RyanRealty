# Photo shot list, September 2026

Why: the asset library holds 62 grade-A landscape photos wide enough for a page hero, and
nearly all are drone aerials. It has no grade-A house exterior, porch, interior, or snow scene,
and two rounds of generation could not pass the vision gate on any subject with a building
(docs/plans/PUBLIC_PRODUCT/AEO_GUIDES_2026-09.md, hero stills). These are the frames the
guides, the place pages, and the seller surfaces keep reaching for. One half-day in fall and
one morning after the first snow covers the list.

## Delivery

- Landscape, 3:2 or 4:3, at least 4000 px on the long edge. Blog heroes crop to 1600x1200.
  Place-page stages crop to 16:9, so keep the subject inside the middle 60% of the height.
- RAW plus a graded JPEG. Neutral late-afternoon or overcast light. No golden-hour glow, no
  HDR. The site is navy on cream and the photos sit against cream.
- No people, no readable signage, no license plates, no yard signs, no brokerage marks. Type
  is composited later.
- No listing under contract or currently listed by another brokerage. Our own listings are
  fine with the seller's written okay. Public streets and trails otherwise.
- Register every frame in the asset library with geo and subject tags and the shoot date so
  the vision grade runs (`node lib/asset-library.mjs register`).

## The list

| # | Subject | Where | Season and light | Framing | Feeds |
|---|---|---|---|---|---|
| 1 | Single-story craftsman exterior, cedar siding, metal roof, ponderosa in the yard | West Bend, River West or Old Bend | Fall, late afternoon | Three-quarter from the sidewalk, 35mm equivalent, no cars | Cost to sell, how to sell, listing prep guides |
| 2 | Front porch at dusk, warm window light, blue sky | Mid-century ranch, Orchard District or Mountain View | Fall, blue hour | Eye level from the front walk, medium | How to price, seller guides |
| 3 | Newer east-side subdivision street, single-level homes, three-car garages, sidewalks | Southeast Bend or Larkspur | Fall, overcast | Eye level from the street, wide, no cars | New construction, good time to buy, east-side guides |
| 4 | Home in light snow, porch light on, tire tracks in the driveway | Any Bend district, morning after the first snow | Winter, flat overcast | Three-quarter from the street | Selling from out of state, winter buying guides |
| 5 | Brass house key on a wood counter, out-of-focus window | Studio or a real kitchen | Any, window light | 85mm equivalent, shallow focus | Buyer's agent guide, closing guides |
| 6 | Kitchen table with a folded paper packet and a pen, no readable text | Real kitchen | Any, window light | Table height, close | Buyer agreement, disclosures, TC surfaces |
| 7 | Deschutes River trail with aspens turning, no bridge, no mill | Old Mill reach or First Street Rapids | Fall, late afternoon | Eye level from the trail, wide | Westside guide, moving guides |
| 8 | Two-lane highway toward the Three Sisters, sage and juniper | Highway 20 west of Bend, pullout | Fall, neutral | Eye level from the shoulder, wide | Bend vs Redmond vs Sisters, relocation guides |
| 9 | Redmond downtown street, low buildings, Smith Rock or peaks small on the horizon | Redmond, 6th Street | Fall, overcast | Eye level, wide | Redmond guides and place page |
| 10 | Sisters main street, western storefronts, peaks behind | Sisters, Cascade Avenue | Fall, overcast | Eye level, wide, early so the street is empty | Sisters guides and place page |
| 11 | Rural acreage home with a well house and a fence line | Tumalo or Alfalfa, with the owner's okay | Fall, late afternoon | Wide from the road | Land, well and septic, rural buying guides |
| 12 | Well head and septic riser in a yard | Same property as 11 | Any | Medium, ground level | Inspection and rural guides |
| 13 | Garage with bikes, skis, and a trailer, doors open | Any east-side home | Any | Wide from the driveway | Renovation guide, east-side guides |
| 14 | Wildfire-hardened details: ember vent, metal roof edge, five-foot gravel zone | A 2026 R327 home | Any | Close, three frames | Wildfire code and insurance guides |
| 15 | Vacant living room, staged, window light | A listed home of ours, empty | Any | Wide from the doorway | Staging and prep guides |
| 16 | Aerial of a west-side street with the river visible, low altitude | River West | Fall | Drone, 60 to 80 metres, looking down 30 degrees | Westside and neighborhood guides |
| 17 | Aerial of an east-side subdivision, low altitude, edge of development | Southeast Bend | Fall | Drone, 60 to 80 metres | Growth plan, new construction, east-side guides |
| 18 | Mt. Bachelor from the Cascade Lakes Highway pullout, road in frame | Cascade Lakes Highway | Fall, neutral | Eye level, wide | Cost of living, relocation guides |

## After the shoot

- Register and grade before picking. Grade A only ships. Md5 the finalists so the same frame
  does not land on two guides (the library already holds one duplicate under two ids).
- Replace the library aerials on the nine September guides where a closer subject fits:
  frames 1, 2, 3, 5, 7 map to cost to sell, how to price, good time to buy, buyer's agent, and
  westside vs eastside.
- Update `hero_image_url` on the post and the seed mirror in the same commit.
