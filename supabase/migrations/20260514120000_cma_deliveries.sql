-- cma_deliveries: state table for the auto-CMA workflow fired by the seller LP.
--
-- One row per CMA generated for a lead. The row holds the draft state of the
-- email-to-lead until the assigned broker reviews and clicks Send. Once sent,
-- the row is marked sent and the email goes out from Resend with the PDF
-- attachment, plus a corresponding FUB Note records the comms.
--
-- Lifecycle:
--   pending           -- row created by submitSellerLPForm, worker not yet started
--   in_production     -- worker has picked it up, generating CMA
--   ready             -- CMA generated, PDF in Storage, email body drafted,
--                        broker emailed for review
--   sent              -- broker clicked Send; email shipped to the lead; FUB note added
--   no_match          -- terminal: findPropertyByAddress returned null, manual CMA needed
--   failed            -- terminal: a step in the pipeline errored unrecoverably
--
-- A signed HMAC token (action_id + expires + secret) protects the broker
-- preview page, so the broker doesn't need to log in to admin to review.

CREATE TABLE IF NOT EXISTS public.cma_deliveries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_person_id       bigint,                          -- FUB Person.id if resolved
  lead_email          text NOT NULL,                   -- email we'll send the CMA to
  lead_name           text,                            -- "Jane Smith"
  lead_phone          text,                            -- E.164 if available
  lead_timeline       text,                            -- 'ready-now' | 'next-3-6' | ...
  lead_classification text,                            -- 'hot' | 'warm' | 'nurture' | 'unknown'
  raw_address         text NOT NULL,                   -- the address as the visitor typed it
  parsed_street       text,
  parsed_city         text,
  parsed_state        text,
  parsed_postal_code  text,
  property_id         uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  valuation_id        uuid,                            -- valuations.id when CMA computed
  cma_estimated_value numeric,
  cma_value_low       numeric,
  cma_value_high      numeric,
  cma_confidence      text,                            -- 'high' | 'medium' | 'low'
  pdf_storage_path    text,                            -- supabase storage object path
  pdf_signed_url      text,                            -- short-lived signed URL (regenerated on view)
  assigned_broker_slug text,                           -- 'ryan-matt' | 'stevenson-paul' | 'peterson-rebecca'
  assigned_broker_email text,
  assigned_broker_name  text,
  broker_imessage_to  text,                            -- E.164 phone we attempt iMessage on
  broker_notified_at  timestamptz,                     -- when the broker review email + iMessage went out
  email_subject       text,                            -- final subject the broker will send
  email_body_html     text,                            -- final body HTML the broker will send
  email_body_text     text,                            -- plain-text version
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_production','ready','sent','no_match','failed')),
  sent_email_resend_id text,                           -- Resend message id when status='sent'
  sent_fub_note_id    text,                            -- FUB note id once posted
  sent_at             timestamptz,
  errors              jsonb NOT NULL DEFAULT '[]'::jsonb,  -- accumulator of warnings/errors
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cma_deliveries_status_created_idx
  ON public.cma_deliveries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS cma_deliveries_lead_email_idx
  ON public.cma_deliveries (lead_email);
CREATE INDEX IF NOT EXISTS cma_deliveries_fub_person_id_idx
  ON public.cma_deliveries (fub_person_id)
  WHERE fub_person_id IS NOT NULL;

-- Auto-update updated_at on row change.
CREATE OR REPLACE FUNCTION public.cma_deliveries_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cma_deliveries_updated_at ON public.cma_deliveries;
CREATE TRIGGER cma_deliveries_updated_at
  BEFORE UPDATE ON public.cma_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.cma_deliveries_set_updated_at();

-- RLS off for now (service-role-only access from the worker route).
ALTER TABLE public.cma_deliveries DISABLE ROW LEVEL SECURITY;
