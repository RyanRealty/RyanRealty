-- market_history_weekly.observation_date — the vintage the PROVIDER stamped.
--
-- Why this column has to exist: the table already carries `source`
-- ('fred:MORTGAGE30US', 'freddie:pmms30', 'fred:DGS10', 'market_pulse_live')
-- and `captured_at` (when OUR cron wrote the row). Neither is the vintage.
-- Freddie's PMMS 30yr rate is published for a week-ending Thursday and the
-- snapshot cron runs the following Monday, so `captured_at` overstates the
-- freshness of the number by several days, and a same-week re-fire moves
-- `captured_at` while the observation it describes never moved.
--
-- CLAUDE.md §0 requires every published figure to trace to a named source AND
-- its date. NationalSeriesPoint.observationDate already carries that date out
-- of the fetchers; before this column existed the snapshot writer dropped it
-- on the floor, which made the §0 trace unsatisfiable for every rate figure
-- the site derives from this table (the public calculators' 30-yr default
-- among them).
--
-- Nullable on purpose: rows written before this migration have no recoverable
-- observation date and must stay NULL rather than be back-filled with a
-- guess (§0 — no invented dates). Readers treat NULL as "provider vintage
-- unknown; fall back to captured_at" and must never present it as the
-- observation date.

ALTER TABLE public.market_history_weekly
  ADD COLUMN IF NOT EXISTS observation_date date;

COMMENT ON COLUMN public.market_history_weekly.observation_date IS
  'Vintage as stamped by the source: the provider''s own observation date (FRED observation date, Freddie PMMS week-ending date) or, for market_pulse_live rows, the pulse row''s updated_at date. Distinct from captured_at, which is when this row was written. NULL = written before the column existed, or the source publishes no date — never back-fill it with a guess (§0).';
