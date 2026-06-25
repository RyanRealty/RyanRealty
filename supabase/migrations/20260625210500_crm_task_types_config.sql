-- crm_task_types — the CONFIG-TABLE pattern applied to CRM task types.
--
-- Wave 7 (TASK lifecycle). Replaces the hardcoded 'Follow Up' default in
-- addCrmTaskAction with a DB-backed, UI-CRUD-able reference list that drives the
-- task-type picker on the new cross-contact task queue. Same shape as crm_stages
-- / crm_tags (key/label/position/is_active/is_protected) so it reuses
-- makeConfigTable (lib/crm/config-table.ts) with no per-table CRUD re-implementation.
--
-- - key        the stable identifier a crm_tasks.type value matches against.
--              Equals the human label for the seed rows (FUB task-type names ARE
--              the keys today) so existing crm_tasks.type values keep resolving.
-- - label      what the UI shows. Editable independent of the key so a rename
--              never orphans existing tasks.
-- - position   render order in the picker. Lower = listed first.
-- - is_active  soft on/off. An inactive type stops appearing in the picker but
--              existing tasks of that type keep their value (no data rewrite).
-- - is_protected  a system type the delete action refuses to remove. 'Follow Up'
--                 is protected because it is the addCrmTaskAction default — a
--                 missing default would break native task creation.
create table if not exists public.crm_task_types (
  id           bigserial    primary key,
  key          text         not null unique,
  label        text         not null,
  position     int          not null default 0,
  is_active    boolean      not null default true,
  is_protected boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

create index if not exists crm_task_types_position_idx
  on public.crm_task_types (position);

comment on table public.crm_task_types is
  'CONFIG-TABLE pattern: DB-backed CRM task types. key matches crm_tasks.type; label is the editable display name; position is picker order; is_protected types (Follow Up) cannot be deleted.';
comment on column public.crm_task_types.key is
  'Stable identifier a crm_tasks.type value matches. Equals the label for the FUB-imported seed rows.';
comment on column public.crm_task_types.is_protected is
  'System type the delete action refuses to remove (Follow Up is the create default).';

-- Seed the FUB task types in their natural order. Follow Up is protected (the
-- addCrmTaskAction default). Idempotent.
insert into public.crm_task_types (key, label, position, is_protected)
values
  ('Follow Up',  'Follow Up',  0, true),
  ('Call',       'Call',       1, false),
  ('Text',       'Text',       2, false),
  ('Email',      'Email',      3, false),
  ('Showing',    'Showing',    4, false),
  ('Closing',    'Closing',    5, false),
  ('Open House', 'Open House',  6, false),
  ('Thank You',  'Thank You',  7, false)
on conflict (key) do nothing;

-- A partial index so the task-queue overdue/today/upcoming filters (which all
-- key on completed_at IS NULL + due_at range) stay cheap as the table grows.
create index if not exists crm_tasks_open_due_idx
  on public.crm_tasks (due_at)
  where completed_at is null;
