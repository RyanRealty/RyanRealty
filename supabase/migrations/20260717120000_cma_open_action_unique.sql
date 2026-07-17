-- One OPEN build per CMA slug (admin-rebuild v2 D8, adversarial review 2026-07-17 MED).
--
-- Two concurrent kick-offs for the same address could both pass the app-level
-- open-build check (a TOCTOU between findOpenCmaActionBySlug and the insert)
-- and enqueue two content:cma rows — double build compute, and the second
-- build overwrites the first's reviewed content by slug. This partial unique
-- index makes the race lose at the DB layer: the loser gets a 23505 and
-- attaches to the winner (lib/crm/cma-kickoff.ts duplicate-key fallback).
--
-- Scoped to content:cma + open statuses only — other action types legitimately
-- carry multiple rows per target over time, and closed cma rows (ready/killed/
-- measured) may repeat a target across rebuild generations.
create unique index if not exists marketing_brain_actions_open_cma_uidx
  on public.marketing_brain_actions (target)
  where action_type = 'content:cma' and status in ('pending', 'in_production');
