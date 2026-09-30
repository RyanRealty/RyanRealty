-- Market-report subscriptions: per-send record, first-send approval, consent
-- source, and a report-scoped stop (Matt's decisions 2026-09-29).
--
-- WHY. A market report went out on a cadence with no record of what was sent:
-- no stored copy (so no web view and no archive for the reader or the broker),
-- no figure trace an auditor could check a number against (CLAUDE.md §0), no
-- approval before a contact's first report, and an unsubscribe that could only
-- stop ALL email. Matt's calls, 2026-09-29:
--   1. Every report carries a manage link, no login: reread past reports,
--      change interval and areas, pause, resume, stop.
--   2. Unsubscribe stops only the market report (footer link and the RFC 8058
--      one-click header). "Stop all Ryan Realty email" is a separate, confirmed
--      action on the manage page.
--   3. Sender stays the report rail (Resend, the assigned broker's identity).
--   4. First send: preview to the broker, then approval, then the next
--      8am to 8pm Pacific window.
--
-- WHAT THIS FILE DOES
--   A. crm_report_subscriptions gains the approval stamp, the consent source,
--      the stop stamp, and the pause stamp (who paused: her pause holds like
--      her stop, review 2026-09-30).
--   B. crm_report_sends: one row per send attempt (sent, failed, held), with the
--      clean html/text as sent (no open pixel, no click wraps, so the web view
--      never fires tracking), the figures trace as jsonb, and the CLAUDE.md §0
--      Spark cross-check the sender ran before the send (spark_check). A
--      scheduled send's email_key is one per subscription per due cycle
--      (market-report:scheduled:<subscription>:<cycle>), so two overlapping
--      cron runs cannot both send; a claimed row sits as failed / 'sending'
--      until the provider answers, and every reader treats that as delivered
--      (an answer that never came stays 'sending (unknown outcome: …)', never
--      a failure a retry would re-send). The claim stores the exact provider
--      request (payload) with its idempotency key, so a retry replays it byte
--      for byte under the same key (review 2026-09-30).
--   C. RLS: service-role only on both tables, the same posture as every crm_
--      table (20260610010000_crm_core.sql). Every reader and writer is a
--      lib/data module on the service client.
--   D. Backfill subscription 9016 (Cheryl Younger, crm_people 64138): she asked
--      for reports by replying to a CMA email on 2026-09-28. Source and consent
--      only. NOT approved and NOT turned on: Matt approves the first send after
--      he sees the preview.
--   E. Backfill the approval stamp on every subscription that already received
--      a report before this step existed (last_sent_at set). Without it the
--      sender would hold them forever, since their first report went out long
--      ago. Read 2026-09-30: ids 3, 9010, 9011, 9012, all active and already
--      sent. A subscription that never sent (9016 included) is not touched and
--      waits for a broker's approval like any new one.
--
-- DEPLOY ORDER: apply this BEFORE the code deploys. The code shipped with it
-- reads and writes these columns and this table (the cron's subscriber read,
-- the preferences page, the one-click endpoint, the admin card, the account
-- page's save), and on the old schema those reads fail. Applying it first is
-- safe for the code already running: every new column is nullable (or has a
-- default), crm_report_sends is a new table the old code never reads, the
-- backfills (D, E) set columns the old code ignores, and the RLS and grants in
-- C change nothing for it (checked 2026-09-30: every reader and writer of
-- crm_report_subscriptions on main uses the service-role client). Per CLAUDE.md
-- §8 the shipping session applies it. After it is applied, refresh the schema
-- snapshot: npm run ci:data-access -- --refresh (ci:migration-drift reads it).

-- ── A. crm_report_subscriptions ──────────────────────────────────────────────

alter table public.crm_report_subscriptions
  add column if not exists first_send_approved_at timestamptz,
  add column if not exists first_send_approved_by text,
  add column if not exists source text,
  add column if not exists requested_at timestamptz,
  add column if not exists consent_note text,
  add column if not exists stopped_at timestamptz,
  add column if not exists stopped_via text,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_via text;

alter table public.crm_report_subscriptions
  drop constraint if exists crm_report_subscriptions_stopped_via_check;
alter table public.crm_report_subscriptions
  add constraint crm_report_subscriptions_stopped_via_check
  check (stopped_via is null or stopped_via in ('one-click', 'email-link', 'admin', 'self-serve'));

alter table public.crm_report_subscriptions
  drop constraint if exists crm_report_subscriptions_paused_via_check;
alter table public.crm_report_subscriptions
  add constraint crm_report_subscriptions_paused_via_check
  check (paused_via is null or paused_via in ('one-click', 'email-link', 'admin', 'self-serve'));

alter table public.crm_report_subscriptions
  drop constraint if exists crm_report_subscriptions_consent_note_len;
alter table public.crm_report_subscriptions
  add constraint crm_report_subscriptions_consent_note_len
  check (consent_note is null or char_length(consent_note) <= 2000);

comment on column public.crm_report_subscriptions.first_send_approved_at is
  'When a broker approved this contact''s first market report after receiving the preview in their own inbox. NULL = never approved: the cadence sender holds the subscription and records one held row per due cycle (lib/crm/market-report-send.ts).';
comment on column public.crm_report_subscriptions.first_send_approved_by is
  'The admin email that approved the first send.';
comment on column public.crm_report_subscriptions.source is
  'How the contact asked for reports: email-reply, broker, self-serve, bulk, lp, and so on.';
comment on column public.crm_report_subscriptions.requested_at is
  'When the contact asked for reports (the consent timestamp).';
comment on column public.crm_report_subscriptions.consent_note is
  'Short consent record: what the contact said and where. Required again when a broker restarts reports the contact stopped themselves.';
comment on column public.crm_report_subscriptions.stopped_at is
  'When the market report was stopped. A stop is report-scoped: other email keeps working. NULL while on or merely paused.';
comment on column public.crm_report_subscriptions.stopped_via is
  'one-click (RFC 8058 List-Unsubscribe-Post), email-link (the no-login manage page), admin, or self-serve (the /account page).';
comment on column public.crm_report_subscriptions.paused_at is
  'When the market report was paused. NULL while on or stopped (a stop clears it).';
comment on column public.crm_report_subscriptions.paused_via is
  'Who paused it: email-link or self-serve (the contact: her pause holds like her stop, so a broker restart needs her consent note and a broker send is refused) or admin (a broker).';

-- ── B. crm_report_sends ──────────────────────────────────────────────────────

create table if not exists public.crm_report_sends (
  id               bigint generated always as identity primary key,
  subscription_id  bigint references public.crm_report_subscriptions(id) on delete set null,
  person_id        bigint not null references public.crm_people(id) on delete cascade,
  -- The per-send instrumentation key. Matches email_events.email_key, so
  -- delivered / opened / clicked / bounced join to the send by this key.
  email_key        text not null unique,
  broker           text,
  kind             text not null check (kind in ('scheduled', 'manual', 'preview')),
  status           text not null check (status in ('sent', 'failed', 'held')),
  -- Why a held row did not send: awaiting-approval, stale-data, suppressed,
  -- no-email, no-data, spark-stop (a printed figure differs from Spark by
  -- more than 1%), spark-unreconciled (a printed figure could not be rebuilt
  -- from Spark, or the check could not run). NULL on sent and failed rows.
  hold_reason      text,
  -- A failure's provider or render error, or a hold's detail (which source was
  -- stale and how old it was).
  error            text,
  message_id       text,
  recipient_email  text,
  attempted_at     timestamptz not null default now(),
  sent_at          timestamptz,
  frequency        text,
  areas            text[] not null default '{}',
  subject          text,
  -- The email exactly as sent, minus the open pixel and the click wraps: the
  -- web view and the archive serve this, so reading an old report never
  -- counts as an open or a click.
  html             text,
  plain_text       text,
  -- Every figure the email printed: {area, label, value, display, source,
  -- filter, as_of, n}. The §0 trace an admin audits a sent number against.
  figures          jsonb not null default '[]'::jsonb,
  -- The CLAUDE.md §0 Spark cross-check run before this send, or the one it
  -- was held on: {verdict, rule, checkedAt, since, checks[], queries[],
  -- polygonGaps[], error}. Each check carries both values, the delta and the
  -- population; the queries are the Spark filters behind them. NULL on a row
  -- held before the check ran (approval, email, data, freshness holds).
  spark_check      jsonb,
  -- The exact provider request (from, to, reply-to, subject, the TRACKED html,
  -- text, headers) with its idempotency key and when it was built:
  -- {v, idempotencyKey, builtAt, request}. A retry inside the replay window
  -- replays it byte for byte under the same key, so Resend answers a
  -- delivered attempt with its first result and never sends twice. It holds
  -- the contact's tracked links: read only by the claim and the recovery in
  -- lib/data/crm/marketReportSends.ts, never by a page.
  payload          jsonb,
  created_at       timestamptz not null default now(),
  constraint crm_report_sends_sent_at_check check (status <> 'sent' or sent_at is not null),
  constraint crm_report_sends_hold_reason_check check (status <> 'held' or hold_reason is not null)
);

-- Idempotent for a database where an earlier draft of this table exists.
alter table public.crm_report_sends add column if not exists spark_check jsonb;
alter table public.crm_report_sends add column if not exists payload jsonb;

create index if not exists crm_report_sends_person_idx
  on public.crm_report_sends (person_id, attempted_at desc);
create index if not exists crm_report_sends_subscription_idx
  on public.crm_report_sends (subscription_id, attempted_at desc);
create index if not exists crm_report_sends_message_idx
  on public.crm_report_sends (message_id)
  where message_id is not null;

comment on table public.crm_report_sends is
  'One row per market-report send attempt (scheduled, manual, preview): status sent / failed / held, the clean html and text as sent, and the figures trace. Written only by lib/data/crm/marketReportSends.ts. Service-role only.';
comment on column public.crm_report_sends.figures is
  'Every printed figure: {area, label, value, display, source, filter, as_of, n}. CLAUDE.md §0 trace.';
comment on column public.crm_report_sends.payload is
  'The exact provider request and its idempotency key ({v, idempotencyKey, builtAt, request}), replayed byte for byte by a retry inside the replay window. Holds tracked links: service role only, never served to a page.';
comment on column public.crm_report_sends.spark_check is
  'The CLAUDE.md §0 Spark cross-check the sender ran before this send (or held it on): verdict, rule (any |delta| > 1% is a STOP), each figure''s printed and Spark values with the delta and population, and the Spark queries.';

-- ── C. RLS: service role only ───────────────────────────────────────────────

alter table public.crm_report_sends enable row level security;
alter table public.crm_report_subscriptions enable row level security;

revoke all on table public.crm_report_sends from anon, authenticated;
revoke all on table public.crm_report_subscriptions from anon, authenticated;
grant all on table public.crm_report_sends to service_role;
grant all on table public.crm_report_subscriptions to service_role;

-- ── D. Backfill: subscription 9016 (consent source only) ────────────────────

update public.crm_report_subscriptions
set
  source = 'email-reply',
  requested_at = '2026-09-28T22:54:59Z',
  consent_note = 'Replied to a CMA email on 2026-09-28: "Yes please keep me in the loop on the market."'
where id = 9016
  and person_id = 64138
  and source is null;

-- ── E. Backfill: approval for subscriptions that already sent ───────────────
-- first_send_approved_at takes the last send time: the latest proof the
-- contact was already receiving reports. The approver text says it was a
-- backfill, so no one reads it as a broker's click.

update public.crm_report_subscriptions
set
  first_send_approved_at = last_sent_at,
  first_send_approved_by = 'backfill 2026-09-29: reports already went out before first-send approval existed'
where last_sent_at is not null
  and first_send_approved_at is null;
