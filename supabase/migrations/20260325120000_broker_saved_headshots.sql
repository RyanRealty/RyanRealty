-- Store multiple saved headshot URLs per broker; photo_url is the one used on the site.
-- Run: npx supabase db push

ALTER TABLE brokers ADD COLUMN IF NOT EXISTS saved_headshot_urls text[] DEFAULT '{}';
COMMENT ON COLUMN brokers.saved_headshot_urls IS 'Saved AI-generated headshot URLs. Only photo_url is used on the site; user can set any saved URL as default.';
