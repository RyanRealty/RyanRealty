-- M2 (TC architecture review 2026-06-23): index the public signing hot path.
-- Every /sign action resolves a recipient by auth_token_hash, but the only index
-- on tc_envelope_recipients is (envelope_id) — so each public signing request is a
-- sequential scan over a table that grows one row per signer forever. UNIQUE so a
-- hash collision raises a constraint error instead of a silent .maybeSingle()
-- ambiguity (which would surface as a 500 on the signer). Partial: only live tokens.
create unique index if not exists tc_envelope_recipients_auth_token_hash_key
  on public.tc_envelope_recipients (auth_token_hash)
  where auth_token_hash is not null;
