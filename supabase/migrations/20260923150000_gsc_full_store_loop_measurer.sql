-- THE LOOP measures itself (visibility audit 2026-09-22: PROCESS-1, PROCESS-2,
-- TRACK-5, TRACK-11, gsc-trend-1, gsc-trend-2). Expand-only except the
-- target_query_benchmark view, which is rebuilt (its old definition matched
-- only a rank tracker's quoted queries).
--
-- Written by lib/data/loop/gsc-store.ts, weekly-measure.ts, scoreboard-snapshot.ts
-- through app/api/cron/loop-weekly-measure (Mondays). Service role only.

-- 1. Full-fidelity Search Console store --------------------------------------
-- The daily snapshot cron keeps the top 25 pages and queries per day, about 5%
-- of impressions (gsc-trend-1). These tables keep every row GSC returns.
-- page = normalized path (origin, query string, trailing slash removed, lower
-- case); page_class + market from lib/data/loop/gsc-page-class.ts.

create table if not exists public.gsc_page_daily (
  date date not null,
  search_type text not null default 'web',
  page text not null,
  page_class text not null,
  market text not null check (market in ('central-oregon', 'out-of-market', 'unknown')),
  clicks integer not null default 0,
  impressions integer not null default 0,
  position numeric(8, 2),
  url_variants integer not null default 1,
  fetched_at timestamptz not null default now(),
  primary key (date, search_type, page)
);

create index if not exists gsc_page_daily_class_date_idx on public.gsc_page_daily (page_class, date);
create index if not exists gsc_page_daily_page_date_idx on public.gsc_page_daily (page, date);

comment on table public.gsc_page_daily is
  'GSC Search Analytics page x date, every row (rowLimit 25,000 + startRow paging), settled days only. position = impression-weighted average for the page-day. Written weekly by /api/cron/loop-weekly-measure. Absence of a page on a date means GSC recorded no impressions for it.';

create table if not exists public.gsc_query_page_daily (
  date date not null,
  search_type text not null default 'web',
  query text not null,
  page text not null,
  page_class text not null,
  market text not null check (market in ('central-oregon', 'out-of-market', 'unknown')),
  trackable boolean not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  position numeric(8, 2),
  fetched_at timestamptz not null default now(),
  primary key (date, search_type, query, page)
);

create index if not exists gsc_query_page_daily_query_date_idx on public.gsc_query_page_daily (query, date);
create index if not exists gsc_query_page_daily_class_date_idx on public.gsc_query_page_daily (page_class, date);

comment on table public.gsc_query_page_daily is
  'GSC Search Analytics query x page x date, every row GSC returns (GSC withholds anonymized queries, so these sum below gsc_page_daily). query is lower case. trackable = false for quoted, bracketed and operator queries (a rank tracker, not demand).';

-- Per (page_class, market) totals over an inclusive window. The scoreboard's
-- GSC status and the brief's week-over-week deltas read this.
create or replace function public.gsc_page_class_rollup(p_start date, p_end date, p_search_type text default 'web')
returns table (page_class text, market text, pages bigint, clicks bigint, impressions bigint, position numeric)
language sql
stable
set search_path = public
as $$
  select
    g.page_class,
    g.market,
    count(distinct g.page) as pages,
    coalesce(sum(g.clicks), 0)::bigint as clicks,
    coalesce(sum(g.impressions), 0)::bigint as impressions,
    round(sum(g.position * g.impressions) / nullif(sum(g.impressions), 0), 2) as position
  from public.gsc_page_daily g
  where g.date between p_start and p_end
    and g.search_type = p_search_type
  group by g.page_class, g.market
$$;

comment on function public.gsc_page_class_rollup(date, date, text) is
  'Clicks, impressions, distinct pages and impression-weighted position per (page_class, market) for an inclusive date window over gsc_page_daily.';

-- 2. Weekly scoreboard snapshot ------------------------------------------------
create table if not exists public.loop_scoreboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  taken_at timestamptz not null default now(),
  source text not null,
  gsc_status text not null,
  gsc jsonb not null default '{}'::jsonb,
  signals jsonb not null default '{}'::jsonb,
  run jsonb not null default '{}'::jsonb
);

