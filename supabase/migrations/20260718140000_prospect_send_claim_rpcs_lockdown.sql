-- SECURITY FIX (adversarial audit 2026-07-18) — lock down the prospecting
-- send-claim RPCs.
--
-- The prior migration (20260718120400) revoked EXECUTE from anon/authenticated
-- BY NAME. But Postgres grants EXECUTE to PUBLIC by default on CREATE FUNCTION,
-- and a role-scoped REVOKE does NOT remove the PUBLIC grant — so anon and
-- authenticated still inherited EXECUTE through PUBLIC. These are SECURITY DEFINER
-- functions with no in-body auth check (they were designed assuming only the
-- service role could reach them), so any client with the public anon key could
-- call prospect_send_finalize to mark a prospect 'sent' (poisoning outreach with
-- no SMS) or DoS a legitimate send via prospect_send_claim.
--
-- Revoke from PUBLIC (the real grant) and grant EXECUTE to service_role only.
-- The app always calls these via createServiceClient() (service role).

revoke execute on function public.prospect_send_claim(text, text, text) from public;
revoke execute on function public.prospect_send_finalize(text, text, text, text, bigint) from public;
revoke execute on function public.prospect_send_release(text, text) from public;

grant execute on function public.prospect_send_claim(text, text, text) to service_role;
grant execute on function public.prospect_send_finalize(text, text, text, text, bigint) to service_role;
grant execute on function public.prospect_send_release(text, text) to service_role;
