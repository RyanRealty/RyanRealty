-- crm_broker_alerts.claimed_at (W5.5 serverless drain) — atomic-claim support.
--
-- The serverless drain (/api/cron/crm-alert-drain) and the mac-mini relay can
-- coexist: the drain CAS-claims a row (status 'pending' -> 'sending' with
-- claimed_at) before sending, so the 45s relay (which selects only
-- status='pending') can never double-send it. claimed_at lets a stale
-- 'sending' row (a drain that died mid-send) be reclaimed after 5 minutes.

ALTER TABLE public.crm_broker_alerts
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Fast reclaim scan (rare rows).
CREATE INDEX IF NOT EXISTS crm_broker_alerts_sending_idx
  ON public.crm_broker_alerts (status, claimed_at)
  WHERE status = 'sending';
