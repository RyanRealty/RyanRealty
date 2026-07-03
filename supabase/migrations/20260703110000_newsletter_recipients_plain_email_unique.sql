-- Newsletter Phase 3 (audit A5): a PLAIN unique on (newsletter_id, email) so
-- PostgREST .upsert({ onConflict: 'newsletter_id,email' }) actually matches an index.
--
-- The existing unique is FUNCTIONAL — (newsletter_id, lower(email)) — which PostgREST
-- cannot address by bare column name, so recordRecipientSend's upsert silently fell
-- through to a plain insert (it would 23505 once the table had rows, and the Phase 3
-- queue enqueue needs on-conflict-ignore too). email is always stored lowercased
-- (the DAL calls .toLowerCase()), so this plain index is equivalent to the functional
-- one and never conflicts differently — it just makes onConflict addressable.
-- Verified safe 2026-07-03: newsletter_recipients is empty.
create unique index if not exists newsletter_recipients_nl_email_key
  on public.newsletter_recipients (newsletter_id, email);
