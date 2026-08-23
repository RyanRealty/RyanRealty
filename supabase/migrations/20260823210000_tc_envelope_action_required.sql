-- Forms File Details / Create-envelope "Action required" is not a contact Role.
-- Live wire (2026-08-23 ROLE_LIST.md): NeedsToSign | ReceivesACopy | NoAction.
-- DigiSign omits No action (Signer / Receives a copy only).
-- Pre-column rows stored copy-only as role = 'cc'.

alter table public.tc_envelope_recipients
  add column if not exists action_required text not null default 'NeedsToSign';

alter table public.tc_envelope_recipients
  drop constraint if exists tc_envelope_recipients_action_required_check;

alter table public.tc_envelope_recipients
  add constraint tc_envelope_recipients_action_required_check
  check (action_required in ('NeedsToSign', 'ReceivesACopy', 'NoAction'));

update public.tc_envelope_recipients
  set action_required = 'ReceivesACopy'
  where lower(role) = 'cc'
    and action_required = 'NeedsToSign';

comment on column public.tc_envelope_recipients.action_required is
  'Forms Action required: NeedsToSign | ReceivesACopy | NoAction. Distinct from contact Role.';
