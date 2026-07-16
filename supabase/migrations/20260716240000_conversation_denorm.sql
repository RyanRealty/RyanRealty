-- Admin rebuild — RC1 inbox read denormalization (spec 02).
-- The inbox read flips onto the model next. To keep it a SINGLE fast query (no
-- per-row message join — a direct answer to the owner's "slow loads" complaint),
-- stamp the newest-message display fields + an exact message_count onto
-- crm_conversation. Maintained by the message trigger; backfilled by recompute.

alter table public.crm_conversation add column if not exists last_snippet text;
alter table public.crm_conversation add column if not exists last_direction text;   -- in | out
alter table public.crm_conversation add column if not exists last_channel text;      -- sms|mms|email|call|voicemail
alter table public.crm_conversation add column if not exists last_subject text;       -- newest message subject (email)
alter table public.crm_conversation add column if not exists last_call_duration_sec integer;
alter table public.crm_conversation add column if not exists message_count integer not null default 0;
-- Brokers who sent an outbound in the thread (drives the Sent folder).
alter table public.crm_conversation add column if not exists outbound_brokers text[] not null default '{}';

-- Trigger v3: v2 order-independent clocks/needs_reply, PLUS newest-message denorm
-- fields + an incremental message_count.
create or replace function public.crm_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_latest boolean;
begin
  select new.created_at >= coalesce(max(created_at), '-infinity'::timestamptz)
    into is_latest
  from public.crm_message
  where conversation_id = new.conversation_id and id <> new.id;

  update public.crm_conversation c set
    last_message_at  = greatest(c.last_message_at, new.created_at),
    last_inbound_at  = case when new.direction = 'in'  then greatest(c.last_inbound_at, new.created_at) else c.last_inbound_at end,
    last_outbound_at = case when new.direction = 'out' then greatest(c.last_outbound_at, new.created_at) else c.last_outbound_at end,
    needs_reply = case when is_latest then (new.direction = 'in') else c.needs_reply end,
    state = case when new.direction = 'in' and is_latest and c.state in ('closed','handled') then 'unread' else c.state end,
    channel_set = (select array(select distinct unnest(c.channel_set || array[new.channel]))),
    message_count = c.message_count + 1,
    outbound_brokers = case
      when new.direction = 'out' and new.sent_by is not null and not (c.outbound_brokers @> array[new.sent_by])
      then c.outbound_brokers || array[new.sent_by] else c.outbound_brokers end,
    -- newest-message display fields (only when this row is the newest)
    last_snippet   = case when is_latest then new.body else c.last_snippet end,
    last_direction = case when is_latest then new.direction else c.last_direction end,
    last_channel   = case when is_latest then new.channel else c.last_channel end,
    last_subject   = case when is_latest then new.subject else c.last_subject end,
    last_call_duration_sec = case
      when is_latest and new.channel in ('call','voicemail')
      then nullif(coalesce(new.meta->>'durationSec', new.meta->>'duration', new.meta->>'RecordingDuration'), '')::int
      else case when is_latest then null else c.last_call_duration_sec end end,
    updated_at = now()
  where c.id = new.conversation_id;
  return null;
end $$;

-- Recompute v2: backfill the denorm fields + exact message_count from crm_message.
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
           array(select distinct unnest(array_agg(sent_by) filter (where direction = 'out' and sent_by is not null))) as out_brokers,
           count(*) as msg_count
    from crm_message group by conversation_id
  ),
  latest as (
    -- newest message per conversation for the denorm display fields
    select distinct on (conversation_id)
           conversation_id, direction, channel, body, subject, meta
    from crm_message
    order by conversation_id, created_at desc, id desc
  )
  update crm_conversation c set
    last_message_at = coalesce(a.last_at, c.last_message_at),
    last_inbound_at = a.last_in,
    last_outbound_at = a.last_out,
    channel_set = a.channels,
    outbound_brokers = a.out_brokers,
    needs_reply = (l.direction = 'in'),
    message_count = coalesce(a.msg_count, 0),
    last_snippet = l.body,
    last_direction = l.direction,
    last_channel = l.channel,
    last_subject = l.subject,
    last_call_duration_sec = case when l.channel in ('call','voicemail')
      then nullif(coalesce(l.meta->>'durationSec', l.meta->>'duration', l.meta->>'RecordingDuration'), '')::int else null end,
    updated_at = now()
  from agg a
  left join latest l on l.conversation_id = a.conversation_id
  where a.conversation_id = c.id;
  get diagnostics n = row_count;
  return n;
end $$;

select public.recompute_conversation_rollups();
