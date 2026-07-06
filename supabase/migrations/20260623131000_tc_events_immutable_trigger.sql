-- H1 (TC architecture review 2026-06-23): make tc_events truly append-only.
-- The audit spine is cited in-code as the ORS 696.280 six-year-retention
-- defensibility artifact, but its only protection is
-- `revoke update, delete on tc_events from anon, authenticated` — which does NOT
-- bind the SERVICE ROLE that every TC action uses. So the audit log is currently
-- editable/deletable by any code path or a compromised service key. Mirror the
-- tc_principal_reviews immutability trigger, which fires for every role.
create or replace function public.tc_events_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'tc_events is append-only (ORS 696.280 audit retention); % is blocked', tg_op;
end $$;

drop trigger if exists tc_events_no_update_delete on public.tc_events;
create trigger tc_events_no_update_delete
  before update or delete on public.tc_events
  for each row execute function public.tc_events_immutable();
