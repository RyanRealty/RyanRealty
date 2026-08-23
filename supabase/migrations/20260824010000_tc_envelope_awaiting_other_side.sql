-- One-sided representation: our clients sign in Vault, then we send the PDF to
-- the other broker and wait for the executed copy back. Not fully executed yet.

alter table public.tc_envelopes drop constraint if exists tc_envelopes_status_check;

alter table public.tc_envelopes
  add constraint tc_envelopes_status_check
  check (status in (
    'draft',
    'sent',
    'partially_signed',
    'awaiting_other_side',
    'completed',
    'voided'
  ));
