-- crm_automation_rules — UI-configurable AUTOMATION/TRIGGER rules.
--
-- Replaces the hardcoded RULES const in lib/crm/enroll.ts (the only auto-enroll
-- triggers today: 4 tags -> 4 master sequences). Makes "when trigger X happens,
-- do action Y" a row in a table the broker manages from the UI, not a code
-- deploy. Linear, single-condition rules only (branching is out of v1).
--
-- - trigger_type   what fires the rule. v1 set:
--                    tag_added      a tag lands on a person
--                    stage_changed  a person moves to a stage
--                    source_is      a person's source matches
--                    inactivity     no activity for N days
-- - trigger_value  the matched value: the tag key / stage key / source string,
--                  or the integer day count (as text) for inactivity.
-- - action_type    what to do. v1 set:
--                    enroll_sequence  enroll the person in a workflow
--                    add_tag          add a tag
--                    set_stage        move the person to a stage
--                    assign_broker    assign the person to a broker
-- - action_value   the action target: the crm_sequences.id (as text) for
--                  enroll_sequence, the tag key / stage key, or the broker slug.
-- - position       evaluation order. Lower = evaluated first; first matching
--                  rule wins per trigger (mirrors the retired const's order).
-- - is_active      soft on/off. An inactive rule never fires.
create table if not exists public.crm_automation_rules (
  id            bigserial    primary key,
  name          text         not null,
  is_active     boolean      not null default true,
  trigger_type  text         not null check (trigger_type in ('tag_added', 'stage_changed', 'source_is', 'inactivity')),
  trigger_value text         not null,
  action_type   text         not null check (action_type in ('enroll_sequence', 'add_tag', 'set_stage', 'assign_broker')),
  action_value  text         not null,
  position      int          not null default 0,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- The engine's hot lookup: active rules for a given trigger type, in order.
create index if not exists crm_automation_rules_active_trigger_idx
  on public.crm_automation_rules (is_active, trigger_type, position);

comment on table public.crm_automation_rules is
  'UI-configurable CRM automation rules: when trigger_type/trigger_value fires, run action_type/action_value. Replaces the hardcoded RULES const in lib/crm/enroll.ts. Linear single-condition rules only; first active rule per trigger wins by position.';
comment on column public.crm_automation_rules.trigger_value is
  'Matched value: tag key / stage key / source string, or integer day count (as text) for inactivity.';
comment on column public.crm_automation_rules.action_value is
  'Action target: crm_sequences.id (as text) for enroll_sequence, tag key / stage key, or broker slug.';

-- Seed the 4 existing RULES (lib/crm/enroll.ts RULES const). Each maps a tag to
-- the master sequence resolved by its fub_legacy_plan_id, so action_value holds
-- the live crm_sequences.id (the engine resolves+activates by id). Order matches
-- the const exactly (intent rules before audience rules) so behaviour is
-- unchanged. Only inserts a row when the target sequence exists.
insert into public.crm_automation_rules (name, is_active, trigger_type, trigger_value, action_type, action_value, position)
select v.name, true, 'tag_added', v.tag, 'enroll_sequence', s.id::text, v.position
from (values
  ('Expired listing -> expired seller workflow', 'intent:expired-listing', 71, 0),
  ('FSBO -> FSBO workflow',                      'intent:fsbo',            72, 1),
  ('Seller -> seller workflow',                  'audience:seller',        69, 2),
  ('Buyer -> buyer workflow',                    'audience:buyer',         70, 3)
) as v(name, tag, fub_plan_id, position)
join public.crm_sequences s on s.fub_legacy_plan_id = v.fub_plan_id
on conflict do nothing;
