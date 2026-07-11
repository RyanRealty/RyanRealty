-- NL-H2: claim timestamp for the newsletter send queue.
--
-- requeueStaleClaims() previously keyed crash-recovery on created_at (the row's
-- ENQUEUE time, always old). After any finalize failure/timeout a still-'sending'
-- row was therefore ALWAYS older than the cutoff and got reset to 'queued' → the
-- same recipient was re-claimed and emailed twice. Keying on the moment the row
-- was actually CLAIMED (claimed_at) means a freshly-claimed row (claimed_at = now)
-- is never mistaken for a crashed claim, so a normal in-flight send is not requeued.
--
-- claimQueuedBatch() stamps claimed_at = now() when it flips queued -> sending;
-- requeueStaleClaims() now recovers only rows whose claim is older than the stale
-- window. Queued rows keep a NULL claimed_at (they were never claimed).

ALTER TABLE public.newsletter_recipients
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Backfill any row currently mid-claim so the new claimed_at-keyed recovery can
-- still reclaim a pre-migration crashed claim (its created_at is old, so it will
-- be picked up on the next drain tick — correct, it is a stuck claim).
UPDATE public.newsletter_recipients
  SET claimed_at = created_at
  WHERE status = 'sending' AND claimed_at IS NULL;

COMMENT ON COLUMN public.newsletter_recipients.claimed_at IS
  'When the drain flipped this row queued -> sending. requeueStaleClaims keys crash-recovery on this (not created_at) so a normal in-flight send is never double-claimed. NULL for never-claimed (queued) rows.';
