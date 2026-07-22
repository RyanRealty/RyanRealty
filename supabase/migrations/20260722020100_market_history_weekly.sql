-- market_history_weekly — the weekly time series market_pulse_live cannot be.
--
-- Why: market_pulse_live overwrites itself on every refresh (10-15 min), so
-- no weekly series exists for inventory, new listings, pendings, price-cut
-- share, months of supply, or median list price. HousingWire-style weekly
-- framing ("inventory up 4 straight weeks") is impossible without a captured
-- history. This table is that history: one row per (week, geo, metric),
-- written every Monday by /api/cron/market-history-snapshot.
--
-- It also carries the national context series the local data can never
-- provide: the 30yr mortgage rate (FRED MORTGAGE30US, Freddie PMMS fallback),
-- the 10Y treasury (FRED DGS10), and the computed mortgage-treasury spread.
-- National rows use geo_type='national', geo_slug='us'.
--
-- Long-thin (metric text) rather than wide so new metrics never need DDL.
-- `source` traces every value to its origin per CLAUDE.md §0
-- ('market_pulse_live', 'fred:MORTGAGE30US', 'freddie:pmms30',
--  'computed:mortgage30-dgs10').
--
-- Access model matches the other market tables
-- (20260528010000_anon_read_market_tables.sql): public market aggregates, no
-- PII — anon/authenticated get SELECT via RLS policy; writes are service-role
-- only (RLS enabled, no insert/update/delete policy — service role bypasses).

CREATE TABLE IF NOT EXISTS public.market_history_weekly (
  week_start  date        NOT NULL,
  geo_type    text        NOT NULL,
  geo_slug    text        NOT NULL,
  metric      text        NOT NULL,
  value       numeric     NOT NULL,
  source      text        NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start, geo_type, geo_slug, metric)
);

COMMENT ON TABLE public.market_history_weekly IS
  'Weekly market time series snapshotted from market_pulse_live (cities + region) plus national rate context (FRED / Freddie PMMS). One row per (week_start, geo, metric). Written by /api/cron/market-history-snapshot every Monday 13:00 UTC; upsert makes reruns idempotent per week. Read via DAL getMarketHistoryWeekly().';
COMMENT ON COLUMN public.market_history_weekly.week_start IS
  'Monday (UTC) of the ISO week the snapshot covers.';
COMMENT ON COLUMN public.market_history_weekly.metric IS
  'Metric key: active_count | new_count_7d | pending_count | price_reduction_share | months_of_supply | median_list_price | mortgage_rate_30yr | treasury_10yr | mortgage_treasury_spread.';
COMMENT ON COLUMN public.market_history_weekly.source IS
  'Provenance per §0: market_pulse_live | fred:MORTGAGE30US | freddie:pmms30 | fred:DGS10 | computed:mortgage30-dgs10.';

-- DAL read pattern: (geo_type, geo_slug, metric) filtered, week_start ranged.
-- The PK leads with week_start, so this dedicated index serves the DAL path.
CREATE INDEX IF NOT EXISTS market_history_weekly_geo_metric_week_idx
  ON public.market_history_weekly (geo_type, geo_slug, metric, week_start);

ALTER TABLE public.market_history_weekly ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'market_history_weekly'
      AND policyname = 'anon_read_market_history_weekly'
  ) THEN
    CREATE POLICY "anon_read_market_history_weekly"
      ON public.market_history_weekly
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;
