alter table public.tc_form_versions drop constraint if exists tc_form_versions_field_map_source_check;

alter table public.tc_form_versions
  add constraint tc_form_versions_field_map_source_check
  check (field_map_source = any (array['acroform', 'manual', 'imported', 'skyslope', 'fallback_stack']));
