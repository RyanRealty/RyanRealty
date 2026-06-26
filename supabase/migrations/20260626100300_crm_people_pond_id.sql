-- Add pond_id to crm_people (FUB §8.2 claim model)
-- When a lead routes to a pond, assigned_broker stays NULL and this column is set.
-- Claiming a lead sets assigned_broker and clears pond_id to NULL.

ALTER TABLE public.crm_people
  ADD COLUMN IF NOT EXISTS pond_id bigint
    REFERENCES public.crm_ponds (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.crm_people.pond_id IS
  'CRM Lead Flow: non-null when this lead is waiting in a pond to be claimed. Cleared on claim.';

-- Partial index: fast lookup of all unclaimed leads in a given pond.
CREATE INDEX IF NOT EXISTS crm_people_pond_id_idx
  ON public.crm_people (pond_id)
  WHERE pond_id IS NOT NULL;
