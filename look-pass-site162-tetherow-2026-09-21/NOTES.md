# SITE-162 Tetherow first look — 2026-09-21

Named peer: [tetherow.com](https://tetherow.com/) (golf + lodge). We win the fold on live MLS marks + priced listing photographs. Same template as Awbrey Butte (`V3PlaceLook`).

## Production before (ryan-realty.com)

`prod-communities-tetherow-1440-before.png` — thin hero, HOA line, pale plat of overlapping `$` chips. Zero listing photographs in the first viewport.

## After (local `next dev --webpack -p 3465`)

| Shot | What it proves |
|---|---|
| `ours-local-communities-tetherow-1440.png` | Tetherow ring + clustered `$` marks + **two** priced photo cards (`$2.2M` 19372 Seaton Loop, `$2.9M` 19492 Bainbridge Court) with beds/baths/sqft |
| `ours-local-communities-tetherow-375.png` | Same two priced cards in the first viewport; map island with cluster `10` / `4` — no overlapping `$` chip soup |
| `ours-local-communities-caldera-1440.png` | Caldera keeps the same fold; two priced cards; ring readable |
| `ours-local-communities-caldera-375.png` | Caldera 375: two priced cards + ring; plat labels stay off the fold |
| `ours-local-awbrey-butte-1440.png` | Neighborhood template we matched (map + priced cards) |
| `peer-tetherow-com-1440.png` | Official resort homepage — golf + lodge, no live MLS houses |

`measure.json`: Tetherow 1440 and 375 `cardsInFold: 2`, `overlappingMarks: 0`.

Receipt-bound `desktop.png` / `mobile375.png` / `value-open-*` left at HEAD (SITE-94). Rebaseline is not done.
