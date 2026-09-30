-- replace_newsletter_draft (code review round 4, 2026-09-30).
--
-- A monthly market report email whose report is republished with new figures
-- is replaced, never rewritten (lib/market-report/edition-email-draft.ts).
-- Done as two calls (cancel the old row, then insert the new one), a failed
-- or raced insert left the month with no live draft, so it was never drafted
-- again, and a concurrent run could slip a stale draft into the gap. This does
-- both in one transaction:
--
--   * the old row is locked and must still have the status the caller read
--     ('draft' or 'scheduled'); otherwise nothing changes and the current
--     status comes back, so the caller reads it again;
--   * it is canceled, so it can never be scheduled or sent again, and its
--     producer marker moves to p_retired_created_by, freeing the live one
--     (the unique index of migration 20260930130000);
--   * the replacement is inserted as a draft under the old row's marker and
--     audience (an audience Matt picked is kept);
--   * previous_status says whether an approved (scheduled) email was pulled
--     back, and touched whether the old row had changed since it was written
--     (an edit, or a schedule), so the text to Matt can say so.
--
-- The send cron's claim (claimNewsletterForSending) and every admin write are
-- conditional updates on status, so they wait on this row lock and then see
-- 'canceled'.

CREATE OR REPLACE FUNCTION public.replace_newsletter_draft(
  p_id uuid,
  p_expected_status text,
  p_retired_created_by text,
  p_subject text,
  p_preview_text text,
  p_body_html text,
  p_body_text text,
  p_citations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old public.newsletters%ROWTYPE;
  v_new uuid;
BEGIN
  IF p_expected_status IS NULL OR p_expected_status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'replace_newsletter_draft: only a draft or a scheduled issue is replaced, not %', p_expected_status;
  END IF;
  IF coalesce(p_retired_created_by, '') = '' THEN
    RAISE EXCEPTION 'replace_newsletter_draft: p_retired_created_by is required';
  END IF;
  IF coalesce(p_subject, '') = '' THEN
    RAISE EXCEPTION 'replace_newsletter_draft: p_subject is required';
  END IF;

  SELECT * INTO v_old FROM public.newsletters WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', NULL);
  END IF;
  IF v_old.status IS DISTINCT FROM p_expected_status THEN
    RETURN jsonb_build_object('ok', false, 'status', v_old.status);
  END IF;

  UPDATE public.newsletters
    SET status = 'canceled', created_by = p_retired_created_by, updated_at = now()
    WHERE id = p_id;

  INSERT INTO public.newsletters (subject, preview_text, body_html, body_text, audience, created_by, citations)
    VALUES (p_subject, p_preview_text, p_body_html, p_body_text, v_old.audience, v_old.created_by, coalesce(p_citations, '[]'::jsonb))
    RETURNING id INTO v_new;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new,
    'previous_status', v_old.status,
    'touched', v_old.updated_at IS DISTINCT FROM v_old.created_at
  );
END;
$$;

COMMENT ON FUNCTION public.replace_newsletter_draft(uuid, text, text, text, text, text, text, jsonb) IS
  'Cancels an open newsletter (it must still be p_expected_status, draft or scheduled), moves its created_by to p_retired_created_by, and inserts its replacement draft under the old created_by and audience, in one transaction. Returns {ok, id, previous_status, touched} or {ok:false, status} when the row moved. Used for the monthly market report email (lib/market-report/edition-email-draft.ts).';

REVOKE ALL ON FUNCTION public.replace_newsletter_draft(uuid, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_newsletter_draft(uuid, text, text, text, text, text, text, jsonb) TO service_role;
