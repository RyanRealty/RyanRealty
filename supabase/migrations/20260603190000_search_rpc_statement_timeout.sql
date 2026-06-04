-- Raise the per-function statement timeout on search_listings_advanced.
--
-- The golf-course + keyword filters scan details->>'PublicRemarks' with ILIKE,
-- which can exceed the anon role's short statement_timeout (57014) and return
-- nothing (the error is swallowed by the DAL -> empty grid). The on-golf-course
-- landing and the with-shop / rv-parking keyword presets all hit this.
--
-- The search RPC's result is page-cached (ISR revalidate=60 + unstable_cache on
-- the standard list path), so the query runs at most once per minute per route.
-- Giving the function room to finish is safe; a trigram index on PublicRemarks
-- is the follow-up perf optimization (built CONCURRENTLY off-hours).
ALTER FUNCTION public.search_listings_advanced(
  text,text,text,numeric,numeric,integer,integer,numeric,numeric,numeric,numeric,
  integer,integer,numeric,numeric,text,text,text,text,boolean,integer,boolean,
  boolean,boolean,boolean,boolean,text,integer,text,integer,integer
) SET statement_timeout TO '20s';
