-- Market Truth Step 7 — counted repairs.
-- close_price_per_sqft 0 → NULL (67,079 before).
-- buyer_financing '[object Object]' → NULL (26 before).
-- listing_views was empty (0 rows); trending moves to user_events; drop the table.

-- Skip compute_listing_derived_fields (PITI etc.) — these columns are not
-- inputs to that trigger; firing it on 67k rows times out.
BEGIN;
SET LOCAL session_replication_role = replica;

UPDATE public.listings
SET close_price_per_sqft = NULL
WHERE close_price_per_sqft = 0;

UPDATE public.listings
SET buyer_financing = NULL
WHERE buyer_financing ILIKE '%object Object%';
COMMIT;

CREATE OR REPLACE FUNCTION public.get_trending_listing_keys(p_city text, p_limit int DEFAULT 16)
RETURNS TABLE (listing_key text)
LANGUAGE sql
STABLE
AS $$
  SELECT e.listing_key
  FROM public.user_events e
  WHERE e.event_type = 'listing_view'
    AND e.listing_key IS NOT NULL
    AND e.event_at > now() - interval '24 hours'
    AND (
      e.payload->>'city' = p_city
      OR e.page_path ILIKE '%' || p_city || '%'
    )
  GROUP BY e.listing_key
  ORDER BY count(*) DESC
  LIMIT GREATEST(1, LEAST(coalesce(p_limit, 16), 24));
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_events(
  p_listing_views_days int DEFAULT 90,
  p_visits_days int DEFAULT 90,
  p_user_events_days int DEFAULT 180
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted int;
  ue_deleted int;
BEGIN
  DELETE FROM visits
  WHERE created_at < now() - (p_visits_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM user_events
  WHERE event_at < now() - (p_user_events_days || ' days')::interval;
  GET DIAGNOSTICS ue_deleted = ROW_COUNT;

  RETURN json_build_object(
    'listing_views_deleted', 0,
    'visits_deleted', v_deleted,
    'user_events_deleted', ue_deleted
  );
END;
$$;

DROP TABLE IF EXISTS public.listing_views CASCADE;
