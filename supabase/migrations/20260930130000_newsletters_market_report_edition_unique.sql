-- One email draft per monthly market report edition.
--
-- Matt 2026-09-30 ("Draft it for my OK"): when a month's report publishes,
-- lib/market-report/edition-email-draft.ts writes that month's email as a
-- newsletters draft for his approval, marked created_by
-- 'cron:market-report-edition:<YYYY-MM>'. Two crons can reach it (the publish
-- on the 8th and the daily refresh as the backstop), and a read-then-insert
-- check cannot stop two runs that overlap. This index can: a second insert for
-- the same month fails, and the writer reads the first one back.

CREATE UNIQUE INDEX IF NOT EXISTS newsletters_market_report_edition_draft_uidx
  ON public.newsletters (created_by)
  WHERE created_by LIKE 'cron:market-report-edition:%';
