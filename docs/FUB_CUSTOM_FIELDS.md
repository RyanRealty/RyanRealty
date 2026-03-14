# FUB (Follow Up Boss) Custom Fields Setup

Create these custom fields in Follow Up Boss so the platform can push lead intelligence.

| Field name (API key) | Type | Description |
|----------------------|------|-------------|
| buyer_budget_min | number | Minimum budget |
| buyer_budget_max | number | Maximum budget |
| preferred_communities | text | Comma-separated or JSON of preferred communities |
| preferred_beds | number | Minimum bedrooms |
| preferred_baths | number | Minimum bathrooms |
| move_timeline | text | ASAP, 1-3mo, 3-6mo, 6-12mo, Just Browsing |
| lead_score | number | Computed score (points with weekly decay) |
| lead_tier | text | cold, warm, hot, very_hot |
| last_active_date | date | Last activity date |
| total_listings_viewed | number | Total listing views |
| total_listings_saved | number | Total saved listings |
| cma_downloads | number | Number of CMA downloads |
| registration_source | text | Source of registration (e.g. google, email) |
| preferred_property_type | text | e.g. Single Family, Condo |
| is_seller_curious | boolean | Visited /sell or downloaded CMA in area |
| engagement_streak_days | number | Consecutive days with activity |

When pushing events from the site, the person object may include these fields so FUB stays in sync.
