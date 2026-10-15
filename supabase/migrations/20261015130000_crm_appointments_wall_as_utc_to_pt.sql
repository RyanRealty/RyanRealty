-- Convert vault/admin crm_appointments rows that stored Pacific wall time as UTC
-- into true UTC instants. Website /book rows already store true instants
-- (description LIKE 'Booked from the website%') and must not move.
--
-- Do not touch id 52 (Leslie Scheppegrell /book row: 2026-10-15 17:00Z = 10:00 PT).
--
-- Affected ids (vault deal-calendar path, midnight UTC wall-as-UTC):
-- 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
-- 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 46, 47, 48,
-- 49, 50, 51.
-- Website /book ids left alone: 44, 45, 52.
--
-- Idempotent: only rows whose UTC wall clock is still midnight (the stored
-- wall-as-UTC shape). After the first apply, start_at is 07:00Z or 08:00Z.
-- Per docs/DATABASE_FOR_AI_AGENTS.md — crm_appointments timestamps.

UPDATE public.crm_appointments
SET
  start_at = (start_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles',
  end_at   = (end_at   AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles'
WHERE id <> 52
  AND COALESCE(description, '') LIKE 'Vault %'
  AND EXTRACT(HOUR FROM start_at AT TIME ZONE 'UTC') = 0
  AND EXTRACT(MINUTE FROM start_at AT TIME ZONE 'UTC') = 0;
