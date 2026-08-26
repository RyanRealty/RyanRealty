-- mls_subdivision_plat_coverage — which recorded county plats does an MLS
-- SubdivisionName actually sit on?
--
-- WHY THIS EXISTS. The site routes /subdivisions/<slug> on slugify(MLS
-- SubdivisionName), but Deschutes County records plats under PHASED and
-- differently-worded names, so the naive slug misses them and the page
-- soft-404s. Worked examples, all verified 2026-08-26:
--   "Sunrise Village"      -> sunrise-village-{river-bluff,outback,west-knoll-section,east-knoll-section} + a replat
--   "Westbrook Meadows"    -> westbrook-meadows-p-u-d-phases-1-and-2 + -phase-3
--   "1st On The Hillsites" -> first-on-the-hill-sites   (county spells it "First", three words)
--   "Pace Estate"          -> pace-estates              (county pluralises it)
--
-- THE FUZZY PREFIX RULE IS FORBIDDEN. docs/plans/MOBILE_GRIND/STATE.json item
-- C-21 (corrected 2026-08-06) records that matching on leading characters
-- over-matched "Triple" to triple-ridge-* when the MLS truncation means Triple
-- KNOT, and under-matches every MLS abbreviation (Bbr, Oww, DrrhTrs, Mtn High,
-- Inn Of The 7th). So membership here is decided by GEOMETRY: where the homes
-- carrying that MLS name physically are. Geometry also surfaces the noise a
-- name rule cannot see — 5 listings tagged "Cline Falls Oasis" sit inside the
-- Coppermill plat, and 2 tagged "Sunrise Village" sit in Bachelor Sunrise.
--
-- OUTPUT IS EVIDENCE, NOT A DECISION. It returns per-plat hit counts and lets a
-- human decide; a low-share row is usually a mis-tagged listing or an abutting
-- plat, not a member. The reviewed result is committed to
-- data/subdivision-alias-plats.json. Nothing consumes this function at request
-- time.
--
-- Reads listing_tile_mv (the DAL's own source, all statuses, carries lat/lng)
-- rather than the 589K-row `listings` table. Sampling is capped per name so the
-- ST_Contains work stays bounded; boundaries is ~3.2K rows.
--
-- Gated to service_role: this is an operator/analysis tool, never anon-facing.

create or replace function public.mls_subdivision_plat_coverage(
  p_min_rows          int default 10,
  p_sample_per_name   int default 40
)
returns table (
  mls_name       text,
  naive_slug     text,
  lifetime_rows  int,
  sampled_points int,
  plat_slug      text,
  plat_label     text,
  plat_source    text,
  points_inside  int
)
language sql
stable
security definer
set search_path = public
set statement_timeout = '300s'
as $$
  with named as (
    select
      t.subdivision_name,
      -- Mirrors lib/slug.ts slugify() exactly, same operation order:
      -- lowercase -> whitespace to dash -> drop non [a-z0-9-] -> collapse -> trim.
      trim(both '-' from regexp_replace(
        regexp_replace(
          regexp_replace(lower(btrim(t.subdivision_name)), '\s+', '-', 'g'),
        '[^a-z0-9-]', '', 'g'),
      '-+', '-', 'g')) as naive_slug,
      count(*)::int as lifetime_rows
    from public.listing_tile_mv t
    where t.subdivision_name is not null
      and btrim(t.subdivision_name) <> ''
      and t.lat is not null
      and t.lng is not null
    group by 1, 2
    having count(*) >= greatest(1, p_min_rows)
  ),
  -- Only names the route cannot already resolve on its own slug.
  unresolved as (
    select n.*
    from named n
    left join public.boundaries b
      on b.geo_type = 'subdivision' and b.geo_slug = n.naive_slug
    where b.geo_slug is null
  ),
  sample as (
    select u.subdivision_name, u.naive_slug, u.lifetime_rows, s.lat, s.lng
    from unresolved u
    cross join lateral (
      select distinct t.lat, t.lng
      from public.listing_tile_mv t
      where t.subdivision_name = u.subdivision_name
        and t.lat is not null and t.lng is not null
      limit greatest(1, p_sample_per_name)
    ) s
  ),
  totals as (
    select subdivision_name, count(*)::int as sampled_points
    from sample group by 1
  )
  select
    sm.subdivision_name,
    sm.naive_slug,
    sm.lifetime_rows,
    tt.sampled_points,
    b.geo_slug,
    b.geo_label,
    b.source,
    count(*)::int as points_inside
  from sample sm
  join totals tt on tt.subdivision_name = sm.subdivision_name
  join public.boundaries b
    on b.geo_type = 'subdivision'
   and b.polygon is not null
   and ST_IsValid(b.polygon)
   and ST_Contains(b.polygon, ST_SetSRID(ST_MakePoint(sm.lng::float8, sm.lat::float8), 4326))
  group by 1, 2, 3, 4, 5, 6, 7
  order by sm.lifetime_rows desc, sm.subdivision_name, points_inside desc
$$;

revoke all on function public.mls_subdivision_plat_coverage(int, int) from public, anon, authenticated;
grant execute on function public.mls_subdivision_plat_coverage(int, int) to service_role;

comment on function public.mls_subdivision_plat_coverage(int, int) is
  'Operator tool. For MLS SubdivisionNames with no boundaries row at slugify(name), returns which recorded county plats their listings physically fall inside, with hit counts. Evidence for the reviewed map in data/subdivision-alias-plats.json — never a request-time read, and never an automatic mapping: a low-share row is usually a mis-tagged listing or an abutting plat. The fuzzy prefix rule this replaces is forbidden (MOBILE_GRIND C-21).';
