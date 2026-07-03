-- Newsletter Phase 1 (spec §3.1): the per-recipient engagement LEDGER.
--
-- Why this exists: today newsletter_recipients.open_count / click_count are the
-- source of truth, and the Resend webhook increments them on every delivery. A
-- webhook REDELIVERY (Resend retries on any non-2xx, and Svix replays) therefore
-- double-counts opens/clicks (edge cases T-2/T-3/T-4). This append-only ledger
-- makes engagement idempotent: every (message, event, url) collapses to ONE row
-- via a unique dedupe_key, so open_count/click_count become derived counts over
-- this table (Phase 5) and a redelivery can never inflate them.
--
-- broker is stamped here too (spec §5): per-broker analytics need the recipient's
-- frozen broker slug on engagement events, not just on sends. Both write paths
-- (our HMAC pixel/token AND the Resend webhook via message_id → recipients.broker)
-- populate it (gate G-NL-5 / fixes H1).
create table if not exists public.newsletter_recipient_events (
  id                bigint generated always as identity primary key,
  newsletter_id     uuid not null references public.newsletters (id) on delete cascade,
  subscriber_id     uuid references public.newsletter_subscribers (id) on delete set null,
  email             text not null,
  resend_message_id text,
  broker            text,               -- recipient's frozen short slug (matt|rebecca|paul)
  event             text not null check (event in ('delivered','open','click','bounce','complaint')),
  url               text,               -- click target, for per-link click granularity
  occurred_at       timestamptz not null default now(),
  -- dedupe_key is RECIPIENT-scoped, NOT the spec's naive "<resend_message_id>:<event>:<url>".
  -- Adversarial audit 2026-07-03: two engagement sources write here — our HMAC open pixel
  -- (which has NO resend_message_id, so a message-id key would collapse every recipient's
  -- open into one row) and the Resend webhook (keyed by message_id). To make BOTH sources
  -- idempotent AND collapse to a single truth per recipient, the key is built from the
  -- recipient identity: "nl:<newsletter_id>:sub:<subscriber_id|email>:<event>:<url>"
  -- (url empty for non-click events). UNIQUE so on-conflict-do-nothing drops replays and
  -- cross-source duplicates silently. Exact construction lands in Phase 4/5.
  dedupe_key        text not null unique,
  created_at        timestamptz not null default now()
);

-- Drives per-newsletter aggregate counts (delivered/open/click/bounce/complaint).
create index if not exists newsletter_recipient_events_newsletter_event_idx
  on public.newsletter_recipient_events (newsletter_id, event);

-- Drives per-broker engagement rollups (matches the (broker, occurred_at) grain
-- already indexed on email_events).
create index if not exists newsletter_recipient_events_broker_idx
  on public.newsletter_recipient_events (broker, occurred_at)
  where broker is not null;

-- Re-link engagement to a subscriber row when needed.
create index if not exists newsletter_recipient_events_subscriber_idx
  on public.newsletter_recipient_events (subscriber_id)
  where subscriber_id is not null;

comment on table public.newsletter_recipient_events is
  'Append-only newsletter engagement ledger (delivered/open/click/bounce/complaint). Idempotent via dedupe_key. Source of truth for open/click counts (Phase 5 derives newsletter_recipients counters from this). Broker stamped per spec §5.';
