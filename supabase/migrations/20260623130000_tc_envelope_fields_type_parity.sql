-- C4 (TC architecture review 2026-06-23): bring the tc_envelope_fields.type CHECK
-- into parity with the canonical TS SIGN_FIELD_TYPES (lib/tc/signing.ts) by
-- dropping the dead 'strike' value. 'strike' was never produced by any code path
-- (0 usages) and is unimplemented in the seal renderer (seal-pdf.ts), so it could
-- only ever silently draw nothing. The table is empty (0 rows), so this is safe.
-- A future strike-through feature must re-add it across CHECK + SIGN_FIELD_TYPES +
-- SignFieldValue + the seal renderer + the composer/UI together.
do $$
declare c text;
begin
  select con.conname into c
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and rel.relname = 'tc_envelope_fields'
    and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%strike%';
  if c is not null then
    execute format('alter table public.tc_envelope_fields drop constraint %I', c);
  end if;
end $$;

alter table public.tc_envelope_fields
  add constraint tc_envelope_fields_type_check
  check (type in ('signature', 'initials', 'date_signed', 'text', 'checkbox'));
