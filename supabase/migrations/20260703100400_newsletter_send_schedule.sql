-- Newsletter Phase 1 (spec §3.1/§6.5): the per-issue tranche schedule that paces a
-- large send across ~5-7 days, engagement-tiered, best senders first.
--
-- A once-a-month 12k blast from a subdomain that otherwise sends little reads as a
-- recurring volume spike to Gmail/Yahoo EVERY month (§6.5). So every large issue is
-- split into tiers and delivered over several days: Tier 1 (engaged) day 1, Tier 2
-- (new) days 2-3, Tier 3 (cold) days 4-7. The drain (§6 step 2) sends a queued
-- recipient only when its tier's scheduled day_index has arrived AND the day's cap
-- isn't hit. Warm-up is the SAME mechanism with a ramped cap curve
-- (500→1k→2k→4k→8k→full) instead of flat caps — one table, two cap shapes.
create table if not exists public.newsletter_send_schedule (
  id            bigint generated always as identity primary key,
  newsletter_id uuid not null references public.newsletters (id) on delete cascade,
  day_index     smallint not null check (day_index between 0 and 13), -- 0..6 typical; headroom for a stretched ramp
  tier          smallint not null check (tier in (1, 2, 3)),
  cap           integer  not null check (cap >= 0),   -- max recipients to send this day (ramped for warm-up, flat otherwise)
  sent_count    integer  not null default 0 check (sent_count >= 0),
  created_at    timestamptz not null default now(),
  unique (newsletter_id, day_index, tier)
);

-- The reconciler/drain looks up "today's" schedule row for an issue by day_index.
create index if not exists newsletter_send_schedule_newsletter_idx
  on public.newsletter_send_schedule (newsletter_id, day_index);

comment on table public.newsletter_send_schedule is
  'Per-issue tranche plan (spec §6.5): rows (newsletter_id, day_index, tier, cap). The send-drain releases queued recipients only when their tier''s day has arrived and the day cap is not exceeded (G-NL-17). Warm-up = ramped caps; steady-state = flat caps.';
