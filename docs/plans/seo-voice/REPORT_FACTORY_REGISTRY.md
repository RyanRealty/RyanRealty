# Report factory registry (H7)

**Status:** Living registry — R01 size + R14 competitive admin shipped public/admin; others planned.  
**Rule:** Every public number from marts/cubes only (§0). No invented figures.  
**Surfaces:** Public hub `/housing-market` (size strip + composition + mart FAQ); admin `/admin/analytics/competition`.

| ID | Report | Grain | Surface | Status |
|----|--------|-------|---------|--------|
| R01 | Market size $ + units by year | CO region | `/housing-market` CoMarketSizeStrip | **Shipped** public |
| R02 | Market composition (type mix) | CO region × year | CoMarketComposition + hub FAQ | **Shipped** public |
| R03 | Multi-year size series | CO 2016–2025 | hub + central-oregon | **Shipped** (mart) |
| R04 | City size $ by year | city × year | history explorer city filter + city mart grain | **Partial** |
| R05 | Price distribution / bands | CO/city × year | Planned | Open |
| R06 | DOM / months of supply | geo × month | Existing pulse paths | Prior |
| R07 | Amenity class (e.g. fireplace) | CO × year | `analytics_mart_feature_annual` + history strip | **Shipped** H6 (fireplace/garage/association) |
| R08 | New vs resale | CO × year | Planned (H6 cube) | Open |
| R09 | Inventory snapshot active | city × day | `analytics_inventory_snapshot` + daily cron | **Shipped** H8 warehouse |
| R10 | List vs sale gap | geo × month | Planned | Open |
| R11 | Seasonal volume | month-of-year | Planned | Open |
| R12 | Neighborhood depth | nbhd × year | Planned | Open |
| R13 | Community / resort closed | community × year | Planned | Open |
| R14 | Competitive office share | office × year × side | `/admin/analytics/competition` | **Shipped** admin |
| R15 | Competitive agent share | agent × year | admin agents + office drill | **Shipped** admin |

**Next builds:** R05 bands, R08 new vs resale, brand-merged competitor share on R14 via office_id join (Ryan brand rollup I4 shipped).

**Ops:** Mart rebuild cron `rebuild-analytics-marts` (market + office + H6 feature cubes); inventory warehouse cron `snapshot-active-inventory` → `analytics_inventory_snapshot`.
