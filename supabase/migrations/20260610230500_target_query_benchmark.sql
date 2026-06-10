-- THE LOOP step 10 (compete) substrate — growth-loop 2026-06-10.
-- A standing registry of target search queries + a view of our GSC position/
-- clicks per query over time. The diagnose step reads the view to attack the
-- gap-to-#1 on queries we have CHOSEN to win, instead of only reacting to
-- whatever happens to rank. Seeded from real 28d GSC query data (top
-- impressions) + the strategic city/community core set.
-- Phase 2 (separate): competitor SERP positions per query via recon.

create table if not exists public.target_queries (
  query text primary key,
  segment text not null,            -- 'city-buy' | 'community' | 'brand' | 'market-data' | 'agent'
  target_url text,                  -- the page that SHOULD rank for it
  priority integer not null default 2,  -- 1 = must-win, 2 = important, 3 = watch
  notes text,
  added_at timestamptz not null default now()
);

comment on table public.target_queries is
  'THE LOOP step 10: queries we are explicitly competing to win. Joined against GSC query-level rows in site_signal by the target_query_benchmark view. docs/DEVELOPMENT_PROCESS.md';

alter table public.target_queries enable row level security;

create or replace view public.target_query_benchmark as
select
  tq.query,
  tq.segment,
  tq.priority,
  tq.target_url,
  s.date,
  max(s.value) filter (where s.metric = 'impressions') as impressions,
  max(s.value) filter (where s.metric = 'clicks') as clicks,
  max(s.value) filter (where s.metric = 'position') as position
from public.target_queries tq
left join public.site_signal s
  on s.channel = 'gsc'
 and s.scope = 'campaign'
 and lower(replace(replace(replace(s.surface, 'query:', ''), '"', ''), '[', '')) ilike '%' || lower(tq.query) || '%'
group by tq.query, tq.segment, tq.priority, tq.target_url, s.date;

comment on view public.target_query_benchmark is
  'Our daily GSC position/impressions/clicks per target query. Gap-to-benchmark = position - 1. Absence of rows for a date means the query was outside that day''s GSC top-25 (not zero impressions).';
