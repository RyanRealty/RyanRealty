-- crm_report_areas — the CONFIG-TABLE pattern, market-report-area instance.
--
-- Kills the hardcoded market-report area set (lib/data/crm/getContactReportSubscriptions.ts
-- buildMarketReportAreas: the CENTRAL_OREGON_CITIES const + the resort communities
-- pulled from data/resort-communities.json) by making the area catalog a DB-backed,
-- UI-CRUD-able reference table. Same shape as crm_stages
-- (key/label/position/is_active/is_protected) so it reuses makeConfigTable with
-- zero per-table CRUD re-implementation.
--
-- - key        the geo SLUG a crm_report_subscriptions.areas[] entry matches
--              against (the report engine resolves a slug to a market geography).
--              Equals the slugs buildMarketReportAreas() emits today so existing
--              subscription rows keep resolving (no data rewrite).
-- - label      what the record-card area picker shows. Editable independent of the
--              key so a rename never orphans an existing subscription.
-- - position   render order in the picker. Seeded alphabetically by label, the
--              exact order buildMarketReportAreas() returns.
-- - is_active  soft on/off. An inactive area stops appearing in the picker but
--              existing subscriptions referencing it keep the slug.
-- - is_protected  Bend is the flagship market and the report engine's anchor
--                 geography, protected from deletion.
create table if not exists public.crm_report_areas (
  id           bigserial    primary key,
  key          text         not null unique,
  label        text         not null,
  position     int          not null default 0,
  is_active    boolean      not null default true,
  is_protected boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Reads order by position; an index keeps the ordered picker list cheap.
create index if not exists crm_report_areas_position_idx
  on public.crm_report_areas (position);

comment on table public.crm_report_areas is
  'CONFIG-TABLE pattern: DB-backed market-report area catalog. Replaces buildMarketReportAreas() in lib/data/crm/getContactReportSubscriptions.ts (Central Oregon cities + resort communities). key is the geo slug a crm_report_subscriptions.areas[] entry matches; label is the editable display name; position is picker order; Bend is protected (the anchor geography).';
comment on column public.crm_report_areas.key is
  'The geo slug a crm_report_subscriptions.areas[] entry matches. Equals the slugs buildMarketReportAreas() emits (cities + resort-communities.json slugs).';
comment on column public.crm_report_areas.is_protected is
  'Bend is the report engine anchor geography and cannot be deleted.';

-- Seed from the exact set buildMarketReportAreas() returns: the 7 Central Oregon
-- cities (CENTRAL_OREGON_CITIES const) plus the resort communities from
-- data/resort-communities.json, de-duped by slug and sorted by label. 20 areas.
-- (lib/data/crm/getContactReportSubscriptions.ts + data/resort-communities.json
--  — DO NOT edit those here; this mirrors them.) Bend → is_protected = true.
insert into public.crm_report_areas (key, label, position, is_protected)
values
  ('awbrey-glen',       'Awbrey Glen',       0,  false),
  ('bend',              'Bend',              1,  true ),
  ('black-butte-ranch', 'Black Butte Ranch', 2,  false),
  ('brasada-ranch',     'Brasada Ranch',     3,  false),
  ('broken-top',        'Broken Top',        4,  false),
  ('caldera-springs',   'Caldera Springs',   5,  false),
  ('crosswater',        'Crosswater',        6,  false),
  ('eagle-crest',       'Eagle Crest',       7,  false),
  ('la-pine',           'La Pine',           8,  false),
  ('northwest-crossing','NorthWest Crossing',9,  false),
  ('pronghorn',         'Pronghorn',         10, false),
  ('redmond',           'Redmond',           11, false),
  ('sisters',           'Sisters',           12, false),
  ('sunriver',          'Sunriver',          13, false),
  ('terrebonne',        'Terrebonne',        14, false),
  ('tetherow',          'Tetherow',          15, false),
  ('three-rivers',      'Three Rivers',      16, false),
  ('tumalo',            'Tumalo',            17, false),
  ('vandevert-ranch',   'Vandevert Ranch',   18, false),
  ('widgi-creek',       'Widgi Creek',       19, false)
on conflict (key) do nothing;
