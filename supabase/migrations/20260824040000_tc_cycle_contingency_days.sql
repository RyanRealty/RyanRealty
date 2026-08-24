alter table public.tc_cycles
  add column if not exists inspection_days integer,
  add column if not exists financing_days integer;
