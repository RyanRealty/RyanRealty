-- crm_sequence_triggers — adds multi-trigger support to crm_sequences and
-- expands crm_automation_rules to cover the full FUB §8.5 trigger set.
--
-- BACKWARD-COMPATIBLE: the existing `steps` column is unchanged; existing
-- flat-step sequences run identically. The new `triggers` column defaults to
-- an empty array so every existing row is valid with no data migration.

-- 1. Add triggers column to crm_sequences (multi-trigger support).
--    Each element: { type: string, value?: string }
--    An empty array means "no sequence-level triggers" (manual-enroll only).
alter table public.crm_sequences
  add column if not exists triggers jsonb not null default '[]'::jsonb;

comment on column public.crm_sequences.triggers is
  'Array of { type, value } objects that auto-start this sequence. Empty = manual enroll only. Engine fires any matching trigger to start a new enrollment.';

-- 2. Widen the trigger_type CHECK on crm_automation_rules to cover the FUB §8.5
--    trigger set (deal_stage_changed, inquiry, property_saved, calendar_date,
--    appointment) while keeping the four original types.
--    Strategy: drop+recreate the CHECK constraint (Postgres does not support
--    ALTER CHECK directly; the constraint has no name, so we use a conditional
--    approach via a new named constraint).
--
--    Supabase hosted Postgres: constraints with CHECK can be altered by dropping
--    the implicit check and adding a named one. We use a DO block to be safe.
do $$
begin
  -- Drop the anonymous check constraint if it exists (the original migration
  -- created it inline, Postgres names it crm_automation_rules_trigger_type_check).
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'crm_automation_rules'
      and constraint_name = 'crm_automation_rules_trigger_type_check'
  ) then
    alter table public.crm_automation_rules
      drop constraint crm_automation_rules_trigger_type_check;
  end if;

  -- Add a new, named, wider constraint.
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'crm_automation_rules'
      and constraint_name = 'crm_automation_rules_trigger_type_v2_check'
  ) then
    alter table public.crm_automation_rules
      add constraint crm_automation_rules_trigger_type_v2_check
      check (trigger_type in (
        'tag_added',
        'stage_changed',
        'source_is',
        'inactivity',
        'deal_stage_changed',
        'inquiry',
        'property_saved',
        'calendar_date',
        'appointment'
      ));
  end if;
end
$$;

comment on column public.crm_automation_rules.trigger_type is
  'What fires the rule. v2 set adds: deal_stage_changed, inquiry, property_saved, calendar_date, appointment (FUB §8.5 parity). Original: tag_added, stage_changed, source_is, inactivity.';
