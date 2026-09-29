-- APPLIED TO PRODUCTION 2026-09-25 as migration `plat_parent_community_rpc`.
-- This file is the committed record.
--
-- WHY (SITE-208). getPlatParentCommunity (lib/data/geo/getPlatParentCommunity.ts)
-- answered "which registry community is this plat inside" by walking the 19
-- registry communities one at a time and awaiting community_subdivisions for
-- each until one listed the plat, so a cold /subdivisions/[slug] render could
-- wait on up to 19 sequential RPCs (a plat with no parent always paid all of
-- them). A Sentry trace on 2026-09-24 showed at least nine community_subdivisions
-- calls in a row on one render; Sentry's "Consecutive HTTP" performance issues
-- RYAN-REALTY-PLATFORM-3 to -8 are this class on /communities/[slug],
-- /subdivisions/[slug] and /listing/by-address/[...slug].
--
-- THE FIX. One function, one round trip: the plat row joined to every
-- candidate parent in one statement, with the SAME membership test as the live
-- community_subdivisions (20260925015103: box test, area guard, ST_Covers
-- short-circuit on valid non-zero-area geometry, majority-overlap ratio
-- otherwise), ordered by the caller's array position and cut to the first
-- match. The DAL passes the registry slugs in registry order, so the first
-- match in that order is exactly the community the sequential walk stopped at.
-- The only textual difference from community_subdivisions is the parent's
-- validity: that body reads it once through a scalar subquery keyed on its
-- single parent; here each candidate parent is its own join row, so it is
-- ST_IsValid(p.polygon) on that row. (geo_type, geo_slug) is UNIQUE
-- (boundaries_geo_type_geo_slug_key), so the two read the same polygon.
--
-- SAME ANSWER, MEASURED (scratchpad/site-208-equivalence.mts, 2026-09-25,
-- through PostgREST with the anon key): every member plat of the 19 registry
-- communities was read through the live community_subdivisions RPC in
-- .range() pages of 1,000, the oracle answer built by the exported
-- resolvePlatParentCommunity over those lists in registry order, and compared
-- with this function for every plat.
--   communities read 19 (15 have a neighborhood row in boundaries; the other 4,
--   mt-bachelor-village, rivers-edge, mountain-high and crooked-river-ranch,
--   list nothing on either path). Member plats 464 (no plat sits in two
--   lists). Plats compared 464, matches 464, mismatches 0. Non-member plats
--   null on both paths 3/3: tetherow-crossing and tetherow-crossing-phase-ii
--   (Redmond) and steve-w-yancey (an invalid geometry).
--
-- COLD, DAL LEVEL (same script, cache bypassed, direct supabase-js, one run
-- each; "before" is the sequential walk, "after" is this function):
--   plat                          before                       after
--   golf-homes-at-tetherow        1 call,    140 ms            1 call,  91 ms
--   tetherow-crossing (no parent) 19 calls, 3,876 ms           1 call, 107 ms
--   tennis-tracts-at-broken-top   2 calls,   463 ms            1 call,  95 ms
create or replace function public.plat_parent_community(
  p_plat_slug text,
  p_community_slugs text[]
)
returns table(geo_slug text)
language sql
stable
security definer
set search_path = public
set statement_timeout = '15s'
as $$
  select p.geo_slug
  from public.boundaries s
  join public.boundaries p
    on p.geo_type = 'neighborhood'
   and p.geo_slug = any(p_community_slugs)
  where s.geo_type = 'subdivision'
    and s.geo_slug = p_plat_slug
    and s.polygon && p.polygon
    -- Same test as community_subdivisions: a child plat is SMALLER than its
    -- parent community and lies MOSTLY inside it.
    and ST_Area(s.polygon) < ST_Area(p.polygon)
    and case
          when ST_IsValid(p.polygon)
               and ST_IsValid(s.polygon)
               and ST_Area(s.polygon) > 0
            then case
                   when ST_Covers(p.polygon, s.polygon) then true
                   else ST_Area(ST_Intersection(s.polygon, p.polygon)) / NULLIF(ST_Area(s.polygon), 0) > 0.5
                 end
          else ST_Area(ST_Intersection(s.polygon, p.polygon)) / NULLIF(ST_Area(s.polygon), 0) > 0.5
        end
  order by array_position(p_community_slugs, p.geo_slug)
  limit 1
$$;

grant execute on function public.plat_parent_community(text, text[]) to anon, authenticated;
