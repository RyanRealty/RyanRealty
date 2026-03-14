-- RLS for geo_places, listing_photo_classifications, sync_state (no RLS in original migrations).

ALTER TABLE geo_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read geo_places" ON geo_places;
CREATE POLICY "Public read geo_places"
  ON geo_places FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage geo_places" ON geo_places;
CREATE POLICY "Service role manage geo_places"
  ON geo_places FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE listing_photo_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read listing_photo_classifications" ON listing_photo_classifications;
CREATE POLICY "Public read listing_photo_classifications"
  ON listing_photo_classifications FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Service role manage listing_photo_classifications" ON listing_photo_classifications;
CREATE POLICY "Service role manage listing_photo_classifications"
  ON listing_photo_classifications FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only sync_state" ON sync_state;
CREATE POLICY "Service role only sync_state"
  ON sync_state FOR ALL TO service_role USING (true) WITH CHECK (true);
