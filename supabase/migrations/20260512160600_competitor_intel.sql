-- competitor_intel: raw scrape results from Apify actors monitoring the 8
-- Bend-area competitor brokerages. The brain reads this to find content
-- formats competitors are using effectively, ranking gaps, ad creative we
-- could counter, and shifts in their behavior that may signal algorithm
-- changes or strategy pivots.
--
-- competitor (canonical slugs, lock these): 'cascade_hasson_sothebys' |
--   'compass_bend' | 'windermere_central_oregon' | 'cascade_sothebys' |
--   'coldwell_banker_bain_bend' | 'berkshire_hathaway_nw_bend' |
--   'john_l_scott_bend' | 'remax_key_properties_bend' |
--   'opendoor' | 'offerpad'
-- source: 'fb_ad_library' | 'google_serp' | 'instagram_profile' |
--         'tiktok_profile' | 'google_maps_reviews' | 'zillow_agent' |
--         'website_diff'
-- data_type: 'ad' | 'serp_position' | 'post' | 'review' | 'listing' |
--            'profile_metric' | 'page_change'

CREATE TABLE IF NOT EXISTS public.competitor_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  observation_date date NOT NULL,

  competitor text NOT NULL,
  source text NOT NULL,
  data_type text NOT NULL,
  data jsonb NOT NULL,
  url text,
  apify_run_id text
);

CREATE INDEX IF NOT EXISTS competitor_intel_competitor_date_idx
  ON public.competitor_intel (competitor, observation_date DESC);
CREATE INDEX IF NOT EXISTS competitor_intel_source_date_idx
  ON public.competitor_intel (source, observation_date DESC);
CREATE INDEX IF NOT EXISTS competitor_intel_type_date_idx
  ON public.competitor_intel (data_type, observation_date DESC);

ALTER TABLE public.competitor_intel ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.competitor_intel FROM anon;
REVOKE ALL ON TABLE public.competitor_intel FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.competitor_intel TO service_role;
