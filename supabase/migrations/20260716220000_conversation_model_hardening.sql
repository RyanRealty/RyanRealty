-- Admin rebuild — RC1 conversation-model hardening (spec 02).
-- Fixes three correctness defects an adversarial review found before the read path
-- flips off crm_timeline. All safe now (the model is still shadow-only, nothing reads it).

-- FIX 1 (HIGH): the 1:1 resolver did read-then-insert with no unique constraint, so
-- concurrent inbound + outbound to a brand-new contact could create TWO 1:1 threads —
-- the exact fragmentation RC1 exists to kill. Enforce one canonical 1:1 thread per
-- contact at the DB level; the resolver now re-reads on conflict (see record-message.ts).
create unique index if not exists crm_conversation_one_to_one_idx
  on public.crm_conversation (primary_person_id)
  where is_group = false and twilio_conversation_sid is null and primary_person_id is not null;

-- FIX 2 (MED): the message-insert trigger set needs_reply + the clocks from the
-- direction of the row being inserted, UNCONDITIONALLY. When an inbound and an
-- outbound cross and land in the opposite order of their created_at, the final state
-- was wrong — a waiting client's thread could read as handled and drop out of triage.
-- Rewritten order-independent: clocks use GREATEST (never regress), and needs_reply /
-- the closed->unread reopen only change when the inserted row is actually the newest.
create or replace function public.crm_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_latest boolean;
begin
  -- Is this the newest message in the thread? (order-independent guard.)
  select new.created_at >= coalesce(max(created_at), '-infinity'::timestamptz)
    into is_latest
  from public.crm_message
  where conversation_id = new.conversation_id and id <> new.id;

  update public.crm_conversation c set
    last_message_at  = greatest(c.last_message_at, new.created_at),
    last_inbound_at  = case when new.direction = 'in'  then greatest(c.last_inbound_at, new.created_at) else c.last_inbound_at end,
    last_outbound_at = case when new.direction = 'out' then greatest(c.last_outbound_at, new.created_at) else c.last_outbound_at end,
    -- needs_reply flips only for the NEWEST message: newest inbound waits on us, newest outbound clears it.
    needs_reply = case when is_latest then (new.direction = 'in') else c.needs_reply end,
    -- reopen a closed/handled thread only on a NEWEST inbound.
    state = case when new.direction = 'in' and is_latest and c.state in ('closed','handled') then 'unread' else c.state end,
    channel_set = (select array(select distinct unnest(c.channel_set || array[new.channel]))),
    updated_at = now()
  where c.id = new.conversation_id;
  return null;
end $$;

-- FIX 3 (MED): the backfill's idempotency guard was crm_message.timeline_id, but no
-- live dual-write populates timeline_id, so a replay after any live send would try to
-- re-insert the live rows' timeline sources and abort on the provider_sid unique index.
-- Add a provider_sid guard: every live shadow-write carries a provider_sid (Twilio SID
-- / gmailId), so a replay now skips already-recorded messages instead of colliding.
create or replace function public.backfill_conversation_model()
returns table(group_conv int, direct_conv int, messages int) language plpgsql
security definer set search_path = public as $$
declare g int; d int; m int;
begin
  with ins as (
    insert into crm_conversation (twilio_conversation_sid, primary_person_id, assigned_broker, channel_set)
    select t.payload->>'conversationSid',
           (array_agg(t.person_id order by t.ts))[1],
           (array_agg(t.broker order by t.ts))[1],
           '{}'::text[]
    from crm_timeline t
    where t.kind in ('sms_in','sms_out','email_in','email_out')
      and coalesce(t.payload->>'conversationSid','') <> ''
      and not exists (select 1 from crm_conversation c where c.twilio_conversation_sid = t.payload->>'conversationSid')
    group by t.payload->>'conversationSid'
    returning 1
  ) select count(*) into g from ins;

  with ins as (
    insert into crm_conversation (primary_person_id, assigned_broker, channel_set)
    select t.person_id, (array_agg(t.broker order by t.ts desc))[1], '{}'::text[]
    from crm_timeline t
    where t.kind in ('sms_in','sms_out','email_in','email_out')
      and coalesce(t.payload->>'conversationSid','') = ''
      and t.person_id is not null
      and not exists (
        select 1 from crm_conversation c
        where c.primary_person_id = t.person_id and c.is_group = false and c.twilio_conversation_sid is null)
    group by t.person_id
    returning 1
  ) select count(*) into d from ins;

  with eligible as (
    select t.*,
           coalesce(gc.id, dc.id) as conv_id,
           nullif(coalesce(t.payload->>'twilioSid', t.payload->>'sid', t.payload->>'messageSid', t.payload->>'gmailId'), '') as sid,
           case
             when coalesce(t.payload->>'conversationSid','') <> ''
                  and coalesce(t.payload->>'messageSid', t.payload->>'sid') is not null
             then 'grp:'||(t.payload->>'conversationSid')||':'||coalesce(t.payload->>'messageSid', t.payload->>'sid')
             else 'tl:'||t.id::text
           end as dedup_key
    from crm_timeline t
    left join crm_conversation gc
      on coalesce(t.payload->>'conversationSid','') <> '' and gc.twilio_conversation_sid = t.payload->>'conversationSid'
    left join crm_conversation dc
      on coalesce(t.payload->>'conversationSid','') = '' and dc.primary_person_id = t.person_id
         and dc.is_group = false and dc.twilio_conversation_sid is null
    where t.kind in ('sms_in','sms_out','email_in','email_out')
      and coalesce(gc.id, dc.id) is not null
      and not exists (select 1 from crm_message x where x.timeline_id = t.id)
      and not exists (select 1 from crm_message x
        where x.provider_sid = nullif(coalesce(t.payload->>'twilioSid', t.payload->>'sid', t.payload->>'messageSid', t.payload->>'gmailId'), ''))
  ),
  keep as (
    select *, row_number() over (partition by dedup_key order by id) as rn from eligible
  ),
  sidranked as (
    select *, case when sid is not null then row_number() over (partition by sid order by id) else 1 end as sid_rn
    from keep where rn = 1
  ),
  ins as (
    insert into crm_message
      (conversation_id, direction, channel, body, subject, provider_sid, sent_by, media, timeline_id, created_at)
    select conv_id,
      case when kind in ('sms_out','email_out') then 'out' else 'in' end,
      case when kind like 'email%' then 'email'
           when payload ? 'media' or coalesce(payload->>'hasMedia','') = 'true' then 'mms'
           else 'sms' end,
      body,
      case when kind like 'email%' then title else null end,
      case when sid_rn = 1 then sid else null end,
      case when kind in ('sms_out','email_out') then broker else null end,
      case when jsonb_typeof(payload->'media') = 'array' then payload->'media' else '[]'::jsonb end,
      id, ts
    from sidranked
    returning 1
  ) select count(*) into m from ins;

  return query select g, d, m;
end $$;
