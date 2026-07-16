-- Twilio reliability hardening (2026-07-15). Backs four code fixes:
--   #1 sequence-engine per-step send idempotency (crm_sequence_sends)
--   #2 atomic forward-only SMS delivery-state merge (crm_advance_sms_delivery)
--   #4 webhook-retry dedupe for CRM tasks (crm_tasks.dedupe_key)
-- (#3 A2P daily send cap is code-only — no schema.)

-- ── #1: per-(enrollment, step) send claim ───────────────────────────────────
-- The engine sends the client text/email, THEN advances step_index. A crash in
-- that gap left step_index unchanged, so the next run re-sent the SAME message.
-- This claim table makes sends at-most-once: the engine claims (enrollment,step)
-- BEFORE the external send; a re-run hits the unique violation and advances
-- WITHOUT re-sending. On a send failure the claim is released so a retry re-sends.
create table if not exists public.crm_sequence_sends (
  id            bigint generated always as identity primary key,
  enrollment_id bigint not null references public.crm_sequence_enrollments(id) on delete cascade,
  step_index    integer not null,
  channel       text,
  provider_sid  text,
  claimed_at    timestamptz not null default now(),
  unique (enrollment_id, step_index)
);
comment on table public.crm_sequence_sends is
  'Per-(enrollment,step) send claim — makes sequence-engine client sends at-most-once across a crash between send and step-advance.';

-- ── #4: dedupe key for CRM tasks ────────────────────────────────────────────
-- Twilio retries inbound webhooks; the "reply to text" task insert had no dedupe
-- so a retry created duplicate tasks. Nullable + a plain unique index (NULLs are
-- distinct in Postgres, so existing null-key rows are unaffected and unlimited),
-- directly usable by PostgREST upsert onConflict='dedupe_key'.
alter table public.crm_tasks add column if not exists dedupe_key text;
create unique index if not exists crm_tasks_dedupe_key_uq on public.crm_tasks (dedupe_key);
comment on column public.crm_tasks.dedupe_key is
  'Optional idempotency key so a webhook retry upserts instead of inserting a duplicate task.';

-- ── #2: atomic forward-only SMS delivery-state merge ────────────────────────
-- The status webhook did SELECT payload -> compute -> UPDATE in app code. Twilio
-- fires queued/sent/delivered in rapid succession; a late callback that read
-- before the delivered write committed could clobber it. This does the whole
-- forward-only merge in ONE statement — Postgres row locks serialize concurrent
-- callbacks, so the state can only ever move forward.

-- Rank ladder mirrors lib/crm/sms-status.ts STATE_RANK (terminal states tie at 4).
create or replace function public.crm_sms_state_rank(p_state text)
returns int language sql immutable as $$
  select case p_state
    when 'queued'      then 1
    when 'sending'     then 2
    when 'sent'        then 3
    when 'delivered'   then 4
    when 'undelivered' then 4
    when 'failed'      then 4
    else 0
  end;
$$;

create or replace function public.crm_advance_sms_delivery(
  p_sid             text,
  p_state           text,
  p_error_code      int,
  p_carrier_filtered boolean
) returns table (id bigint, person_id bigint)
language sql as $$
  update public.crm_timeline t
  set payload = t.payload
    || jsonb_build_object('deliveryUpdatedAt', now())
    -- forward-only: advance deliveryState only when the incoming rank is higher
    || case
         when public.crm_sms_state_rank(p_state)
              > public.crm_sms_state_rank(t.payload->>'deliveryState')
         then jsonb_build_object('deliveryState', p_state)
         else '{}'::jsonb
       end
    -- errorCode + carrierFiltered are additive evidence (never cleared)
    || jsonb_build_object('errorCode',
         coalesce(p_error_code, nullif(t.payload->>'errorCode', '')::int))
    || jsonb_build_object('carrierFiltered',
         p_carrier_filtered or coalesce(nullif(t.payload->>'carrierFiltered', '')::boolean, false))
  where t.kind = 'sms_out'
    and t.payload->>'twilioSid' = p_sid
  returning t.id, t.person_id;
$$;
