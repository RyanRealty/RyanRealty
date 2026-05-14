-- marketing_inbox_events: queue of inbound emails into marketing@ryan-realty.com
--
-- Lifecycle:
--   1. cron poll picks up new messages from Gmail (via DWD service account)
--   2. one row per message is inserted with status='received'
--   3. parser sets parsed_intent + parsed_target + parsed_payload + parser_confidence
--   4. dispatcher inserts a marketing_brain_actions row and links action_row_id
--   5. reply layer sends a confirmation and sets replied_at + reply_status
--
-- An email can fail to parse or be rejected (status='killed') without dirtying
-- marketing_brain_actions. Action rows are only ever created for sender-allowlisted,
-- confidently-parsed inbox events.
--
-- Locked 2026-05-14 by the marketing-inbox-agent handoff.

CREATE TABLE IF NOT EXISTS public.marketing_inbox_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at         timestamptz NOT NULL    DEFAULT now(),
  gmail_message_id    text        NOT NULL    UNIQUE,
  gmail_thread_id     text        NOT NULL,
  sender_email        text        NOT NULL,
  sender_name         text,
  subject             text,
  body_text           text,
  body_html           text,
  attachments         jsonb       NOT NULL    DEFAULT '[]'::jsonb,

  -- Parser output
  parsed_at           timestamptz,
  parsed_intent       text,
  parsed_target       text,
  parsed_payload      jsonb,
  parser_confidence   numeric,
  parser_model        text,
  parser_rationale    text,

  -- Brain action linkage
  action_row_id       uuid        REFERENCES public.marketing_brain_actions(id) ON DELETE SET NULL,

  -- Reply tracking
  replied_at          timestamptz,
  reply_status        text,                                  -- 'sent' | 'failed' | 'skipped'
  reply_message_id    text,
  reply_error         text,

  -- Lifecycle
  status              text        NOT NULL    DEFAULT 'received'
    CHECK (status IN ('received', 'parsed', 'dispatched', 'replied', 'killed')),
  kill_reason         text,

  created_at          timestamptz NOT NULL    DEFAULT now(),
  updated_at          timestamptz NOT NULL    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_inbox_events_status_idx
  ON public.marketing_inbox_events (status);

CREATE INDEX IF NOT EXISTS marketing_inbox_events_sender_idx
  ON public.marketing_inbox_events (sender_email);

CREATE INDEX IF NOT EXISTS marketing_inbox_events_received_at_idx
  ON public.marketing_inbox_events (received_at DESC);

CREATE INDEX IF NOT EXISTS marketing_inbox_events_thread_idx
  ON public.marketing_inbox_events (gmail_thread_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_marketing_inbox_events_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_inbox_events_updated_at ON public.marketing_inbox_events;

CREATE TRIGGER trg_marketing_inbox_events_updated_at
BEFORE UPDATE ON public.marketing_inbox_events
FOR EACH ROW EXECUTE FUNCTION public.set_marketing_inbox_events_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_inbox_events TO service_role;
