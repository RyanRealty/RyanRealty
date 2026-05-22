-- Enable RLS on cma_deliveries (PII: lead email, name, phone, address, broker assignment).
-- Per deep-audit 2026-05-21 finding C7, this table was created with rowsecurity=false
-- and is exposed to any caller with the anon key. Ultrareview's fc3115c closed the
-- API-route auth bypass but did NOT enable table-level RLS.
--
-- Policy model:
--   - Service role bypasses RLS automatically (no policy needed). All app-server
--     code paths use SUPABASE_SERVICE_ROLE_KEY, so writes/admin-reads keep working.
--   - Authenticated brokers can read their own assigned deliveries via JWT email match.
--     This supports the future "broker dashboard" use case without exposing other
--     brokers' leads.
--   - Anon key: no policy = no access. CMA delivery is server-side only; anon clients
--     have no business reading this table directly.

ALTER TABLE public.cma_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can read their own assigned CMA deliveries"
  ON public.cma_deliveries
  FOR SELECT
  TO authenticated
  USING (assigned_broker_email = (auth.jwt() ->> 'email'));

COMMENT ON TABLE public.cma_deliveries IS
  'CMA delivery log with lead PII. RLS enabled 2026-05-21. Service role for all writes; authenticated broker self-read on assigned_broker_email match. No anon-key access.';
