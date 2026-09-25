-- Envelope fields a signer can actually work (Matt 2026-09-24): "With the
-- forms, they have the ability to include date and time pickers, checkboxes,
-- and determine whether they're read-only or can be assigned to someone for
-- use. All that interactivity needs to be built into our system."
--
-- His calls the same day: a field the broker fills is LOCKED (it prints as
-- typed), with a per-field switch that hands it to a signer to change (the
-- field is then that signer's, prefilled); signers open the documents from
-- the email link, and an envelope can also require a text-message code.
--
-- lib/tc/field-rules.ts reads these columns.

-- Date and time pickers, beside the automatic date_signed / time_signed stamps.
alter table public.tc_envelope_fields
  drop constraint if exists tc_envelope_fields_type_check;

alter table public.tc_envelope_fields
  add constraint tc_envelope_fields_type_check
  check (type in (
    'signature',
    'initials',
    'full_name',
    'date_signed',
    'time_signed',
    'date',
    'time',
    'text',
    'checkbox',
    'strike',
    'highlight'
  ));

alter table public.tc_envelope_fields
  add column if not exists label text,
  add column if not exists group_key text,
  add column if not exists group_min integer,
  add column if not exists group_max integer;

comment on column public.tc_envelope_fields.label is
  'What the field asks for ("Possession date"), shown to the signer as its prompt.';
comment on column public.tc_envelope_fields.group_key is
  'Checkboxes that answer one question share a key; group_min / group_max are the rule (select at least / exactly / at most N).';

alter table public.tc_envelope_fields
  drop constraint if exists tc_envelope_fields_group_rule_check;

alter table public.tc_envelope_fields
  add constraint tc_envelope_fields_group_rule_check
  check (
    (group_key is null and group_min is null and group_max is null)
    or (group_key is not null
        and (group_min is null or group_min >= 0)
        and (group_max is null or group_max >= 1)
        and (group_min is null or group_max is null or group_min <= group_max))
  );

create index if not exists tc_envelope_fields_group_idx
  on public.tc_envelope_fields (envelope_id, group_key)
  where group_key is not null;

-- The phone a text-message code goes to, and which consent text was agreed.
alter table public.tc_envelope_recipients
  add column if not exists phone text,
  add column if not exists consent_version text;

-- The per-envelope switch for a text-message code before the documents open.
alter table public.tc_envelopes
  add column if not exists require_text_code boolean not null default false;
