-- Spec 07 (prospecting hub) §4.3 — persisted, structured compliance state.
-- The hard-stop truth must be structured, written from the structured skip-trace
-- signal, NEVER parsed from free-text enrichment_notes (Defect 3: the 5 duplicate
-- /HARD STOP|LITIGATOR/ regexes miss DECEASED / "BEST PHONE ON DNC").
--
-- These columns are the DISPLAY + fail-closed-SECONDARY source. The authoritative
-- send gate stays the live isSuppressed(personId,'sms') tag read (crm_people.tags
-- + crm_suppressions). Send is blocked if EITHER says hard-stop (union = fail-closed).
--
-- Additive + back-compatible: NOT NULL with safe defaults, nothing reads them yet.

ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS compliance_hard_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_source text;

ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS compliance_hard_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_source text;

COMMENT ON COLUMN public.expired_listings.compliance_flags IS
  'Structured skip-trace compliance flags, e.g. ["litigator","dnc:tcpa","deceased"] (spec 07 §4.3). Display + fail-closed secondary; authoritative gate is isSuppressed().';
COMMENT ON COLUMN public.expired_listings.compliance_source IS
  'Which skip-trace provider produced compliance_flags: batchdata | tracerfy | apify | manual.';
COMMENT ON COLUMN public.fsbo_listings.compliance_flags IS
  'Structured skip-trace compliance flags (spec 07 §4.3). Display + fail-closed secondary; authoritative gate is isSuppressed().';
COMMENT ON COLUMN public.fsbo_listings.compliance_source IS
  'Which skip-trace provider produced compliance_flags: batchdata | tracerfy | apify | manual.';
