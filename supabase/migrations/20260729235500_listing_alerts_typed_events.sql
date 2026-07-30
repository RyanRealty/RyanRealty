-- 20260729235500_listing_alerts_typed_events.sql
--
-- Phase 3 of docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md: upgrade the
-- listing-alert engine from "new result-set keys" to TYPED EVENTS, with
-- per-day weekly cadence, multi-recipient (household) alerts, and a
-- preview/approval queue — matching (and extending) the Flexmls subscription
-- model documented in that plan's §1.5.
--
-- WRITTEN, NOT APPLIED in the authoring session (parallel-build protocol).
-- Purely additive: every change is ADD COLUMN IF NOT EXISTS / CREATE IF NOT
-- EXISTS, and the engine code degrades gracefully until this is applied
-- (missing columns read as undefined via the DAL's select('*')).

-- ── 1. listing_alerts: typed-event + cadence + recipient columns ─────────────

-- Per-alert event toggle map. Defaults are Flexmls-inherited (plan §1.5,
-- "Portal preferences → Default Subscription Settings"): New ✓ · Price Change ✓
-- · Status Change ✓ · Back On Market ✗ · Sold ✗ · Open House ✗.
ALTER TABLE public.listing_alerts
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL
    DEFAULT '{"new":true,"price_change":true,"status_change":true,"back_on_market":false,"sold":false,"open_house":false}'::jsonb;

COMMENT ON COLUMN public.listing_alerts.events IS
  'Typed-event toggle map: {new, price_change, status_change, back_on_market, sold, open_house} booleans. Missing keys fall back to the Flexmls-inherited defaults in lib/alerts/event-detection.ts DEFAULT_EVENT_TOGGLES.';

-- Weekly per-day scheduling (Flexmls''s Sun–Sat checkboxes). 0=Sunday..6=Saturday
-- in America/Los_Angeles. NULL (or empty) = every day the base cadence allows.
-- Applies ONLY when notification_frequency = 'weekly'
-- (lib/saved-search-cadence.ts isCadenceDue).
ALTER TABLE public.listing_alerts
  ADD COLUMN IF NOT EXISTS schedule_days smallint[] NULL;

ALTER TABLE public.listing_alerts
  DROP CONSTRAINT IF EXISTS listing_alerts_schedule_days_valid;
ALTER TABLE public.listing_alerts
  ADD CONSTRAINT listing_alerts_schedule_days_valid
  CHECK (schedule_days IS NULL OR schedule_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

COMMENT ON COLUMN public.listing_alerts.schedule_days IS
  'Weekly cadence day-of-week filter, 0=Sunday..6=Saturday (America/Los_Angeles). NULL = any day. Only honored when notification_frequency = weekly.';

-- Preview mode (Flexmls "Preview Mode" / "Listings to Approve"): when true the
-- engine writes listing_alert_queue rows instead of sending; a CRM admin
-- approves or rejects them from the subscriptions hub.
ALTER TABLE public.listing_alerts
  ADD COLUMN IF NOT EXISTS preview_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.listing_alerts.preview_mode IS
  'When true, detected events queue in listing_alert_queue for broker approval instead of sending (Flexmls Preview Mode).';

-- Additional household recipients (the Jim + Lisa case). Array of
-- {email, name?, unsubscribe_token}. The PRIMARY recipient stays in the
-- email/unsubscribe_token columns; each entry here carries its OWN token,
-- honored by /alerts/unsubscribe (a recipient token removes only that
-- recipient; the primary token deactivates the whole alert).
ALTER TABLE public.listing_alerts
  ADD COLUMN IF NOT EXISTS recipients jsonb NULL;

COMMENT ON COLUMN public.listing_alerts.recipients IS
  'Additional recipients: [{email, name?, unsubscribe_token}]. Primary recipient stays in email/unsubscribe_token. Each entry token unsubscribes only that recipient (lib/data/leads/listingAlerts.ts deactivateListingAlertByToken).';

-- notified_listing_keys upgrades from plain key strings to per-key state
-- objects {key, price, status, notified_at, open_house} so price/status/OH
-- deltas are detectable per subscriber. No column change needed (already
-- jsonb); old rows holding plain strings keep working — the reader
-- (lib/alerts/event-detection.ts parseNotifiedState) accepts both shapes.
COMMENT ON COLUMN public.listing_alerts.notified_listing_keys IS
  'Per-key notified state for the typed-event diff. Entries are either legacy plain key strings or {key, price, status, notified_at, open_house} objects (lib/alerts/event-detection.ts). Capped at the newest 1,000 by the DAL.';

-- ── 2. listing_alert_queue: preview-mode holds ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.listing_alert_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.listing_alerts(id) ON DELETE CASCADE,
  listing_key text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('new', 'price_change', 'status_change', 'back_on_market', 'sold', 'open_house')),
  -- Everything needed to rebuild the email card without re-querying listings:
  -- {event: ListingEvent, card: ListingAlertListing} (app/actions/saved-search-alerts.ts).
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  -- CRM admin email that approved/rejected (app/actions getCrmAccess().email).
  decided_by text
);

COMMENT ON TABLE public.listing_alert_queue IS
  'Preview-mode holds for listing alerts (Flexmls "Listings to Approve"): one row per (alert, listing, event). pending → approved (sends immediately via the engine send path) / rejected. Service-role only.';

-- Admin hub scan: pending items per alert.
CREATE INDEX IF NOT EXISTS idx_listing_alert_queue_alert_status
  ON public.listing_alert_queue (alert_id, status);

-- One pending hold per (alert, listing, event): re-runs upsert-ignore instead
-- of stacking duplicates while the broker hasn't decided yet.
CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_alert_queue_pending
  ON public.listing_alert_queue (alert_id, listing_key, event_type)
  WHERE status = 'pending';

-- RLS: enabled with NO policies = service-role only (the cron + admin server
-- actions run on the service client; anon/authenticated get nothing).
ALTER TABLE public.listing_alert_queue ENABLE ROW LEVEL SECURITY;

-- Defensive posture (matches 20260730000500 grant-model note): Supabase default
-- privileges auto-grant table rights to anon/authenticated on creation; RLS
-- with zero policies already blocks row access, but claw the grants back too.
REVOKE ALL ON public.listing_alert_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.listing_alert_queue TO service_role;
