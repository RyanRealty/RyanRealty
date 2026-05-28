-- Install `_agent_schema_dump()` — a SECURITY DEFINER function that
-- returns a row per column in the `public` schema (plus row-count
-- estimates for the hot tables).
--
-- This is the canonical interface used by `scripts/snapshot-schema.mjs`
-- to regenerate `docs/DATABASE_SCHEMA_SNAPSHOT.md` without giving the
-- agent (or any CI runner) raw `information_schema` access.
--
-- Why a function instead of exposing information_schema via PostgREST:
-- PostgREST's schema cache only indexes user-owned tables in the
-- exposed schema. We could expose information_schema but that gives
-- every anon caller read access to system catalogs. A scoped function
-- with EXECUTE granted to anon + authenticated + service_role is
-- safer and more portable.
--
-- The agent-discipline contract: read `docs/DATABASE_SCHEMA_SNAPSHOT.md`
-- instead of calling this directly. The gate `scripts/check-data-access.mjs`
-- ensures the committed snapshot stays in sync with what this function
-- returns.

CREATE OR REPLACE FUNCTION public._agent_schema_dump()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  ordinal_position int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  -- Tables + views (information_schema.columns covers these, but NOT
  -- materialized views — those have to come from pg_attribute joined to
  -- pg_matviews because materialized views are not "regular" relations
  -- for information_schema purposes).
  SELECT
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.ordinal_position::int
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  UNION ALL
  SELECT
    mv.matviewname::text AS table_name,
    a.attname::text AS column_name,
    format_type(a.atttypid, a.atttypmod)::text AS data_type,
    CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END::text AS is_nullable,
    NULL::text AS column_default,
    a.attnum::int AS ordinal_position
  FROM pg_matviews mv
  JOIN pg_class cl ON cl.relname = mv.matviewname AND cl.relkind = 'm'
  JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = mv.schemaname
  JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE mv.schemaname = 'public'
  ORDER BY 1, 6;
$$;

GRANT EXECUTE ON FUNCTION public._agent_schema_dump() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public._agent_schema_dump() IS 'Returns every column in the public schema. Called by scripts/snapshot-schema.mjs to regenerate docs/DATABASE_SCHEMA_SNAPSHOT.md. Safe to expose: returns column metadata only, no row data.';
