-- Stream 1 (CRM contact record card): the market-report subscription model.
--
-- Newsletter + listing-alerts are already first-class membership channels on a
-- contact (getContactMemberships). There was NO distinct "market reports"
-- subscription with selectable market areas + a cadence. This table adds it: one
-- row per contact, the set of geo areas they receive market reports for, and how
-- often. A broker flips this on/off, picks the areas, and sets the frequency from
-- the contact record card.
--
-- One row per person (unique(person_id)) — a contact has a single market-report
-- preference, not many. The reader/action upsert on that conflict target.
create table if not exists public.crm_report_subscriptions (
  id          bigserial    primary key,
  person_id   bigint       not null,
  -- Geo slugs/labels of the market areas they get reports for (e.g. {bend,sisters}).
  areas       text[]       not null default '{}',
  -- Cadence. Constrained to the three the report engine can produce.
  frequency   text         not null default 'monthly'
                check (frequency in ('weekly', 'monthly', 'quarterly')),
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  unique (person_id)
);

-- person_id is the only access pattern (one read per contact record card render,
-- one upsert per save). unique(person_id) already creates a btree, but the
-- explicit index keeps intent obvious + survives any future drop of the
-- constraint. Harmless duplicate-coverage; Postgres uses the unique index.
create index if not exists crm_report_subscriptions_person_id_idx
  on public.crm_report_subscriptions (person_id);

comment on table public.crm_report_subscriptions is
  'Per-contact market-report subscription: selectable geo areas + cadence. One row per crm_people.id. Set from the CRM contact record card.';
comment on column public.crm_report_subscriptions.areas is
  'Geo slugs/labels of the market areas this contact receives reports for. Empty = none selected yet.';
comment on column public.crm_report_subscriptions.frequency is
  'Report cadence: weekly | monthly | quarterly.';
