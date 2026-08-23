-- Market Truth Step 2 — on-market episodes from listing_history.
-- Never reads status_change_timestamp. Off-market from MlsStatus /
-- StandardStatus FieldChange, plus listing-row close for leftover opens.
-- Same-calendar-day events MUST order by event_date, not date+uuid
-- (uuid order put Closed before NewListing and left 48k spans open).
-- ODS 60-day rule is for CDOM, not for splitting episodes.
-- Batch: refresh_market_fact_listing_span(p_after, p_limit, p_modified_since)

ALTER TABLE public.market_fact_listing_span
  ADD COLUMN IF NOT EXISTS flags text[] NOT NULL DEFAULT '{}';

DROP FUNCTION IF EXISTS public.refresh_market_fact_listing_span(text, integer);

CREATE OR REPLACE FUNCTION public.refresh_market_fact_listing_span(
  p_after text DEFAULT '',
  p_limit integer DEFAULT 4000,
  p_modified_since date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '90s'
AS $$
DECLARE
  v_last text := coalesce(p_after, '');
  v_n integer := 0;
  v_lim integer := least(greatest(coalesce(p_limit, 4000), 1), 8000);
  v_keys text[];
BEGIN
  SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[])
  INTO v_keys
  FROM (
    SELECT l."ListingKey" AS k
    FROM public.listings l
    WHERE l."ListingKey" > v_last
      AND (
        p_modified_since IS NULL
        OR l."ModificationTimestamp" >= p_modified_since::timestamp
      )
    ORDER BY l."ListingKey"
    LIMIT v_lim
  ) s;

  IF array_length(v_keys, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'upserted', 0, 'last_key', v_last, 'done', true);
  END IF;
  v_last := v_keys[array_length(v_keys, 1)];

  DELETE FROM public.market_fact_listing_span
  WHERE listing_key = ANY (v_keys);

  WITH keys AS (
    SELECT
      l."ListingKey" AS listing_key,
      (timezone('America/Los_Angeles', l."OnMarketDate"))::date AS row_on,
      l.off_market_date AS row_off,
      (timezone('America/Los_Angeles', l."CloseDate"))::date AS close_d,
      l."ListPrice" AS list_price,
      l."StandardStatus" AS status,
      CASE
        WHEN l.off_market_date IS NOT NULL
         AND l."OnMarketDate" IS NOT NULL
         AND l.off_market_date < l."OnMarketDate"::date
        THEN ARRAY['inverted_listing_dates']::text[]
        ELSE '{}'::text[]
      END AS flags
    FROM public.listings l
    WHERE l."ListingKey" = ANY (v_keys)
  ),
  ev AS (
    SELECT
      h.listing_key,
      h.event_date,
      (timezone('America/Los_Angeles', h.event_date))::date AS d,
      CASE
        WHEN h.event IN ('NewListing', 'BackOnMarket') THEN 'ON'
        WHEN h.event = 'FieldChange'
         AND lower(coalesce(h.raw->>'Field', '')) IN ('mlsstatus', 'standardstatus') THEN
          CASE
            WHEN lower(coalesce(h.raw->>'NewValue', '')) IN (
              'active', 'active under contract'
            ) THEN 'ON'
            WHEN lower(coalesce(h.raw->>'NewValue', '')) IN (
              'pending', 'closed', 'expired', 'cancelled', 'canceled',
              'withdrawn', 'hold', 'coming soon'
            ) THEN 'OFF'
          END
      END AS dir,
      h.raw->>'NewValue' AS new_status,
      h.price,
      h.id
    FROM public.listing_history h
    WHERE h.listing_key = ANY (v_keys)
      AND h.event_date IS NOT NULL
      AND (
        h.event IN ('NewListing', 'BackOnMarket')
        OR (
          h.event = 'FieldChange'
          AND lower(coalesce(h.raw->>'Field', '')) IN ('mlsstatus', 'standardstatus')
        )
      )
  ),
  ordered AS (
    SELECT
      e.*,
      lag(e.dir) OVER (
        PARTITION BY e.listing_key
        ORDER BY e.event_date, e.id
      ) AS prev_dir
    FROM ev e
    WHERE e.dir IS NOT NULL
  ),
  islands AS (
    SELECT
      listing_key,
      event_date,
      d,
      dir,
      new_status,
      price,
      id,
      sum(CASE WHEN dir = 'ON' AND prev_dir IS DISTINCT FROM 'ON' THEN 1 ELSE 0 END)
        OVER (
          PARTITION BY listing_key
          ORDER BY event_date, id
        ) AS ep
    FROM ordered
  ),
  built AS (
    SELECT
      listing_key,
      ep,
      min(d) FILTER (WHERE dir = 'ON') AS on_d,
      min(d) FILTER (WHERE dir = 'OFF') AS off_d,
      (array_agg(new_status ORDER BY event_date, id)
        FILTER (WHERE dir = 'OFF' AND new_status IS NOT NULL))[1] AS end_status,
      (array_agg(price ORDER BY event_date, id)
        FILTER (WHERE price IS NOT NULL))[1] AS list_price
    FROM islands
    WHERE ep > 0
    GROUP BY listing_key, ep
  ),
  from_history_raw AS (
    SELECT
      b.listing_key,
      row_number() OVER (PARTITION BY b.listing_key ORDER BY b.on_d, b.ep)::smallint AS episode_no,
      b.on_d AS on_market_date,
      CASE
        WHEN b.off_d IS NULL THEN NULL
        WHEN b.off_d < b.on_d THEN b.on_d
        ELSE b.off_d
      END AS off_market_date,
      CASE
        WHEN b.off_d IS NOT NULL AND b.off_d < b.on_d THEN 'inverted_repaired'
        WHEN b.end_status ILIKE 'closed%' THEN 'closed'
        WHEN b.end_status ILIKE 'expir%' THEN 'expired'
        WHEN b.end_status ILIKE 'cancel%' THEN 'canceled'
        WHEN b.end_status ILIKE 'withdraw%' THEN 'withdrawn'
        WHEN b.end_status ILIKE 'pend%' THEN 'pending'
        WHEN b.end_status ILIKE 'hold%' THEN 'canceled'
        WHEN b.end_status ILIKE 'coming soon%' THEN 'coming_soon'
        WHEN b.off_d IS NULL THEN 'open'
        ELSE 'open'
      END AS end_reason,
      b.list_price,
      'history'::text AS span_source
    FROM built b
    WHERE b.on_d IS NOT NULL
  ),
  hist_numbered AS (
    SELECT
      h.*,
      lead(h.on_market_date) OVER (
        PARTITION BY h.listing_key ORDER BY h.episode_no
      ) AS next_on,
      max(h.episode_no) OVER (PARTITION BY h.listing_key) AS last_ep
    FROM from_history_raw h
  ),
  from_history AS (
    SELECT
      h.listing_key,
      h.episode_no,
      h.on_market_date,
      CASE
        WHEN h.off_market_date IS NOT NULL THEN h.off_market_date
        WHEN h.episode_no < h.last_ep THEN
          CASE
            WHEN h.next_on IS NULL THEN h.on_market_date
            WHEN h.next_on < h.on_market_date THEN h.on_market_date
            ELSE h.next_on
          END
        WHEN k.status IS DISTINCT FROM 'Active'
         AND k.status IS DISTINCT FROM 'Active Under Contract' THEN
          CASE
            WHEN k.row_off IS NOT NULL AND k.row_off >= h.on_market_date THEN k.row_off
            WHEN k.close_d IS NOT NULL AND k.close_d >= h.on_market_date THEN k.close_d
            ELSE h.on_market_date
          END
        ELSE NULL
      END AS off_market_date,
      CASE
        WHEN h.off_market_date IS NOT NULL THEN h.end_reason
        WHEN h.episode_no < h.last_ep THEN 'relisted'
        WHEN k.status IS DISTINCT FROM 'Active'
         AND k.status IS DISTINCT FROM 'Active Under Contract' THEN
          CASE
            WHEN (k.row_off IS NOT NULL AND k.row_off < h.on_market_date)
              OR (k.row_off IS NULL AND k.close_d IS NOT NULL AND k.close_d < h.on_market_date)
              THEN 'inverted_repaired'
            WHEN k.status ILIKE '%Closed%' THEN 'closed'
            WHEN k.status ILIKE '%Expir%' THEN 'expired'
            WHEN k.status ILIKE '%Cancel%' THEN 'canceled'
            WHEN k.status ILIKE '%Withdraw%' THEN 'withdrawn'
            WHEN k.status ILIKE '%Pend%' THEN 'pending'
            WHEN k.status ILIKE '%Hold%' THEN 'canceled'
            WHEN k.status ILIKE '%Coming Soon%' THEN 'coming_soon'
            ELSE 'open'
          END
        ELSE 'open'
      END AS end_reason,
      coalesce(h.list_price, k.list_price) AS list_price,
      h.span_source,
      k.flags
    FROM hist_numbered h
    JOIN keys k ON k.listing_key = h.listing_key
  ),
  from_row AS (
    SELECT
      k.listing_key,
      (coalesce((
        SELECT max(h.episode_no) FROM from_history h WHERE h.listing_key = k.listing_key
      ), 0) + 1)::smallint AS episode_no,
      k.row_on AS on_market_date,
      CASE
        WHEN k.status IN ('Active', 'Active Under Contract') THEN NULL
        WHEN k.row_off IS NOT NULL AND k.row_on IS NOT NULL AND k.row_off < k.row_on
          THEN k.row_on
        WHEN k.row_off IS NOT NULL THEN k.row_off
        WHEN k.close_d IS NOT NULL AND k.row_on IS NOT NULL AND k.close_d >= k.row_on
          THEN k.close_d
        WHEN k.status IS DISTINCT FROM 'Active'
         AND k.status IS DISTINCT FROM 'Active Under Contract'
          THEN k.row_on
        ELSE NULL
      END AS off_market_date,
      CASE
        WHEN k.status IN ('Active', 'Active Under Contract') THEN 'open'
        WHEN k.row_off IS NOT NULL AND k.row_on IS NOT NULL AND k.row_off < k.row_on
          THEN 'inverted_repaired'
        WHEN k.status ILIKE '%Closed%' THEN 'closed'
        WHEN k.status ILIKE '%Expir%' THEN 'expired'
        WHEN k.status ILIKE '%Cancel%' THEN 'canceled'
        WHEN k.status ILIKE '%Withdraw%' THEN 'withdrawn'
        WHEN k.status ILIKE '%Pend%' THEN 'pending'
        WHEN k.status ILIKE '%Coming Soon%' THEN 'coming_soon'
        WHEN k.row_off IS NULL THEN 'open'
        ELSE 'open'
      END AS end_reason,
      k.list_price,
      'listing_row'::text AS span_source,
      k.flags
    FROM keys k
    WHERE k.row_on IS NOT NULL
      AND (
        NOT EXISTS (SELECT 1 FROM from_history h WHERE h.listing_key = k.listing_key)
        OR (
          k.status IN ('Active', 'Active Under Contract')
          AND NOT EXISTS (
            SELECT 1 FROM from_history h
            WHERE h.listing_key = k.listing_key
              AND h.off_market_date IS NULL
          )
        )
      )
  ),
  combined AS (
    SELECT * FROM from_history
    UNION ALL
    SELECT * FROM from_row
  ),
  stamped AS (
    SELECT
      c.listing_key,
      c.episode_no,
      c.on_market_date,
      c.off_market_date,
      c.end_reason,
      c.list_price,
      c.span_source,
      CASE WHEN c.span_source = 'history' THEN 'recovered' ELSE 'assumed' END
        AS first_on_market_confidence,
      c.flags
    FROM combined c
  )
  INSERT INTO public.market_fact_listing_span (
    listing_key, episode_no, on_market_date, off_market_date, end_reason,
    list_price, span_source, first_on_market_confidence, flags
  )
  SELECT
    listing_key, episode_no, on_market_date, off_market_date, end_reason,
    list_price, span_source, first_on_market_confidence, flags
  FROM stamped
  ON CONFLICT (listing_key, episode_no) DO UPDATE SET
    on_market_date = EXCLUDED.on_market_date,
    off_market_date = EXCLUDED.off_market_date,
    end_reason = EXCLUDED.end_reason,
    list_price = EXCLUDED.list_price,
    span_source = EXCLUDED.span_source,
    first_on_market_confidence = EXCLUDED.first_on_market_confidence,
    flags = EXCLUDED.flags,
    computed_at = now();

  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'upserted', v_n,
    'last_key', v_last,
    'done', array_length(v_keys, 1) < v_lim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_market_fact_listing_span(text, integer, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_market_fact_listing_span(text, integer, date)
  TO service_role;
