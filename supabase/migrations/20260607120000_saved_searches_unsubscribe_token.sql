-- One-click email unsubscribe token for signed-in saved-search alerts, at parity
-- with guest_search_alerts. The alert email's List-Unsubscribe header points to
-- /alerts/unsubscribe?token=<this>, which pauses the saved search (is_paused).
-- Backfill existing rows; default a token onto every new insert.
alter table public.saved_searches add column if not exists unsubscribe_token text;
update public.saved_searches set unsubscribe_token = gen_random_uuid()::text where unsubscribe_token is null;
alter table public.saved_searches alter column unsubscribe_token set default gen_random_uuid()::text;
create unique index if not exists saved_searches_unsubscribe_token_idx
  on public.saved_searches (unsubscribe_token) where unsubscribe_token is not null;
