-- Newsletter Phase 3 (§6.5 rule 4): the deliverability circuit-breaker pause flag.
-- The drain auto-pauses a send (sets this true) when the rolling bounce rate > 2%
-- or complaint rate > 0.1% within the send, and alerts Matt. Resume is explicit
-- (an admin sets it back to false). The drain skips paused newsletters every tick.
alter table public.newsletters
  add column if not exists send_paused boolean not null default false;
comment on column public.newsletters.send_paused is
  'Circuit-breaker pause (spec §6.5 rule 4): drain auto-pauses on bounce>2% / complaint>0.1%; resume is a manual admin action.';
