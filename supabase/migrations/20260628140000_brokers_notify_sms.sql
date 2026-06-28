-- 20260628140000_brokers_notify_sms.sql
--
-- Per-broker opt-in for SMS lead/activity alerts. Default OFF (Matt 2026-06-28):
-- brokers are opted OUT of text-message notifications unless they turn it on in
-- /admin/settings. Gates queueBrokerAlert (lib/crm/broker-alerts.ts), which is the
-- "instant channel" the mac-mini poller texts from crm_broker_alerts. Email +
-- dashboard alert paths are separate and unaffected. Operational health alerts
-- (queueBrokerHealthAlert, always routed to Matt) are intentionally NOT gated.

ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS notify_sms boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.brokers.notify_sms IS
  'Per-broker opt-in for SMS lead/activity alerts (queueBrokerAlert). Default false = opted out (Matt 2026-06-28). Ops/health alerts route to Matt separately and are not gated by this.';
