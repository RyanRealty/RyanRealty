-- Prospecting hub — EMAIL channel outreach columns + at-most-once claim RPCs.
--
-- Mirrors the SMS claim-column pattern (20260718120200_prospect_send_claim.sql
-- + 20260718120400_prospect_send_claim_rpcs.sql + the 20260718150000 sid guard
-- + the 20260718140000 grant lockdown) for the email channel, so the send
-- dialog's Email tab gets the same one-intro-ever / at-most-once guarantees the
-- SMS intro has. The two channels claim independently: an SMS send never blocks
-- the email intro and vice versa (per-channel sent-state; the row is "sent"
-- when EITHER channel sent).
--
-- Additive + back-compatible: all columns nullable, nothing reads them until
-- the app code feature-detects them (42703-tolerant selects).

ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS outreach_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_email_message_id text,
  ADD COLUMN IF NOT EXISTS outreach_email_status text,          -- null | 'sending' | 'sent'
  ADD COLUMN IF NOT EXISTS outreach_email_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_email_idempotency_key text;

ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS outreach_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_email_message_id text,
  ADD COLUMN IF NOT EXISTS outreach_email_status text,
  ADD COLUMN IF NOT EXISTS outreach_email_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_email_idempotency_key text;

COMMENT ON COLUMN public.expired_listings.outreach_email_status IS
  'Email send-claim state (mirrors outreach_sms_status): null (unsent) | sending (claimed, Gmail in flight) | sent (finalized).';
COMMENT ON COLUMN public.fsbo_listings.outreach_email_status IS
  'Email send-claim state (mirrors outreach_sms_status): null (unsent) | sending (claimed, Gmail in flight) | sent (finalized).';
COMMENT ON COLUMN public.expired_listings.outreach_email_message_id IS
  'Provider message id (Gmail message id or Resend id), stamped the instant the send returns — a message-id-bearing row is treated as sent by the claim even if finalize failed (mirrors the 20260718150000 sid guard).';
COMMENT ON COLUMN public.fsbo_listings.outreach_email_message_id IS
  'Provider message id (Gmail message id or Resend id), stamped the instant the send returns — a message-id-bearing row is treated as sent by the claim even if finalize failed (mirrors the 20260718150000 sid guard).';

-- ── Claim (row-locked; semantics identical to prospect_send_claim) ──────────
--   'not_found'         row gone
--   'replay'            this exact idempotency key already completed → return the ORIGINAL success, no second email
--   'already_sent'      a DIFFERENT send already completed → block (one-intro-ever per channel)
--   'claimed_elsewhere' another tab/device is mid-send inside the 2-min window → abort before Gmail
--   'claimed'           caller owns the send; proceed to Gmail, then finalize (or release on failure)

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

  if v_status = 'sending' and v_claim_at is not null and v_claim_at > now() - interval '2 minutes' then
    return 'claimed_elsewhere';
  end if;

  if p_kind = 'expired' then
    update public.expired_listings set outreach_email_status = 'sending', outreach_email_claim_at = now() where listing_key = p_id;
  else
    update public.fsbo_listings set outreach_email_status = 'sending', outreach_email_claim_at = now() where fsbo_url = p_id;
  end if;
  return 'claimed';
end; $$;

-- ── Stamp the provider message id the INSTANT the send returns (pre-finalize).
create or replace function public.prospect_email_send_stamp(
  p_kind text,
  p_id text,
  p_message_id text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'expired' then
    update public.expired_listings set outreach_email_message_id = p_message_id where listing_key = p_id and outreach_email_message_id is null;
  elsif p_kind = 'fsbo' then
    update public.fsbo_listings set outreach_email_message_id = p_message_id where fsbo_url = p_id and outreach_email_message_id is null;
  end if;
end; $$;

-- ── Finalize: durable sent stamp.
create or replace function public.prospect_email_send_finalize(
  p_kind text,
  p_id text,
  p_idem text,
  p_message_id text,
  p_person_id bigint
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'expired' then
    update public.expired_listings
       set outreach_email_status = 'sent',
           outreach_email_sent_at = now(),
           outreach_email_message_id = coalesce(p_message_id, outreach_email_message_id),
           outreach_email_idempotency_key = p_idem,
           outreach_crm_person_id = coalesce(p_person_id, outreach_crm_person_id)
     where listing_key = p_id;
  elsif p_kind = 'fsbo' then
    update public.fsbo_listings
       set outreach_email_status = 'sent',
           outreach_email_sent_at = now(),
           outreach_email_message_id = coalesce(p_message_id, outreach_email_message_id),
           outreach_email_idempotency_key = p_idem,
           outreach_crm_person_id = coalesce(p_person_id, outreach_crm_person_id)
     where fsbo_url = p_id;
  end if;
end; $$;

-- ── Release a still-in-flight claim after a pre-send failure. Never clears a
--    finalized send OR a message-id-bearing row (an email that fired).
create or replace function public.prospect_email_send_release(
  p_kind text,
  p_id text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'expired' then
    update public.expired_listings
       set outreach_email_status = null, outreach_email_claim_at = null
     where listing_key = p_id and outreach_email_sent_at is null and outreach_email_message_id is null;
  elsif p_kind = 'fsbo' then
    update public.fsbo_listings
       set outreach_email_status = null, outreach_email_claim_at = null
     where fsbo_url = p_id and outreach_email_sent_at is null and outreach_email_message_id is null;
  end if;
end; $$;

-- ── Grant lockdown (mirrors 20260718140000 + 20260718150000): Postgres grants
-- EXECUTE to PUBLIC by default on CREATE FUNCTION, and Supabase default
-- privileges add anon/authenticated — revoke ALL of them explicitly, grant to
-- service_role only. These are SECURITY DEFINER functions with no in-body auth
-- check; only the service role may reach them.
revoke execute on function public.prospect_email_send_claim(text, text, text) from public, anon, authenticated;
revoke execute on function public.prospect_email_send_stamp(text, text, text) from public, anon, authenticated;
revoke execute on function public.prospect_email_send_finalize(text, text, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.prospect_email_send_release(text, text) from public, anon, authenticated;
grant execute on function public.prospect_email_send_claim(text, text, text) to service_role;
grant execute on function public.prospect_email_send_stamp(text, text, text) to service_role;
grant execute on function public.prospect_email_send_finalize(text, text, text, text, bigint) to service_role;
grant execute on function public.prospect_email_send_release(text, text) to service_role;
