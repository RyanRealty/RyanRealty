-- Phase 4.6 of AUTONOMOUS_PIPELINE_BRIEF.md: content_performance upgrade.
--
-- The existing content_performance table (20260512160400) already has:
--   id, brief_id, calendar_id, platform, platform_post_id, published_at,
--   measured_at, hours_since_publish, impressions, reach, views, engagements,
--   clicks, saves, shares, comments, follows, watch_time_seconds, conversions,
--   attributed_leads, metadata, source
--
-- This migration adds the columns needed by the performance_loop producer and
-- the brain's learning cycle:
--
--   action_id                   FK to marketing_brain_actions; the newer FK name
--   post_external_id            platform-specific post ID (alias for platform_post_id
--                               where naming was inconsistent; kept separate to allow
--                               platforms that issue a separate external ID at publish)
--   posted_at                   canonical publish timestamp (alias for published_at
--                               for new code that does not know the old column name)
--   metrics_48h                 snapshot JSONB captured at the 48-hour mark
--   metrics_7d                  snapshot JSONB captured at the 7-day mark
--   metrics_30d                 snapshot JSONB captured at the 30-day mark
--   north_star_attributed_seller_leads  seller leads directly attributed to this post
--   asset_library_refs          UUIDs of asset_library rows used in this post
--   pulled_at                   when the performance_loop last refreshed this row
--
-- IDEMPOTENT: uses ADD COLUMN IF NOT EXISTS throughout.
-- Depends on: 20260516200000 (marketing_brain_actions_upgrade) for action_id FK.

ALTER TABLE public.content_performance
  ADD COLUMN IF NOT EXISTS action_id                          uuid
    REFERENCES public.marketing_brain_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS post_external_id                   text,
  ADD COLUMN IF NOT EXISTS posted_at                          timestamptz,
  ADD COLUMN IF NOT EXISTS metrics_48h                        jsonb,
  ADD COLUMN IF NOT EXISTS metrics_7d                         jsonb,
  ADD COLUMN IF NOT EXISTS metrics_30d                        jsonb,
  ADD COLUMN IF NOT EXISTS north_star_attributed_seller_leads int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asset_library_refs                 text[],
  ADD COLUMN IF NOT EXISTS pulled_at                          timestamptz;

-- Index: query performance by platform + recency (already partially covered by
-- content_performance_platform_published_idx; this adds posted_at variant).
CREATE INDEX IF NOT EXISTS idx_cp_platform_posted
  ON public.content_performance (platform, posted_at DESC)
  WHERE posted_at IS NOT NULL;

-- Index: join from marketing_brain_actions to its performance rows.
CREATE INDEX IF NOT EXISTS idx_cp_action_id
  ON public.content_performance (action_id)
  WHERE action_id IS NOT NULL;
