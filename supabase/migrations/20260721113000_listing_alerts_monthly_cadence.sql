-- Monthly listing-alert cadence (Matt directive 2026-07-21).
--
-- listing_alerts.notification_frequency was constrained to
-- ('instant', 'daily', 'weekly') by 20260707160000_unify_listing_alerts.sql.
-- Widen the CHECK to admit 'monthly' (= 30 days since last send in the cron's
-- due logic, lib/saved-search-cadence.ts isCadenceDue).
--
-- Until this migration is applied, code paths that try to store 'monthly'
-- fail soft: every DAL write in lib/data/leads/listingAlerts.ts returns
-- { ok: false, error: 'persist_failed' } on a constraint violation and the UI
-- surfaces the error — no crash, no partial state.

DO $$
DECLARE
  c record;
BEGIN
  -- Drop whatever CHECK constraint currently guards notification_frequency
  -- (name-agnostic: the inline column CHECK was auto-named at table creation).
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'listing_alerts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%notification_frequency%'
  LOOP
    EXECUTE format('ALTER TABLE public.listing_alerts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.listing_alerts
  ADD CONSTRAINT listing_alerts_notification_frequency_check
  CHECK (notification_frequency IN ('instant', 'daily', 'weekly', 'monthly'));
