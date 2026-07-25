-- W5.5 leg (b) — PWA web-push as the DURABLE broker-alert channel.
--
-- Three changes, all additive:
--
-- 1. crm_broker_alerts_status_check did NOT allow 'sending'. The leg-(a)
--    serverless drain claims a row with a CAS `status 'pending' -> 'sending'`
--    (lib/data/crm/brokerAlertDrain.ts claimAlert), so Postgres rejected every
--    claim it ever attempted. Proven live 2026-07-24 with a rolled-back probe:
--
--      VERDICT=SENDING_REJECTED: new row for relation "crm_broker_alerts"
--      violates check constraint "crm_broker_alerts_status_check"
--
--    Widen the constraint so the serverless drain can actually claim, and add
--    'push_only' (below).
--
-- 2. Web-push delivery gets its OWN claim column (pushed_at) instead of reusing
--    the SMS status machine. The two channels then deliver the same alert
--    independently: the SMS drain CAS-claims `status`, the push drain CAS-claims
--    `pushed_at`, and neither can consume the other's work. Same
--    first-writer-wins model as the existing claim, applied on a second axis.
--
-- 3. push_subscriptions gains a broker key. The table was created 2026-03-10 for
--    public PWA listing alerts and is EMPTY (0 rows, verified 2026-07-24), so
--    keying broker devices here costs nothing and avoids a second table. A row
--    with broker IS NULL stays a public subscription; broker IS NOT NULL means
--    "notify this Ryan Realty broker".
--
-- 'push_only' status: a broker who has NOT opted into SMS (Paul and Rebecca,
-- brokers.notify_sms = false as of 2026-07-24) previously got NO alert row at
-- all, so web-push could never reach them either. A push_only row carries the
-- alert for the push channel while staying invisible to BOTH SMS drainers —
-- the mac-mini relay (scripts/crm-alert-relay.mjs:75) and the serverless drain
-- (lib/data/crm/brokerAlertDrain.ts listPendingAlerts) each select
-- status='pending' only. No new text can escape through this path.

alter table public.crm_broker_alerts
  drop constraint if exists crm_broker_alerts_status_check;

alter table public.crm_broker_alerts
  add constraint crm_broker_alerts_status_check
  check (status = any (array['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'push_only'::text]));

alter table public.crm_broker_alerts
  add column if not exists pushed_at timestamptz,
  add column if not exists push_attempts integer not null default 0,
  add column if not exists push_result text;

comment on column public.crm_broker_alerts.pushed_at is
  'Web-push claim (W5.5 leg b). CAS-set by the push pass in /api/cron/crm-alert-drain; independent of status so SMS and web-push deliver the same alert without cannibalising each other.';

-- The push pass scans only unclaimed rows inside a short lookback window.
create index if not exists crm_broker_alerts_push_unclaimed_idx
  on public.crm_broker_alerts (created_at desc)
  where pushed_at is null;

alter table public.push_subscriptions
  add column if not exists broker text,
  add column if not exists label text,
  add column if not exists created_by_email text,
  add column if not exists last_success_at timestamptz,
  add column if not exists failure_count integer not null default 0,
  add column if not exists disabled_at timestamptz;

comment on column public.push_subscriptions.broker is
  'Ryan Realty broker slug (matt | rebecca | paul) whose devices this subscription notifies. NULL = public PWA subscription (the original 2026-03-10 use).';
comment on column public.push_subscriptions.disabled_at is
  'Set when the push service returns 404/410 Gone for this endpoint. Disabled rows are skipped by the drain and never resurrected.';

create index if not exists push_subscriptions_broker_active_idx
  on public.push_subscriptions (broker)
  where disabled_at is null;
