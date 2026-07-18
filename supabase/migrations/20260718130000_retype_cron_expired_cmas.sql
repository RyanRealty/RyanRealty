-- Spec 07 follow-up — re-type the historical cron-built expired docs.
--
-- Before the Defect-4 fix (doc_type threading, migration/commit 2026-07-18), the
-- expired-listing detection cron built its documents as doc_type='cma' instead of
-- 'expired-audit'. Those 23 rows therefore showed in /admin/cmas as "seller CMAs"
-- when they are really the audit doc for an expired listing (they belong in
-- /admin/prospecting). Re-type them so the taxonomy is true: CMA = sellers,
-- expired-audit = expireds.
--
-- Scoped PRECISELY to the cron origin (`generation_reason ILIKE '%expired-listing-cron%'`)
-- so no genuine seller CMA (lead-form / seller-LP / broker-repeat origins) is touched.
-- The document HTML stays a CMA (a valid pricing doc); a broker can "Rebuild as audit"
-- from the prospecting surface for the full failure-analysis framing when they work
-- the lead. Idempotent: re-running only affects rows still typed 'cma'/null.

UPDATE public.cmas
   SET doc_type = 'expired-audit'
 WHERE (doc_type = 'cma' OR doc_type IS NULL)
   AND generation_reason ILIKE '%expired-listing-cron%';
