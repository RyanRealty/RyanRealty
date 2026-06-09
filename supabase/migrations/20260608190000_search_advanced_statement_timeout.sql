-- Stop subdivision / preset / advanced-filter search pages from 500-ing on a
-- cold heavy scan.
--
-- WHY: search_listings_advanced is the heavy listings RPC (count(*) OVER() +
-- jsonb feature filters). The anon role's statement_timeout is 3s, but the RPC's
-- cold scan can take several seconds (its own code comments cite ~8s cold). When
-- it trips 3s, Postgres raises 57014; getListingsAdvanced returns degraded=true;
-- the search page throws (the deliberate "don't ISR-cache an empty grid"
-- protection) and renders a blank error boundary. Live DB logs (2026-06-08)
-- showed "canceling statement due to statement timeout" on every
-- /homes-for-sale/<city>/<subdivision|preset> hit.
--
-- A per-function statement_timeout OVERRIDES the role setting for the duration of
-- the call, so the cold RPC gets the room it needs (12s, matching the search
-- page's LISTINGS_FETCH_TIMEOUT_MS) while every other anon query stays capped at
-- the strict 3s. Warm calls are ~26ms; this only changes the cold-call ceiling.

ALTER FUNCTION public.search_listings_advanced(
  text, text, text, numeric, numeric, integer, integer, numeric, numeric,
  numeric, numeric, integer, integer, numeric, numeric, text, text, text, text,
  boolean, integer, boolean, boolean, boolean, boolean, boolean, text, integer,
  text, integer, integer
) SET statement_timeout = '12s';
