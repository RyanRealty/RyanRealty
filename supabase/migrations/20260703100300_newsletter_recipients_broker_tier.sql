-- Newsletter Phase 1 (spec §3.1/§5/§6.5): freeze the recipient's broker + assign
-- an engagement tier on each per-issue recipient row, AND open the status vocabulary
-- so the Phase 3 queue can exist at all.
--
-- broker text   — the RECIPIENT's resolved short slug (matt|rebecca|paul) at send
--                 time, FROZEN for this issue (spec §5, edge case S-6/S-17). Today
--                 attribution uses the SENDER's slug (the admin who clicks send) —
--                 the core bug the identity swap fixes. Analytics scope by this
--                 frozen value so a later reassignment never migrates engagement
--                 history between brokers (§9.5: analytics = frozen at send).
-- tier smallint — engagement tier assigned at enqueue: 1 engaged / 2 new / 3 cold
--                 (§6.5 rule 2). Drives which day of the ~5-7 day tranche this
--                 recipient sends (best senders first, protects reputation).
alter table public.newsletter_recipients
  add column if not exists broker text,
  add column if not exists tier   smallint;

-- CRITICAL (adversarial audit 2026-07-03): newsletter_recipients_status_check today is
-- CHECK (status IN ('sent','delivered','opened','clicked','bounced','complained','failed')).
-- The Phase 3 queue enqueues rows as status='queued' and the drain marks suppressed /
-- unsubscribed-during-send rows 'skipped' (S-8/S-14). Without widening this CHECK, EVERY
-- queued insert is rejected and the queue is dead on arrival. The table is empty
-- (verified 2026-07-03) so the swap is safe; existing values are all preserved.
alter table public.newsletter_recipients
  drop constraint if exists newsletter_recipients_status_check;
alter table public.newsletter_recipients
  add constraint newsletter_recipients_status_check
  check (status in ('queued','sent','delivered','opened','clicked','bounced','complained','failed','skipped'));

-- The drain selects eligible rows by (newsletter, tier, status='queued'); this index
-- keeps that hot query off a sequential scan as the table grows one row per recipient
-- per issue.
create index if not exists newsletter_recipients_drain_idx
  on public.newsletter_recipients (newsletter_id, tier, status);

-- Per-broker reporting (admin §9.3/§9.5) rolls up recipients by frozen broker.
create index if not exists newsletter_recipients_broker_idx
  on public.newsletter_recipients (broker)
  where broker is not null;

comment on column public.newsletter_recipients.broker is
  'Recipient''s FROZEN short broker slug at send time (spec §5). Analytics scope by this; branding follows live crm_people.assigned_broker for the NEXT issue only (§9.5).';
comment on column public.newsletter_recipients.tier is
  'Engagement tier at enqueue: 1 engaged / 2 new / 3 cold (spec §6.5). Maps to a tranche day via newsletter_send_schedule.';
