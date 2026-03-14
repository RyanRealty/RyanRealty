-- Homepage hero: optional video (and fallback image) URL, editable in Admin → Site pages.

ALTER TABLE brokerage_settings
  ADD COLUMN IF NOT EXISTS hero_video_url text,
  ADD COLUMN IF NOT EXISTS hero_image_url text;

COMMENT ON COLUMN brokerage_settings.hero_video_url IS 'Homepage hero background video URL (mp4). When set, hero uses <video>; otherwise uses hero_image_url or default image.';
COMMENT ON COLUMN brokerage_settings.hero_image_url IS 'Homepage hero background image URL when no video, or poster/fallback.';
