-- Where each deal term on a cycle came from (Matt 2026-09-24, asked what should
-- happen when the executed contract disagrees with the file: "Contract wins,
-- unless a person typed it").
--
-- tc_cycles.term_provenance: { <column>: { by, at, actor, document, page,
-- keptAgainst } } for the term columns (sale_price, earnest_money,
-- contract_acceptance_date, escrow_closing_date, inspection_days,
-- financing_days, escrow_company, escrow_number, buyers, sellers).
--   by = person    a broker typed it: a contract that disagrees is flagged for
--                  Matt and never written over
--        contract  the terms reader wrote it from the executed agreement
--        import    the SkySlope import or intake wrote it
--        mail      read from an email
-- No stamp = written before this column existed by a machine (the SkySlope
-- migration); the backfill below stamps everything a person or the terms
-- reader wrote before now. lib/tc/terms/provenance.ts is the reader.

alter table public.tc_cycles
  add column if not exists term_provenance jsonb not null default '{}'::jsonb;

comment on column public.tc_cycles.term_provenance is
  'Per term column: who wrote the current value (person | contract | import | mail), when, and from which document/page. A person-typed value is never overwritten by the contract reader. lib/tc/terms/provenance.ts.';

-- ── backfill: what a person typed ───────────────────────────────────────────
-- Each person stamp only lands on a column with no stamp yet, so the backfill
-- can be run again (after the deploy that starts stamping) without relabelling
-- anything a later writer stamped.

-- Contingency days: before today the only writer was the broker's own editor
-- (app/actions/tc-cycle-dates.ts). The terms reader's fills are re-stamped as
-- contract below, after this.
update public.tc_cycles c
set term_provenance = c.term_provenance
  || case when c.inspection_days is not null and not (c.term_provenance ? 'inspection_days') then jsonb_build_object('inspection_days', jsonb_build_object('by', 'person', 'at', c.updated_at, 'actor', null, 'note', 'backfill: set with the contingency editor')) else '{}'::jsonb end
  || case when c.financing_days is not null and not (c.term_provenance ? 'financing_days') then jsonb_build_object('financing_days', jsonb_build_object('by', 'person', 'at', c.updated_at, 'actor', null, 'note', 'backfill: set with the contingency editor')) else '{}'::jsonb end
where c.inspection_days is not null or c.financing_days is not null;

-- The parties a broker entered when opening a file (deal_created).
update public.tc_cycles c
set term_provenance = c.term_provenance
  || case when (jsonb_typeof(c.buyers) = 'array' and jsonb_array_length(c.buyers) > 0) and not (c.term_provenance ? 'buyers') then jsonb_build_object('buyers', jsonb_build_object('by', 'person', 'at', e.created_at, 'actor', e.actor, 'note', 'backfill: deal opened')) else '{}'::jsonb end
  || case when (jsonb_typeof(c.sellers) = 'array' and jsonb_array_length(c.sellers) > 0) and not (c.term_provenance ? 'sellers') then jsonb_build_object('sellers', jsonb_build_object('by', 'person', 'at', e.created_at, 'actor', e.actor, 'note', 'backfill: deal opened')) else '{}'::jsonb end
from public.tc_events e
where e.action = 'deal_created' and e.cycle_id = c.id;

-- An offer a broker accepted wrote price, closing, earnest money and buyers
-- onto the deal's latest sale cycle (app/actions/tc-offers.ts).
with accepted as (
  select distinct on (e.deal_id) e.deal_id, e.actor, e.created_at
  from public.tc_events e
  where e.action = 'offer_accepted'
  order by e.deal_id, e.created_at desc
),
target as (
  select distinct on (c.deal_id) c.id, a.actor, a.created_at
  from public.tc_cycles c
  join accepted a on a.deal_id = c.deal_id
  where c.kind = 'sale'
  order by c.deal_id, c.created_at desc
)
update public.tc_cycles c
set term_provenance = c.term_provenance
  || case when c.sale_price is not null and not (c.term_provenance ? 'sale_price') then jsonb_build_object('sale_price', jsonb_build_object('by', 'person', 'at', t.created_at, 'actor', t.actor, 'note', 'backfill: offer accepted')) else '{}'::jsonb end
  || case when c.escrow_closing_date is not null and not (c.term_provenance ? 'escrow_closing_date') then jsonb_build_object('escrow_closing_date', jsonb_build_object('by', 'person', 'at', t.created_at, 'actor', t.actor, 'note', 'backfill: offer accepted')) else '{}'::jsonb end
  || case when c.earnest_money is not null and not (c.term_provenance ? 'earnest_money') then jsonb_build_object('earnest_money', jsonb_build_object('by', 'person', 'at', t.created_at, 'actor', t.actor, 'note', 'backfill: offer accepted')) else '{}'::jsonb end
  || case when (jsonb_typeof(c.buyers) = 'array' and jsonb_array_length(c.buyers) > 0) and not (c.term_provenance ? 'buyers') then jsonb_build_object('buyers', jsonb_build_object('by', 'person', 'at', t.created_at, 'actor', t.actor, 'note', 'backfill: offer accepted')) else '{}'::jsonb end
from target t
where t.id = c.id;

-- ── backfill: what the terms reader wrote (overrides the guesses above) ─────

with fills as (
  select e.cycle_id, f.value->>'column' as col, e.created_at, f.value->>'document' as document,
         case when (f.value->>'page') ~ '^[0-9]+$' then (f.value->>'page')::int end as page,
         row_number() over (partition by e.cycle_id, f.value->>'column' order by e.created_at desc) as rn
  from public.tc_events e
  cross join lateral jsonb_array_elements(coalesce(e.detail->'fields', '[]'::jsonb)) as f(value)
  where e.action = 'deal_terms_filled' and e.cycle_id is not null
),
per_cycle as (
  select cycle_id,
         jsonb_object_agg(col, jsonb_build_object('by', 'contract', 'at', created_at, 'actor', 'deal-terms-reader', 'document', document, 'page', page)) as stamp
  from fills
  where rn = 1 and col is not null
  group by cycle_id
)
update public.tc_cycles c
set term_provenance = c.term_provenance || p.stamp
from per_cycle p
where p.cycle_id = c.id;

with accepted as (
  select distinct on (e.cycle_id, e.detail->>'column') e.cycle_id, e.detail->>'column' as col, e.actor, e.created_at, e.detail->>'document' as document,
         case when (e.detail->>'page') ~ '^[0-9]+$' then (e.detail->>'page')::int end as page
  from public.tc_events e
  where e.action = 'deal_terms_accepted' and e.cycle_id is not null
  order by e.cycle_id, e.detail->>'column', e.created_at desc
),
per_cycle as (
  select cycle_id, jsonb_object_agg(col, jsonb_build_object('by', 'contract', 'at', created_at, 'actor', actor, 'document', document, 'page', page)) as stamp
  from accepted
  where col is not null
  group by cycle_id
)
update public.tc_cycles c
set term_provenance = c.term_provenance || p.stamp
from per_cycle p
where p.cycle_id = c.id;
