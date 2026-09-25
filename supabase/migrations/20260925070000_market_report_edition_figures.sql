-- Monthly market report: an edition's headline figures, small enough to list.
--
-- The archive page lists every edition from market_report_editions without
-- reading the payload (about 400 KB each). Its calendar shades each month by
-- the Central Oregon median sale price and prints it under the month, so the
-- list needs those figures on the row. Written from the payload's region
-- figures when the edition is stored (lib/data/market-report/editions.ts); a
-- row stored before this column reads null and the calendar leaves it plain.
--
-- Shape: { "median": number|null, "medianYoY": number|null, "sales": number,
--          "mos": number|null, "verdict": "seller"|"balanced"|"buyer"|null }

ALTER TABLE public.market_report_editions
  ADD COLUMN IF NOT EXISTS figures jsonb;

COMMENT ON COLUMN public.market_report_editions.figures IS
  'Headline figures for listing the edition without its payload: Central Oregon single-family (under 1 acre) median, change from a year earlier, sales, months of supply, verdict, for the edition month. Copied from payload.region.kpis when stored.';
