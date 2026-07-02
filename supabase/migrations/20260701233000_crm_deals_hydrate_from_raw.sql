-- Deals §10 — hydrate crm_deals columns from the FUB raw payload (one-time backfill).
--
-- Finding (2026-07-01, deals-desktop slice): the FUB deal import wrote the full
-- API payload into crm_deals.raw but never hydrated the dedicated columns —
-- close_date, the five key dates, commission_dollars, description and
-- assigned_broker were NULL on every row while raw.projectedCloseDate,
-- raw.commissionValue, raw.people[], raw.users[] etc. carried the real values
-- (verified live: 16 Closed deals, all close_date NULL, all raw.projectedCloseDate
-- populated). The §10 card spec (price + commission + close date + avatar cluster)
-- needs those columns. raw IS the primary source (the authoritative FUB export),
-- so this backfill copies raw → columns wherever the column is still NULL.
--
-- Date semantics: FUB date fields arrive as UTC timestamps pinned to midnight
-- Pacific (e.g. 2026-02-26T08:00:00Z) — cast via America/Los_Angeles so the
-- calendar date survives.

-- Key dates.
update public.crm_deals set close_date =
  ((nullif(raw->>'projectedCloseDate',''))::timestamptz at time zone 'America/Los_Angeles')::date
  where close_date is null and nullif(raw->>'projectedCloseDate','') is not null;
update public.crm_deals set earnest_money_due =
  ((nullif(raw->>'earnestMoneyDueDate',''))::timestamptz at time zone 'America/Los_Angeles')::date
  where earnest_money_due is null and nullif(raw->>'earnestMoneyDueDate','') is not null;
update public.crm_deals set mutual_acceptance =
  ((nullif(raw->>'mutualAcceptanceDate',''))::timestamptz at time zone 'America/Los_Angeles')::date
  where mutual_acceptance is null and nullif(raw->>'mutualAcceptanceDate','') is not null;
update public.crm_deals set due_diligence =
  ((nullif(raw->>'dueDiligenceDate',''))::timestamptz at time zone 'America/Los_Angeles')::date
  where due_diligence is null and nullif(raw->>'dueDiligenceDate','') is not null;
update public.crm_deals set final_walkthrough =
  ((nullif(raw->>'finalWalkThroughDate',''))::timestamptz at time zone 'America/Los_Angeles')::date
  where final_walkthrough is null and nullif(raw->>'finalWalkThroughDate','') is not null;
update public.crm_deals set possession =
  ((nullif(raw->>'possessionDate',''))::timestamptz at time zone 'America/Los_Angeles')::date
  where possession is null and nullif(raw->>'possessionDate','') is not null;

-- Gross commission (§8: a STORED amount, never computed from price). $0 is a real
-- value (FUB renders "$0" on lost deals), so 0 is copied, not skipped.
update public.crm_deals set commission_dollars = (nullif(raw->>'commissionValue',''))::numeric
  where commission_dollars is null and nullif(raw->>'commissionValue','') is not null;

update public.crm_deals set description = nullif(raw->>'description','')
  where description is null;

-- Assigned broker ← first FUB user on the deal (FUB user ids verified live:
-- 1 = Matt Ryan, 2 = Rebecca Peterson, 3 = Paul Stevenson).
update public.crm_deals set assigned_broker = case raw->'users'->0->>'id'
    when '1' then 'matt' when '2' then 'rebecca' when '3' then 'paul' end
  where assigned_broker is null and raw->'users'->0->>'id' in ('1','2','3');

-- Multi-contact junction ← raw.people[] (FUB legacy person ids → crm_people).
insert into public.crm_deal_people (deal_id, person_id)
select d.id, p.id
from public.crm_deals d
cross join lateral jsonb_array_elements(coalesce(d.raw->'people', '[]'::jsonb)) pe
join public.crm_people p on p.fub_legacy_id = (pe->>'id')::bigint
on conflict (deal_id, person_id) do nothing;

-- actual_close_date (§20.10) — rerun now that close_date is hydrated.
update public.crm_deals d
set actual_close_date = d.close_date
from public.crm_deal_stages s
join public.crm_pipelines p on p.id = s.pipeline_id
where d.actual_close_date is null
  and d.close_date is not null
  and s.is_closed_stage = true
  and d.pipeline = p.name
  and d.stage = s.name;
