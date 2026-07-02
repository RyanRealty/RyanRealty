-- §12.2 Automations list parity (docs/fub-crm-spec/12-action-plans-and-automations.md)
-- Folders for the Automations list (spec §12.2.2 folder card + "Move to Folder" row
-- action + Create Folder header control) and authorship for the Created By column
-- (§12.2.3 col 7). Mirrors the spec's automation_folders shape (§12.11) on the
-- existing crm_sequences engine tables.

create table if not exists public.crm_sequence_folders (
  id            bigint generated always as identity primary key,
  name          text not null,
  -- System folders ("My Automations") cannot be renamed or deleted (§12.5.3 pattern).
  is_system     boolean not null default false,
  folder_order  integer not null default 0,
  -- Broker slug of the creator (matt / rebecca / paul).
  created_by    text,
  created_at    timestamptz not null default now()
);

alter table public.crm_sequences
  add column if not exists folder_id bigint references public.crm_sequence_folders(id) on delete set null;

-- Created By (§12.2.3 col 7): broker slug of the author. Every pre-existing
-- sequence (the 4 FUB master plans + hand-built workflows) was authored by Matt
-- in FUB / this admin — backfill is factual, not a guess.
alter table public.crm_sequences
  add column if not exists created_by text;

update public.crm_sequences set created_by = 'matt' where created_by is null;

-- Seed the system folder once (idempotent).
insert into public.crm_sequence_folders (name, is_system, folder_order, created_by)
select 'My Automations', true, 0, 'matt'
where not exists (select 1 from public.crm_sequence_folders where is_system = true);

-- Existing sequences group under the system folder (they are all Matt's).
update public.crm_sequences
set folder_id = (select id from public.crm_sequence_folders where is_system = true order by id limit 1)
where folder_id is null;

create index if not exists crm_sequences_folder_id_idx on public.crm_sequences (folder_id);
