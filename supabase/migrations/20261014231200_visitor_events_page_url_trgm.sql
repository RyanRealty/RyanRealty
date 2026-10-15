-- Trigram index for the document-engagement reads over visitor_events.page_url
-- (lib/data/prospecting/engagement.ts: getProspectEngagement, getDocEngagement),
-- which the admin prospecting list, prospect detail and the CMA performance
-- report run.
--
-- THE COST. Each read is a page of OR'd substring matches, 25 documents at a
-- time:
--   page_url ilike '%utm_campaign=<slug>%' or page_url ilike '%rr_doc=<slug>%' ...
-- A leading-% ILIKE cannot use a btree, so production's auto_explain
-- (2026-10-14, threshold 10 s) logged them as a Parallel Seq Scan on
-- visitor_events (244K rows) evaluating up to 50 ILIKEs per row. By 23:00Z
-- that log held 54 of them (average 64 s, longest 118 s), the largest
-- app-issued reads in it, and a run of them (21:58 to 22:04Z, several at a
-- time, 14 to 114 s each) preceded the database's unclean restart at 22:05Z ("last
-- known up at 22:04:24 UTC"; two more restarts followed at 22:20Z and 22:49Z).
--
-- THE FIX. pg_trgm (installed, schema public) indexes the substrings, so each
-- ILIKE arm is a bitmap index scan and the OR is a BitmapOr instead of a scan
-- of every row. Same rows, same answers.
--
-- Plain CREATE INDEX, the form the repo records for a transactional replay
-- (20261009030000_listings_parcel_number_index.sql). Inserts into
-- visitor_events (the site's /api/visitors/track) wait for the build; the
-- larger maintenance_work_mem below keeps that short. Reads go on.
SET LOCAL maintenance_work_mem = '256MB';

CREATE INDEX IF NOT EXISTS visitor_events_page_url_trgm_idx
  ON public.visitor_events USING gin (page_url public.gin_trgm_ops);
