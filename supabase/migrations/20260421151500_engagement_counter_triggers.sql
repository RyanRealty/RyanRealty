-- Wire AFTER INSERT/DELETE triggers from engagement source tables to the
-- denormalized counter columns on `listings`. The counter columns
-- (like_count, save_count, share_count, email_share_count, view_count,
-- inquiry_count) were added previously but had no triggers, so they
-- were dead-on-arrival. This migration makes them live.
--
-- Source -> column mapping:
--   likes              -> listings.like_count
--   saved_listings     -> listings.save_count
--   listing_shares     -> listings.share_count
--                       + listings.email_share_count when share_method
--                         ILIKE '%email%' OR recipient_email IS NOT NULL
--   listing_views      -> listings.view_count
--   listing_inquiries  -> listings.inquiry_count
--
-- Idempotent: drops + recreates trigger objects each run.
-- Backfill: pulls current source counts so columns reflect history.
-- Governance purge follow-up (Pass 3 of post-purge cleanup, 2026-04-21).

-- ---------------------------------------------------------------------------
-- Helper: bump a counter on listings by listing_key, clamped to >= 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._incr_listing_counter(
  p_listing_key TEXT,
  p_column      TEXT,
  p_delta       INT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_listing_key IS NULL OR length(p_listing_key) = 0 THEN
    RETURN;
  END IF;
  EXECUTE format(
    'UPDATE public.listings SET %I = GREATEST(0, COALESCE(%I, 0) + $1) WHERE "ListingKey" = $2',
    p_column, p_column
  ) USING p_delta, p_listing_key;
END;
$$;

-- ---------------------------------------------------------------------------
-- Generic trigger function. Dispatches via TG_ARGV:
--   TG_ARGV[0] = primary counter column on listings (required)
--   TG_ARGV[1] = optional secondary column for conditional bump
--                (currently used by listing_shares -> email_share_count)
-- Increment on INSERT, decrement on DELETE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._listing_engagement_counter_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_column       TEXT := TG_ARGV[0];
  v_extra_column TEXT := CASE WHEN TG_NARGS > 1 THEN TG_ARGV[1] ELSE NULL END;
  v_delta        INT  := CASE TG_OP WHEN 'INSERT' THEN 1 WHEN 'DELETE' THEN -1 ELSE 0 END;
  v_listing_key  TEXT;
  v_match_extra  BOOLEAN;
BEGIN
  IF v_delta = 0 THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_listing_key := NEW.listing_key;
    -- listing_shares: email-share match logic
    IF v_extra_column = 'email_share_count' AND TG_TABLE_NAME = 'listing_shares' THEN
      v_match_extra := (NEW.share_method ILIKE '%email%') OR (NEW.recipient_email IS NOT NULL);
    ELSE
      v_match_extra := FALSE;
    END IF;
  ELSE
    v_listing_key := OLD.listing_key;
    IF v_extra_column = 'email_share_count' AND TG_TABLE_NAME = 'listing_shares' THEN
      v_match_extra := (OLD.share_method ILIKE '%email%') OR (OLD.recipient_email IS NOT NULL);
    ELSE
      v_match_extra := FALSE;
    END IF;
  END IF;

  PERFORM public._incr_listing_counter(v_listing_key, v_column, v_delta);

  IF v_match_extra AND v_extra_column IS NOT NULL THEN
    PERFORM public._incr_listing_counter(v_listing_key, v_extra_column, v_delta);
  END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_likes_listing_counter ON public.likes;
CREATE TRIGGER trg_likes_listing_counter
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public._listing_engagement_counter_trigger('like_count');

DROP TRIGGER IF EXISTS trg_saved_listings_listing_counter ON public.saved_listings;
CREATE TRIGGER trg_saved_listings_listing_counter
  AFTER INSERT OR DELETE ON public.saved_listings
  FOR EACH ROW EXECUTE FUNCTION public._listing_engagement_counter_trigger('save_count');

DROP TRIGGER IF EXISTS trg_listing_shares_listing_counter ON public.listing_shares;
CREATE TRIGGER trg_listing_shares_listing_counter
  AFTER INSERT OR DELETE ON public.listing_shares
  FOR EACH ROW EXECUTE FUNCTION public._listing_engagement_counter_trigger('share_count', 'email_share_count');

DROP TRIGGER IF EXISTS trg_listing_views_listing_counter ON public.listing_views;
CREATE TRIGGER trg_listing_views_listing_counter
  AFTER INSERT OR DELETE ON public.listing_views
  FOR EACH ROW EXECUTE FUNCTION public._listing_engagement_counter_trigger('view_count');

DROP TRIGGER IF EXISTS trg_listing_inquiries_listing_counter ON public.listing_inquiries;
CREATE TRIGGER trg_listing_inquiries_listing_counter
  AFTER INSERT OR DELETE ON public.listing_inquiries
  FOR EACH ROW EXECUTE FUNCTION public._listing_engagement_counter_trigger('inquiry_count');

-- ---------------------------------------------------------------------------
-- Backfill from current source-table state. Existing source counts are
-- tiny today (likes=6, saved=2, others=0) so this is a one-shot, no-chunking.
-- The triggers handle every change going forward.
-- Only updates rows where the source has matching entries; rows without any
-- engagement keep their existing column value (typically 0 / NULL).
-- ---------------------------------------------------------------------------
UPDATE public.listings l SET like_count = sub.n
  FROM (SELECT listing_key, count(*)::int AS n FROM public.likes WHERE listing_key IS NOT NULL GROUP BY listing_key) sub
  WHERE l."ListingKey" = sub.listing_key;

UPDATE public.listings l SET save_count = sub.n
  FROM (SELECT listing_key, count(*)::int AS n FROM public.saved_listings WHERE listing_key IS NOT NULL GROUP BY listing_key) sub
  WHERE l."ListingKey" = sub.listing_key;

UPDATE public.listings l SET share_count = sub.n
  FROM (SELECT listing_key, count(*)::int AS n FROM public.listing_shares WHERE listing_key IS NOT NULL GROUP BY listing_key) sub
  WHERE l."ListingKey" = sub.listing_key;

UPDATE public.listings l SET email_share_count = sub.n
  FROM (
    SELECT listing_key, count(*)::int AS n
    FROM public.listing_shares
    WHERE listing_key IS NOT NULL
      AND ((share_method ILIKE '%email%') OR (recipient_email IS NOT NULL))
    GROUP BY listing_key
  ) sub
  WHERE l."ListingKey" = sub.listing_key;

UPDATE public.listings l SET view_count = sub.n
  FROM (SELECT listing_key, count(*)::int AS n FROM public.listing_views WHERE listing_key IS NOT NULL GROUP BY listing_key) sub
  WHERE l."ListingKey" = sub.listing_key;

UPDATE public.listings l SET inquiry_count = sub.n
  FROM (SELECT listing_key, count(*)::int AS n FROM public.listing_inquiries WHERE listing_key IS NOT NULL GROUP BY listing_key) sub
  WHERE l."ListingKey" = sub.listing_key;
