-- GSC slide fix (2026-10-05). Listing URLs Google still holds in a bad index
-- state after the 09-05/09-06 crawl burst that hit a failed-lookup page (200,
-- noindex, one shared body). Until 7e392cc4 (2026-10-04) a database failure on
-- a listing read rendered "We can't show this home" with noindex; URL
-- Inspection on a random 150 of the 3,247 sitemap listing URLs found 12 still
-- "Excluded by 'noindex' tag", 8 with a Google canonical pointing at a
-- DIFFERENT listing.
--
-- Written by scripts/gsc-listing-noindex-sweep.mjs (URL Inspection over every
-- URL in /sitemaps/listings.xml, 2,000/day quota, resumable). A row exists only
-- while the URL is flagged: a later inspection that finds it healthy deletes
-- the row. Read by lib/data/sitemap/getListingSitemapRows.ts, which emits
-- lastmod = greatest(listing modified_at, recrawl_after) for these URLs so
-- Google recrawls them.
--
-- flag:
--   noindex             coverageState = 'Excluded by ''noindex'' tag'
--   canonical_mismatch  googleCanonical set and different from userCanonical

create table if not exists public.gsc_listing_index_flags (
  url text primary key,
  listing_number text not null,
  flag text not null check (flag in ('noindex', 'canonical_mismatch')),
  coverage_state text,
  google_canonical text,
  user_canonical text,
  last_crawl_at timestamptz,
  inspected_at timestamptz not null default now(),
  recrawl_after timestamptz not null default now()
);

create index if not exists gsc_listing_index_flags_listing_number_idx
  on public.gsc_listing_index_flags (listing_number);

comment on table public.gsc_listing_index_flags is
  'Sitemap listing URLs that URL Inspection found Excluded by noindex or with a Google canonical different from ours (GSC slide fix 2026-10-05). Written by scripts/gsc-listing-noindex-sweep.mjs; a healthy re-inspection deletes the row. getListingSitemapRows bumps lastmod to recrawl_after for these so Google recrawls.';

alter table public.gsc_listing_index_flags enable row level security;

-- The sitemap reads this with the anon key. The rows are our own public URLs
-- and Google''s public verdict on them; nothing private. Writes: service role.
drop policy if exists gsc_listing_index_flags_read on public.gsc_listing_index_flags;
create policy gsc_listing_index_flags_read on public.gsc_listing_index_flags
  for select to anon, authenticated using (true);

grant select on public.gsc_listing_index_flags to anon, authenticated;
grant all on public.gsc_listing_index_flags to service_role;
