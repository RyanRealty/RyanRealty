-- Add the 2026-08-20 featured major parents to crm_report_areas.
-- Keys match data/resort-communities.json slugs. Positions continue after
-- the Bend-district seed (0–37). Keep lockstep with buildMarketReportAreas().

insert into public.crm_report_areas (key, label, position, is_protected)
values
  ('discovery-west', 'Discovery West', 38, false),
  ('petrosa', 'Petrosa', 39, false),
  ('seventh-mountain', 'Seventh Mountain', 40, false),
  ('shevlin-commons', 'Shevlin Commons', 41, false),
  ('tree-farm', 'Tree Farm', 42, false),
  ('westgate', 'Westgate', 43, false)
on conflict (key) do nothing;
