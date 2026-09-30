-- prune_sale_pricing_facts_batch's COMMENT named only p_max_delete for
-- approving a refused batch (code review round 5, 2026-09-30). The cron reads
-- 20,000 keys a batch and the function's p_limit defaults to 5,000, so an
-- approval that passes only p_max_delete reads a smaller batch, and a refused
-- key past its end is not reached. The approval passes both.

COMMENT ON FUNCTION public.prune_sale_pricing_facts_batch(integer, text, integer) IS
  'Deletes sale_pricing_facts rows whose listing no longer passes the comp filter of refresh_sale_pricing_facts_batch (gone, not closed, no close price, under 300 sq ft, not PropertyType A, outside Central Oregon). A listing the MLS changed in the last 48 hours gets a 48-hour clock (stale_since) first. A batch with more to delete than p_max_delete (the run''s remaining budget, default 50) deletes nothing, reports refused and keeps the cursor on that batch, so the sweep waits on it. To approve a checked cleanup of exactly that batch, call it with the cron''s batch size and a larger budget: select prune_sale_pricing_facts_batch(20000, ''sale_pricing_facts_prune'', <n>). Keyset-batched on listing_backfill_cursors job sale_pricing_facts_prune; returns up to 50 keys.';
