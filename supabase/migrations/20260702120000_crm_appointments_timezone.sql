-- §09 Tasks & Calendar (docs/fub-crm-spec/09-tasks-and-calendar.md §2.6 field 6 / §2.9):
-- the Create Appointment modal carries a per-appointment timezone dropdown
-- ("Pacific Time (GMT-07:00)" default) and the spec data model stores it
-- ("timezone text — user's timezone for display"). Display metadata only —
-- start_at/end_at remain the stored wall-clock timestamps.
alter table public.crm_appointments
  add column if not exists timezone text;
