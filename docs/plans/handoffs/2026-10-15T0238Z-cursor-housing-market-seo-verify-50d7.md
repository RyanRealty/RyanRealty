# 2026-10-15 (Cursor, housing-market SEO)

Surface: Cursor cloud. Branch `cursor/housing-market-seo-verify-50d7`.

Done: reproduced production deploy:verify on `/housing-market/bend` (missing `#takeaways` / FAQ) and `/housing-market/la-pine` (noindex not-found shell, no canonical). La Pine is the thin-data `geoMarketPublishes` gate firing on a slug miss (`city:la pine` vs stored `city:la-pine`); HUD is publishable (169 active, 8.7 months). Overlay lookup + city takeaways HUD fallback. Do not merge.

Next: land after review. Fresh ISR should also restore leftover monthly / yoy FAQ on Bend.

Held: do not force-index a true leftover miss. leftoverOrCacheMonthly still does not mix cache.

Skills: database-canonical-reference (DATABASE_FOR_AI_AGENTS.md §3a / cache slugs).
