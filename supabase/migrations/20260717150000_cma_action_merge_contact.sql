-- Atomic contact-field merge into a content:cma row's payload (adversarial
-- review 2026-07-17 LOW-MED residual N1, closing the documented window).
--
-- When a repeat intake ATTACHES to an open build (23505 on the partial unique
-- index), it must refresh the action payload's client contact fields so the
-- worker builds for the NEWEST requester. The first implementation was a plain
-- read-modify-write of the whole payload from the app, which could overwrite a
-- notify entry a concurrent kicker appended via cma_action_append_notify in
-- the read→write window (that broker would silently miss the ready text).
--
-- This mirrors the append RPC: FOR UPDATE serializes with concurrent appends
-- and the worker's status flip; the merge is `payload || patch` on ONLY the
-- four contact keys, so notify_broker_sms (and every other key) is never
-- touched; the merge only lands while the build is still OPEN.
--
-- Returned row: merged = whether anything was written; status = the row's
-- status at lock time (null when the action id does not exist).
create or replace function public.cma_action_merge_contact(
  p_action_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_client_notes text
)
returns table (merged boolean, status text)
language plpgsql
security invoker
as $$
declare
  v_status text;
  v_patch jsonb := jsonb_strip_nulls(jsonb_build_object(
    'client_name', to_jsonb(p_client_name),
    'client_email', to_jsonb(p_client_email),
    'client_phone', to_jsonb(p_client_phone),
    'client_notes', to_jsonb(p_client_notes)
  ));
begin
  select mba.status
    into v_status
    from public.marketing_brain_actions mba
   where mba.id = p_action_id
     for update;

  if not found then
    return query select false, null::text;
    return;
  end if;

  if v_status in ('pending', 'in_production') and v_patch <> '{}'::jsonb then
    update public.marketing_brain_actions
       set payload = payload || v_patch,
           updated_at = now()
     where id = p_action_id;
    return query select true, v_status;
    return;
  end if;

  return query select false, v_status;
end;
$$;

comment on function public.cma_action_merge_contact(uuid, text, text, text, text) is
  'Atomically merge non-null client contact fields into a content:cma action row''s payload while the build is open. Backs the createCmaRequest attach path (lib/data/cma/queue.ts mergeCmaActionContact); never touches notify_broker_sms.';
