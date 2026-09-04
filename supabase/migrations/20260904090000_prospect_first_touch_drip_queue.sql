-- Prospecting first-touch drip queue (approve → queue → weekday drain).
--
-- Additive: outreach_email_queued_at marks membership in the drip FIFO.
-- outreach_email_status gains 'queued' (alongside null | sending | sent).
-- Claim RPC unchanged in contract — queued rows are claimable like null.
-- Release restores 'queued' when queued_at is set so a failed drip send retries.

ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS outreach_email_queued_at timestamptz;

ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS outreach_email_queued_at timestamptz;

COMMENT ON COLUMN public.expired_listings.outreach_email_queued_at IS
  'When the broker-approved CMA was enqueued for the weekday first-touch email drip. Null = not in drip queue (manual send only).';
COMMENT ON COLUMN public.fsbo_listings.outreach_email_queued_at IS
  'When the broker-approved CMA was enqueued for the weekday first-touch email drip. Null = not in drip queue (manual send only).';

COMMENT ON COLUMN public.expired_listings.outreach_email_status IS
  'Email send-claim state: null (unsent) | queued (drip FIFO) | sending (claimed, in flight) | sent (finalized).';
COMMENT ON COLUMN public.fsbo_listings.outreach_email_status IS
  'Email send-claim state: null (unsent) | queued (drip FIFO) | sending (claimed, in flight) | sent (finalized).';

CREATE INDEX IF NOT EXISTS expired_listings_email_drip_queue_idx
  ON public.expired_listings (outreach_email_queued_at)
  WHERE outreach_email_status = 'queued' AND outreach_email_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS fsbo_listings_email_drip_queue_idx
  ON public.fsbo_listings (outreach_email_queued_at)
  WHERE outreach_email_status = 'queued' AND outreach_email_sent_at IS NULL;

-- Release: restore queued when this row was a drip member; else clear to null.
create or replace function public.prospect_email_send_release(
  p_kind text,
  p_id text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_queued_at timestamptz;
begin
  if p_kind = 'expired' then
    select outreach_email_queued_at into v_queued_at
      from public.expired_listings where listing_key = p_id for update;
    if not found then return; end if;
    update public.expired_listings
       set outreach_email_status = case when v_queued_at is not null then 'queued' else null end,
           outreach_email_claim_at = null
     where listing_key = p_id
       and outreach_email_sent_at is null
       and outreach_email_message_id is null;
  elsif p_kind = 'fsbo' then
    select outreach_email_queued_at into v_queued_at
      from public.fsbo_listings where fsbo_url = p_id for update;
    if not found then return; end if;
    update public.fsbo_listings
       set outreach_email_status = case when v_queued_at is not null then 'queued' else null end,
           outreach_email_claim_at = null
     where fsbo_url = p_id
       and outreach_email_sent_at is null
       and outreach_email_message_id is null;
  end if;
end; $$;

revoke execute on function public.prospect_email_send_release(text, text) from public, anon, authenticated;
grant execute on function public.prospect_email_send_release(text, text) to service_role;
