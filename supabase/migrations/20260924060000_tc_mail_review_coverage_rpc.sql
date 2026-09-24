-- getMailCoverage() (lib/data/tc/mail-coverage.ts) read tc_mail_reviews with a
-- plain `select('mailbox, status, reviewed_at')` and no page/range — fine while
-- the table was small, silently wrong once it passed PostgREST's row cap (the
-- table holds ~73,000 rows as of 2026-09-24, one per (mailbox, gmail_id) ever
-- reviewed). The read came back truncated at the cap, so "every message
-- reviewed" counted only the first page and under-reported coverage and the
-- per-status breakdown on /admin/closings.
--
-- This function does the GROUP BY where the row cap cannot reach it: server
-- side, in Postgres. It returns one row per (mailbox, status) with the count
-- and the newest reviewed_at in that bucket — at most a few dozen rows for
-- three mailboxes and the eight tc_mail_reviews.status values, never the whole
-- table.
create or replace function public.tc_mail_review_coverage()
returns table (
  mailbox text,
  status text,
  reviewed_count bigint,
  last_reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mailbox,
    status,
    count(*)::bigint as reviewed_count,
    max(reviewed_at) as last_reviewed_at
  from public.tc_mail_reviews
  group by mailbox, status
$$;

comment on function public.tc_mail_review_coverage() is
  'Per (mailbox, status) counts + last reviewed_at over ALL of tc_mail_reviews, computed server side so the PostgREST row cap never truncates the coverage read getMailCoverage() (lib/data/tc/mail-coverage.ts) does for /admin/closings "Every message reviewed".';

-- service_role only — getMailCoverage() always reads via createServiceClient(),
-- the same grant tc_mail_reviews itself carries (20260924030000_tc_mail_reviews.sql).
revoke all on function public.tc_mail_review_coverage() from public;
grant execute on function public.tc_mail_review_coverage() to service_role;
