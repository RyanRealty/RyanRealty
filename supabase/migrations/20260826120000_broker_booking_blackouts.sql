-- Days a broker is not bookable, independent of any calendar event (Matt 2026-08-26).
--
-- WHY THIS EXISTS RATHER THAN READING AN ALL-DAY EVENT. Booking availability
-- deliberately SKIPS all-day Google/CRM events, because the TC system writes
-- transaction milestones as all-day entries ("Contract accepted · 2840 NE
-- Sedalia Loop"). Counting those as busy showed 4 bookable days out of 15.
-- The cost of that decision is that an all-day "Vacation" does not hold time
-- either. Rather than guess a broker's intent from an event title, a day off is
-- stated explicitly here.
--
-- Half-open [starts_on, ends_on): a single day is one row with ends_on the
-- following day, so a range never double-counts its final date.

create table if not exists public.broker_booking_blackouts (
  id           bigint generated always as identity primary key,
  broker_slug  text not null,
  starts_on    date not null,
  ends_on      date not null,
  reason       text,
  created_at   timestamptz not null default now(),
  constraint broker_booking_blackouts_range check (ends_on > starts_on)
);

create index if not exists broker_booking_blackouts_lookup
  on public.broker_booking_blackouts (broker_slug, starts_on, ends_on);

comment on table public.broker_booking_blackouts is
  'Days a broker is not bookable on /book. Independent of calendar events, because booking skips all-day events (TC writes milestones that way). Half-open [starts_on, ends_on).';

alter table public.broker_booking_blackouts enable row level security;

-- Service-role only. Availability is read server-side; nothing client-side
-- should be able to enumerate when a broker is away.
revoke all on public.broker_booking_blackouts from anon, authenticated;
