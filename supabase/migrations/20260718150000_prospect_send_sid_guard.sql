-- Adversarial audit 2026-07-18 (HIGH) — close the finalize-failure double-text hole.
--
-- Before: outreach_sms_sent_at (the "already sent" marker) is written only by
-- prospect_send_finalize. If Twilio succeeds but all finalize retries fail, the
-- row stays status='sending', sent_at NULL, sid NULL — and after the 2-minute
-- stale-claim window, prospect_send_claim reopens it and a retry re-texts the
-- owner. Fix: stamp outreach_sms_sid the instant Twilio returns (before finalize),
-- and make the claim treat ANY row that already carries a sid as sent (never
-- reopen it) — so a send that fired is never repeated even if finalize failed.

-- Lightweight sid stamp, called immediately after a successful Twilio send.
create or replace function public.prospect_send_stamp_sid(
  p_kind text,
  p_id text,
  p_sid text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'expired' then
    update public.expired_listings set outreach_sms_sid = p_sid where listing_key = p_id and outreach_sms_sid is null;
  elsif p_kind = 'fsbo' then
    update public.fsbo_listings set outreach_sms_sid = p_sid where fsbo_url = p_id and outreach_sms_sid is null;
  end if;
end; $$;

-- Claim now blocks on a present sid (a fired send) as well as sent_at.
create or replace function public.prospect_send_claim(p_kind text, p_id text, p_idem text) returns text
language plpgsql security definer set search_path = public as $$
declare v_sent_at timestamptz; v_status text; v_claim_at timestamptz; v_idem text; v_sid text;
begin
  if p_kind = 'expired' then
    select outreach_sms_sent_at, outreach_sms_status, outreach_claim_at, outreach_idempotency_key, outreach_sms_sid
      into v_sent_at, v_status, v_claim_at, v_idem, v_sid
      from public.expired_listings where listing_key = p_id for update;
  elsif p_kind = 'fsbo' then
    select outreach_sms_sent_at, outreach_sms_status, outreach_claim_at, outreach_idempotency_key, outreach_sms_sid
      into v_sent_at, v_status, v_claim_at, v_idem, v_sid
      from public.fsbo_listings where fsbo_url = p_id for update;
  else return 'not_found'; end if;
  if not found then return 'not_found'; end if;
  -- A row that already carries a sid HAS fired a text — never reopen it, even if
  -- finalize failed to stamp sent_at. Same for a finalized sent_at.
  if v_sent_at is not null or v_sid is not null then
    if v_idem is not null and v_idem = p_idem then return 'replay'; end if;
    return 'already_sent';
  end if;
  if v_status = 'sending' and v_claim_at is not null and v_claim_at > now() - interval '2 minutes' then
    return 'claimed_elsewhere';
  end if;
  if p_kind = 'expired' then
    update public.expired_listings set outreach_sms_status = 'sending', outreach_claim_at = now() where listing_key = p_id;
  else
    update public.fsbo_listings set outreach_sms_status = 'sending', outreach_claim_at = now() where fsbo_url = p_id;
  end if;
  return 'claimed';
end; $$;

-- Supabase default-privileges grant EXECUTE to anon+authenticated on brand-new
-- public functions, so `revoke from public` alone is NOT enough for a fresh
-- function (verified: prospect_send_stamp_sid still showed anon_exec=true after a
-- public-only revoke). Revoke the role grants explicitly. prospect_send_claim was
-- already locked by 140000 and create-or-replace preserves its ACL, but we re-run
-- the full revoke for defense in depth.
revoke execute on function public.prospect_send_stamp_sid(text, text, text) from public, anon, authenticated;
grant execute on function public.prospect_send_stamp_sid(text, text, text) to service_role;
revoke execute on function public.prospect_send_claim(text, text, text) from public, anon, authenticated;
grant execute on function public.prospect_send_claim(text, text, text) to service_role;
