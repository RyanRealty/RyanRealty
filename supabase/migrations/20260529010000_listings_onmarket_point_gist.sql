-- Partial spatial GIST index on the listings point geometry, restricted to
-- on-market statuses.
--
-- WHY: the listing_boundary_xref_mv (migration 20260529020000) is rebuilt by a
-- full spatial join of on-market listings against every boundary polygon. This
-- partial GIST index accelerates that refresh's per-boundary bbox scan. It is
-- ALSO usable by any direct ST_Within query that filters on an on-market
-- status (a query with StandardStatus='Active' implies this IN-list predicate).
--
-- It is partial on the on-market set (~4% of the 589K-row table) so it stays
-- small and cheap to maintain on writes, unlike a broad coords-only index whose
-- bbox scans over a wide polygon (e.g. Tetherow, whose bbox reaches dense
-- central Bend) returned ~38K candidates and blew the anon 3s timeout.
--
-- The expression MUST be byte-identical to the join condition used by the MV
-- and any RPC so the planner matches it:
--   ST_SetSRID(ST_MakePoint("Longitude","Latitude"), 4326)

create index if not exists idx_listings_onmarket_point_gist
  on public.listings
  using gist (ST_SetSRID(ST_MakePoint("Longitude", "Latitude"), 4326))
  where "StandardStatus" in ('Active','Coming Soon','Active Under Contract','Pending')
    and "Latitude" is not null and "Longitude" is not null;
