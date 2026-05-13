-- Add open_id column to tiktok_auth. The ingestor at
-- /api/cron/marketing-snapshot-tiktok needs the OpenID for the
-- /v2/research/user/* and /v2/video/list endpoints. Older rows have
-- NULL; the ingestor fetches and persists open_id at runtime via
-- /v2/user/info when missing.
ALTER TABLE public.tiktok_auth ADD COLUMN IF NOT EXISTS open_id text;
