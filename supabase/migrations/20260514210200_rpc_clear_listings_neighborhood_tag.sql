-- RPC: clear_listings_neighborhood_tag
-- Clears public.listings.boundary_neighborhood for any listing currently tagged with the given name.
-- Used during boundary re-imports so listings get cleanly re-classified against the new polygons.
-- Operates one name at a time to stay under statement timeouts on the 590K+ row listings table.

CREATE OR REPLACE FUNCTION public.clear_listings_neighborhood_tag(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.listings
  SET boundary_neighborhood = NULL
  WHERE boundary_neighborhood = p_name;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('name', p_name, 'rows_cleared', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.clear_listings_neighborhood_tag(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_listings_neighborhood_tag(text) TO service_role;
