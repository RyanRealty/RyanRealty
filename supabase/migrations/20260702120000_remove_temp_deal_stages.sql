-- Remove the FUB-import artifact "Start (temp stage)" columns from both deal
-- pipelines (mobile audit 2026-07-02, P2-9 test-data hygiene).
--
-- These two rows came verbatim from the FUB pipelines.json export
-- (20260701230000_crm_deal_pipelines.sql seed). FUB itself documents the stage
-- as an auto-created placeholder "users expected to rename" — Matt's account
-- never renamed it, so the live Deals board rendered an empty amber
-- "Start (temp stage)" column on both pipelines.
--
-- Verified before deletion (2026-07-02, live prod):
--   SELECT count(*) FROM crm_deals WHERE stage ILIKE '%temp%';  -- 0 rows
-- No deal has ever sat in either stage; deletion is reference-free.
-- The code-side seed mirror (lib/crm/deal-pipelines.ts DEAL_PIPELINES) is
-- updated in the same delivery.

DELETE FROM crm_deal_stages
WHERE id IN (47, 48)
  AND name = 'Start (temp stage)';
