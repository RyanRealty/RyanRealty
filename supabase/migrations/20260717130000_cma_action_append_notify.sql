-- Atomic append to a content:cma row's ready-notify list (admin-rebuild v2 D8,
-- adversarial review 2026-07-17 MED).
--
-- The kick-off notify contract is `payload.notify_broker_sms`: a LIST of
-- {person_id, broker} entries the build worker texts when the draft is ready.
-- The first kicker's entry is written at enqueue (lib/cma-request.ts); every
-- later kicker that ATTACHES to the open build appends its entry here. A plain
-- read-modify-write from the app would race a concurrent attacher (lost
-- update), so the append runs server-side under a row lock:
--
--   * FOR UPDATE serializes concurrent appends AND the worker's status flip.
--   * Exact-duplicate entries are skipped (a double-attach adds nothing).
--   * The append only lands while the build is still OPEN. Once the worker has
--     flipped the row to ready/killed, the function refuses and reports the
--     status so the caller can queue the "draft ready" text directly instead
--     (the worker's notify pass has already read the list by then).
--
-- Returned row: appended = whether the entry was added; status = the row's
-- status at lock time (null when the action id does not exist).
create or replace function public.cma_action_append_notify(
  p_action_id uuid,
  p_person_id bigint,
  p_broker text
)
returns table (appended boolean, status text)
language plpgsql
security invoker
as $$
declare
  v_status text;
  v_list jsonb;
  v_entry jsonb := jsonb_build_object('person_id', p_person_id, 'broker', p_broker);
begin
  select
      mba.status,
      case
        when jsonb_typeof(mba.payload -> 'notify_broker_sms') = 'array'
          then mba.payload -> 'notify_broker_sms'
        else '[]'::jsonb
      end
    into v_status, v_list
    from public.marketing_brain_actions mba
   where mba.id = p_action_id
     for update;

  if not found then
    return query select false, null::text;
    return;
  end if;

  if v_status in ('pending', 'in_production') and not v_list @> jsonb_build_array(v_entry) then
    update public.marketing_brain_actions
       set payload = jsonb_set(payload, '{notify_broker_sms}', v_list || jsonb_build_array(v_entry), true),
           updated_at = now()
     where id = p_action_id;
    return query select true, v_status;
    return;
  end if;

  return query select false, v_status;
end;
$$;

comment on function public.cma_action_append_notify(uuid, bigint, text) is
  'Atomically append a {person_id, broker} entry to a content:cma action row''s payload.notify_broker_sms list while the build is open. Backs the CMA kick-off attach path (lib/data/cma/queue.ts appendCmaActionNotify).';
