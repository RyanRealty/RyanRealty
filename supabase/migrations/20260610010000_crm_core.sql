-- CRM core schema — Phase 0 of the FUB replacement (docs/CRM_REPLACEMENT_BLUEPRINT.md)
-- Mirror-first design: every row imported from FUB carries fub_legacy_id for reconciliation
-- during the parallel-run period. Service-role access only (RLS enabled, no policies).

create extension if not exists pg_trgm;

-- ── People ────────────────────────────────────────────────────────────────
create table public.crm_people (
  id bigint generated always as identity primary key,
  fub_legacy_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fub_created_at timestamptz,
  fub_updated_at timestamptz,
  first_name text,
  last_name text,
  name text,
  stage text not null default 'Lead',
  source text,
  source_url text,
  assigned_broker text,
  assigned_fub_user_id integer,
  emails jsonb not null default '[]'::jsonb,
  phones jsonb not null default '[]'::jsonb,
  addresses jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  custom jsonb not null default '{}'::jsonb,
  background text,
  price numeric,
  picture_url text,
  deleted boolean not null default false,
  last_activity_at timestamptz,
  raw jsonb
);
create index crm_people_tags_gin on public.crm_people using gin (tags);
create index crm_people_stage_idx on public.crm_people (stage);
create index crm_people_broker_idx on public.crm_people (assigned_broker);
create index crm_people_name_trgm on public.crm_people using gin (name gin_trgm_ops);
create index crm_people_updated_idx on public.crm_people (updated_at desc);
create index crm_people_fub_updated_idx on public.crm_people (fub_updated_at desc);

-- Normalized contact points: the lookup surface for inbound SMS/email routing.
create table public.crm_contact_points (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.crm_people(id) on delete cascade,
  kind text not null check (kind in ('email','phone')),
  value text not null,
  label text,
  is_primary boolean not null default false
);
create index crm_contact_points_value_idx on public.crm_contact_points (kind, value);
create index crm_contact_points_person_idx on public.crm_contact_points (person_id);

-- ── Unified timeline (notes, messages, calls, web events, system) ────────
create table public.crm_timeline (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.crm_people(id) on delete cascade,
  ts timestamptz not null default now(),
  kind text not null check (kind in (
    'note','email_in','email_out','sms_in','sms_out','call','voicemail',
    'web_event','task','stage_change','system'
  )),
  title text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  broker text,
  source text not null default 'app',
  fub_legacy_id bigint,
  dedupe_key text
);
create unique index crm_timeline_dedupe_uq on public.crm_timeline (dedupe_key) where dedupe_key is not null;
create index crm_timeline_person_ts_idx on public.crm_timeline (person_id, ts desc);
create index crm_timeline_kind_idx on public.crm_timeline (kind);

-- ── Tasks ─────────────────────────────────────────────────────────────────
create table public.crm_tasks (
  id bigint generated always as identity primary key,
  person_id bigint references public.crm_people(id) on delete cascade,
  name text not null,
  type text,
  due_at timestamptz,
  completed_at timestamptz,
  assigned_broker text,
  origin text not null default 'app',
  fub_legacy_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_tasks_due_idx on public.crm_tasks (due_at) where completed_at is null;
create index crm_tasks_person_idx on public.crm_tasks (person_id);

-- ── Deals (pre-contract pipeline only; Vault is the transaction SoR) ─────
create table public.crm_deals (
  id bigint generated always as identity primary key,
  person_id bigint references public.crm_people(id) on delete set null,
  name text,
  pipeline text,
  stage text,
  entered_stage_at timestamptz,
  value numeric,
  status text,
  listing_key text,
  fub_legacy_id bigint unique,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Saved views (smart-list replacement) ─────────────────────────────────
create table public.crm_saved_views (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  filter jsonb not null default '{}'::jsonb,
  sort text not null default 'updated_desc',
  shared boolean not null default true,
  owner text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Sequences (action-plan replacement; engine ships Phase 2) ─────────────
create table public.crm_sequences (
  id bigint generated always as identity primary key,
  name text not null,
  status text not null default 'paused' check (status in ('active','paused','archived')),
  description text,
  stop_on_reply boolean not null default true,
  steps jsonb not null default '[]'::jsonb,
  fub_legacy_plan_id integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_sequence_enrollments (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.crm_people(id) on delete cascade,
  sequence_id bigint not null references public.crm_sequences(id) on delete cascade,
  step_index int not null default 0,
  next_run_at timestamptz,
  status text not null default 'running' check (status in ('running','paused_reply','completed','stopped','suppressed')),
  enrolled_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_seq_enroll_due_idx on public.crm_sequence_enrollments (next_run_at) where status = 'running';
create unique index crm_seq_enroll_active_uq on public.crm_sequence_enrollments (person_id, sequence_id) where status in ('running','paused_reply');

-- ── Templates (email + SMS) ───────────────────────────────────────────────
create table public.crm_templates (
  id bigint generated always as identity primary key,
  key text unique not null,
  channel text not null check (channel in ('email','sms')),
  name text not null,
  subject text,
  body text not null,
  fub_legacy_id integer,
  updated_at timestamptz not null default now()
);

-- ── Suppressions: THE single compliance chokepoint for every send path ───
create table public.crm_suppressions (
  id bigint generated always as identity primary key,
  person_id bigint references public.crm_people(id) on delete cascade,
  channel text not null check (channel in ('all','sms','email','call')),
  value text,
  reason text not null,
  source text not null default 'import',
  created_at timestamptz not null default now()
);
create index crm_suppressions_person_idx on public.crm_suppressions (person_id);
create index crm_suppressions_value_idx on public.crm_suppressions (value) where value is not null;

-- ── Relationships ─────────────────────────────────────────────────────────
create table public.crm_relationships (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.crm_people(id) on delete cascade,
  related_person_id bigint references public.crm_people(id) on delete set null,
  related_name text,
  kind text,
  fub_legacy_id bigint unique
);

-- ── Import/sync bookkeeping (also holds the delta-sync cursor) ────────────
create table public.crm_imports (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  counts jsonb not null default '{}'::jsonb,
  cursor jsonb not null default '{}'::jsonb,
  notes text
);

-- ── RLS: service-role only on every crm_ table ────────────────────────────
alter table public.crm_people enable row level security;
alter table public.crm_contact_points enable row level security;
alter table public.crm_timeline enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_saved_views enable row level security;
alter table public.crm_sequences enable row level security;
alter table public.crm_sequence_enrollments enable row level security;
alter table public.crm_templates enable row level security;
alter table public.crm_suppressions enable row level security;
alter table public.crm_relationships enable row level security;
alter table public.crm_imports enable row level security;
