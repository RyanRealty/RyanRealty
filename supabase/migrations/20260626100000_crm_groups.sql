-- CRM Groups + Group Members (FUB §8.1)
-- A Group is a named set of brokers used as a distribution target in Lead Flows.
-- distribution_type controls how leads are handed out within the group:
--   round_robin  — atomic per-group pointer, mirrors crm_advance_round_robin pattern
--   first_to_claim — lead lands in the group's pond-like queue; first broker to accept wins

CREATE TABLE IF NOT EXISTS public.crm_groups (
  id                  bigserial PRIMARY KEY,
  name                text        NOT NULL,
  distribution_type   text        NOT NULL DEFAULT 'round_robin'
                      CHECK (distribution_type IN ('round_robin', 'first_to_claim')),
  round_robin_index   integer     NOT NULL DEFAULT -1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_groups IS
  'CRM Lead Flow: named distribution groups (FUB §8.1). Each group holds broker members and carries its own round-robin pointer.';

CREATE TABLE IF NOT EXISTS public.crm_group_members (
  id         bigserial PRIMARY KEY,
  group_id   bigint NOT NULL REFERENCES public.crm_groups (id) ON DELETE CASCADE,
  broker_slug text   NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, broker_slug)
);

COMMENT ON TABLE public.crm_group_members IS
  'CRM Lead Flow: members of a crm_groups row. broker_slug references CRM_BROKERS (matt | rebecca | paul).';

CREATE INDEX IF NOT EXISTS crm_group_members_group_id_idx ON public.crm_group_members (group_id);

-- Seed two default groups
INSERT INTO public.crm_groups (name, distribution_type)
VALUES
  ('Seller Leads', 'round_robin'),
  ('Team Ryan',    'round_robin')
ON CONFLICT DO NOTHING;

-- Per-group atomic round-robin advance.
-- Mirrors crm_advance_round_robin() but scoped to a specific group_id.
-- Locks the crm_groups row FOR UPDATE so two concurrent leads in the same
-- group never pick the same broker. Returns NULL when group has no members.
CREATE OR REPLACE FUNCTION public.crm_advance_group_round_robin(p_group_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eligible   text[];
  n          integer;
  prev_index integer;
  next_index integer;
  chosen     text;
BEGIN
  -- Ordered member list (stable order for deterministic rotation).
  SELECT array_agg(broker_slug ORDER BY sort_order, id)
    INTO eligible
    FROM public.crm_group_members
   WHERE group_id = p_group_id;

  n := COALESCE(array_length(eligible, 1), 0);
  IF n = 0 THEN
    RETURN NULL;
  END IF;

  -- Lock the group row for the duration of this transaction.
  SELECT round_robin_index
    INTO prev_index
    FROM public.crm_groups
   WHERE id = p_group_id
   FOR UPDATE;

  IF prev_index IS NULL THEN
    prev_index := -1;
  END IF;

  next_index := (prev_index + 1) % n;
  chosen     := eligible[next_index + 1];  -- Postgres arrays are 1-based

  UPDATE public.crm_groups
     SET round_robin_index = next_index,
         updated_at        = now()
   WHERE id = p_group_id;

  RETURN chosen;
END;
$$;

COMMENT ON FUNCTION public.crm_advance_group_round_robin(bigint) IS
  'CRM Lead Flow: atomically advance the per-group round-robin pointer and return the next broker slug (NULL if group has no members).';