create index if not exists loop_scoreboard_snapshots_taken_at_idx on public.loop_scoreboard_snapshots (taken_at desc);

comment on table public.loop_scoreboard_snapshots is
  'One row per weekly measurer run: collectCompanyScoreboardSignals output (signals), the GSC page-class trend (gsc), and what the run did (run: store, learn, seed). Read by scripts/loop-brief.ts.';

-- Internal operational tables: service role only.
alter table public.gsc_page_daily enable row level security;
alter table public.gsc_query_page_daily enable row level security;
alter table public.loop_scoreboard_snapshots enable row level security;
revoke all on public.gsc_page_daily from anon, authenticated;
revoke all on public.gsc_query_page_daily from anon, authenticated;
revoke all on public.loop_scoreboard_snapshots from anon, authenticated;
revoke all on function public.gsc_page_class_rollup(date, date, text) from public, anon, authenticated;
grant execute on function public.gsc_page_class_rollup(date, date, text) to service_role;

-- 3. target_query_benchmark on the full store, exact match -------------------
-- Old view: ilike '%query%' over site_signal top-25 query rows with quotes and
-- brackets stripped. 153 of 153 rows in the 28 days before 2026-09-22 came from
-- quoted/bracketed queries (a rank tracker, 0 clicks). New view: the target
-- query itself, lower case, exact, trackable rows only. A target query with no
-- GSC row keeps one row with a NULL date (as before).
drop view if exists public.target_query_benchmark;
create view public.target_query_benchmark
with (security_invoker = true) as
select
  tq.query,
  tq.segment,
  tq.priority,
  tq.target_url,
  g.date,
  sum(g.impressions)::numeric as impressions,
  sum(g.clicks)::numeric as clicks,
  round(sum(g.position * g.impressions) / nullif(sum(g.impressions), 0), 2) as position,
  count(distinct g.page) as pages
from public.target_queries tq
left join public.gsc_query_page_daily g
  on g.query = lower(btrim(tq.query))
 and g.search_type = 'web'
 and g.trackable
group by tq.query, tq.segment, tq.priority, tq.target_url, g.date;

comment on view public.target_query_benchmark is
  'Daily GSC impressions/clicks/impression-weighted position per target query, exact lower-case match on gsc_query_page_daily, trackable queries only. pages = distinct URLs that collected the query that day (more than 1 = split landing). Absence of a date means GSC recorded no impressions for that exact query.';

revoke all on public.target_query_benchmark from anon, authenticated;

-- 4. Ledger: no data is not zero (gsc-trend-2) --------------------------------
-- An unmeasurable window closes with verdict 'unmeasurable' and actual_delta
-- NULL. A row is open while it has neither.
alter table public.site_improvement_ledger drop constraint if exists site_improvement_ledger_verdict_check;
alter table public.site_improvement_ledger
  add constraint site_improvement_ledger_verdict_check
  check (verdict in ('win', 'loss', 'flat', 'inconclusive', 'unmeasurable'));

alter table public.site_improvement_ledger drop constraint if exists site_improvement_ledger_measured_has_verdict;
alter table public.site_improvement_ledger
  add constraint site_improvement_ledger_measured_has_verdict
  check (actual_delta is null or verdict is not null) not valid;

create or replace function public.site_improvement_ledger_guard()
returns trigger
language plpgsql
as $$
declare
  open_count integer;
  stranded_count integer;
begin
  select count(*) into open_count
  from public.site_improvement_ledger
  where domain = new.domain and actual_delta is null and verdict is null;

  if open_count > 0 then
    select count(*) into stranded_count
    from public.site_improvement_ledger
    where domain = new.domain
      and actual_delta is null
      and verdict is null
      and shipped_at + make_interval(days => coalesce(window_days, 14)) < now();

    if stranded_count > 0 then
      raise exception 'domain "%" has % expired unlearned window(s) — write a verdict (Learn) before opening a new class', new.domain, stranded_count;
    end if;

    raise exception 'domain "%" already has % open class(es) — one open class per domain (THE LOOP); close or supersede it first', new.domain, open_count;
  end if;

  return new;
end;
$$;
