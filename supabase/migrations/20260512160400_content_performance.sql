-- content_performance: post-publish metrics for every piece of content.
-- The brain reads this to learn which formats/topics/hooks drove qualified
-- seller leads (the north-star metric) and which underperformed.
--
-- One row per (platform, platform_post_id, measured_at) so the same post
-- can be measured at multiple snapshots (e.g. 1h, 24h, 7d, 30d, 90d).
-- The brief_id links back to the content_briefs row that produced the post
-- so the brain can compare predicted vs actual outcome.

CREATE TABLE IF NOT EXISTS public.content_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES public.content_briefs(id) ON DELETE SET NULL,
  calendar_id uuid REFERENCES public.content_calendar(id) ON DELETE SET NULL,

  platform text NOT NULL,
  platform_post_id text NOT NULL,
  published_at timestamptz NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  hours_since_publish numeric NOT NULL,

  impressions numeric,
  reach numeric,
  views numeric,
  engagements numeric,
  clicks numeric,
  saves numeric,
  shares numeric,
  comments numeric,
  follows numeric,
  watch_time_seconds numeric,
  conversions numeric,
  attributed_leads numeric,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,

  UNIQUE (platform, platform_post_id, measured_at)
);

CREATE INDEX IF NOT EXISTS content_performance_platform_published_idx
  ON public.content_performance (platform, published_at DESC);
CREATE INDEX IF NOT EXISTS content_performance_brief_idx
  ON public.content_performance (brief_id);

ALTER TABLE public.content_performance ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_performance FROM anon;
REVOKE ALL ON TABLE public.content_performance FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_performance TO service_role;
