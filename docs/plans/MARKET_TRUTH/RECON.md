# Market Truth — shadow reconciliation

**As-of 2026-08-22, flipped 2026-08-23.** Shadow store: `market_metric` `definition_id='mt-v1'`, computed by `compute_market_metrics_shadow`. `/sell` Bend (active count, months of supply, verdict) plus Dataset JSON-LD and `/data/market/city/bend` read `getMetric()`. Other public surfaces still pulse.

Population: REGISTRY `detached` (`PropertyType='A'` AND `property_sub_type='Single Family Residence'`) and `all_residential`. Geography: `place_membership` `is_primary`. Active: `StandardStatus='Active'` exact. Months of supply: `active / (closed_180d / 6)`.

Frozen live comparison set for this report: `market_pulse_live` city rows (`property_type='A'`), `/sell` Bend three figures, cache Bend `rolling_365d` labels. Remaining surfaces (CMA, JSON feeds, video, newsletter) get a line when they migrate.

## `/sell` Bend — migration #1 target

| figure | live `/sell` (pulse, city polygon, type A) | shadow (MLS city, detached) | delta | reason |
|---|---|---|---|---|
| homes for sale | 488 | **775** | +287 / +58.8% | Live clips to TIGER city limits (D5). Shadow is MLS `"City"='Bend'`. |
| months of supply | 3.54 | **4.45** | +0.91 | Same clip. The excluded ring runs ~8 months, so dropping it pushes the ratio toward seller. |
| verdict | seller's | **balanced** | verdict flips | House bins ≤4 seller / 4–6 balanced / ≥6 buyer. |

Flipped 2026-08-23 after Matt's go-ahead. `/sell`, Dataset JSON-LD, and `/data/market/city/bend` all read `getSellBendMarket()` (775 / 4.45 / balanced). Pulse 488 / 3.54 remains on unmigrated surfaces.

## Pulse city inventory vs shadow detached

| pulse slug | pulse active | pulse MoS | shadow active | shadow MoS | shadow verdict | reason |
|---|---:|---:|---:|---:|---|---|
| bend | 488 | 3.54 | 775 | 4.45 | balanced | polygon clip (D5) |
| redmond | 191 | 4.41 | 274 | 4.95 | balanced | polygon clip |
| prineville | 83 | 5.03 | 181 | 7.65 | buyer | polygon clip; verdict flips |
| sisters | 35 | 4.47 | 110 | 7.59 | buyer | polygon clip; verdict flips |
| terrebonne | 6 | NULL | 51 | 10.93 | buyer | CDP polygon; pulse divide-by-zero |
| culver | 12 | 8.00 | 29 | 11.60 | buyer | polygon clip |
| madras | 48 | 4.72 | 75 | 5.84 | balanced | polygon clip |
| la pine | 172 | 10.98 | 170 | 10.85 | buyer | not clipped; 2-home exact-Active vs pulse mix |
| sunriver | 57 | 7.43 | 56 | 7.47 | buyer | CDP ≈ MLS city |
| powell butte | 62 | 12.00 | 62 | 12.00 | buyer | match |
| black butte ranch | 31 | 11.62 | 31 | 11.63 | buyer | match |
| camp sherman | 5 | 5.00 | 5 | 5.00 | balanced | match |
| metolius | 6 | 6.00 | 6 | 6.00 | buyer | match |
| tumalo / warm springs / crooked river ranch | 0 | — | 0 | — | — | no MLS City text |

Pulse keys cities on `lower("City")` (space form). Shadow keys hyphen slugs. Join with `market_hyphen_slug`.

## Other Bend live figures vs shadow (detached, 12-month)

| live source | live value | shadow | reason |
|---|---|---|---|
| pulse `median_days_to_pending` | 18 | `median_days_to_contract` **28** | Pulse is polygon + type A, list-to-pending. Shadow is MLS-city detached, D2. |
| cache `rolling_365d` `median_dom` | 25 (list-to-pending, SFR-only) | 28 | Cache geography is not MLS City (AUDIT F5). Same D2 column, different membership. |
| cache `avg_sale_to_list_ratio` | 0.957 | `median_sale_to_final_list` **0.991** | Mean vs median; $1 auctions. Mean is banned. |
| cache `end_of_period_inventory` | 452 | active **775** | Cache eopi is a third active definition. |

## What this report is not

- Every remaining surface. `/sell` now reads getMetric. CMA, place pages, newsletter, video, and the rest stay on pulse until their own recon line.
- Every one of the ~72 named figures AUDIT F21 counted. Those surfaces stay on the old store until they have a row in a follow-on recon.
- Neighborhood / subdivision price stats. REGISTRY §4: neighborhood polygons are unverified; subdivision publishes counts and sales, not prices.
