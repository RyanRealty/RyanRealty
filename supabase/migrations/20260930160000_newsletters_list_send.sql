-- newsletters.list_send: true once an issue was sent to the subscriber list.
--
-- The list send (lib/newsletter/send-queue.ts enqueueNewsletter, reached by
-- Approve & Schedule, Send now and the scheduled cron) and the one-off send to
-- named addresses (enqueueNewsletterToEmails) both end as status 'sent', so a
-- test to a few inboxes looked like the brokerage's current issue. On
-- 2026-09-30 the only sent issues were three July 2026 Bend Brief sends to
-- Matt's own inboxes and one contact, and a broker's one-click "send the
-- newsletter" (lib/data/newsletter/current-issue.ts) would have delivered one.
-- The list path sets this when it claims the issue; nothing else does, and
-- every issue sent before today stays false, which is what each of them was.

ALTER TABLE public.newsletters ADD COLUMN IF NOT EXISTS list_send boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.newsletters.list_send IS
  'True once the issue was claimed for a send to the subscriber list (enqueueNewsletter). A one-off send to named addresses leaves it false. The one-click CRM send offers only list sends (lib/data/newsletter/current-issue.ts).';
