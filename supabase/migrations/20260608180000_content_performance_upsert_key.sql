-- Close the marketing measurement loop: make the content_performance write path
-- actually able to insert.
--
-- WHY (verified live 2026-06-08, content_performance had 0 rows): the 2026-05-16
-- upgrade migration ADDed the action-driven columns (action_id, post_external_id,
-- posted_at, metrics_48h/7d/30d, north_star_attributed_seller_leads) that the
-- publisher-sweep + performance-pull crons write, but it left TWO landmines that
-- made every one of those upserts throw at runtime, so the table never populated:
--
--   1. The crons upsert with ON CONFLICT (action_id, platform), but no unique
--      index on (action_id, platform) ever existed (the only unique constraint was
--      the legacy UNIQUE (platform, platform_post_id, measured_at)). Postgres
--      requires a matching unique index for ON CONFLICT, so the upsert errored.
--      publisher-sweep swallows that error (console.error), so the row silently
--      never appeared.
--   2. Four original columns are still NOT NULL with no default
--      (platform_post_id, published_at, hours_since_publish, source). The new
--      action-driven write path supplies post_external_id/posted_at/metrics_*
--      instead, so a partial-column insert violated NOT NULL even once a
--      constraint existed.
--
-- This migration removes both landmines. Behaviour-preserving for the legacy
-- measurement-loop writer (it still supplies the full legacy column set).

-- 1. Stop the legacy NOT NULL columns from blocking the action-driven write path.
ALTER TABLE public.content_performance
  ALTER COLUMN platform_post_id    DROP NOT NULL,
  ALTER COLUMN published_at        DROP NOT NULL,
  ALTER COLUMN hours_since_publish DROP NOT NULL,
  ALTER COLUMN source              DROP NOT NULL;

-- 2. Canonical upsert key: one content_performance row per (action_id, platform).
--    NON-partial on purpose so supabase-js onConflict:'action_id,platform' (which
--    emits no WHERE predicate) can use it as the ON CONFLICT arbiter. action_id is
--    nullable and the legacy measurement-loop writer inserts NULL-action_id rows;
--    NULLs are distinct in a unique index, so those legacy rows never collide.
--    Table is empty at apply time, so no existing-duplicate risk.
CREATE UNIQUE INDEX IF NOT EXISTS content_performance_action_platform_key
  ON public.content_performance (action_id, platform);
