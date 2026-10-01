-- SITE-212: the API plans every read with its own values.
--
-- WHY. PostgREST sends each read as a prepared statement whose filter values
-- are parameters ($1, $2, ...). After five executions on a connection Postgres
-- may switch the statement to a generic plan, built without the values, and
-- keeps it while its estimated cost is no higher than the custom plans'
-- average. On this data the estimate errs cheap. The neighborhood rail
-- (city_lower = $1 AND boundary_neighborhood = $2 AND standard_status = ANY ($3)
-- ... ORDER BY modified_at DESC) multiplies the average city and neighborhood
-- selectivities as if they were independent, 17 rows estimated, when a
-- neighborhood lies inside one city (Mountain View: 11,692 rows); and a
-- parameter cannot prove an index's WHERE on a status, so every
-- status-partial index is out. Production 2026-10-01, EXPLAIN (ANALYZE,
-- BUFFERS) of that rail for Bend / Mountain View: the generic plan read 8,095
-- heap blocks to return 24 rows; the same statement planned with its values
-- read 105. pg_stat_statements (since 2026-09-30 22:08Z): 6,988 calls at 3,449
-- blocks a call, the generic plan's signature; postgres_logs: 114 statement
-- timeouts at anon's 3 s for it between 2026-09-30 23:45Z and 2026-10-01
-- 04:10Z. No index fixes it: with listing_tile_mv_src indexes on
-- (boundary_neighborhood, standard_status, modified_at) and on (city_lower,
-- boundary_neighborhood, standard_status, modified_at) in place, the generic
-- plan still chose the 8,095-block bitmap.
--
-- THE CHANGE. plan_cache_mode = force_custom_plan for PostgREST's login role
-- and the three roles it impersonates (it applies an impersonated role's
-- settings on each request, the way anon's 3 s statement_timeout reaches
-- every anon read). Every execution is planned with its values; planning these
-- statements measured 2 to 3 ms. Undo with ALTER ROLE <role> RESET
-- plan_cache_mode and the same NOTIFY.

ALTER ROLE authenticator SET plan_cache_mode = 'force_custom_plan';
ALTER ROLE anon SET plan_cache_mode = 'force_custom_plan';
ALTER ROLE authenticated SET plan_cache_mode = 'force_custom_plan';
ALTER ROLE service_role SET plan_cache_mode = 'force_custom_plan';

-- PostgREST reads the impersonated roles' settings with its schema cache.
NOTIFY pgrst, 'reload schema';
