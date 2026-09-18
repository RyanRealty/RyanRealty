# SITE-128 rematch — competitor first-look (2026-09-18)

Tip Ready evidence for `lib/place/place-craft.parity.json`.

## Named peers

| Peer | URL | Shot | Status |
|---|---|---|---|
| Compass Bend, OR homes | https://www.compass.com/homes-for-sale/bend-or/ | `peer-compass-bend-or.png` | Valid. Real map + clusters + photo prices. |
| Compass Old Bend | https://www.compass.com/neighborhoods/old-bend-or/ | `peer-compass-old-bend.png` | Valid. Thick black boundary fills the frame + pins + photos. |
| Zillow bend-or | https://www.zillow.com/bend-or/ | `peer-zillow-bend-or.png` | SKIP. Same 403 / Press-and-Hold bot wall class as Redfin. Not a first-look. |
| Redfin | — | — | SKIP per Cos order. |

## Ours (this rematch, local first-look)

Production shots in this folder named `ours-*.png` are the FAIL Cos rematched: no photo rail, faint / 20-plat outlines, auth modal. They stay as the before. The rematch first-look shots are `ours-local-*.png` from this tip's Atlas (thick navy subject ring, `SUBJECT_FRAME_PAD` 0.12, photo cards in the first viewport, child-select chips).

Juniper: `/cities/bend/juniper-ridge` 404. `/cities/bend/juniper` also 404 in the recapture. No invented neighborhood page. Tetherow / DRW parksN=0 trailsN=0 after overlap fetch — no held park/trail geom overlaps those rings. Not invented.

## Side-by-side / sequential

- `side-by-side-old-bend.png` — Compass Old Bend | Ryan Old Bend local
- `side-by-side-bend.png` — Compass Bend homes | Ryan /cities/bend local
- Sequence also listed on the receipt: Compass Old Bend → Ryan Old Bend → Compass Bend → Ryan Bend

## Map hierarchy this rematch

1. Neighborhood / community draw ONE subject outline. Child plats are chips, not twenty simultaneous rings.
2. Child chip zooms that recorded ring until it fills the frame (`SUBJECT_FRAME_PAD` 0.12).
3. Homes stay on the current-place map (SITE-127 $ mixed).
4. Subdivision recorded plat frames at the same pad (DRW is no longer a 0.6 speck).

Zillow / Redfin 403 is not invented evidence.
