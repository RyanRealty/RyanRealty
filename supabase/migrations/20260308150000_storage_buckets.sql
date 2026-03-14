-- Ensure storage buckets exist (banners, reports). Create via API in app if this is not supported in your Supabase version.
-- See: https://supabase.com/docs/guides/storage/buckets/creating-buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('banners', 'banners', true),
  ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;
