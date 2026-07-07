-- Saved search + subscription admin foundation (W1 of SAVED_SEARCH_MASTER_GOAL).
--
-- 1. guest_search_alerts gains crm_person_id so listing-alert emails can carry
--    open/click tracking attributed to the right CRM person (tracking tokens
--    need crm_people.id — fub_person_id is the legacy id and not sufficient).
-- 2. Backfill crm_person_id from the legacy fub id, then from email match.
-- 3. Indexes for the admin subscriptions hub (filter by active/frequency) and
--    for per-person lookups on both alert tables.

ALTER TABLE public.guest_search_alerts
  ADD COLUMN IF NOT EXISTS crm_person_id bigint;

-- Backfill by legacy FUB id first (strongest link).
UPDATE public.guest_search_alerts g
SET crm_person_id = p.id
FROM public.crm_people p
WHERE g.crm_person_id IS NULL
  AND g.fub_person_id IS NOT NULL
  AND p.fub_legacy_id = g.fub_person_id
  AND p.deleted = false;

-- Then by primary-or-any email match for rows that predate identity linking.
UPDATE public.guest_search_alerts g
SET crm_person_id = p.id
FROM public.crm_people p
WHERE g.crm_person_id IS NULL
  AND p.deleted = false
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.emails) e
    WHERE lower(trim(e->>'value')) = lower(trim(g.email))
  );

CREATE INDEX IF NOT EXISTS idx_guest_search_alerts_crm_person
  ON public.guest_search_alerts (crm_person_id)
  WHERE crm_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guest_search_alerts_active_freq
  ON public.guest_search_alerts (is_active, notification_frequency);

CREATE INDEX IF NOT EXISTS idx_saved_searches_crm_person
  ON public.saved_searches (crm_person_id)
  WHERE crm_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_searches_paused_freq
  ON public.saved_searches (is_paused, notification_frequency);
