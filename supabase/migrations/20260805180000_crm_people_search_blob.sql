-- crm_people.search_blob — the segment compiler's free-text (q) substrate.
--
-- WHY (chip task_cb8a89a8, found 2026-08-06 during P9 roll:people): the q node
-- compiled to `emails::text.ilike.*term*` inside PostgREST or() strings, but
-- the or() filter grammar REJECTS ::text casts — every free-text segment
-- errored and callers routed around the compiler. A plain generated text
-- column gives the compiler a legal ilike target that still covers name +
-- emails + phones, plus a digits-only rendering of phones so a digit-fragment
-- query ("500555") matches stored E.164 values.
--
-- 23k rows: the ADD (stored generated => table rewrite) and the trigram index
-- both complete in seconds.

alter table public.crm_people
  add column if not exists search_blob text
  generated always as (
    lower(
      coalesce(name, '') || ' ' ||
      coalesce(emails::text, '') || ' ' ||
      coalesce(phones::text, '') || ' ' ||
      regexp_replace(coalesce(phones::text, ''), '[^0-9]', '', 'g')
    )
  ) stored;

create index if not exists crm_people_search_blob_trgm
  on public.crm_people using gin (search_blob gin_trgm_ops);
