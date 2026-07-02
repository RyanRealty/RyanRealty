-- §13 (Email & Text Templates) parity fields on crm_templates.
--
--   preview_text — email-only inbox preview line (§13.1.3 "Preview text" field,
--                  rendered beneath the subject in the recipient's inbox).
--   featured     — text-only "Feature" toggle (§13.2.3): featured templates
--                  surface prominently in the quick-text compose picker.
--   created_at   — creation metadata for the edit-modal header line
--                  ("Created on <date> by <name>", §13.1.3). NULLABLE and NOT
--                  backfilled: the FUB-seeded templates carry no creation date
--                  in the import, and stamping the import date would be a false
--                  claim (§0 data accuracy). New templates stamp it on insert;
--                  the modal renders the metadata line only when known.

ALTER TABLE public.crm_templates
  ADD COLUMN IF NOT EXISTS preview_text text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

COMMENT ON COLUMN public.crm_templates.preview_text IS
  'Email-only inbox preview text (§13.1.3). Shown beneath the subject in the recipient inbox preview.';
COMMENT ON COLUMN public.crm_templates.featured IS
  'Text-only (§13.2.3): featured templates appear prominently in the quick-text compose picker.';
COMMENT ON COLUMN public.crm_templates.created_at IS
  'Creation timestamp. NULL for FUB-seeded rows (import carried no creation date — never fabricated).';
