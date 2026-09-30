-- The owner's email claim holds for 15 minutes, not 2 (prospecting drip fix,
-- 2026-09-29. Apply BEFORE the drip fix code deploys (see the commit message).
--
-- prospect_email_send_claim reopened a 'sending' claim once it was two minutes
-- old. That was safe while every claimer died within a minute. It is not now:
-- a first-touch send is a whole CMA send (MLS check, CRM lead, Chromium PDF,
-- ~7 MB Gmail message), the drip route runs up to 300 s
-- (DRIP_ROUTE_MAX_DURATION_S), and the manual intro and the CMA rail's own
-- claim (lib/cma/prospect-send-claim.ts) run in 300 s functions too. With a
-- two minute window, a broker clicking Send on the prospect page, or Send now
-- on the review page, two to five minutes into a slow drip send gets
-- 'claimed' and emails the owner a second time while the first is in flight.
--
-- The window is now longer than any claimer can live (300 s) AND longer than
-- the drip's stuck-send threshold (DRIP_STUCK_SEND_STALE_MS, 10 min) plus a few
-- drain ticks. So a live claim can never be taken from its owner, and a claim
-- whose function died is first settled from evidence by the drip's recovery
-- (lib/data/prospecting/drip-recover.ts: finalized when the email left, released
-- when it provably did not). Only a claim the recovery could not settle (it
-- alerts Matt) reopens to a manual click after 15 minutes, the same "check Sent
-- first" call the two minute window used to hand the broker.
--
-- Everything else is unchanged from 20260722010100: same signature, same
-- answers, same row locks. The SMS claim (prospect_send_claim) keeps its two
-- minutes; a Twilio post returns in seconds.

create or replace function public.prospect_email_send_claim(
  p_kind text,
  p_id text,
  p_idem text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sent_at timestamptz; v_status text; v_claim_at timestamptz; v_idem text; v_mid text;
begin
  if p_kind = 'expired' then
    select outreach_email_sent_at, outreach_email_status, outreach_email_claim_at, outreach_email_idempotency_key, outreach_email_message_id
      into v_sent_at, v_status, v_claim_at, v_idem, v_mid
      from public.expired_listings where listing_key = p_id for update;
  elsif p_kind = 'fsbo' then
    select outreach_email_sent_at, outreach_email_status, outreach_email_claim_at, outreach_email_idempotency_key, outreach_email_message_id
      into v_sent_at, v_status, v_claim_at, v_idem, v_mid
      from public.fsbo_listings where fsbo_url = p_id for update;
  else return 'not_found'; end if;
  if not found then return 'not_found'; end if;

  -- A row that already carries a message id HAS fired an email — never reopen
  -- it, even if finalize failed to stamp sent_at (mirrors the SMS sid guard).
  if v_sent_at is not null or v_mid is not null then
    if v_idem is not null and v_idem = p_idem then return 'replay'; end if;
    return 'already_sent';
  end if;

  if v_status = 'sending' and v_claim_at is not null and v_claim_at > now() - interval '15 minutes' then
    return 'claimed_elsewhere';
  end if;

  if p_kind = 'expired' then
    update public.expired_listings set outreach_email_status = 'sending', outreach_email_claim_at = now() where listing_key = p_id;
  else
    update public.fsbo_listings set outreach_email_status = 'sending', outreach_email_claim_at = now() where fsbo_url = p_id;
  end if;
  return 'claimed';
end; $$;

-- Grant lockdown, restated (CREATE OR REPLACE keeps privileges, but the house
-- rule is that every definition of a SECURITY DEFINER send RPC says who may
-- call it): service role only.
revoke execute on function public.prospect_email_send_claim(text, text, text) from public, anon, authenticated;
grant execute on function public.prospect_email_send_claim(text, text, text) to service_role;
