-- Spec 07 (prospecting hub) §4.2 — link a prospect to its built document by id,
-- not a fuzzy address slug. slugifyAddress strips street-type + zip but not city
-- and caps at 40 chars, so two properties (same street#+name in two cities, or
-- 40-char twins) could cross-link onto one cmas row + one client identity.
--
-- Additive + back-compatible: nullable FK, nothing reads it until the DAL rebuild
-- (getBuiltDocForProspect resolves by cma_id first, slug only as a warned legacy
-- fallback). Backfill from the current slug join runs after this lands.

ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS cma_id uuid REFERENCES public.cmas(id);
ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS cma_id uuid REFERENCES public.cmas(id);

CREATE INDEX IF NOT EXISTS idx_expired_cma_id ON public.expired_listings(cma_id);
CREATE INDEX IF NOT EXISTS idx_fsbo_cma_id    ON public.fsbo_listings(cma_id);

COMMENT ON COLUMN public.expired_listings.cma_id IS
  'FK to the built expired-audit/CMA for this listing (spec 07 §4.2). Resolves the document by id; the address-slug join is a legacy fallback only.';
COMMENT ON COLUMN public.fsbo_listings.cma_id IS
  'FK to the built CMA for this FSBO (spec 07 §4.2). Resolves the document by id; the address-slug join is a legacy fallback only.';
