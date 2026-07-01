-- Migration: crm_people_collaborators
-- Tracks additional brokers who can view and work a contact beyond the assigned_broker.
-- Matches the FUB Collaborators widget (§7c.8.9 / §7c.7 — delivery order #6).
--
-- The assigned_broker lives on crm_people.assigned_broker;
-- this table holds the supplementary collaborator set only.

create table if not exists public.crm_people_collaborators (
  person_id   bigint      not null references public.crm_people(id) on delete cascade,
  broker_slug text        not null check (broker_slug in ('matt', 'rebecca', 'paul')),
  added_by    text        not null default 'system',
  created_at  timestamptz not null default now(),
  primary key (person_id, broker_slug)
);

create index if not exists crm_people_collaborators_person_idx
  on public.crm_people_collaborators (person_id);

comment on table public.crm_people_collaborators is
  'Additional brokers who collaborate on a contact (FUB §7c.8.9). '
  'The primary assigned_broker is in crm_people; this table is the supplementary set. '
  'Merge: when a contact is merged into a survivor, these rows are re-pointed to the survivor.';
