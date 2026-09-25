-- The signing-link lifetime bug: every reminder (manual, automatic, the client
-- portal, and the next-signing-group invite) minted a NEW auth_token_hash and
-- overwrote the recipient's row, because only the sha256 hash was ever stored
-- and a hash cannot be reversed back into the raw token that was already
-- emailed. The link a signer had in their inbox died the moment any later
-- send happened to touch that recipient.
--
-- auth_token_enc holds the CURRENT raw token, encrypted at rest (AES-256-GCM,
-- lib/tc/signing-token-vault.ts). A later send can now decrypt it, confirm it
-- still matches auth_token_hash, and re-use the same link instead of minting a
-- new one — so an already-emailed link keeps working until the recipient
-- signs, declines, or the envelope is voided. Nullable: older rows and any
-- recipient who has not been sent a link yet simply have no live token to
-- re-use, so a mint proceeds exactly as it did before.

alter table public.tc_envelope_recipients
  add column if not exists auth_token_enc text;

comment on column public.tc_envelope_recipients.auth_token_enc is
  'Current raw signing token, AES-256-GCM encrypted (lib/tc/signing-token-vault.ts). Lets a resend reuse the already-emailed link instead of minting a new one. Null = no live token to reuse; mint fresh. Cleared when the recipient signs or declines, or the envelope is voided; auth_token_hash stays so the old link opens to its final state.';
