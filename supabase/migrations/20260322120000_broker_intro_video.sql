-- Broker intro video: optional hero/header video for agent/team page.
-- When set, the broker page shows this video in the hero; when null, the page is built without it.
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS intro_video_url text;
COMMENT ON COLUMN brokers.intro_video_url IS 'Optional intro/hero video URL for broker page header. Upload to storage or paste external URL.';
