-- Per-listing visual-media suppression flag.
--
-- When `media_suppressed = true`, the public site hides ALL visual media for the
-- listing: the photo gallery + hero (getListingPhotos), the hero poster / OG image
-- (getListingDetail.photoUrl), and every video + virtual tour (getListingVideos).
--
-- Honors owner media-removal requests durably. CRITICAL: this column is
-- deliberately NOT emitted by the Spark sync mapper (lib/listing-mapper.ts
-- sparkToListingRow) nor by lib/spark.ts, so a delta OR full re-sync upsert
-- (which overwrites `details` and `PhotoURL` wholesale) can never clear it.
-- Managed manually / via admin tooling.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS media_suppressed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listings.media_suppressed IS
  'When true, the public site hides all visual media for this listing (photos, hero/OG image, videos, virtual tours). Honors owner media-removal requests. Never written by the Spark sync; set manually / via admin.';
