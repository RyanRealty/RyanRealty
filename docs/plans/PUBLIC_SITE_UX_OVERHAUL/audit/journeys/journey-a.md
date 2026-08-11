# Journey A — Buyer (specific home type)

**Date:** 2026-08-11 · **Method:** production HTML sample + ledger cross-link (P2)

**Litmus bar:** ≤90s to meaningful results; ≤3 taps to tour/alert; zero chrome breaks; mobile map first-class

**Result now:** FAIL — functional find path exists; UX coherence and portal parity incomplete

## Steps

- **A1 Land /** — Cold homepage. H1/search intent? Live count? Dual CTA buy vs sell?
- **A2 Scope /homes-for-sale** — Filters, map, list, mobile map parity, save/alert
- **A3 Browse results** — Card decision fields, save without wall
- **A4 Detail listing** — Photo, price, one broker, tour CTA
- **A5 Capture alerts** — Alerts match criteria
- **A6 Trust soft proof** — Reviews/team without hijack

## Defects (linked)

| Sev | Type | ID | Defect | Bars |
|---|---|---|---|---|
| P0 | section | `jsx.KbHero` | Dual primary CTAs on home dilute buyer job | B01,B02 |
| P0 | page | `/` | Long equal-weight section stack (12 blocks) — disjoint narrative | B05,B06 |
| P0 | page | `/homes-for-sale` | Hybrid search chrome vs KB pages — register seam risk | B05 |
| P0 | section | `search filters/map` | Portal ceiling: must match Zillow/Redfin feel on map+filter speed | B03,B13 |
| P1 | page | `/listing/*` | Patchwork listing body + broker identity consistency | B09,B02 |
| P1 | section | `alerts` | Alert capture must inherit active search criteria | B10,B11 |

## Sample text cues (prod)

**Home:**  Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver Skip to main content Buy ▾ All homes for sale Map search Open houses Price drops Luxury homes in Bend Sold homes Compare homes Video tours Listing alerts Areas ▾ Area guides All cities Bend Redmond Sisters Sunriver La Pine Terrebonne Prineville Madras All communities Tetherow Broken Top NorthWest Crossing Caldera Springs Eagle Cr

**Search:**  Homes for Sale | Ryan Realty — Central Oregon Skip to main content Buy ▾ All homes for sale Map search Open houses Price drops Luxury homes in Bend Sold homes Compare homes Video tours Listing alerts Areas ▾ Area guides All cities Bend Redmond Sisters Sunriver La Pine Terrebonne Prineville Madras All communities Tetherow Broken Top NorthWest Crossing Caldera Springs Eagle Crest Black Butte Ranch 

## Disposition

All linked pages dispositioned **rebuild** in PAGE_LEDGER. Fix via P5 library + P8 family roll; do not patch in place as final.

