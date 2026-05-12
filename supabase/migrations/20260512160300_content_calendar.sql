-- content_calendar: scheduled publish slots derived from content_briefs.
-- One row per (brief, platform, scheduled_for) so a single brief can fan out
-- to multiple platforms at different times.
--
-- status flow: queued -> rendering -> ready -> published -> measured
--              ('failed' is a terminal state for unrecoverable errors).

CREATE TABLE IF NOT EXISTS public.content_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES public.content_briefs(id) ON DELETE CASCADE,
  platform text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'rendering', 'ready', 'published', 'measured', 'failed')),
  asset_url text,
  platform_post_id text,
  publish_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_calendar_scheduled_status_idx
  ON public.content_calendar (scheduled_for, status);
CREATE INDEX IF NOT EXISTS content_calendar_brief_idx
  ON public.content_calendar (brief_id);
CREATE INDEX IF NOT EXISTS content_calendar_platform_status_idx
  ON public.content_calendar (platform, status);

ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_calendar FROM anon;
REVOKE ALL ON TABLE public.content_calendar FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_calendar TO service_role;
