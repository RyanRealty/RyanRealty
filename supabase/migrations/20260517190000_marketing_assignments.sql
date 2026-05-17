-- marketing_assignments — round-robin assignment state for lead intake
--
-- Powers the seller LP form's round-robin between Matt and Rebecca (and
-- any future broker added to the FUB "Seller Leads" group). Every time the
-- LP form successfully resolves a lead to an assigned broker, it inserts a
-- row here. The next intake reads the most-recent row to decide who's up
-- next.
--
-- Per docs/FUB_SELLER_WORKFLOW_2026-05-17.md §6:
--   - Hot leads default to Matt (override only on Matt OOO)
--   - Warm + nurture leads round-robin between active "Seller Leads" group
--
-- Future expansion: same table powers the buyer LP form's round-robin and
-- the FB-ads lead intake. The audience column distinguishes them.

CREATE TABLE IF NOT EXISTS public.marketing_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  audience          text NOT NULL,                  -- 'seller' | 'buyer'
  broker            text NOT NULL,                  -- 'matt' | 'rebecca' | 'paul'
  fub_user_id       int NOT NULL,                   -- FUB-side user id (1=Matt, 2=Rebecca, 3=Paul)
  fub_person_id     int,                            -- FUB-side person id (nullable when intake fails)
  source            text,                           -- 'seller-lp' | 'fb-ads' | 'google-ads' | 'referral' | 'open-house'
  tier              text,                           -- 'hot' | 'warm' | 'nurture' (the seller:* tag suffix)
  notes             text,                           -- free-form, optional debug info
  CONSTRAINT marketing_assignments_audience_check CHECK (audience IN ('seller', 'buyer')),
  CONSTRAINT marketing_assignments_broker_check CHECK (broker IN ('matt', 'rebecca', 'paul'))
);

CREATE INDEX IF NOT EXISTS marketing_assignments_audience_assigned_at_idx
  ON public.marketing_assignments (audience, assigned_at DESC);

CREATE INDEX IF NOT EXISTS marketing_assignments_broker_assigned_at_idx
  ON public.marketing_assignments (broker, assigned_at DESC);

CREATE INDEX IF NOT EXISTS marketing_assignments_fub_person_id_idx
  ON public.marketing_assignments (fub_person_id)
  WHERE fub_person_id IS NOT NULL;

COMMENT ON TABLE public.marketing_assignments IS
  'Round-robin assignment ledger for inbound lead intake. The seller LP form (app/lp/seller-home-value/actions.ts) reads the most-recent row for audience=seller to pick the next broker. See docs/FUB_SELLER_WORKFLOW_2026-05-17.md §6.';

COMMENT ON COLUMN public.marketing_assignments.audience IS
  'Top-level segment that drives which round-robin pool is used. seller leads use the FUB "Seller Leads" group (Matt + Rebecca). Buyer leads round-robin against the full active broker roster.';

COMMENT ON COLUMN public.marketing_assignments.fub_user_id IS
  'FUB-side numeric user id. As of 2026-05-17: 1=Matt, 2=Rebecca, 3=Paul. Update the env var FOLLOWUPBOSS_BROKER_USER_MAP if these ever change.';

-- Service-role only; no public RLS policies.
ALTER TABLE public.marketing_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_assignments_service_role_all
  ON public.marketing_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
