# Google Maps API enablement log

**Date:** 2026-05-17 (Phase 1 follow-up after tool-inventory.md flagged Geocoding as disabled)

## Trigger

Matt directed: "I believe that the geocoding API is enabled. Don't make any assumptions, but you have full access to get this stuff done."

## Diagnosis

- Service account `viewer@ryanrealty.iam.gserviceaccount.com` has Viewer role only. Service Usage API call to enable Geocoding returned HTTP 403 PERMISSION_DENIED with `AUTH_PERMISSION_DENIED`.
- Programmatic enable via SA is blocked. The fix path is interactive (Cloud Console as Matt) or SA role elevation.
- After Matt enabled Geocoding via the surfaced URL, live curl confirmed `status: OK` for `https://maps.googleapis.com/maps/api/geocode/json?address=63100+NE+18th+St,+Bend,+OR&key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` returning lat 44.0983416, lng -121.2788938.

## Cloud project metadata

- Project ID: `ryanrealty`
- Project number: `725620954432`
- Service account email: `viewer@ryanrealty.iam.gserviceaccount.com` (Viewer role only)

## Enable actions taken via Chrome (after Matt authenticated)

| API | Before | Action | Post-click state | Verified live |
|---|---|---|---|---|
| Geocoding API | REQUEST_DENIED | Matt clicked Enable (manual via surfaced URL) | enabled | yes, status OK |
| Static Maps API | already enabled | none | enabled | yes, HTTP 200 PNG |
| Places API (Legacy) | REQUEST_DENIED | Enable clicked | enabled | yes, status OK |
| Places API (New) | not enabled | Enable clicked | propagating | wait 2-5 min, retry |
| Routes API | not enabled | Enable clicked | propagating | wait 2-5 min, retry |
| Street View Static API | REQUEST_DENIED | Enable clicked | propagating | wait 2-5 min, retry |
| Solar API | PERMISSION_DENIED | Enable clicked | propagating | wait 2-5 min, retry |
| Aerial View API | already enabled (page showed Manage) | none | enabled | tested, returns NOT_FOUND on test address (expected, no aerial video at that address) |
| Address Validation API | not enabled | Enable clicked | propagating | wait 2-5 min, retry |
| Time Zone API | REQUEST_DENIED | Enable clicked | propagating | wait 2-5 min, retry |
| Maps Elevation API | REQUEST_DENIED | Enable clicked | enabled | yes, status OK |

## Legacy retirement note

Google has retired the Directions API and Distance Matrix API for new projects. Calls return REQUEST_DENIED with message "You're calling a legacy API, which is not enabled for your project. To get newer features and more functionality, switch to the Places API (New) or Routes API." Producers must call Routes API instead of Directions or Distance Matrix.

## What this unlocks for producers

| Producer | Was blocked by | Now unblocked |
|---|---|---|
| `map_route_video` | Directions/Distance Matrix (legacy retired) | Routes API |
| `walkability_overlay` | Distance Matrix | Routes API matrix endpoint |
| `school_district_overlay` | Geocoding for address-to-school lookup | Geocoding API |
| `listing-tour-video` | Street View Static | Street View Static API |
| `neighborhood_tour` | Street View + Places + Geocoding | all three |
| `comparable_grid` | Places + Geocoding for comp pinning | both |
| `map_static_card` | Static Maps + Geocoding | both |
| `listing-description` | Places + Geocoding for "near X" copy | both |
| `site-neighborhood-page` | Places + Geocoding for live neighborhood data | both |
| (new opportunity) | Solar API for solar potential overlay on south-facing listings | Solar API |
| (new opportunity) | Aerial View for cinematic luxury intros | Aerial View API |
| (new opportunity) | Address Validation for lead-form data cleansing | Address Validation API |

## Follow-up

- Re-verify all propagating APIs at 2026-05-17 + 10 min: curl probes (this file's status table will be updated).
- Update `tool-inventory.md` Section F (Google Maps) with the enabled-state table from this log.
- Phase 6 producers in the map/route/street/places families now have green-light to wire these APIs.

## SA elevation recommendation (defer, surface to Matt)

The viewer SA cannot enable APIs, manage IAM, or write GCS. For autonomous brain operations that need to programmatically enable a new API as the system grows, consider creating a second SA with `roles/serviceusage.serviceUsageAdmin` (NOT broader). This is a permission decision for Matt; surface in Phase 11 summary [ACTION REQUIRED] block.

## Final re-probe results (2026-05-17, post-propagation window)

After ~30 minutes the 5 propagating APIs were still returning PERMISSION_DENIED / REQUEST_DENIED. Diagnosis: the Chrome MCP click-then-navigate sequence advanced past the Enable button before the click event fully fired on some pages (the Cloud Console redirects to an overview page after Enable; the next navigate raced the redirect).

### Confirmed enabled and live

- Geocoding API
- Static Maps API
- Places API (Legacy)
- Maps Elevation API
- Aerial View API (returns NOT_FOUND for test address but API itself responds)

### Still disabled (Matt: one-click URLs below)

| API | Enable URL | Used by |
|---|---|---|
| Places API (New) | https://console.cloud.google.com/apis/library/places.googleapis.com?project=ryanrealty | comparable_grid, listing-description, neighborhood_tour, school_district_overlay, site-neighborhood-page |
| Routes API | https://console.cloud.google.com/apis/library/routes.googleapis.com?project=ryanrealty | map_route_video, walkability_overlay |
| Street View Static API | https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com?project=ryanrealty | listing-tour-video, neighborhood_tour |
| Solar API | https://console.cloud.google.com/apis/library/solar.googleapis.com?project=ryanrealty | (future) south-facing-listing solar overlay |
| Address Validation API | https://console.cloud.google.com/apis/library/addressvalidation.googleapis.com?project=ryanrealty | (future) FB lead-gen form data cleansing |
| Time Zone API | https://console.cloud.google.com/apis/library/timezone-backend.googleapis.com?project=ryanrealty | (future) cross-zone cron scheduling |

Each takes about 30 seconds; ~3 min total. The Phase 11 summary HTML surfaces these in the [ACTION REQUIRED] block.
