-- Add fbclid column to visitor_sessions so Meta click-ids are persisted
-- alongside utm_* for first-touch attribution. Populated by the
-- /api/visitors/track route on the first event of each session.
ALTER TABLE public.visitor_sessions
  ADD COLUMN IF NOT EXISTS fbclid text;

-- Index so we can efficiently look up sessions by Meta click-id (e.g. for
-- CAPI event deduplication or ad-click attribution reports).
CREATE INDEX IF NOT EXISTS visitor_sessions_fbclid_idx
  ON public.visitor_sessions (fbclid)
  WHERE fbclid IS NOT NULL;
