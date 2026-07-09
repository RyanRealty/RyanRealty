-- Gmail-synced email signatures (2026-07-09, Matt directive: CRM email
-- signatures must match each broker's real Gmail signature).
--
-- gmail_signature_html: the primary sendAs signature pulled verbatim from the
-- Gmail API (users.settings.sendAs) for the broker's mailbox. When non-null it
-- is the signature used on every client-facing CRM email (the ORS 696.820
-- agency-pamphlet compliance line is still appended at compose time).
-- gmail_signature_synced_at: when the last successful sync ran (null = never).
alter table public.brokers
  add column if not exists gmail_signature_html text,
  add column if not exists gmail_signature_synced_at timestamptz;

comment on column public.brokers.gmail_signature_html is
  'Primary Gmail sendAs signature HTML, synced from the Gmail API (lib/crm/gmail-signature-sync.ts). Takes precedence over email_signature in buildSignature.';
comment on column public.brokers.gmail_signature_synced_at is
  'Timestamp of the last successful Gmail signature sync for this broker mailbox.';
