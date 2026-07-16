-- Admin rebuild — RC1 conversation-model channel parity (spec 02).
-- The inbox surfaces calls + voicemail alongside SMS/email; the model only covered
-- SMS/email, so a read-flip would silently drop every call-only contact (measured:
-- 22 of 23 would-be-dropped people). This brings calls/voicemail into the model so
-- the flip regresses nobody. Additive + idempotent, same as the other backfills.

-- Channel-specific metadata (call duration, dial status, etc.). crm_message had no
-- generic payload; calls need one for the inbox's duration label.
alter table public.crm_message add column if not exists meta jsonb not null default '{}';

-- Extend the projection to call + voicemail. Calls/voicemail are inbound events on
-- the contact's canonical 1:1 thread; provider_sid = callSid; the call payload rides
-- in meta so the inbox can read duration/dial status.
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
    where t.kind in ('sms_in','sms_out','email_in','email_out','call','voicemail')
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
           nullif(coalesce(t.payload->>'twilioSid', t.payload->>'sid', t.payload->>'messageSid', t.payload->>'gmailId', t.payload->>'callSid'), '') as sid,
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
    where t.kind in ('sms_in','sms_out','email_in','email_out','call','voicemail')
      and coalesce(gc.id, dc.id) is not null
      and not exists (select 1 from crm_message x where x.timeline_id = t.id)
      and not exists (select 1 from crm_message x
        where x.provider_sid = nullif(coalesce(t.payload->>'twilioSid', t.payload->>'sid', t.payload->>'messageSid', t.payload->>'gmailId', t.payload->>'callSid'), ''))
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
      (conversation_id, direction, channel, body, subject, provider_sid, sent_by, media, meta, timeline_id, created_at)
    select conv_id,
      case when kind in ('sms_out','email_out') then 'out' else 'in' end,
      case when kind = 'call' then 'call'
           when kind = 'voicemail' then 'voicemail'
           when kind like 'email%' then 'email'
           when payload ? 'media' or coalesce(payload->>'hasMedia','') = 'true' then 'mms'
           else 'sms' end,
      body,
      case when kind like 'email%' then title else null end,
      case when sid_rn = 1 then sid else null end,
      case when kind in ('sms_out','email_out') then broker else null end,
      case when jsonb_typeof(payload->'media') = 'array' then payload->'media' else '[]'::jsonb end,
      case when kind in ('call','voicemail') then coalesce(payload, '{}'::jsonb) else '{}'::jsonb end,
      id, ts
    from sidranked
    returning 1
  ) select count(*) into m from ins;

  return query select g, d, m;
end $$;

-- Re-run the projection to pull in the newly-covered call/voicemail rows (idempotent).
select public.backfill_conversation_model();
select public.backfill_conversation_participants();
select public.recompute_conversation_rollups();
