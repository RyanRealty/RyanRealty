-- Three valuation deliverables on one shared engine (Matt directive 2026-07-14):
-- CMA (sellers), EXPIRED AUDIT (expired owners: audit + services + 2.5% net
-- sheet), BPO (buyers, separate table). doc_type distinguishes the first two.
-- Applied to hosted Supabase 2026-07-14 via MCP apply_migration.
ALTER TABLE public.cmas
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'cma'
  CHECK (doc_type IN ('cma', 'expired-audit'));

CREATE INDEX IF NOT EXISTS cmas_doc_type_idx ON public.cmas (doc_type);

COMMENT ON COLUMN public.cmas.doc_type IS
  'cma = standard seller CMA; expired-audit = expired-listing audit (failure analysis + services + 2.5% net sheet). Same pricing engine, tailored output.';
