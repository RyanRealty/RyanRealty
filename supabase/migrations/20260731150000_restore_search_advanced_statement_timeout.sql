-- Restore the per-function statement_timeout on search_listings_advanced.
--
-- WHY: 20260608190000_search_advanced_statement_timeout gave the heavy search
-- RPC a 12s per-call ceiling (overriding the anon role's strict 3s) because the
-- cold scan legitimately needs several seconds — without it every cold
-- /homes-for-sale/<city>/<preset|subdivision> hit tripped 57014 and the page
-- rendered a blank error boundary.
--
-- That setting was attached to the FUNCTION SIGNATURE. When the signature grew
-- on 2026-07-06 (and again later — p_cities, p_view_contains_any,
-- p_off_market_within_days, p_exclude_sold_since, p_new_listings_days,
-- p_neighborhood_slug and friends), CREATE OR REPLACE targeted a NEW function
-- (different arg list = different pg_proc row) and the proconfig stayed behind
-- on the old one, which was later dropped. Verified live 2026-07-31:
-- proconfig IS NULL on the current 36-arg function, so cold calls are back on
-- the 3s role cap.
--
-- Signature below pulled live via pg_get_function_identity_arguments the same
-- day — it is the exact current identity, not a guess. If the signature grows
-- again, this setting is lost again: re-apply it in the SAME migration that
-- changes the signature.

ALTER FUNCTION public.search_listings_advanced(
  p_city text, p_subdivision text, p_postal_code text, p_min_price numeric,
  p_max_price numeric, p_min_beds integer, p_max_beds integer,
  p_min_baths numeric, p_max_baths numeric, p_min_sqft numeric,
  p_max_sqft numeric, p_year_built_min integer, p_year_built_max integer,
  p_lot_acres_min numeric, p_lot_acres_max numeric, p_property_type text,
  p_property_subtype text, p_status_filter text, p_keywords text,
  p_has_open_house boolean, p_garage_min integer, p_has_pool boolean,
  p_has_view boolean, p_has_waterfront boolean, p_has_fireplace boolean,
  p_has_golf_course boolean, p_view_contains text, p_cities text[],
  p_view_contains_any text[], p_off_market_within_days integer,
  p_exclude_sold_since boolean, p_new_listings_days integer,
  p_neighborhood_slug text, p_sort text, p_limit integer, p_offset integer
) SET statement_timeout = '12s';
