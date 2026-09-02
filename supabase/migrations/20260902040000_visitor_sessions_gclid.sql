-- Google Ads click-id capture (queue item gclid-capture, 2026-09-01).
-- Same treatment as fbclid: persisted on session creation from the ?gclid=
-- URL param, first-touch only, stripped at every consent level that strips
-- the UTMs. Closes the Google half of paid click attribution (fbclid has
-- carried the Meta half since 2026-08-26).
ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS gclid text;
