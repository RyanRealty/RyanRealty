-- Newsletter per-recipient tracking: opens, clicks (which links), delivery, and
-- which broker sent it. Resend webhook events match back via resend_message_id.

-- Who sent it (broker email/slug), for per-broker attribution + stats.
alter table public.newsletters add column if not exists sent_by text;

-- One row per (newsletter, recipient). The send records resend_message_id from
-- the Resend send response; the webhook updates open/click state by that id.
create table if not exists public.newsletter_recipients (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  email text not null,
  resend_message_id text,
  status text not null default 'sent'
    check (status in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  open_count integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  click_count integer not null default 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  clicked_links jsonb not null default '[]'::jsonb,   -- [{ "url": "...", "count": N, "last": iso }]
  created_at timestamptz not null default now()
);

create unique index if not exists newsletter_recipients_letter_email_key
  on public.newsletter_recipients (newsletter_id, lower(email));
create index if not exists newsletter_recipients_msgid_idx
  on public.newsletter_recipients (resend_message_id);
create index if not exists newsletter_recipients_newsletter_idx
  on public.newsletter_recipients (newsletter_id);
create index if not exists newsletter_recipients_status_idx
  on public.newsletter_recipients (status);

alter table public.newsletter_recipients enable row level security;
-- Service-role only.

comment on table public.newsletter_recipients is 'Per-recipient newsletter delivery + open/click tracking. Matched to Resend events by resend_message_id. Service-role only.';
