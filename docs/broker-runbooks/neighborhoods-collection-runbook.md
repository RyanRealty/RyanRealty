# Create the Neighborhoods collection, ~3 minutes

The 27 polygon-driven neighborhood lists already exist. They're scattered in your standalone Smart Lists today. This runbook groups them into one `Neighborhoods` collection in your sidebar.

## Step 1, create the collection

1. People > Manage (bottom-left button).
2. Top right of the Collections section, click `+ New Collection`.
3. Name it: **Neighborhoods**
4. Click Save.

You'll now see an empty `Neighborhoods` collection card next to `Pipeline`.

## Step 2, move each of these 27 lists into Neighborhoods

For each list below, on the Manage Lists page:

1. Find the list row.
2. Click the `...` menu on the right of that row.
3. Click `Move to Collection`.
4. Pick `Neighborhoods` from the dropdown.
5. Click `Move to Collection`.

The 27 lists (alphabetical by FUB sort):

| # | List |
|---:|---|
| 1 | Awbrey Glen |
| 2 | Bend — Awbrey Butte |
| 3 | Bend — Boyd Acres |
| 4 | Bend — Century West |
| 5 | Bend — Larkspur |
| 6 | Bend — Mountain View |
| 7 | Bend — Old Bend |
| 8 | Bend — Old Farm District |
| 9 | Bend — Orchard District |
| 10 | Bend — River West |
| 11 | Bend — Southeast Bend |
| 12 | Bend — Southern Crossing |
| 13 | Bend — Southwest Bend |
| 14 | Bend — Summit West |
| 15 | Black Butte Ranch |
| 16 | Brasada Ranch |
| 17 | Broken Top |
| 18 | Caldera Springs |
| 19 | Crosswater |
| 20 | Eagle Crest |
| 21 | Northwest Crossing |
| 22 | Pronghorn |
| 23 | Sunriver |
| 24 | Tetherow |
| 25 | Three Rivers |
| 26 | Vandevert Ranch |
| 27 | Widgi Creek |

## Heads up, you'll see duplicates

You have older manually-curated versions of four of these:

- `Vandevert` (21, your old one) vs `Vandevert Ranch` (id 84, polygon-driven)
- `Crosswater` (66, your old one) vs `Crosswater` (id 93, polygon-driven, same name)
- `Caldera Springs` (239, your old one) vs `Caldera Springs` (id 83, polygon-driven, same name)
- `Sunstone Loop — Showing Brokers` (8, your old one) — no polygon equivalent

For the three duplicates with overlapping names, the polygon-driven lists are auto-updated by the hourly cron via Deschutes County GIS. Your old manually-curated ones won't grow. I recommend deleting your three old ones AFTER you've moved the polygon-driven ones into the collection. Keep `Sunstone Loop — Showing Brokers` since there's no polygon equivalent.

## When you're done

Your sidebar will have:

- COLLECTIONS
  - Pipeline (4 lists)
  - Neighborhoods (27 lists)
- SMART LISTS (everything else)

Cleaner shape.
