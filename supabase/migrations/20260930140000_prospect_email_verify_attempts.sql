-- How many times the first-touch drip could not verify a queued owner's
-- address against the MLS (prospecting drip review, 2026-09-30).
--
-- The drip checks every queued owner against the MLS right before it emails
-- (lib/data/prospecting/drip-drain.ts). A check that cannot answer for one
-- address (no listing key and no street number, more on-market listings at the
-- number than one page, a listing our Spark key may not read, a shared address
-- with no unit) used to leave that row at the head of the queue, and the drain
-- served it again every minute: nothing behind it ever sent, and nobody was
-- told. Now the row is set aside for an hour and counted here; on the third
-- such failure it leaves the queue and Matt gets an ops text.
--
-- Safe in either order with the code: before this column exists the drain
-- still sets the row aside, uncounted, and never drops it
-- (setAsideQueuedFirstTouch in lib/data/prospecting/drip-queue.ts reads a
-- missing column as "not counting").

alter table public.expired_listings
  add column if not exists outreach_email_verify_attempts integer not null default 0;

alter table public.fsbo_listings
  add column if not exists outreach_email_verify_attempts integer not null default 0;

comment on column public.expired_listings.outreach_email_verify_attempts is
  'First-touch drip: MLS relist checks that could not answer for this address while queued. Three sets the row out of the queue with an ops text to Matt; cleared when it leaves.';
comment on column public.fsbo_listings.outreach_email_verify_attempts is
  'First-touch drip: MLS relist checks that could not answer for this address while queued. Three sets the row out of the queue with an ops text to Matt; cleared when it leaves.';
