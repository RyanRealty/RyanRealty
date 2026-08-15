-- Adversarial audit 2026-08-15 (escape: self-graded verification) found the
-- work-graph state machine and the ledger freeze enforceable only at the DAL
-- layer: raw service-role writes bypassed both, and the DAL transition had a
-- read-then-write race. These triggers make the rules true at the database, so
-- no writer — DAL, script, SQL console, or future cron — can produce an
-- illegal state.

-- 1. Work-node transitions: legality + evidence-required-for-done, at the DB.
create or replace function public.loop_work_nodes_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.state is distinct from old.state then
    if not (
      (old.state = 'open'        and new.state in ('in_progress','killed')) or
      (old.state = 'in_progress' and new.state in ('done','blocked','open','killed')) or
      (old.state = 'blocked'     and new.state in ('open','in_progress','killed'))
    ) then
      raise exception 'illegal work-node transition % -> % (done and killed are terminal)', old.state, new.state;
    end if;
    if new.state = 'done' and (new.evidence is null or btrim(new.evidence) = '') then
      raise exception 'a work node cannot be done without evidence — the environment says done, not the session';
    end if;
    if new.state = 'killed' and (new.blocked_reason is null or btrim(new.blocked_reason) = '') then
      raise exception 'a kill needs a recorded reason';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists loop_work_nodes_guard on public.loop_work_nodes;
create trigger loop_work_nodes_guard
  before update on public.loop_work_nodes
  for each row execute function public.loop_work_nodes_guard();

-- 2. Ledger discipline at the DB: one open class per domain (canon), and the
-- stranded-window freeze — enforced on INSERT regardless of the writer.
create or replace function public.site_improvement_ledger_guard()
returns trigger
language plpgsql
as $$
declare
  open_count integer;
  stranded_count integer;
begin
  select count(*) into open_count
  from public.site_improvement_ledger
  where domain = new.domain and actual_delta is null;

  if open_count > 0 then
    select count(*) into stranded_count
    from public.site_improvement_ledger
    where domain = new.domain
      and actual_delta is null
      and shipped_at + make_interval(days => coalesce(window_days, 14)) < now();

    if stranded_count > 0 then
      raise exception 'domain "%" has % expired unlearned window(s) — write actual_delta + verdict (Learn) before opening a new class', new.domain, stranded_count;
    end if;

    raise exception 'domain "%" already has % open class(es) — one open class per domain (THE LOOP); close or supersede it first', new.domain, open_count;
  end if;

  return new;
end;
$$;

drop trigger if exists site_improvement_ledger_guard on public.site_improvement_ledger;
create trigger site_improvement_ledger_guard
  before insert on public.site_improvement_ledger
  for each row execute function public.site_improvement_ledger_guard();
