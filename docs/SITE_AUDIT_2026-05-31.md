# Full-Site Audit — 2026-05-31

Source: 9-dimension multi-agent audit of ryan-realty.com (links, data accuracy,
SEO, images, lead funnel, performance, accessibility, content, functionality),
every finding adversarially verified. Plus a Drive asset inventory and the
production-down hotfixes from the same session.

## FIXED + SHIPPED this session (verified)

| Issue | Fix | Commit | Verified |
|---|---|---|---|
| Intermittent "City Not Found" + "can't open listing" (poison-null cache in getGeoSnapshot/getListingDetail) | throw-on-error + retry + cache-key bump | f3583dc, ac8b858 | ✅ 2 clean sweeps, 10 cities + 8 listings |
| **DEAD Tetherow lead funnel** — all 5 forms POST /api/cma → 404, fake success, leads lost | new /api/cma POST route + submitTetherowLead (FUB+CAPI+canonical tags+GA4); fixed wrong 'seller-intent' tag → audience:seller | 298ec8a | ✅ live: empty POST → 502 validation (not 404) |
| Homepage KPIs em-dash / /housing-market "Not available" / /homes-for-sale "0 homes" (poison-null in getMarketPulse/getMarketStats/getListingTiles) | shared makeResilientCached + readOrThrow (throw-on-error, never cache empties) + key bumps | 6129cdc | build+tests green; deploying |
| GSC zero-data, sitemap missing cities, blind health check, no AI-referrer/seller-source attribution | 5 measurement-loop fixes | 2842dce, ffbf424, 013b521 | ✅ |

## REMAINING P0 (verified real, not yet fixed)

1. **10 weekly market-report pages return HTTP 500** — `/housing-market/reports/<slug>` and `/reports/<slug>` both 500; all are in the sitemap feeding Google server errors. DB rows exist (image_storage_path + content_html non-null), so it's a render-time throw downstream of getMarketReportBySlug (suspect getReportImageUrl / sanitizeHtml / next/image of the storage URL). FILE: app/reports/[slug]/page.tsx. Until fixed, drop /housing-market/reports/* from sitemap.
2. **Soft-404s return HTTP 200** on every dynamic notFound() (/communities, /cities, /cities/[hood], /listing, /team) with robots index,follow — likely deploy-lag/streamed-render status. Add robots:{index:false} to not-found metadata + a route-smoke gate asserting invalid slugs 404.
3. **sitemap.xml force-dynamic** aggregates raw 589K listings with ~10 sequential scans + N+1 per-city loop; nondeterministically collapses to ~63 URLs or times out (one catch silently returns static-only). Rebuild from listing_tile_mv / a sitemap MV + split into a sitemap index per family; serve last-good on error. Target <5s.
4. **31 junk /communities slugs** in sitemap resolve to fabricated 200 pages ("Industrial, Madras Oregon") — /communities/[slug] accepts ANY subdivision string with no existence check. Emit only the 14 registry slugs; 404 arbitrary subdivisions. Add a gate.
5. **Tetherow form res.ok hardening** (P0 #2 remainder) — the 5 handlers still `setDone(true)` without checking res.ok; if the new endpoint ever 502s they'd show fake success again. Branch on res.ok; show error UI with 541.703.3095.

## REMAINING P1

- SEO facet pages ("/homes-for-sale/redmond", "/under-500k") render "No active listings" while their status block shows inventory — same poison-null class via getCachedSeo; indexed with no noindex.
- Both broker profile (/team/<slug>) links 404.
- Additional lower-impact poison-null resolvers (getPriceHistory, getSimilarListings, getUpcomingOpenHouses, getGeoBoundaryMapData, getBoundaryGeoJSON, getMarketStatsCacheRows) — apply makeResilientCached.

## Photos (separate workstream — your professional assets)

Drive "Area Guides" master folder has pro PHOTO+VIDEO for ~70 areas: all 7 cities,
all 13 Bend neighborhoods, the communities. Best-hero file IDs catalogued. Only 5
genuine gaps (sunriver, black-butte-ranch, westgate, river-bend-estates,
woodside-ranch). Plan: download chosen heroes → optimize to WebP → wire into
lib/geo-images.ts (replacing the stock heroes for cities where pro photos exist) →
geo-accuracy gate. Web-sourced verified heroes (Smith Rock/Terrebonne, Lake Billy
Chinook/Culver, etc.) are the fallback only where you have no asset. Draft-first
contact sheet before anything locks in.
