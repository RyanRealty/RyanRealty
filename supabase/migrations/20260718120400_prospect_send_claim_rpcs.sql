-- Spec 07 (prospecting hub) §4.5 — at-most-once send claim as row-locked RPCs.
-- PostgREST cannot express the "claim iff not sent AND not freshly-claimed, else
-- distinguish replay/already-sent/claimed-elsewhere" logic in one statement, so
-- the claim/finalize/release trio lives here. Each RPC is its own transaction;
-- SELECT ... FOR UPDATE serializes concurrent claims on the same row.
--
-- Semantics (the send action reads the returned status):
--   'not_found'         row gone
--   'replay'            this exact idempotency key already completed → return the ORIGINAL success, no second text
--   'already_sent'      a DIFFERENT send already completed → block (one-intro-ever)
--   'claimed_elsewhere' another tab/device is mid-send inside the 2-min window → abort before Twilio
--   'claimed'           caller owns the send; proceed to Twilio, then finalize (or release on failure)
--
-- The idempotency key is stamped at FINALIZE (after a successful Twilio send),
-- NEVER at claim — so a replay during the in-flight window is treated as
-- 'claimed_elsewhere' (at-most-once), not a false 'replay'.

create or replace function public.prospect_send_claim(
  p_kind text,
  p_id text,
  p_idem text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent_at timestamptz;
  v_status text;
  v_claim_at timestamptz;
  v_idem text;
begin
  if p_kind = 'expired' then
    select outreach_sms_sent_at, outreach_sms_status, outreach_claim_at, outreach_idempotency_key
      into v_sent_at, v_status, v_claim_at, v_idem
      from public.expired_listings where listing_key = p_id for update;
  elsif p_kind = 'fsbo' then
    select outreach_sms_sent_at, outreach_sms_status, outreach_claim_at, outreach_idempotency_key
      into v_sent_at, v_status, v_claim_at, v_idem
      from public.fsbo_listings where fsbo_url = p_id for update;
  else
    return 'not_found';
  end if;

  if not found then
    return 'not_found';
  end if;

  if v_sent_at is not null then
    if v_idem is not null and v_idem = p_idem then
      return 'replay';
    end if;
    return 'already_sent';
  end if;

  if v_status = 'sending' and v_claim_at is not null and v_claim_at > now() - interval '2 minutes' then
    return 'claimed_elsewhere';
  end if;

  if p_kind = 'expired' then
    update public.expired_listings
       set outreach_sms_status = 'sending', outreach_claim_at = now()
     where listing_key = p_id;
  else
    update public.fsbo_listings
       set outreach_sms_status = 'sending', outreach_claim_at = now()
     where fsbo_url = p_id;
  end if;

  return 'claimed';
end;
$$;

create or replace function public.prospect_send_finalize(
  p_kind text,
  p_id text,
  p_idem text,
  p_sid text,
  p_person_id bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'expired' then
    update public.expired_listings
       set outreach_sms_status = 'sent',
           outreach_sms_sent_at = now(),
           outreach_sms_sid = p_sid,
           outreach_idempotency_key = p_idem,
           outreach_crm_person_id = coalesce(p_person_id, outreach_crm_person_id)
     where listing_key = p_id;
  elsif p_kind = 'fsbo' then
    update public.fsbo_listings
       set outreach_sms_status = 'sent',
           outreach_sms_sent_at = now(),
           outreach_sms_sid = p_sid,
           outreach_idempotency_key = p_idem,
           outreach_crm_person_id = coalesce(p_person_id, outreach_crm_person_id)
     where fsbo_url = p_id;
  end if;
end;
$$;

create or replace function public.prospect_send_release(
  p_kind text,
  p_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only release a still-in-flight claim; never clear a finalized send.
  if p_kind = 'expired' then
    update public.expired_listings
       set outreach_sms_status = null, outreach_claim_at = null
     where listing_key = p_id and outreach_sms_sent_at is null;
  elsif p_kind = 'fsbo' then
    update public.fsbo_listings
       set outreach_sms_status = null, outreach_claim_at = null
     where fsbo_url = p_id and outreach_sms_sent_at is null;
  end if;
end;
$$;

revoke all on function public.prospect_send_claim(text, text, text) from anon, authenticated;
revoke all on function public.prospect_send_finalize(text, text, text, text, bigint) from anon, authenticated;
revoke all on function public.prospect_send_release(text, text) from anon, authenticated;
