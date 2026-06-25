-- crm_stages — the CONFIG-TABLE pattern, first instance.
--
-- Kills the hardcoded CRM_STAGES const (lib/crm/constants.ts) by making the
-- pipeline stages a DB-backed, UI-CRUD-able reference table. This same shape
-- (key/label/position/is_active/is_protected) is the reusable template for the
-- Wave 2 config tables: tags, templates, segments, areas.
--
-- - key        the stable identifier a crm_people.stage value matches against.
--              Equals the human label for the seed rows (FUB stage names ARE the
--              keys today) so existing crm_people.stage values keep resolving.
-- - label      what the UI shows. Editable independent of the key so a rename
--              never orphans existing people.
-- - position   render order. Lower = earlier in the funnel. Seeded to preserve
--              the exact order of the retired const.
-- - is_active  soft on/off. An inactive stage stops appearing in pickers but
--              existing people on it keep their value (no data rewrite).
-- - is_protected  a system stage that the delete action refuses to remove
--                 (Trash + Archive are terminal/system buckets).
create table if not exists public.crm_stages (
  id           bigserial    primary key,
  key          text         not null unique,
  label        text         not null,
  position     int          not null default 0,
  is_active    boolean      not null default true,
  is_protected boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Reads order by position; an index keeps the ordered list cheap as the table
-- grows (and the pattern carries to the larger Wave 2 config tables).
create index if not exists crm_stages_position_idx
  on public.crm_stages (position);

comment on table public.crm_stages is
  'CONFIG-TABLE pattern (first instance): DB-backed CRM pipeline stages. Replaces the hardcoded CRM_STAGES const. key matches crm_people.stage; label is the editable display name; position is funnel order; is_protected stages cannot be deleted.';
comment on column public.crm_stages.key is
  'Stable identifier a crm_people.stage value matches. Equals the label for the FUB-imported seed rows.';
comment on column public.crm_stages.is_protected is
  'System stage the delete action refuses to remove (Trash + Archive).';

-- Seed from the exact retired const list, preserving order via position.
-- (lib/crm/constants.ts CRM_STAGES — DO NOT edit that file here; this mirrors it.)
-- Trash + Archive are the only system/terminal buckets → is_protected = true.
insert into public.crm_stages (key, label, position, is_protected)
values
  ('Lead',                    'Lead',                     0,  false),
  ('Seller Prospect',         'Seller Prospect',          1,  false),
  ('A - Hot 1-3 Months',      'A - Hot 1-3 Months',       2,  false),
  ('B - Warm 3-6 Months',     'B - Warm 3-6 Months',      3,  false),
  ('C - Cold 6+ Months',      'C - Cold 6+ Months',       4,  false),
  ('Renter - future buyer',   'Renter - future buyer',    5,  false),
  ('Active Client',           'Active Client',            6,  false),
  ('Pending',                 'Pending',                  7,  false),
  ('Past Client',             'Past Client',              8,  false),
  ('Sphere',                  'Sphere',                   9,  false),
  ('Nurture',                 'Nurture',                  10, false),
  ('Closed',                  'Closed',                   11, false),
  ('Archive',                 'Archive',                  12, true),
  ('Real Estate Agent',       'Real Estate Agent',        13, false),
  ('Vendor',                  'Vendor',                   14, false),
  ('Trash',                   'Trash',                    15, true)
on conflict (key) do nothing;
