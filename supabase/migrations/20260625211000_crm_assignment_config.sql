-- CRM lead-routing engine — built but DORMANT (Wave 7).
--
-- The routing ENGINE ships now; its live behavior stays all-to-Matt because the
-- seeded strategy is 'all_to_one' with default_broker 'matt'. Flipping the
-- strategy to round_robin or by_source later distributes leads WITHOUT a deploy
-- (it's a setting, edited from the Phase B settings UI via app/actions/crm-assignment.ts).
--
-- Three tables, kept minimal:
--   * crm_assignment_config      — the SINGLE-ROW config (singleton id = 1):
--                                  strategy + default_broker.
--   * crm_assignment_rules       — by_source rules (source -> broker, ordered).
--   * crm_round_robin_state      — the SINGLE-ROW round-robin pointer.
--
-- Plus crm_advance_round_robin() — a SECURITY DEFINER function that ATOMICALLY
-- advances the pointer and returns the next routing_eligible broker, so two
-- concurrent leads can never be handed the same broker.

-- ── Config (singleton) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_assignment_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  strategy text NOT NULL DEFAULT 'all_to_one'
    CHECK (strategy IN ('all_to_one', 'round_robin', 'by_source')),
  default_broker text NOT NULL DEFAULT 'matt',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_assignment_config IS
  'CRM Wave 7: single-row lead-routing config. Seeded all_to_one/matt (dormant). Flip strategy to distribute without a deploy.';

-- Seed the singleton: all_to_one + matt (the live default — unchanged behavior).
INSERT INTO public.crm_assignment_config (id, strategy, default_broker)
  VALUES (1, 'all_to_one', 'matt')
  ON CONFLICT (id) DO NOTHING;

-- ── by_source rules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_assignment_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  broker text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One rule per source (the first/only match wins; uniqueness keeps it deterministic).
CREATE UNIQUE INDEX IF NOT EXISTS crm_assignment_rules_source_key
  ON public.crm_assignment_rules (source);

COMMENT ON TABLE public.crm_assignment_rules IS
  'CRM Wave 7: by_source routing rules (source -> broker). Only consulted when strategy = by_source.';

-- ── Round-robin pointer (singleton) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_round_robin_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_broker text,
  last_index integer NOT NULL DEFAULT -1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_round_robin_state (id, last_broker, last_index)
  VALUES (1, NULL, -1)
  ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.crm_round_robin_state IS
  'CRM Wave 7: single-row round-robin pointer. Advanced atomically by crm_advance_round_robin().';

-- ── Atomic round-robin advance ──────────────────────────────────────────────
-- Returns the NEXT routing_eligible broker (ordered by crm_slug for a stable
-- rotation) and advances the pointer in the SAME statement under a row lock, so
-- two concurrent leads can never get the same broker. Returns NULL when no
-- broker is eligible (caller fails safe to its default_broker).
CREATE OR REPLACE FUNCTION public.crm_advance_round_robin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eligible text[];
  n integer;
  prev_index integer;
  next_index integer;
  chosen text;
BEGIN
  -- Ordered list of routing_eligible CRM brokers (slug). Stable order = stable rotation.
  SELECT array_agg(crm_slug ORDER BY crm_slug)
    INTO eligible
    FROM public.brokers
   WHERE crm_slug IS NOT NULL
     AND crm_active IS TRUE
     AND routing_eligible IS TRUE;

  n := COALESCE(array_length(eligible, 1), 0);
  IF n = 0 THEN
    RETURN NULL;
  END IF;

  -- Lock the pointer row for the duration of this transaction.
  SELECT last_index INTO prev_index
    FROM public.crm_round_robin_state
   WHERE id = 1
   FOR UPDATE;

  IF prev_index IS NULL THEN
    prev_index := -1;
  END IF;

  next_index := (prev_index + 1) % n;  -- wrap
  chosen := eligible[next_index + 1];   -- Postgres arrays are 1-based

  UPDATE public.crm_round_robin_state
     SET last_index = next_index,
         last_broker = chosen,
         updated_at = now()
   WHERE id = 1;

  RETURN chosen;
END;
$$;

COMMENT ON FUNCTION public.crm_advance_round_robin() IS
  'CRM Wave 7: atomically advance the round-robin pointer and return the next routing_eligible broker (NULL if none).';
