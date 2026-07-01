-- CRM templates: sharing + ownership columns (§13 Templates delivery).
--
-- is_shared   — when true, the template is visible to ALL brokers (not just
--               the owner). Default false keeps existing templates broker-local
--               until explicitly shared.
-- owner_broker — the broker slug (matt|rebecca|paul) who created the template.
--               Nullable for legacy/FUB-seeded templates that predate ownership
--               tracking. Superusers (Matt) may edit any template regardless of
--               owner; restricted brokers may only edit their own or shared ones.

ALTER TABLE public.crm_templates
  ADD COLUMN IF NOT EXISTS is_shared    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_broker text;

-- Indexes for the DAL queries that filter by owner or shared flag.
CREATE INDEX IF NOT EXISTS idx_crm_templates_owner_broker
  ON public.crm_templates (owner_broker)
  WHERE owner_broker IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_templates_is_shared
  ON public.crm_templates (is_shared)
  WHERE is_shared = true;
