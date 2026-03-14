-- Optional source and attribution for banner_images (AI = grok, or unsplash/pexels when using photo API).
ALTER TABLE banner_images
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS attribution text;

COMMENT ON COLUMN banner_images.source IS 'grok (AI), unsplash, or pexels';
COMMENT ON COLUMN banner_images.attribution IS 'e.g. Photo by John Doe on Unsplash; shown when source is unsplash/pexels';
