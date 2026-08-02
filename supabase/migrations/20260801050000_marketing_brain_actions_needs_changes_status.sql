-- R0.2 (BROKER_SMS_AGENT plan, applied live 2026-07-31 via MCP as
-- marketing_brain_actions_needs_changes_status): the approval-queue
-- "request changes" verb has written status='needs_changes' since the
-- 20260516 upgrade added needs_changes_at, but the status CHECK constraint
-- was never updated, so every request_changes failed with 23514.
-- Add the status the app already writes.
alter table public.marketing_brain_actions
  drop constraint if exists marketing_brain_actions_status_check;
alter table public.marketing_brain_actions
  add constraint marketing_brain_actions_status_check
  check (status = any (array[
    'pending'::text, 'in_production'::text, 'ready'::text, 'approved'::text,
    'executed'::text, 'measured'::text, 'killed'::text, 'needs_changes'::text
  ]));
