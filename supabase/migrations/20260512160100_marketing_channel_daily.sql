-- marketing_channel_daily: pre-aggregated daily metrics per channel.
-- The marketing brain reads this to compute deltas, trends, and signal.
-- One row per (date, channel, scope, scope_id, metric).
--
-- channel:   'meta_ads' | 'meta_page' | 'instagram' | 'ga4' | 'gsc' | 'fub' |
--            'youtube' | 'linkedin' | 'x' | 'tiktok' | 'gbp' | 'threads' |
--            'nextdoor' | 'pinterest' | 'email'
-- scope:     'account' (channel-wide) | 'campaign' | 'post' | 'page' |
--            'ad' | 'adset' | 'video' | 'sequence' | 'channel'
-- scope_id:  the campaign_id, post_id, page_id, etc.  Empty string for
--            'account' scope.
-- metric:    'impressions' | 'reach' | 'clicks' | 'spend' | 'ctr' | 'cpm' |
--            'cpc' | 'engagements' | 'saves' | 'shares' | 'comments' |
--            'follows' | 'leads' | 'conversions' | 'sessions' | 'users' |
--            'bounce_rate' | 'session_duration' | 'page_views' | etc.
-- value:     numeric value (use 0 for counts, decimals for rates).
-- metadata:  free-form JSON for things that vary by channel (e.g.
--            campaign_name, post_type, country_breakdown).
-- source:    'meta_ads_insights_api' | 'meta_page_insights_api' |
--            'ga4_data_api' | 'gsc_api' | 'fub_api' | etc.

CREATE TABLE IF NOT EXISTS public.marketing_channel_daily (
  date date NOT NULL,
  channel text NOT NULL,
  scope text NOT NULL DEFAULT 'account',
  scope_id text NOT NULL DEFAULT '',
  metric text NOT NULL,
  value numeric NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, channel, scope, scope_id, metric)
);

CREATE INDEX IF NOT EXISTS marketing_channel_daily_channel_date_idx
  ON public.marketing_channel_daily (channel, date DESC);

CREATE INDEX IF NOT EXISTS marketing_channel_daily_metric_date_idx
  ON public.marketing_channel_daily (metric, date DESC);

CREATE INDEX IF NOT EXISTS marketing_channel_daily_scope_idx
  ON public.marketing_channel_daily (scope, scope_id) WHERE scope <> 'account';

ALTER TABLE public.marketing_channel_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_channel_daily FROM anon;
REVOKE ALL ON TABLE public.marketing_channel_daily FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_channel_daily TO service_role;
