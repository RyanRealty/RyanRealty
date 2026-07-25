-- W5.1 / admin rebuild spec 03 §3.1–3.2: person link + async build lifecycle
-- on CMAs (parity with broker_price_opinions.person_id) and build_state on both.
-- Additive / back-compatible. Existing rows default build_state='ready'.

alter table public.cmas
  add column if not exists person_id bigint,
  add column if not exists build_state text not null default 'ready',
  add column if not exists build_started_at timestamptz,
  add column if not exists build_finished_at timestamptz,
  -- build_error already exists on cmas (legacy); keep it, do not re-add
  add column if not exists build_idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cmas_build_state_check'
  ) then
    alter table public.cmas
      add constraint cmas_build_state_check
      check (build_state in ('queued', 'building', 'ready', 'failed'));
  end if;
end $$;

create index if not exists cmas_person_id_idx on public.cmas (person_id);
create index if not exists cmas_build_state_idx
  on public.cmas (build_state)
  where build_state in ('queued', 'building');
create unique index if not exists cmas_build_idem_uidx
  on public.cmas (build_idempotency_key)
  where build_idempotency_key is not null;

-- Best-effort person_id backfill from client_email → crm_people.emails jsonb
update public.cmas c
set person_id = p.id
from public.crm_people p
where c.person_id is null
  and c.client_email is not null
  and exists (
    select 1
    from jsonb_array_elements(coalesce(p.emails, '[]'::jsonb)) e
    where lower(trim(coalesce(e->>'value', ''))) = lower(trim(c.client_email))
  );

alter table public.broker_price_opinions
  add column if not exists build_state text not null default 'ready',
  add column if not exists build_started_at timestamptz,
  add column if not exists build_finished_at timestamptz,
  add column if not exists build_error text,
  add column if not exists build_idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bpo_build_state_check'
  ) then
    alter table public.broker_price_opinions
      add constraint bpo_build_state_check
      check (build_state in ('queued', 'building', 'ready', 'failed'));
  end if;
end $$;

create unique index if not exists bpo_build_idem_uidx
  on public.broker_price_opinions (build_idempotency_key)
  where build_idempotency_key is not null;
create index if not exists bpo_build_state_idx
  on public.broker_price_opinions (build_state)
  where build_state in ('queued', 'building');
