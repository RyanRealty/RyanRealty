-- Lead Flows + Lead Flow Rules (FUB §8.3)
-- A Lead Flow maps a lead source to a distribution target (broker | group | pond).
-- Optional ordered rules allow conditional overrides (e.g. "if price > 1M, route
-- to group Seller Leads; otherwise route to matt").

CREATE TABLE IF NOT EXISTS public.lead_flows (
  id                    bigserial PRIMARY KEY,
  source                text    NOT NULL UNIQUE,   -- matches crm_people.source values
  display_name          text    NOT NULL DEFAULT '',
  -- Default distribution target (exactly ONE of the three should be non-null)
  assigned_broker_slug  text    NULL,
  assigned_group_id     bigint  NULL REFERENCES public.crm_groups (id) ON DELETE SET NULL,
  assigned_pond_id      bigint  NULL REFERENCES public.crm_ponds  (id) ON DELETE SET NULL,
  automation_id         text    NULL,              -- reserved for future automation wiring
  archived              boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lead_flows IS
  'CRM Lead Flow: per-source routing rules (FUB §8.3). source matches crm_people.source. Looked up first by pickRoutedBroker; falls back to crm_assignment_config when no row exists.';

CREATE TABLE IF NOT EXISTS public.lead_flow_rules (
  id                    bigserial PRIMARY KEY,
  flow_id               bigint  NOT NULL REFERENCES public.lead_flows (id) ON DELETE CASCADE,
  position              integer NOT NULL DEFAULT 0,
  condition_match       text    NOT NULL DEFAULT 'all'
                        CHECK (condition_match IN ('all', 'any')),
  -- conditions is a JSON array of condition objects:
  -- [{ "field": "price"|"area"|"tag", "op": "gt"|"lt"|"eq"|"contains", "value": "..." }]
  conditions            jsonb   NOT NULL DEFAULT '[]'::jsonb,
  -- Override distribution target (exactly ONE of the three should be non-null)
  assigned_broker_slug  text    NULL,
  assigned_group_id     bigint  NULL REFERENCES public.crm_groups (id) ON DELETE SET NULL,
  assigned_pond_id      bigint  NULL REFERENCES public.crm_ponds  (id) ON DELETE SET NULL,
  automation_id         text    NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lead_flow_rules IS
  'CRM Lead Flow: conditional rule rows for a lead_flows entry. Evaluated in position order; first match wins.';

CREATE INDEX IF NOT EXISTS lead_flow_rules_flow_id_position_idx
  ON public.lead_flow_rules (flow_id, position);
