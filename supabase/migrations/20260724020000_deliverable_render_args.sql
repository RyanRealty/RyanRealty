-- W10.3 — make a document re-renderable without recomputing its numbers.
--
-- THE DEFECT THIS CLOSES (verified in code 2026-07-24):
-- components/admin/cma/CmaReviewActions.tsx wires the "Signing broker" select to
-- rebuildCmaAction, which calls buildCma WITHOUT forwarding comp keys
-- (app/actions/cma-admin.ts). buildCma then re-selects comparables from scratch
-- and re-runs two Anthropic passes — judgeComps (lib/cma/build.ts:158) and
-- auditCma (lines 233, 272). So changing WHO SIGNS a client-facing pricing
-- document can change the recommended list price. That is a CLAUDE.md section 0
-- violation: the same property, valued twice, produces two numbers for reasons
-- that have nothing to do with the property.
--
-- A re-brand must be a RENDER, not a REBUILD. renderCmaHtml / renderBpoHtml are
-- pure functions of their args, but only the rendered html_content is persisted
-- — the args are not — so re-rendering with a different signature block is
-- currently impossible. This column stores them.
--
-- DELIBERATELY OMITTED from render_args: `broker` (that is the one thing a
-- re-brand replaces) and `mapDataUri` (a ~300KB base64 image; several readers
-- do select('*') on these tables and would pay it on every row read). The map is
-- re-derived at re-brand time, falling back to the one already embedded in the
-- stored html_content if the Maps fetch fails.
--
-- Nullable on purpose: the 192 documents that predate this column cannot be
-- re-branded without one rebuild, and the code returns a typed
-- 'predates the re-brand pass' result rather than silently rebuilding them.
ALTER TABLE public.cmas
  ADD COLUMN IF NOT EXISTS render_args jsonb;

ALTER TABLE public.broker_price_opinions
  ADD COLUMN IF NOT EXISTS render_args jsonb;

COMMENT ON COLUMN public.cmas.render_args IS
  'RenderCmaArgs minus broker and mapDataUri. Lets a document be re-rendered for a different signing broker with byte-identical numbers. Null = predates W10.3; rebuild once to populate.';

COMMENT ON COLUMN public.broker_price_opinions.render_args IS
  'RenderBpoArgs minus broker and mapDataUri. Same contract as cmas.render_args.';
