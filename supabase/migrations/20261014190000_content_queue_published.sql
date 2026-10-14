-- Content-queue publish log. One row per content item + channel + PT date.
-- The unique key makes a duplicate publish impossible. The daily run
-- (`scripts/content-queue/publish.mjs --live`) posts any scheduled_at on or
-- before today that has no row here (catch-up of a missed day).
--
-- Hosted apply: `npm run db:push` or Supabase MCP apply_migration after this
-- file lands on main. No GitHub Action auto-applies migrations.

CREATE TABLE IF NOT EXISTS public.content_queue_published (
  content_item text NOT NULL,
  channel text NOT NULL,
  published_date date NOT NULL,
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'posted', 'failed')),
  remote_id text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_item, channel, published_date)
);

ALTER TABLE public.content_queue_published ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_queue_published FROM anon;
REVOKE ALL ON TABLE public.content_queue_published FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_queue_published TO service_role;
