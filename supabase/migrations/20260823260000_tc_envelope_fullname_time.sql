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
    'text',
    'checkbox',
    'strike',
    'highlight'
  ));

alter table public.tc_envelopes
  add column if not exists invite_subject text,
  add column if not exists invite_body text;

comment on column public.tc_envelopes.invite_subject is
  'Optional DigiSign Edit Message subject. Empty uses the brokerage default.';
comment on column public.tc_envelopes.invite_body is
  'Optional DigiSign Edit Message body. Empty uses the brokerage default.';
