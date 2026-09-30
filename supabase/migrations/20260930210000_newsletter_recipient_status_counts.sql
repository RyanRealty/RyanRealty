-- newsletter_recipient_status_counts (code review round 9, 2026-09-30).
--
-- finalizeNewsletter closes a send once nothing is queued or sending. It read
-- one count per status, and read in parallel those are separate snapshots: a
-- drain claim (queued -> sending) that commits between the 'sending' read and
-- the 'queued' read is in neither, and a send still going out closed 'failed'.
-- One grouped count is one snapshot, and one round trip instead of ten.
--
-- Read-only; service role only.

CREATE OR REPLACE FUNCTION public.newsletter_recipient_status_counts(p_newsletter_id uuid)
RETURNS TABLE (status text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.status, count(*)::bigint AS n
  FROM public.newsletter_recipients r
  WHERE r.newsletter_id = p_newsletter_id
  GROUP BY r.status
$$;

COMMENT ON FUNCTION public.newsletter_recipient_status_counts(uuid) IS
  'Recipient rows of one newsletter by status, in one snapshot (finalizeNewsletter, the reconcile, the breaker). Statuses with no rows are absent.';

REVOKE ALL ON FUNCTION public.newsletter_recipient_status_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_recipient_status_counts(uuid) TO service_role;
