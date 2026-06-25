-- crm_newsletter_segments — the CONFIG-TABLE pattern, newsletter-segment instance.
--
-- Kills the hardcoded newsletter segment enum (app/actions/newsletter.ts
-- SEGMENTS const + lib/data NewsletterSegment union) by making the audience
-- segments a DB-backed, UI-CRUD-able reference table. Same shape as crm_stages
-- (key/label/position/is_active/is_protected) so it reuses makeConfigTable with
-- zero per-table CRUD re-implementation.
--
-- - key        the stable identifier a newsletter_subscribers.segment value
--              matches against. Equals the four current enum literals so existing
--              subscriber rows keep resolving (no data rewrite).
-- - label      what the admin audience picker shows. Editable independent of the
--              key so a rename never orphans existing subscribers.
-- - position   render order in the picker. Seeded to preserve the const order.
-- - is_active  soft on/off. An inactive segment stops appearing in the picker but
--              existing subscribers on it keep their value.
-- - is_protected  'general' is the default fallback (asSegment coerces unknown
--                 values to 'general'), so it is protected from deletion — losing
--                 it would break the coercion floor.
create table if not exists public.crm_newsletter_segments (
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
create index if not exists crm_newsletter_segments_position_idx
  on public.crm_newsletter_segments (position);

comment on table public.crm_newsletter_segments is
  'CONFIG-TABLE pattern: DB-backed newsletter audience segments. Replaces the hardcoded SEGMENTS enum in app/actions/newsletter.ts. key matches newsletter_subscribers.segment; label is the editable display name; position is picker order; general is protected (the coercion fallback).';
comment on column public.crm_newsletter_segments.key is
  'Stable identifier a newsletter_subscribers.segment value matches. Equals the retired enum literals (general | buyer | seller | past-client).';
comment on column public.crm_newsletter_segments.is_protected is
  'general is the asSegment() coercion fallback and cannot be deleted.';

-- Seed from the exact retired enum, preserving order via position.
-- (app/actions/newsletter.ts SEGMENTS = ['general','buyer','seller','past-client']
--  — DO NOT edit that file here; this mirrors it.) general is the default
-- fallback → is_protected = true.
insert into public.crm_newsletter_segments (key, label, position, is_protected)
values
  ('general',     'General',     0, true),
  ('buyer',       'Buyer',       1, false),
  ('seller',      'Seller',      2, false),
  ('past-client', 'Past Client', 3, false)
on conflict (key) do nothing;
