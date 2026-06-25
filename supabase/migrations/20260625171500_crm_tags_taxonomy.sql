-- crm_tags — the CONFIG-TABLE pattern, applied to the TAG taxonomy.
--
-- Tags are stored ON crm_people.tags (text[]) — they always have been (carried
-- from FUB's 1,486 namespaced tags). This table is NOT where a person's tags
-- live. It is the managed TAXONOMY: the canonical list of tag keys the UI offers
-- as autocomplete, the human label per key, render order, an active flag, and a
-- protected flag for the compliance-critical tags that must never be deleted or
-- merged away.
--
-- Shape mirrors crm_stages exactly (the reusable config-table template):
-- - key        the literal string stored in crm_people.tags[] (e.g.
--              'audience:seller'). The taxonomy key IS the on-person value, so a
--              rename has to rewrite the array everywhere (handled in
--              app/actions/crm-tags.ts), not just relabel the row.
-- - label      what the UI shows. Editable independent of the key.
-- - position   render order in the tag manager + autocomplete.
-- - is_active  soft on/off. An inactive tag drops out of the autocomplete picker
--              but a person already carrying it keeps it (no array rewrite).
-- - is_protected  a compliance tag the delete/merge actions refuse to touch
--                 (hard-stop, do-not-text, do-not-call — the chokepoint in
--                 lib/crm/suppressions.ts reads these off crm_people.tags).
create table if not exists public.crm_tags (
  id           bigserial    primary key,
  key          text         not null unique,
  label        text         not null,
  position     int          not null default 0,
  is_active    boolean      not null default true,
  is_protected boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Reads order by position; an index keeps the ordered list cheap.
create index if not exists crm_tags_position_idx
  on public.crm_tags (position);

comment on table public.crm_tags is
  'CONFIG-TABLE pattern: the managed TAG TAXONOMY. Tags themselves live on crm_people.tags (text[]); this table is the canonical key list (autocomplete source) plus protected compliance tags. key equals the literal value stored in crm_people.tags[] — a rename rewrites the array everywhere.';
comment on column public.crm_tags.key is
  'The literal string stored in crm_people.tags[]. A rename rewrites the array across every person, not just this row.';
comment on column public.crm_tags.is_protected is
  'Compliance-critical tag the delete + merge actions refuse to touch (hard-stop / do-not-text / do-not-call — read by lib/crm/suppressions.ts).';

-- Seed: the three compliance-critical tags as PROTECTED (these gate every
-- outbound send via lib/crm/suppressions.ts — deleting or merging one would
-- silently re-open a suppressed channel), plus a representative set of the
-- canonical namespaced tags from the locked kebab-case schema
-- (docs/FUB_AUDIT_2026-05-17.md, lib/crm/enroll.ts). on conflict do nothing so a
-- re-run is idempotent and never clobbers a hand-edited label.
insert into public.crm_tags (key, label, position, is_protected)
values
  -- Compliance — protected, never deletable/mergeable.
  ('compliance:hard-stop',  'Compliance - hard stop',   0,  true),
  ('contact:do-not-text',   'Contact - do not text',    1,  true),
  ('contact:do-not-call',   'Contact - do not call',    2,  true),
  -- Audience.
  ('audience:buyer',        'Audience - buyer',         10, false),
  ('audience:seller',       'Audience - seller',        11, false),
  -- Seller tiers (canonical kebab schema).
  ('seller:hot',            'Seller - hot',             20, false),
  ('seller:warm',           'Seller - warm',            21, false),
  ('seller:nurture',        'Seller - nurture',         22, false),
  -- Source.
  ('source:seller-lp',      'Source - seller LP',       30, false),
  ('source:fb-ads-seller',  'Source - FB ads (seller)', 31, false)
on conflict (key) do nothing;
