-- Phase 4.1 (docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md) — the
-- per-saved-search "new since last visit" baseline for the /account portal.
--
-- The portal shows, per alert, how many CURRENT matches came on market since
-- the subscriber last checked that search. That baseline is this column. When
-- it is NULL the reader falls back to created_at ("new since you saved it"),
-- so a brand-new search never renders a scary "everything is new" badge.
--
-- Deliberately NOT derived from notified_listing_keys: detectListingEvents
-- restamps notified_at on EVERY current match on every engine pass, so that
-- column is a "last seen by the engine" cursor, not a per-subscriber visit
-- marker. One timestamp, written on an explicit "mark as seen", is the whole
-- mechanism — no new event stream.
--
-- No index: every read is already scoped by user_id / id, both indexed.
alter table public.listing_alerts
  add column if not exists last_viewed_at timestamptz;

comment on column public.listing_alerts.last_viewed_at is
  'Portal baseline for "new since last visit" (/account). Written when the owner marks the saved search as seen. NULL = never marked; readers fall back to created_at.';
