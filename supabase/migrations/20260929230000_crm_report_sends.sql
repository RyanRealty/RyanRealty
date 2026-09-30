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
--      and the stop stamp.
--   B. crm_report_sends: one row per send attempt (sent, failed, held), with the
--      clean html/text as sent (no open pixel, no click wraps, so the web view
--      never fires tracking) and the figures trace as jsonb.
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
-- DEPLOY ORDER: the code shipped with this file reads and writes these
-- columns and this table (the cron's subscriber read, the preferences page,
-- the one-click endpoint, the admin card, the account page's save). Apply it
-- BEFORE, or together with, that deploy; on the old schema those reads fail.
--
-- Do NOT apply from an agent session. After it is applied, refresh the schema
-- snapshot: npm run ci:data-access -- --refresh (ci:migration-drift reads it).

-- ── A. crm_report_subscriptions ──────────────────────────────────────────────

alter table public.crm_report_subscriptions
  add column if not exists first_send_approved_at timestamptz,
  add column if not exists first_send_approved_by text,
  add column if not exists source text,
  add column if not exists requested_at timestamptz,
  add column if not exists consent_note text,
  add column if not exists stopped_at timestamptz,
  add column if not exists stopped_via text;

alter table public.crm_report_subscriptions
  drop constraint if exists crm_report_subscriptions_stopped_via_check;
alter table public.crm_report_subscriptions
  add constraint crm_report_subscriptions_stopped_via_check
  check (stopped_via is null or stopped_via in ('one-click', 'email-link', 'admin', 'self-serve'));

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
  -- no-email, no-data. NULL on sent and failed rows.
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
  created_at       timestamptz not null default now(),
  constraint crm_report_sends_sent_at_check check (status <> 'sent' or sent_at is not null),
  constraint crm_report_sends_hold_reason_check check (status <> 'held' or hold_reason is not null)
);

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
