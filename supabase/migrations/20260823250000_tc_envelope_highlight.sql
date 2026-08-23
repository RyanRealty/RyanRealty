alter table public.tc_envelope_fields
  drop constraint if exists tc_envelope_fields_type_check;

alter table public.tc_envelope_fields
  add constraint tc_envelope_fields_type_check
  check (type in ('signature','initials','date_signed','text','checkbox','strike','highlight'));
