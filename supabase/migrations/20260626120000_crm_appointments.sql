-- ── CRM Appointments (FUB audit §5, types/outcomes §8.12) ──────────────────
-- Three tables: appointment types, appointment outcomes, appointments.

-- 1. Appointment types (lookup)
CREATE TABLE IF NOT EXISTS public.crm_appointment_types (
  id     serial PRIMARY KEY,
  name   text    NOT NULL,
  ord    integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT crm_appointment_types_name_unique UNIQUE (name)
);

-- Seed default types
INSERT INTO public.crm_appointment_types (name, ord, active) VALUES
  ('Buyer consultation',   1, true),
  ('Listing consultation', 2, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Appointment outcomes (lookup)
CREATE TABLE IF NOT EXISTS public.crm_appointment_outcomes (
  id     serial PRIMARY KEY,
  name   text    NOT NULL,
  ord    integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT crm_appointment_outcomes_name_unique UNIQUE (name)
);

-- Seed default outcomes
INSERT INTO public.crm_appointment_outcomes (name, ord, active) VALUES
  ('No show',              1, true),
  ('Working with buyers',  2, true),
  ('Listing obtained',     3, true)
ON CONFLICT (name) DO NOTHING;

-- 3. Appointments
CREATE TABLE IF NOT EXISTS public.crm_appointments (
  id               bigserial PRIMARY KEY,
  title            text        NOT NULL,
  start_at         timestamptz NOT NULL,
  end_at           timestamptz NOT NULL,
  all_day          boolean     NOT NULL DEFAULT false,
  location         text,
  description      text,
  type_id          integer     REFERENCES public.crm_appointment_types(id)   ON DELETE SET NULL,
  outcome_id       integer     REFERENCES public.crm_appointment_outcomes(id) ON DELETE SET NULL,
  person_id        bigint      REFERENCES public.crm_people(id)               ON DELETE SET NULL,
  broker_slug      text        NOT NULL,
  guest_person_ids bigint[]    NOT NULL DEFAULT '{}',
  invite_sent      boolean     NOT NULL DEFAULT false,
  gcal_event_id    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_appointments_start_before_end CHECK (start_at <= end_at)
);

-- Indexes for common read paths
CREATE INDEX IF NOT EXISTS crm_appointments_start_at_idx    ON public.crm_appointments (start_at);
CREATE INDEX IF NOT EXISTS crm_appointments_broker_slug_idx ON public.crm_appointments (broker_slug);
CREATE INDEX IF NOT EXISTS crm_appointments_person_id_idx   ON public.crm_appointments (person_id) WHERE person_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.crm_appointments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_appointments_updated_at ON public.crm_appointments;
CREATE TRIGGER crm_appointments_updated_at
  BEFORE UPDATE ON public.crm_appointments
  FOR EACH ROW EXECUTE FUNCTION public.crm_appointments_set_updated_at();
