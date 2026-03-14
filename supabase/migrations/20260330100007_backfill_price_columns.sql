-- Backfill OriginalListPrice and ClosePrice from details jsonb.
-- Batched in loops of 2000 rows to stay within statement timeout.

DO $$
DECLARE
  batch_size int := 2000;
  rows_affected int;
BEGIN
  -- Backfill OriginalListPrice
  LOOP
    UPDATE listings
    SET "OriginalListPrice" = (details->>'OriginalListPrice')::numeric
    WHERE "ListNumber" IN (
      SELECT "ListNumber" FROM listings
      WHERE "OriginalListPrice" IS NULL
        AND details->>'OriginalListPrice' IS NOT NULL
        AND details->>'OriginalListPrice' ~ '^\d+\.?\d*$'
      LIMIT batch_size
    );
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    EXIT WHEN rows_affected = 0;
  END LOOP;

  -- Backfill ClosePrice
  LOOP
    UPDATE listings
    SET "ClosePrice" = (details->>'ClosePrice')::numeric
    WHERE "ListNumber" IN (
      SELECT "ListNumber" FROM listings
      WHERE "ClosePrice" IS NULL
        AND details->>'ClosePrice' IS NOT NULL
        AND details->>'ClosePrice' ~ '^\d+\.?\d*$'
      LIMIT batch_size
    );
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    EXIT WHEN rows_affected = 0;
  END LOOP;
END $$;
