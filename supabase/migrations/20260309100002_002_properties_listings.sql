-- Migration 002: Properties & Listings
-- Address-deduplicated properties; one row per MLS listing event. History tables for status/price.
-- Ref: Section 6, 7.4 (per-listing processing), Appendix A (Spark API field mapping).

-- Properties (one per physical address; PostGIS geography for radius/CMA)
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  street_number text,
  street_name text,
  street_suffix text,
  unit_number text,
  unparsed_address text NOT NULL,
  city text,
  state text,
  postal_code text,
  county text,
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES neighborhoods(id) ON DELETE SET NULL,
  parcel_number text,
  latitude numeric,
  longitude numeric,
  geography geography(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unparsed_address)
);

COMMENT ON TABLE properties IS 'Address-deduplicated properties. geography for PostGIS radius/CMA.';

-- Listings (one per MLS listing; listing_key = Spark ListingKey, unique)
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL UNIQUE,
  listing_id text,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  standard_status text,
  mls_status text,
  list_price numeric,
  original_list_price numeric,
  close_price numeric,
  listing_contract_date date,
  on_market_date date,
  close_date date,
  modification_timestamp timestamptz,
  status_change_timestamp timestamptz,
  price_change_timestamp timestamptz,
  beds_total integer,
  baths_full integer,
  baths_half integer,
  baths_total_integer integer,
  living_area numeric,
  lot_size_acres numeric,
  lot_size_sqft numeric,
  year_built integer,
  levels integer,
  garage_spaces integer,
  property_type text,
  property_sub_type text,
  subdivision_name text,
  public_remarks text,
  directions text,
  architectural_style text,
  construction_materials text,
  roof text,
  flooring text,
  heating text,
  cooling text,
  fireplace_yn boolean,
  fireplace_features text,
  interior_features text,
  exterior_features text,
  kitchen_appliances text,
  pool_features text,
  view text,
  waterfront_yn boolean,
  water_source text,
  sewer text,
  association_yn boolean,
  association_fee numeric,
  association_fee_frequency text,
  tax_amount numeric,
  elementary_school text,
  middle_school text,
  high_school text,
  photos_count integer,
  virtual_tour_url text,
  vow_avm_display_yn boolean,
  new_construction_yn boolean,
  senior_community_yn boolean,
  days_on_market integer,
  cumulative_days_on_market integer,
  finalized_at timestamptz,
  finalization_notes text,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE listings IS 'One row per MLS listing. listing_key = Spark ListingKey. raw_data = unmapped Spark fields.';

-- Status change history (Section 7.4 Step 3). Uses listing_key so we don't require listings.id on existing large tables.
CREATE TABLE IF NOT EXISTS status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  old_status text,
  new_status text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_history_listing_key ON status_history(listing_key);
COMMENT ON TABLE status_history IS 'Every status change per listing (e.g. Active -> Pending). Join to listings via listing_key.';

-- Price change history (Section 7.4 Step 4). Uses listing_key so we don't require listings.id on existing large tables.
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key text NOT NULL,
  old_price numeric,
  new_price numeric,
  change_pct numeric,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_listing_key ON price_history(listing_key);
COMMENT ON TABLE price_history IS 'Every price change per listing for display and notifications. Join to listings via listing_key.';
