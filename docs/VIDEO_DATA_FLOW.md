# Video data flow: MLS/Spark → listing page

This doc traces how listing video data gets from the MLS (Spark API) to the listing detail page so you can verify video is wired correctly.

## 1. Spark API request

- **Sync** (`app/actions/sync-spark.ts`): Full sync and photo-only sync both use `SYNC_EXPAND = 'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'`, so Spark is asked to expand `Videos` (and `VirtualTours`) on each listing.
- **Single listing** (`lib/spark.ts`): `fetchSparkListingByKey()` uses `LISTING_EXPAND = 'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'`, so when a listing is loaded on demand (e.g. not in Supabase), video is also requested.

## 2. Spark response → Supabase `details`

- Spark returns each listing with `StandardFields` that **include** expanded arrays when `_expand=Videos` is used: e.g. `StandardFields.Videos` (array of `{ Id, Uri, ObjectHtml, Name, Caption, ... }`).
- **Mapping** (`lib/spark.ts` → `sparkListingToSupabaseRow()`): The entire `StandardFields` object is stored as `details`:
  ```ts
  details: f as Record<string, unknown>  // f = result.StandardFields
  ```
- So after sync, `listings.details` in Supabase has the same shape as Spark’s `StandardFields`, including `details.Videos` (and `details.VirtualTours`).

## 3. Listing page data source

- **`/listings/[listingKey]`** (main listing detail): `getListingDetailData()` in `app/actions/listing-detail.ts` fetches `listing_photos`, `listing_videos` (table), and `listings.virtual_tour_url`. Videos are passed to `ListingVideos`; virtual tour URL becomes a virtual tour link. Hero uses `ListingDetailHero` (photos + virtual tour badge).
- **Alternative path** (e.g. `/listing/[listingKey]` if used): `getListingByKey(listingKey)` in `app/actions/listings.ts` loads the row from Supabase, including the `details` column. If the row exists, `fields` on the listing page is `row.details` (parsed from JSON if stored as string).
- **Fallback**: If there is no row (e.g. listing not synced), the page fetches from Spark via `fetchSparkListingByKey()` and uses `StandardFields` as `fields`. So video is present in both paths.

## 4. Normalizing for display (casing)

- Supabase/Postgres may store JSON keys in different casing; Spark uses PascalCase. The listing page normalizes so either works:
- **`normalizeListingVideos(fields)`** (`app/listing/[listingKey]/page.tsx`):
  - Reads `fields.Videos ?? fields.videos`.
  - For each item, maps `Uri`/`uri`, `ObjectHtml`/`object_html`/`ObjectHTML`, etc., to a single shape (PascalCase) so components see `Uri` and `ObjectHtml`.

## 5. Where video is rendered

- **Hero** (`components/listing/ListingHero.tsx`): Receives `photos` and `videos` from the listing page. If `videos.length > 0`, the first video is added to the media carousel (video first, then photos). Each video is rendered as:
  - `ObjectHtml` → embed div (iframe)
  - Direct file URL (e.g. `.mp4`) → `<video>` tag
  - YouTube/Vimeo URL (no `ObjectHtml`) → embed iframe via `getVideoEmbedHtml()` (`lib/video-embed.ts`)
  - Otherwise → “Watch video →” link
- **Videos & virtual tours section** (`components/listing/ListingVideos.tsx`): Same normalization and same rendering rules for each item in `videos`; `VirtualTours` are shown as links.

## 6. If video doesn’t show up

- **MLS doesn’t send video**: Many listings have no `Videos` array; the UI shows “No photos or video” or “No videos or virtual tours” when the array is missing or empty.
- **Sync didn’t include expand**: Ensure sync runs with the default expand (Videos is in `SYNC_EXPAND`). Re-sync or “Photos only” sync will refresh `details` including `Videos`.
- **Casing**: `normalizeListingVideos` already handles `Videos`/`videos` and `Uri`/`uri`, `ObjectHtml`/`object_html`. If your MLS uses different keys, add them in the normalizer.
- **URL-only video**: If the MLS sends only a URL (e.g. YouTube) in `Uri` and no `ObjectHtml`, the app now embeds it via `getVideoEmbedHtml()`; no change needed unless the URL format is non-standard (then extend `lib/video-embed.ts`).

## 7. Admin: counts

- Sync dashboard and admin sync page show “with videos” count from `get_listing_media_counts()` (Supabase), which counts rows where `details->'Videos'` is a non-empty array. Use this to confirm how many listings have video data stored.
