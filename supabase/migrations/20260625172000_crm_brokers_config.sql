-- CRM brokers config — make the broker roster DB-driven (Wave 2).
--
-- The CRM has historically depended on the hardcoded CRM_BROKERS const
-- (lib/crm/constants.ts: matt/rebecca/paul, with email + display maps). This
-- migration moves the CRM-facing broker attributes onto the existing
-- public.brokers table so the roster, CRM-active flag, and routing eligibility
-- become UI-editable instead of a code constant.
--
-- The brokers table already carries slug / display_name / email / is_active.
-- We add three CRM-specific columns:
--   * crm_active        — is this broker visible/usable inside the CRM at all
--   * crm_slug          — the SHORT CRM slug (matt/rebecca/paul) that
--                         crm_people.assigned_broker + "broker:" tags match.
--                         The brokers.slug column holds the long web slug
--                         (matthew-ryan/paul-stevenson/rebecca-peterson), so a
--                         distinct short slug is required for CRM joins.
--   * routing_eligible  — may this broker receive round-robin lead routing
--
-- Backfill crm_slug by email (the stable join key), matching the existing
-- CRM_BROKER_BY_EMAIL map in lib/crm/constants.ts.

ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS crm_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS crm_slug text;

ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS routing_eligible boolean NOT NULL DEFAULT true;

-- Backfill the short CRM slug from the known email → slug map. Only sets rows
-- that don't already carry a crm_slug, so re-running is a no-op.
UPDATE public.brokers SET crm_slug = 'matt'
  WHERE crm_slug IS NULL AND lower(email) = 'matt@ryan-realty.com';
UPDATE public.brokers SET crm_slug = 'rebecca'
  WHERE crm_slug IS NULL AND lower(email) = 'rebeccapeterson@ryan-realty.com';
UPDATE public.brokers SET crm_slug = 'paul'
  WHERE crm_slug IS NULL AND lower(email) = 'paul@ryan-realty.com';

-- crm_slug must be unique among rows that have one (two brokers can't share the
-- short CRM identity). Partial unique index allows multiple NULLs for any future
-- non-CRM broker rows.
CREATE UNIQUE INDEX IF NOT EXISTS brokers_crm_slug_key
  ON public.brokers (crm_slug)
  WHERE crm_slug IS NOT NULL;

COMMENT ON COLUMN public.brokers.crm_active IS
  'CRM Wave 2: is this broker active inside the CRM (pickers, assignment, lists).';
COMMENT ON COLUMN public.brokers.crm_slug IS
  'CRM Wave 2: short CRM slug (matt/rebecca/paul) matching crm_people.assigned_broker and broker: tags. Distinct from brokers.slug (the long web slug).';
COMMENT ON COLUMN public.brokers.routing_eligible IS
  'CRM Wave 2: may this broker receive round-robin lead routing.';
