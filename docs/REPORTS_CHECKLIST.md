# Reports — Comprehensive List & Placement

**Purpose:** Single list of all reports the site must show and make usable, and where they appear (pre-computed stats, variable time frames, SEO assets, shareable links).

---

## Report types (public-facing)

| Report | Description | URL | Status |
|--------|-------------|-----|--------|
| **Weekly market report** | Pending and closed sales by city (last Sun–Sat). AI image, shareable. | `/reports`, `/reports/[slug]` | ✅ Built |
| **Explore market data** | Interactive: city/community, date range, metrics, price bands, trends. Share view via link. | `/reports/explore` | ✅ Built |
| **City market report** | Current-month metrics for a city: median price, active listings, median DOM, sold count, market condition. PDF download. | `/reports/city/[geoName]` | ✅ Built |
| **Community market report** | Same as city but for a subdivision/community. | `/reports/community/[geoName]` | ✅ Built |

## Report types (admin-only)

| Report | Description | URL | Status |
|--------|-------------|-----|--------|
| **Weekly report generator** | Trigger generation of weekly market report (cron or manual). | Admin → Reports | ✅ Built |
| **Market report by area** | Generate/view metrics by city/area. | `/admin/reports/market` | ✅ Built |
| **Broker performance** | Agent/broker stats (listings, sold, volume). | `/admin/reports/brokers` | ✅ Built |
| **Lead analytics** | Lead sources, conversion. | `/admin/reports/leads` | ✅ Built |

## Metrics to expose

Where data exists and UI supports it:

- Median and average price  
- Price per square foot trends  
- Days on market (median DOM)  
- List-to-sale ratio  
- Inventory (current listings)  
- New listings, closed sales  
- Price reductions  
- Absorption rate / months of inventory  
- YoY appreciation, sold volume  
- Seasonal trends  

**Explore** and **city/community report** pages use reporting_cache and RPCs; weekly report uses listing_history + market_reports.

---

## Where reports are surfaced

| Location | What to show |
|----------|----------------|
| **Header nav** | “Reports” → `/reports` |
| **Footer** | Link to “Market reports” → `/reports` |
| **Sell page** | CTA/link to “See market reports” or “Explore market data” → `/reports` or `/reports/explore` |
| **City page** | Link to city market report (e.g. “Bend market report”) → `/reports/city/Bend` |
| **Community page** | Link to community report when available → `/reports/community/[name]` |
| **Listing page** | Optional “Market trends” link to report for that city/community |
| **Buy / area guides** | Link to “Explore market data” or “Market reports” |

---

## Design standards for report pages

- Same layout pattern as rest of site: **nav hero** (e.g. navy section with title + short description), then content in `max-w-7xl` (or max-w-4xl for single-column).
- Use **design tokens** from `app/globals.css` (e.g. `--brand-navy`, `--brand-cream`, `--color-border-cream`, `--surface`).
- Cards: `rounded-xl`, `border border-[var(--color-border-cream)]`, `shadow-[var(--shadow-subtle)]`.
- CTAs: primary `bg-[var(--accent)]` or `bg-[var(--brand-navy)]`; secondary bordered.
- Every report page: unique **title/description** and **canonical** for SEO; share button where appropriate.
