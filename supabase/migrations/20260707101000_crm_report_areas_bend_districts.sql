-- Add the 13 Bend neighborhood districts to the crm_report_areas catalog.
--
-- WHY: the CRM keeps a smart list per neighborhood (crm_people.neighborhood_slug
-- — Bend districts + resort communities). Matt directive 2026-07-06: every one
-- of those lists gets a DEFAULT saved search + market report. The resort
-- communities were already in the catalog (20260625171000 seed); the Bend
-- districts were not, so a bend-* area could never be subscribed. Every slug
-- below has full market_stats_cache coverage (geo_type='neighborhood', ~136
-- period rows each), so the report engine resolves real data for it.
--
-- Keys match crm_people.neighborhood_slug / boundaries.geo_slug exactly
-- (bend-* prefixed). Labels drop the redundant prefix — the same labeling the
-- CRM people-filter picker uses (lib/data/crm/getCrmNeighborhoodOptions.ts).
-- Positions continue after the 20260625171000 seed (0–24).
--
-- Keep the seed in lockstep with buildMarketReportAreas() in
-- lib/data/crm/getContactReportSubscriptions.ts (BEND_DISTRICTS const) — the
-- report-areas-seed parity test reads this file.
insert into public.crm_report_areas (key, label, position, is_protected)
values
  ('bend-awbrey-butte',      'Awbrey Butte',      25, false),
  ('bend-boyd-acres',        'Boyd Acres',        26, false),
  ('bend-century-west',      'Century West',      27, false),
  ('bend-larkspur',          'Larkspur',          28, false),
  ('bend-mountain-view',     'Mountain View',     29, false),
  ('bend-old-bend',          'Old Bend',          30, false),
  ('bend-old-farm-district', 'Old Farm District', 31, false),
  ('bend-orchard-district',  'Orchard District',  32, false),
  ('bend-river-west',        'River West',        33, false),
  ('bend-southeast-bend',    'Southeast Bend',    34, false),
  ('bend-southern-crossing', 'Southern Crossing', 35, false),
  ('bend-southwest-bend',    'Southwest Bend',    36, false),
  ('bend-summit-west',       'Summit West',       37, false)
on conflict (key) do nothing;
