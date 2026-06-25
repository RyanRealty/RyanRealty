-- crm_saved_views — the Wave 4 smart-list store (named, reusable CrmSegment AST).
--
-- The core migration (20260610010000_crm_core.sql) created crm_saved_views with a
-- legacy shape: filter jsonb / shared boolean / owner text / sort text. Wave 4
-- upgrades it to the AST model so a saved view is both (a) a clickable list filter
-- and (b) a reusable AUDIENCE for a bulk action, all resolving through the ONE
-- compiler (lib/data/crm/buildCrmPeopleQuery.ts) — no second filter codepath.
--
-- Shape after this migration:
--   id           bigserial pk (already identity from core — kept)
--   name         text not null
--   description  text
--   ast          jsonb not null   -- a CrmSegment (lib/crm/segment-ast.ts)
--   owner_email  text             -- null for seeded SYSTEM views
--   is_shared    boolean not null default false
--   is_protected boolean not null default false  -- system views can't be deleted
--   position     int not null default 0
--   created_at / updated_at timestamptz
--
-- Idempotent: ALTERs use IF NOT EXISTS, the backfill only touches new columns,
-- and the 12-row system seed is gated by a partial unique on system view names.

-- ── 1. New columns (additive) ────────────────────────────────────────────────
alter table public.crm_saved_views
  add column if not exists ast          jsonb,
  add column if not exists owner_email  text,
  add column if not exists is_shared    boolean not null default false,
  add column if not exists is_protected boolean not null default false,
  add column if not exists updated_at   timestamptz not null default now();

-- ── 2. Backfill the AST model from the legacy columns ────────────────────────
-- Legacy `filter` was { stage?: string; tagsAny?: string[] }. Translate it to a
-- CrmSegment AST so existing broker-created views keep resolving through the new
-- compiler. A row already carrying an `ast` is left untouched.
--   - stage  -> { field:'stage', value }
--   - tagsAny (len 1)  -> { field:'tag', op:'has', value }
--   - tagsAny (len >1) -> or-group of tag-has conditions
-- Both present -> top-level AND of the two. Neither -> empty AND (everyone).
update public.crm_saved_views v
set ast = coalesce(
  (
    select jsonb_build_object(
      'type', 'group',
      'op', 'and',
      'nodes', coalesce(
        (
          select jsonb_agg(node)
          from (
            -- stage condition (when present)
            select jsonb_build_object('field', 'stage', 'value', v.filter->>'stage') as node
            where (v.filter ? 'stage') and coalesce(v.filter->>'stage', '') <> ''
            union all
            -- single tag -> a bare tag-has condition
            select jsonb_build_object('field', 'tag', 'op', 'has', 'value', (v.filter->'tagsAny'->>0))
            where jsonb_typeof(v.filter->'tagsAny') = 'array'
              and jsonb_array_length(v.filter->'tagsAny') = 1
            union all
            -- multiple tags -> a single or-group node over tag-has conditions
            select jsonb_build_object(
              'type', 'group',
              'op', 'or',
              'nodes', (
                select jsonb_agg(jsonb_build_object('field', 'tag', 'op', 'has', 'value', t))
                from jsonb_array_elements_text(v.filter->'tagsAny') as t
              )
            )
            where jsonb_typeof(v.filter->'tagsAny') = 'array'
              and jsonb_array_length(v.filter->'tagsAny') > 1
          ) nodes
        ),
        '[]'::jsonb
      )
    )
  ),
  jsonb_build_object('type', 'group', 'op', 'and', 'nodes', '[]'::jsonb)
)
where v.ast is null;

-- Backfill is_shared / owner_email from the legacy shared / owner columns.
update public.crm_saved_views
set is_shared = coalesce(shared, false)
where is_shared = false and shared is true;

update public.crm_saved_views
set owner_email = owner
where owner_email is null and owner is not null;

-- ── 3. Lock the AST not-null now that every row has one ──────────────────────
alter table public.crm_saved_views
  alter column ast set not null;

-- ── 4. Indexes the DAL relies on ─────────────────────────────────────────────
create index if not exists crm_saved_views_is_shared_idx
  on public.crm_saved_views (is_shared);
