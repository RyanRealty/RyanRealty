-- Wave 2 (Configurability): make crm_templates fully editable in the admin.
--
-- crm_templates today is SELECT-only (seeded from FUB's 76 email + 37 SMS
-- templates via fub_legacy_id). To give it full admin CRUD we add two columns
-- the picker reader does not need but the admin list does:
--
--   * category   — an optional grouping label (e.g. 'seller', 'buyer',
--                  'nurture') so the admin can organize a large template set.
--                  Nullable; uncategorized templates stay valid.
--   * is_active  — soft-disable. An inactive template is hidden from the
--                  composer + sequence step picker but never deleted, so a
--                  sequence that still references its key keeps resolving copy
--                  rather than silently sending nothing.
--
-- Both are additive and backfill-safe: existing rows default to active +
-- uncategorized. No data migration, no destructive change.

ALTER TABLE public.crm_templates
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- The admin list orders by is_active (active first) then name; a partial index
-- on the active set keeps that listing query cheap as the template set grows.
CREATE INDEX IF NOT EXISTS crm_templates_active_idx
  ON public.crm_templates (channel, name)
  WHERE is_active = true;

COMMENT ON COLUMN public.crm_templates.category IS
  'Optional admin grouping label (seller/buyer/nurture/...). Null = uncategorized.';
COMMENT ON COLUMN public.crm_templates.is_active IS
  'Soft-disable. Inactive templates hide from pickers but are not deleted so referencing sequences keep resolving copy.';
