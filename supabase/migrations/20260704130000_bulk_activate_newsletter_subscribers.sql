-- Batch enroll: upsert many newsletter subscribers to active in ONE statement.
--
-- Why: adminBulkEnrollNewsletterAction and enqueueNewsletterToEmails enrolled with a
-- per-email subscribeToNewsletter loop (a SELECT + UPDATE/INSERT each) — up to 10,000
-- sequential round-trips in one Server Action request, which times out well before
-- the 5,000 cap (P1/P2). The unique index is functional (lower(email)), so a
-- PostgREST upsert can't target it; this function does INSERT ... ON CONFLICT
-- (lower(email)) directly.
--
-- COMPLIANCE: this sets status='active' on conflict, so the CALLER must pass only
-- opt-out-filtered addresses (new + already-active). Never pass an unsubscribed /
-- bounced / complained address — that would resurrect an opt-out (S-10). Both callers
-- filter via getSubscribersByEmails(status!=='active') before calling.
create or replace function public.bulk_activate_newsletter_subscribers(
  p_emails text[],
  p_source text,
  p_segment text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with up as (
    insert into newsletter_subscribers (email, status, source, segment)
    select lower(btrim(e)), 'active', p_source, coalesce(nullif(p_segment, ''), 'general')
    from unnest(p_emails) as e
    where btrim(e) <> '' and position('@' in e) > 0
    on conflict (lower(email)) do update
      set status = 'active', updated_at = now()
    returning 1
  )
  select count(*) into n from up;
  return coalesce(n, 0);
end;
$$;

comment on function public.bulk_activate_newsletter_subscribers(text[], text, text) is
  'Single-statement batch enroll (P1/P2 fix). Caller MUST pre-filter opt-outs; ON CONFLICT sets active.';

grant execute on function public.bulk_activate_newsletter_subscribers(text[], text, text) to service_role;
