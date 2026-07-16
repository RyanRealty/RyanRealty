-- Admin rebuild — backfill the conversation model from crm_timeline (RC1, spec 02).
--
-- Projects the ~45k historical message-kind timeline rows into
-- crm_conversation / participant / message so the inbox has history the moment the
-- read path flips off the person-collapsed timeline. crm_timeline stays the
-- immutable ledger; this is a one-time projection, and every step is idempotent
-- (guarded by not-exists / crm_message.timeline_id) so a replay on a fresh clone
-- reproduces the same state without duplicating.
--
-- Resolution: a row carrying payload.conversationSid joins the shared group
-- conversation for that SID; every other row joins its contact's canonical 1:1
-- conversation. Two-tier dedup — one crm_message per REAL message: group member
-- rows sharing a (conversationSid, messageSid) collapse to one; a multi-recipient
-- email's per-person rows stay faithful-per-person (one message each), with the
-- shared provider_sid kept on the first and nulled on the rest (the unique index).

-- One crm_message per timeline row — the projection idempotency key.
create unique index if not exists crm_message_timeline_idx
  on public.crm_message (timeline_id) where timeline_id is not null;

create or replace function public.backfill_conversation_model()
returns table(group_conv int, direct_conv int, messages int) language plpgsql
security definer set search_path = public as $$
declare g int; d int; m int;
begin
  -- 1) group conversations — one per distinct Twilio Conversation SID
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

  -- 2) 1:1 conversations — one per contact with any non-group message row
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

  -- 3) messages — two-tier dedup, resolved to their conversation
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

-- 1:1 participants only (one synthetic per-contact address; group threads handled
-- by backfill_group_participants). NEVER touches a thread carrying a Twilio SID.
create or replace function public.backfill_conversation_participants()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with ins as (
    insert into crm_conversation_participant (conversation_id, person_id, channel_address, role)
    select c.id, c.primary_person_id, 'person:'||c.primary_person_id, 'contact'
    from crm_conversation c
    where c.is_group = false and c.twilio_conversation_sid is null and c.primary_person_id is not null
      and not exists (select 1 from crm_conversation_participant p where p.conversation_id = c.id)
    returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

-- Group participants from the timeline payload member arrays (groupTo on the send
-- path, groupMembers on the inbound path). Seeded as raw addresses so
-- participant_count + is_group are correct; forward sends link contacts precisely.
create or replace function public.backfill_group_participants()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with ins as (
    insert into crm_conversation_participant (conversation_id, raw_phone, channel_address, role)
    select distinct c.id, m.addr, m.addr, 'raw'
    from crm_conversation c
    join crm_timeline t on coalesce(t.payload->>'conversationSid','') = c.twilio_conversation_sid
    cross join lateral (
      select jsonb_array_elements_text(
        case when jsonb_typeof(t.payload->'groupTo') = 'array' then t.payload->'groupTo'
             when jsonb_typeof(t.payload->'groupMembers') = 'array' then t.payload->'groupMembers'
             else '[]'::jsonb end) as addr
    ) m
    where c.twilio_conversation_sid is not null and coalesce(m.addr,'') <> ''
      and not exists (select 1 from crm_conversation_participant p where p.conversation_id = c.id and p.channel_address = m.addr)
    returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

-- Corrective recompute: the message-insert trigger sets clocks per row, so after a
-- bulk backfill (arbitrary row order) the clocks/needs_reply reflect whatever row
-- landed last. Derive the true values from the messages so inbox ordering is exact.
create or replace function public.recompute_conversation_rollups()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with agg as (
    select conversation_id,
           max(created_at) as last_at,
           max(created_at) filter (where direction = 'in') as last_in,
           max(created_at) filter (where direction = 'out') as last_out,
           array(select distinct unnest(array_agg(channel))) as channels,
           (array_agg(direction order by created_at desc))[1] as latest_dir
    from crm_message group by conversation_id
  )
  update crm_conversation c set
    last_message_at = coalesce(a.last_at, c.last_message_at),
    last_inbound_at = a.last_in,
    last_outbound_at = a.last_out,
    channel_set = a.channels,
    needs_reply = (a.latest_dir = 'in'),
    updated_at = now()
  from agg a where a.conversation_id = c.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Run the projection (idempotent — a re-apply on an already-backfilled DB is a no-op).
select public.backfill_conversation_model();
select public.backfill_conversation_participants();
select public.backfill_group_participants();
select public.recompute_conversation_rollups();
