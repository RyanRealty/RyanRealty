-- content_briefs: the marketing brain writes structured content briefs here.
-- The content engine (video skills, blog skill, social skills) reads from
-- this table and produces assets. Briefs flow through statuses from
-- 'pending' to 'measured'.
--
-- format: tied to a format skill name (e.g. 'listing_reveal',
--         'market-data-video', 'news-video', 'blog-post', 'ig_carousel').
-- platforms: target distribution channels for this brief's output.
-- status flow: pending -> in_production -> ready -> published -> measured
--              ('killed' is a terminal state for retired briefs).

CREATE TABLE IF NOT EXISTS public.content_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  topic text NOT NULL,
  format text NOT NULL,
  platforms text[] NOT NULL DEFAULT '{}'::text[],
  hook text NOT NULL,
  body text,
  cta text,
  target_audience text NOT NULL,

  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  predicted_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_production', 'ready', 'published', 'measured', 'killed')),

  generated_by text NOT NULL,
  generation_reason text,

  approved_by text,
  approved_at timestamptz,

  scheduled_for timestamptz,
  published_at timestamptz,
  measured_at timestamptz
);

CREATE INDEX IF NOT EXISTS content_briefs_status_idx ON public.content_briefs (status);
CREATE INDEX IF NOT EXISTS content_briefs_scheduled_idx ON public.content_briefs (scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_briefs_format_idx ON public.content_briefs (format);

ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_briefs FROM anon;
REVOKE ALL ON TABLE public.content_briefs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_briefs TO service_role;
