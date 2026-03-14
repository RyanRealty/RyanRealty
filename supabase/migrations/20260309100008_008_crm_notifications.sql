-- Migration 008: CRM & Notifications
-- FUB contacts cache, email campaigns, notification_queue. Section 7.10b, Section 29.

CREATE TABLE IF NOT EXISTS fub_contacts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id text NOT NULL,
  broker_id uuid REFERENCES brokers(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  tags jsonb DEFAULT '[]',
  stage text,
  lead_score numeric,
  source text,
  last_activity_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE fub_contacts_cache IS 'Follow Up Boss contact mirror; broker_id = assigned agent.';

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_campaign_id text,
  template_type text,
  subject text,
  sent_count integer NOT NULL DEFAULT 0,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE email_campaigns IS 'Email campaign tracking (FUB/Resend).';

-- Notification queue: all notifications go here; background job processes. Section 7.10b.
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text
);

COMMENT ON TABLE notification_queue IS 'Outbound notifications (saved_search_match, price_drop, etc). Processed every 30s.';
