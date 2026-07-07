-- CMA deterministic builder storage (W1 lifecycle workflows, 2026-07-07).
--
-- The CMA HTML is now rendered by deterministic server code (lib/cma/build.ts)
-- and stored IN THE DATABASE so it survives Vercel's read-only filesystem.
-- public/cmas/<slug>/cma.html stays as the legacy home of the 21 pre-existing
-- finalized file-based CMAs; new builds live in cmas.html_content and are
-- served at /cma/<slug>.
--
-- Additive only. Idempotent.

ALTER TABLE public.cmas ADD COLUMN IF NOT EXISTS html_content text;
ALTER TABLE public.cmas ADD COLUMN IF NOT EXISTS citations jsonb;
ALTER TABLE public.cmas ADD COLUMN IF NOT EXISTS build_summary jsonb;
ALTER TABLE public.cmas ADD COLUMN IF NOT EXISTS built_at timestamptz;
ALTER TABLE public.cmas ADD COLUMN IF NOT EXISTS build_error text;
ALTER TABLE public.cmas ADD COLUMN IF NOT EXISTS price_override integer;

CREATE INDEX IF NOT EXISTS idx_cmas_status ON public.cmas (status);
CREATE INDEX IF NOT EXISTS idx_cmas_client_email_lower ON public.cmas (lower(client_email));

COMMENT ON COLUMN public.cmas.html_content IS 'Self-contained rendered CMA HTML (deterministic builder). Served at /cma/<slug>. Null for legacy file-based CMAs under public/cmas/.';
COMMENT ON COLUMN public.cmas.citations IS 'Per-figure verification trace written by the same build that produced html_content (CLAUDE.md section 0).';
COMMENT ON COLUMN public.cmas.build_summary IS 'Computed pricing summary (methods, tiers, comp grid, market context) for admin display and rebuilds.';
COMMENT ON COLUMN public.cmas.price_override IS 'Broker-adjusted recommended list price. When set, a rebuild re-anchors the tier grid on this number and notes the override in the rationale.';
