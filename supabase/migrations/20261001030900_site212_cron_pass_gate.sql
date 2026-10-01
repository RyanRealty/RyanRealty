-- SITE-212 review: the plat warmer's pass gap, decided in one statement.
--
-- WHY. warm-geo-pages may start a plat pass (about 2,750 cold renders) only
-- when no pass began in the last six hours (lib/warm-plat-pages.ts, "ONE PASS
-- PER GAP"). The first form treated "slice 0 was claimable" as "a pass is
-- starting" and gave slice 0 back when the gap was held. Two ways it failed:
-- the slice names carry the plat count, so when the indexable set changed size
-- mid-pass the renamed slice 0 asked for the gap again, found it held by its
-- own pass, and stopped the rest of that pass for up to six hours; and when the
-- claim or the give-back call failed, later slices were claimed with no gap
-- check at all.
--
-- THE GATE. crm_cron_pass_gate(marker, marker_seconds, gap, gap_seconds),
-- under one advisory lock so two runs cannot both start:
--   marker held (this deployment's pass already started)  -> 'continue'
--   else gap held (another pass began inside the gap)      -> 'throttled'
--   else take the gap and the marker                        -> 'start'
-- Nothing is taken and given back, so no failed call can leave a pass running
-- past the gap. The caller warms nothing unless the answer is 'start' or
-- 'continue'. Leases live in crm_cron_leases (20260704120300).

CREATE OR REPLACE FUNCTION public.crm_cron_pass_gate(
  p_marker         text,
  p_marker_seconds integer,
  p_gap            text,
  p_gap_seconds    integer
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('crm_cron_pass_gate:' || p_gap));

  IF EXISTS (
    SELECT 1 FROM public.crm_cron_leases l
    WHERE l.name = p_marker AND l.locked_until > now()
  ) THEN
    RETURN 'continue';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.crm_cron_leases l
    WHERE l.name = p_gap AND l.locked_until > now()
  ) THEN
    RETURN 'throttled';
  END IF;

  INSERT INTO public.crm_cron_leases AS l (name, locked_until)
  VALUES (p_gap, now() + make_interval(secs => p_gap_seconds))
  ON CONFLICT (name) DO UPDATE SET locked_until = excluded.locked_until;

  INSERT INTO public.crm_cron_leases AS l (name, locked_until)
  VALUES (p_marker, now() + make_interval(secs => p_marker_seconds))
  ON CONFLICT (name) DO UPDATE SET locked_until = excluded.locked_until;

  RETURN 'start';
END;
$fn$;

COMMENT ON FUNCTION public.crm_cron_pass_gate(text, integer, text, integer) IS
  'One-statement pass gate for a cron that runs a long pass at most once per gap: continue (marker held), throttled (gap held) or start (takes both). warm-geo-pages plat tier (SITE-212).';

REVOKE ALL ON FUNCTION public.crm_cron_pass_gate(text, integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_cron_pass_gate(text, integer, text, integer) TO service_role;
