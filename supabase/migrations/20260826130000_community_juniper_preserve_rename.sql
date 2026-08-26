-- Pronghorn -> Juniper Preserve: the PUBLIC NAME only.
--
-- public.communities.name is the third place this community is named (the other
-- two are data/resort-communities.json `label` and
-- data/resort-community-pronghorn.json `name`), and it is the one the page's
-- generateMetadata reads — so without this the <title> kept saying "Pronghorn
-- Homes for Sale" while the body said Juniper Preserve.
--
-- VERIFIED BEFORE APPLYING (CLAUDE.md §0 — a name is a fact like a number):
--   * The resort publishes og:site_name "Juniper Preserve" and the footer
--     "JUNIPER PRESERVE GOLF & WELLNESS RESORT, 65600 Pronghorn Club Drive,
--     Bend, Oregon 97701" (juniperpreserve.com).
--   * Rebrand announced 2022-10-17 ("Pronghorn Club and Resort Rebrands as
--     Juniper Preserve, a Destination Wellness Resort", PRWeb); KTVZ
--     2022-11-11, The Bulletin 2022-11-13. Still current: the GM signed Oregon
--     House Revenue testimony 2026-02-04 as "General Manager, Juniper Preserve".
--
-- THE SLUG DOES NOT CHANGE, deliberately. `slug` is a durable key, not a display
-- name: geo_snapshot_mv carries geo_key 'bend:pronghorn' and
-- /api/cron/market-stat-consistency sentinels on exactly that key;
-- market_stats_cache rows are keyed geo_slug='pronghorn'. Renaming the slug
-- orphans live figures on a $1M+ community page until every cache rebuilds, for
-- no user-visible gain. /communities/pronghorn stays canonical.
--
-- The RESIDENTIAL side keeps the old name and that is not an oversight: the HOA
-- of record is PRONGHORN COMMUNITY ASSOC INC, the recorded plats are Core Area
-- at Pronghorn / Estates at Pronghorn Phases 1-6 / Villas at Pronghorn, and MLS
-- SubdivisionName is exactly 'Pronghorn' with zero rows anywhere containing
-- 'preserve'. 'Pronghorn' therefore stays a LIVE alias in the registry.

update public.communities
set name = 'Juniper Preserve',
    updated_at = now()
where slug = 'pronghorn'
  and name = 'Pronghorn';
