-- get_subdivision_sales_history RPC + slugify_geo helper + expression index
-- (W2.5 subdivision depth, 2026-07-22).
--
-- Yearly closed-sale aggregates for one subdivision plat, matched by URL slug.
-- Powers the sales-history section on /subdivisions/[slug] via the
-- getSubdivisionSalesHistory DAL. Returns ONLY market statistics (year, count,
-- median) — never row-level sold listings (ODS §5-4 A.4: sold data is
-- VOW-only; a yearly aggregate is an allowed market statistic).
--
-- WHY slug-match in SQL: /subdivisions/[slug] slugs are produced by
-- lib/slug.ts slugify(SubdivisionName), and MLS SubdivisionName carries casing
-- and punctuation variants ("Tetherow Phase 5", "TETHEROW PHASE 5 P.U.D.")
-- that all collapse to one slug. slugify_geo mirrors the JS normalization
-- exactly (trim -> lower -> whitespace->hyphen -> strip non [a-z0-9-] ->
-- collapse hyphen runs -> trim edge hyphens -> 'unknown' on empty) so every
-- variant aggregates under the page's slug.
--
-- WHY an expression index: without it the RPC would seq-scan 589K rows with 3
-- regexps per row on every cold call. The partial index (PropertyType='A',
-- matching the site-wide SFR convention) makes the lookup a cheap index scan.
-- Plain CREATE INDEX (not CONCURRENTLY) because supabase migrations run inside
-- a transaction; the brief write-lock during apply is acceptable.
--
-- SET statement_timeout '15s' overrides the anon 3s cap as a cold-buffer
-- safety net (same idiom as community_subdivisions, migration 20260529050000).
-- The DAL caches results for 6h, so this runs at most once per TTL per slug.

-- 1. Slug normalizer — MUST stay in lockstep with lib/slug.ts slugify().
create or replace function public.slugify_geo(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(
    nullif(
      trim(both '-' from
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(trim(coalesce(p_text, ''))), '\s+', '-', 'g'),
            '[^a-z0-9-]', '', 'g'
          ),
          '-{2,}', '-', 'g'
        )
      ),
      ''
    ),
    'unknown'
  )
$$;

-- 2. Partial expression index for the slug lookup (SFR rows only — the query
--    always filters "PropertyType" = 'A', which lets the planner use this).
create index if not exists idx_listings_subdivision_slug_sfr
  on public.listings (public.slugify_geo("SubdivisionName"))
  where "PropertyType" = 'A';

-- 3. The aggregate RPC.
create or replace function public.get_subdivision_sales_history(p_slug text)
returns table(
  sale_year          int,
  closed_count       int,
  median_close_price numeric
)
language sql
stable
security definer
set search_path = public
set statement_timeout = '15s'
as $$
  select
    extract(year from l."CloseDate")::int as sale_year,
    count(*)::int as closed_count,
    (percentile_cont(0.5) within group (order by l."ClosePrice"))::numeric as median_close_price
  from public.listings l
  where l."PropertyType" = 'A'
    and lower(coalesce(l."StandardStatus", '')) like '%closed%'
    and l."CloseDate" is not null
    and l."ClosePrice" is not null
    and l."ClosePrice" > 0
    and public.slugify_geo(l."SubdivisionName") = p_slug
  group by 1
  order by 1 desc
$$;

-- Grant lockdown (memory: SECURITY DEFINER RPC grant lockdown — revoke from
-- PUBLIC, then grant the exact roles). Anon is intentional: the RPC exposes
-- only aggregate market statistics.
revoke all on function public.get_subdivision_sales_history(text) from public;
grant execute on function public.get_subdivision_sales_history(text) to anon, authenticated, service_role;
