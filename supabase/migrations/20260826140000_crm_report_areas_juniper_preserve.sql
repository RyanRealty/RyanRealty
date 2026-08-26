-- crm_report_areas: Pronghorn -> Juniper Preserve.
--
-- The catalog was seeded from buildMarketReportAreas(), which takes resort
-- community labels straight from data/resort-communities.json. That label is now
-- "Juniper Preserve" (rebrand verified against the resort's own site; see
-- 20260826130000), so the seeded row drifted and lib/crm/report-areas-seed.test.ts
-- — which asserts the catalog still mirrors the builder exactly — went red.
--
-- The KEY does not change. 'pronghorn' is the join key for existing contact
-- report subscriptions; renaming it would silently unsubscribe every contact
-- subscribed to this area.
--
-- `position` is the catalog's display order and the seed built it by sorting on
-- label, so a rename has to re-sort or the admin list stops being alphabetical.
-- Renumbering is done in SQL from the labels themselves rather than from a
-- hardcoded list, so it stays correct whatever else has been added since.

update public.crm_report_areas
set label = 'Juniper Preserve'
where key = 'pronghorn'
  and label = 'Pronghorn';

with ordered as (
  select key, row_number() over (order by label) - 1 as new_position
  from public.crm_report_areas
)
update public.crm_report_areas a
set position = o.new_position
from ordered o
where a.key = o.key
  and a.position is distinct from o.new_position;
