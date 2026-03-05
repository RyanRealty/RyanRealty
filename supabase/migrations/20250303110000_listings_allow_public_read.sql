-- Allow the app (anon key) to read listings. Sync uses service_role and can write; 
-- without this policy, anon sees 0 rows even though data exists.
-- Run: npx supabase db push

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on listings"
  ON listings
  FOR SELECT
  TO anon, authenticated
  USING (true);
