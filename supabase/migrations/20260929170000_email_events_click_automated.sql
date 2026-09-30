-- Widen the unified email_events event CHECK so `click_automated` can land.
--
-- /api/track/e/click now classifies the request's user agent
-- (lib/analytics/automation.ts). A click by an email security scanner, link
-- previewer or crawler used to be recorded as an ordinary `click` and a
-- crm_timeline `email_click`, so it read as the recipient engaging: a scanner
-- that opens every link in a message put a "clicked" mark on every contact it
-- was sent to. An automated click is now stored as `click_automated`, with
-- meta.automation_reason naming the class, and nothing else is written for it.
-- Every reader of the engagement events (open, click, delivered, ...) filters on
-- the exact value, so `click_automated` counts toward none of them.
--
-- Until this is applied the automated-click insert fails the old CHECK, the route
-- logs it and still redirects: an automated click is recorded nowhere, and never
-- as a `click`. The column set is unchanged; this only widens the event enum.
--
-- Locking: this file is applied as one transaction, and a lock is held until the
-- transaction commits. DROP CONSTRAINT takes an ACCESS EXCLUSIVE lock on
-- email_events, so reads and writes of the table wait from the DROP until the
-- commit, which comes after VALIDATE CONSTRAINT has scanned every existing row.
-- Splitting ADD ... NOT VALID from VALIDATE shortens the lock only when the two run
-- in separate transactions; here they do not, so the lock lasts as long as the scan.
--
-- Do not apply this file from the agent session. Hosted apply is a separate
-- delivery step.

ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS email_events_event_check;
ALTER TABLE public.email_events ADD CONSTRAINT email_events_event_check
  CHECK (event IN ('sent','accepted','delivered','open','click','click_automated','bounce','complaint','unsubscribe'))
  NOT VALID;
ALTER TABLE public.email_events VALIDATE CONSTRAINT email_events_event_check;

COMMENT ON COLUMN public.email_events.event IS
  'Normalized lifecycle event: sent | accepted | delivered | open | click | bounce | complaint | unsubscribe. Also click_automated: a click by an email scanner, link previewer or crawler (meta.automation_reason names the class); not engagement, and no report counts it as a click.';