create index if not exists crm_saved_views_owner_email_idx
  on public.crm_saved_views (owner_email);

-- A partial unique on SYSTEM view names (owner_email is null) makes the 12-row
-- seed idempotent: re-running the seed conflicts on the name and does nothing.
-- Broker-created views (owner_email not null) are unconstrained — two brokers can
-- both name a list "My Buyers".
create unique index if not exists crm_saved_views_system_name_uq
  on public.crm_saved_views (name)
  where owner_email is null;

comment on table public.crm_saved_views is
  'Wave 4 smart-list store. A saved view is a named CrmSegment AST that is both a clickable list filter and a reusable bulk-action audience, resolving through buildCrmPeopleQuery. Seeded system views (owner_email null, is_protected) mirror lib/crm/saved-view-seeds.ts; broker-created views carry owner_email.';
comment on column public.crm_saved_views.ast is
  'A CrmSegment (lib/crm/segment-ast.ts) — the boolean group/condition tree the resolver compiles.';
comment on column public.crm_saved_views.is_protected is
  'A seeded system view the delete action refuses to remove.';

-- ── 5. Seed the 12 FUB smart lists as protected, shared, system views ────────
-- owner_email null = system; is_protected true = undeletable; is_shared true =
-- visible to every broker. ASTs mirror lib/crm/saved-view-seeds.ts exactly.
-- Date windows (Stay In Touch / Email / IDX) are pinned at seed time; re-seeding
-- does nothing (the partial unique on name absorbs the conflict) so the windows
-- only advance if a row is deleted + re-inserted.
insert into public.crm_saved_views (name, description, ast, owner_email, is_shared, is_protected, position)
values
  (
    'Leads',
    'New leads in the pipeline.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Lead"}]}'::jsonb,
    null, true, true, 0
  ),
  (
    'Hot Prospects',
    'Hot prospects, 1 to 3 months out.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"A - Hot 1-3 Months"}]}'::jsonb,
    null, true, true, 1
  ),
  (
    'Sellers',
    'Seller audience and seller prospects.',
    '{"type":"group","op":"or","nodes":[{"field":"tag","op":"has","value":"audience:seller"},{"field":"stage","value":"Seller Prospect"}]}'::jsonb,
    null, true, true, 2
  ),
  (
    'Buyers',
    'Buyer audience.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"audience:buyer"}]}'::jsonb,
    null, true, true, 3
  ),
  (
    'Past Clients',
    'Closed clients to stay in touch with.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Past Client"}]}'::jsonb,
    null, true, true, 4
  ),
  (
    'Sphere',
    'Your sphere of influence.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Sphere"}]}'::jsonb,
    null, true, true, 5
  ),
  (
    'Nurture',
    'Long-term nurture contacts.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Nurture"}]}'::jsonb,
    null, true, true, 6
  ),
  (
    'Pending',
    'Contacts with a transaction in progress.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Pending"}]}'::jsonb,
    null, true, true, 7
  ),
  (
    'Closed',
    'Closed transactions.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Closed"}]}'::jsonb,
    null, true, true, 8
  ),
  (
    'Stay In Touch',
    'No activity in the last 90 days.',
    jsonb_build_object(
      'type', 'group', 'op', 'and',
      'nodes', jsonb_build_array(
        jsonb_build_object('field', 'last_activity', 'op', 'before',
          'value', to_char((now() - interval '90 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      )
    ),
    null, true, true, 9
  ),
  (
    'Email Activity',
    'Recent email engagement.',
    jsonb_build_object(
      'type', 'group', 'op', 'and',
      'nodes', jsonb_build_array(
        jsonb_build_object('field', 'last_activity', 'op', 'after',
          'value', to_char((now() - interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      )
    ),
    null, true, true, 10
  ),
  (
    'IDX Activity',
    'Recent website and search activity.',
    jsonb_build_object(
      'type', 'group', 'op', 'and',
      'nodes', jsonb_build_array(
        jsonb_build_object('field', 'last_activity', 'op', 'after',
          'value', to_char((now() - interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      )
    ),
    null, true, true, 11
  )
on conflict (name) where owner_email is null do nothing;
