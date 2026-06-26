-- CRM Ponds + Pond Members (FUB §8.2)
-- A Pond is a holding queue for leads that are not yet assigned to a broker.
-- Any pond member can claim a lead from the pond (first-to-claim model).
-- When a lead lands in a pond, assigned_broker stays NULL and pond_id is set
-- on crm_people. A broker claims it via claimLeadFromPondAction, which sets
-- assigned_broker and clears pond_id.

CREATE TABLE IF NOT EXISTS public.crm_ponds (
  id             bigserial PRIMARY KEY,
  name           text    NOT NULL,
  -- pond_lead_slug: the source label stamped on leads that auto-route into this pond
  pond_lead_slug text    NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_ponds IS
  'CRM Lead Flow: holding queues for unassigned leads (FUB §8.2). Members compete first-to-claim.';

CREATE TABLE IF NOT EXISTS public.crm_pond_members (
  id         bigserial PRIMARY KEY,
  pond_id    bigint NOT NULL REFERENCES public.crm_ponds (id) ON DELETE CASCADE,
  broker_slug text   NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pond_id, broker_slug)
);

COMMENT ON TABLE public.crm_pond_members IS
  'CRM Lead Flow: brokers who can claim leads from a pond.';

CREATE INDEX IF NOT EXISTS crm_pond_members_pond_id_idx ON public.crm_pond_members (pond_id);

-- Seed the default pond
WITH new_pond AS (
  INSERT INTO public.crm_ponds (name, pond_lead_slug)
  VALUES ('Out Of State Home Owners', 'out-of-state')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO public.crm_pond_members (pond_id, broker_slug)
SELECT np.id, b.slug
FROM new_pond np
CROSS JOIN (VALUES ('matt'), ('rebecca'), ('paul')) AS b(slug)
ON CONFLICT DO NOTHING;
