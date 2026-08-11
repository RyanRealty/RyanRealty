# Journey B — Seller

**Date:** 2026-08-11 · **Method:** production HTML sample + ledger cross-link (P2)

**Litmus bar:** Primary valuation CTA above fold mobile; one form spine; fee story scannable ≤60s

**Result now:** PARTIAL — conversion spine present; density and progressive disclosure fail 2026 bar

## Steps

- **B1 Land /sell or home Value CTA** — Seller intent obvious ≤3s
- **B2 Value form** — One spine, no duplicate address forms
- **B3 Proof** — Sold track + reviews before matrix wall
- **B4 Plan/fees** — Scannable ≤60s
- **B5 Confirmation** — What happens next + CRM speed

## Defects (linked)

| Sev | Type | ID | Defect | Bars |
|---|---|---|---|---|
| P0 | page | `/sell` | Strong substance; fee comparison matrix is a wall (progressive disclosure fail) | B06 |
| P0 | section | `SellerLPForm/KbSell` | Multiple valuation entry points sitewide — risk of duplicate heroes | B02,B10 |
| P1 | page | `/` | Seller CTA competes with buyer hero on homepage | B01 |
| P1 | page | `/sell/valuation` | Must stay single written-CMA door; align chrome with /sell | B05 |

## Sample text cues (prod)

**Sell:**  Sell Your Home in Central Oregon | Ryan Realty — Central Oregon Skip to main content Buy ▾ All homes for sale Map search Open houses Price drops Luxury homes in Bend Sold homes Compare homes Video tours Listing alerts Areas ▾ Area guides All cities Bend Redmond Sisters Sunriver La Pine Terrebonne Prineville Madras All communities Tetherow Broken Top NorthWest Crossing Caldera Springs Eagle Crest Black Butte Ranch Schools Parks Trails Events Live music and shows Golf Market ▾ Market overview Mar

## Disposition

All linked pages dispositioned **rebuild** in PAGE_LEDGER. Fix via P5 library + P8 family roll; do not patch in place as final.

