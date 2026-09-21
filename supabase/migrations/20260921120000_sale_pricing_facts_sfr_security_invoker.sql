-- C2 (deep audit 2026-09-20): sale_pricing_facts_sfr is a postgres-owned view
-- over the pricing-moat table. Default security_definer let the anon key page
-- 124k closed SFR comps even though sale_pricing_facts is RLS-on, 0 policies,
-- and REVOKE'd from anon. Invoker + revoke matches the facts table.

ALTER VIEW public.sale_pricing_facts_sfr SET (security_invoker = true);

REVOKE ALL ON TABLE public.sale_pricing_facts_sfr FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.sale_pricing_facts_sfr TO service_role;

COMMENT ON VIEW public.sale_pricing_facts_sfr IS
  'Detached SFR slice of sale_pricing_facts (sqft >= 300, close_price > 0). Service-role only. security_invoker so table RLS applies.';
