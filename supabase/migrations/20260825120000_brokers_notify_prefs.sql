-- Broker notification preferences (Matt 2026-08-25).
--
-- WHY: brokers.notify_new_leads / notify_deal_activity / notify_task_due have
-- existed since the CRM rebuild and are written by /admin/settings/account, but
-- NO send path ever read them — only notify_sms gated queueBrokerAlert. Turning
-- "New lead assigned" off still texted the broker. This migration adds the two
-- categories that fire in production but had no toggle at all (return-visit and
-- cma-ready), plus the volume controls Matt asked for, so the settings screen
-- governs the rail instead of decorating it.
--
-- Defaults preserve today's behaviour exactly: every category on, no cap, no
-- personal quiet window. A broker only gets quieter by choosing to.

alter table public.brokers
  add column if not exists notify_return_visit boolean not null default true,
  add column if not exists notify_cma_ready    boolean not null default true,
  -- Personal quiet window for INTERNAL broker alerts, local Pacific hours.
  -- NULL/NULL = no window. This is a preference, not the TCPA/ORS 646.563
  -- lead-facing window in lib/crm/quiet-hours.ts — that one is law and still
  -- governs every lead-facing send regardless of what a broker sets here.
  add column if not exists notify_quiet_start_hour smallint,
  add column if not exists notify_quiet_end_hour   smallint,
  -- Max broker alerts per rolling 24h. NULL = unlimited.
  add column if not exists notify_max_per_day smallint;

alter table public.brokers
  add constraint brokers_notify_quiet_start_hour_range
    check (notify_quiet_start_hour is null or notify_quiet_start_hour between 0 and 23) not valid,
  add constraint brokers_notify_quiet_end_hour_range
    check (notify_quiet_end_hour is null or notify_quiet_end_hour between 0 and 23) not valid,
  add constraint brokers_notify_max_per_day_range
    check (notify_max_per_day is null or notify_max_per_day between 1 and 200) not valid;

alter table public.brokers validate constraint brokers_notify_quiet_start_hour_range;
alter table public.brokers validate constraint brokers_notify_quiet_end_hour_range;
alter table public.brokers validate constraint brokers_notify_max_per_day_range;

comment on column public.brokers.notify_return_visit is
  'Alert when an identified lead returns to the site and views a home (return-visit:* kind).';
comment on column public.brokers.notify_cma_ready is
  'Alert when a CMA draft finishes building and is ready to review (cma-ready:* kind).';
comment on column public.brokers.notify_max_per_day is
  'Cap on broker alerts per rolling 24h. NULL = unlimited. Health/ops alarms are never capped.';
