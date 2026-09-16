-- ─────────────────────────────────────────────────────────────────────────────
-- Conversation participants are PARTIES, not rows (2026-09-16).
--
-- WHAT WENT WRONG. crm_conversation_participant keys a member by
-- (conversation_id, channel_address). The 1:1 send path recorded the contact's
-- phone as the contact stores it ("(541) 902-0420", "5419020420"); the inbound
-- webhook recorded the same line as "+15419020420". One person, two rows. The
-- sync trigger counted rows, so the one-person thread flipped is_group=true;
-- the next 1:1 send looked for the contact's non-group thread, found none, and
-- opened a new conversation — and the next reply pair did it again. Measured
-- before this migration: 22 is_group=true conversations, 17 of them carrying
-- exactly one person (12 as two spellings of one number, the rest phone+email);
-- one contact's texts split across eight conversations since Aug 1.
--
-- WHAT THIS DOES, IN ORDER.
--   1. crm_normalize_channel_address(): one spelling — E.164 for US phones,
--      lower case for email (lib/crm/record-message.ts applies the same rule on
--      write from now on).
--   2. The sync trigger counts DISTINCT parties (a person, or a raw address).
--   3. Existing participant rows: drop the later duplicate spelling, rewrite
--      the survivors to the one spelling.
--   4. Merge fragmented 1:1 threads: for a contact with several no-carrier-group,
--      one-party conversations, the earliest is canonical; messages and
--      participants move to it, the fragments go, an unread fragment keeps the
--      merged thread unread.
--   5. Recount every conversation with the party formula and recompute the
--      denormalized rollups (recompute_conversation_rollups, 20260716240000).
--
-- The one-1:1-per-contact unique index is dropped for the duration and rebuilt
-- at the end: if any contact still had two 1:1 threads the rebuild fails and
-- the migration rolls back, rather than leaving a half-merged inbox.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. One spelling per address.
create or replace function public.crm_normalize_channel_address(addr text)
returns text language sql immutable as $$
  select case
    when addr is null then null
    when position('@' in addr) > 0 then lower(btrim(addr))
    when length(regexp_replace(addr, '\D', '', 'g')) = 10
      then '+1' || regexp_replace(addr, '\D', '', 'g')
    when regexp_replace(addr, '\D', '', 'g') ~ '^1\d{10}$'
      then '+' || regexp_replace(addr, '\D', '', 'g')
    else btrim(addr)
  end
$$;

comment on function public.crm_normalize_channel_address(text) is
  'One spelling per participant address: E.164 for US phones, lower case for email. Mirrors normalizeChannelAddress in lib/crm/record-message.ts.';

-- 2. Parties, not rows.
create or replace function public.crm_conversation_sync_participants()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid uuid := coalesce(new.conversation_id, old.conversation_id);
  cnt integer;
begin
  select count(distinct coalesce(person_id::text, 'raw:' || channel_address)) into cnt
    from public.crm_conversation_participant where conversation_id = cid;
  update public.crm_conversation
     set participant_count = cnt,
         is_group = (cnt > 1),
         updated_at = now()
   where id = cid;
  return null;
end $$;

drop index if exists public.crm_conversation_one_to_one_idx;

-- 3. Existing rows: drop the later duplicate spelling, then rewrite survivors.
with ranked as (
  select id,
         row_number() over (
           partition by conversation_id, public.crm_normalize_channel_address(channel_address)
           order by id
         ) as rn
  from public.crm_conversation_participant
)
delete from public.crm_conversation_participant p
  using ranked r
 where p.id = r.id and r.rn > 1;

update public.crm_conversation_participant
   set channel_address = public.crm_normalize_channel_address(channel_address)
 where channel_address is distinct from public.crm_normalize_channel_address(channel_address);

-- 4. Merge fragmented 1:1 threads.
do $$
declare
  r record;
  keep uuid;
  frags uuid[];
begin
  for r in
    select c.primary_person_id as pid,
           array_agg(c.id order by c.created_at, c.id) as ids
      from public.crm_conversation c
     where c.twilio_conversation_sid is null
       and c.primary_person_id is not null
       and (select count(distinct coalesce(p.person_id::text, 'raw:' || p.channel_address))
              from public.crm_conversation_participant p
             where p.conversation_id = c.id) <= 1
     group by c.primary_person_id
    having count(*) > 1
  loop
    keep  := r.ids[1];
    frags := r.ids[2:];

    update public.crm_message set conversation_id = keep where conversation_id = any(frags);

    -- Copy the fragments' members before the cascade removes them.
    create temp table if not exists _rr_merge_members
      (person_id bigint, raw_phone text, raw_email text, channel_address text, display_name text, role text)
      on commit drop;
    truncate _rr_merge_members;
    insert into _rr_merge_members
      select person_id, raw_phone, raw_email, channel_address, display_name, role
        from public.crm_conversation_participant where conversation_id = any(frags);

    update public.crm_conversation
       set state = 'unread'
     where id = keep
       and exists (select 1 from public.crm_conversation f where f.id = any(frags) and f.state = 'unread');

    delete from public.crm_conversation where id = any(frags);

    insert into public.crm_conversation_participant
      (conversation_id, person_id, raw_phone, raw_email, channel_address, display_name, role)
    select keep, person_id, raw_phone, raw_email, channel_address, display_name, role
      from _rr_merge_members
    on conflict (conversation_id, channel_address) do nothing;
  end loop;
end $$;

-- 5. Recount every conversation as parties; rebuild the rollups the moved
--    messages changed.
update public.crm_conversation c
   set participant_count = s.cnt,
       is_group = (s.cnt > 1),
       updated_at = now()
  from (select conversation_id,
               count(distinct coalesce(person_id::text, 'raw:' || channel_address)) as cnt
          from public.crm_conversation_participant
         group by conversation_id) s
 where s.conversation_id = c.id
   and (c.participant_count is distinct from s.cnt or c.is_group is distinct from (s.cnt > 1));

select public.recompute_conversation_rollups();

-- One 1:1 thread per contact, again — and provably, or this migration fails.
create unique index crm_conversation_one_to_one_idx
  on public.crm_conversation (primary_person_id)
  where is_group = false and twilio_conversation_sid is null and primary_person_id is not null;
