-- D7 (Matt 2026-08-27): a CMA row must know how its request arrived. Five
-- sources exist in code (seller-lp, expired-listing-cron, fsbo-lp,
-- crm-kickoff, and buyer once built) but the row only kept a prose
-- generation_reason — 194 of 359 rows could not name their own origin, and
-- delivery rules (auto-send for people who ASKED, approval for the rest)
-- cannot route on a sentence.
alter table public.cmas add column if not exists request_source text;

-- Backfill from the prose, most specific pattern first. Rows matching nothing
-- stay null — an unknown origin stays visibly unknown rather than guessed.
update public.cmas set request_source = 'seller-lp'
  where request_source is null and generation_reason ilike '%Seller LP submission%';
update public.cmas set request_source = 'fsbo-lp'
  where request_source is null and generation_reason ilike '%FSBO LP submission%';
update public.cmas set request_source = 'expired-listing-cron'
  where request_source is null and (
    generation_reason ilike '%expired-listing-cron%'
    or generation_reason ilike '%Expired-listing detection%'
  );
update public.cmas set request_source = 'crm-kickoff'
  where request_source is null and generation_reason ilike '%kick-off%';
update public.cmas set request_source = 'lead-form'
  where request_source is null and generation_reason ilike '%(lead-form)%';
