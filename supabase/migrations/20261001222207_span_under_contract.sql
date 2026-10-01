-- On-market episodes count Active only: a listing under contract is off the market
-- (Market Truth REGISTRY 2.2, Matt 2026-10-01 "Republish all 248").
--
-- This MLS marks Active Under Contract with the Contingency field on an Active
-- listing: MlsStatus stays Active and Contingency changes from '' to a code (A,
-- S, ...); removing it sets it back to ''. Spark history example,
-- 20250811165015327233000000: 2026-07-08 18:24 MlsStatus Pending -> Active and
-- Contingency '' -> 'S' in the same instant (back under contract, contingent).
-- The episode builder read only MlsStatus/StandardStatus and counted
-- 'Active Under Contract' as on the market, so every contingent contract stayed
-- in homes for sale until it went Pending: 22 of the 1,258 homes the August 2026
-- edition counted for sale on 2026-08-31 were under contract that day (full
-- Spark histories, 2026-10-01).
--
-- What changes:
--   * StandardStatus 'Active Under Contract' is OFF (under contract).
--   * A Contingency change while the listing's MLS status is Active is OFF when
--     it sets a code and ON when it clears it (the contract fell through). The
--     status is read as of the same instant, and a Contingency change sorts
--     after a status change with the same timestamp, so "back to Active, under
--     contract" in one edit ends up off the market. A Contingency change while
--     the listing is not Active (cleared at closing, say) is ignored.
--   * An episode ended by a contract ends 'pending' (under contract), so the
--     report's pendings count it as a contract.
--   * A listing whose row says Active Under Contract and whose history does not
--     show it ends its episode at its purchase contract date when the MLS gave
--     one; with no date it stays open, as before (no date is invented).
-- Everything else is the 2026-08-22 builder, unchanged.

CREATE OR REPLACE FUNCTION public.refresh_market_fact_listing_span(p_after text DEFAULT ''::text, p_limit integer DEFAULT 4000, p_modified_since date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '90s'
AS $function$
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
      l.purchase_contract_date AS contract_d,
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
  ev_raw AS (
    SELECT
      h.listing_key,
      h.event_date,
      (timezone('America/Los_Angeles', h.event_date))::date AS d,
      h.event,
      lower(coalesce(h.raw->>'Field', '')) AS field,
      h.raw->>'NewValue' AS new_value,
      h.price,
      h.id
    FROM public.listing_history h
    WHERE h.listing_key = ANY (v_keys)
      AND h.event_date IS NOT NULL
      AND (
        h.event IN ('NewListing', 'BackOnMarket')
        OR (
          h.event = 'FieldChange'
          AND lower(coalesce(h.raw->>'Field', '')) IN ('mlsstatus', 'standardstatus', 'contingency')
        )
      )
  ),
  ev AS (
    SELECT
      r.listing_key,
      r.event_date,
      r.d,
      -- A Contingency change sorts after a status change in the same instant.
      CASE WHEN r.field = 'contingency' THEN 1 ELSE 0 END AS ord,
      CASE
        WHEN r.event IN ('NewListing', 'BackOnMarket') THEN 'ON'
        WHEN r.field IN ('mlsstatus', 'standardstatus') THEN
          CASE
            WHEN lower(coalesce(r.new_value, '')) = 'active' THEN 'ON'
            WHEN lower(coalesce(r.new_value, '')) IN (
              'active under contract', 'pending', 'closed', 'expired', 'cancelled', 'canceled',
              'withdrawn', 'hold', 'coming soon'
            ) THEN 'OFF'
          END
        -- The listing's status as of the change: its latest status event at or
        -- before that instant (a new or back-on-market listing is Active).
        WHEN r.field = 'contingency' AND lower(coalesce((
          SELECT CASE WHEN h2.event IN ('NewListing', 'BackOnMarket') THEN 'Active' ELSE h2.raw->>'NewValue' END
          FROM public.listing_history h2
          WHERE h2.listing_key = r.listing_key
            AND h2.event_date IS NOT NULL
            AND h2.event_date <= r.event_date
            AND (
              h2.event IN ('NewListing', 'BackOnMarket')
              OR (h2.event = 'FieldChange' AND lower(coalesce(h2.raw->>'Field', '')) IN ('mlsstatus', 'standardstatus'))
            )
          ORDER BY h2.event_date DESC, h2.id DESC
          LIMIT 1
        ), '')) = 'active' THEN
          CASE WHEN nullif(btrim(coalesce(r.new_value, '')), '') IS NOT NULL THEN 'OFF' ELSE 'ON' END
      END AS dir,
      CASE
        WHEN r.field = 'contingency' THEN 'Active Under Contract'
        ELSE r.new_value
      END AS new_status,
      r.price,
      r.id
    FROM ev_raw r
  ),
  ordered AS (
    SELECT
      e.*,
      lag(e.dir) OVER (
        PARTITION BY e.listing_key
        ORDER BY e.event_date, e.ord, e.id
      ) AS prev_dir
    FROM ev e
    WHERE e.dir IS NOT NULL
  ),
  islands AS (
    SELECT
      listing_key,
      event_date,
      ord,
      d,
      dir,
      new_status,
      price,
      id,
      sum(CASE WHEN dir = 'ON' AND prev_dir IS DISTINCT FROM 'ON' THEN 1 ELSE 0 END)
        OVER (
          PARTITION BY listing_key
          ORDER BY event_date, ord, id
        ) AS ep
    FROM ordered
  ),
  built AS (
    SELECT
      listing_key,
      ep,
      min(d) FILTER (WHERE dir = 'ON') AS on_d,
      min(d) FILTER (WHERE dir = 'OFF') AS off_d,
      (array_agg(new_status ORDER BY event_date, ord, id)
        FILTER (WHERE dir = 'OFF' AND new_status IS NOT NULL))[1] AS end_status,
      (array_agg(price ORDER BY event_date, ord, id)
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
        WHEN b.end_status ILIKE 'active under contract%' THEN 'pending'
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
        -- Under contract by the row though the history never showed it: the
        -- contract date ends the episode when the MLS gave one.
        WHEN k.status = 'Active Under Contract'
         AND k.contract_d IS NOT NULL AND k.contract_d >= h.on_market_date THEN k.contract_d
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
        WHEN k.status = 'Active Under Contract'
         AND k.contract_d IS NOT NULL AND k.contract_d >= h.on_market_date THEN 'pending'
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
        WHEN k.status = 'Active' THEN NULL
        -- Under contract with no history: off at the contract date when the MLS
        -- gave one; with none it stays open, as before.
        WHEN k.status = 'Active Under Contract' THEN
          CASE WHEN k.contract_d IS NOT NULL AND k.row_on IS NOT NULL AND k.contract_d >= k.row_on THEN k.contract_d END
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
        WHEN k.status = 'Active' THEN 'open'
        WHEN k.status = 'Active Under Contract' THEN
          CASE WHEN k.contract_d IS NOT NULL AND k.row_on IS NOT NULL AND k.contract_d >= k.row_on THEN 'pending' ELSE 'open' END
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
          -- The current episode of a listing still for sale whose history ended
          -- every episode. Not one under contract: its history ended it there.
          k.status = 'Active'
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
$function$;
