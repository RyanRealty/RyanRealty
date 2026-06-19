-- Neighborhoods SEO content cleanup (dedicated review-pass findings, 2026-06-18).
--
-- Data correction, not DDL. Two issues the review pass surfaced on the live
-- /cities/<city>/<neighborhood> pages:
--
--   1. seo_title baked in "| Ryan Realty" which the root layout title.template
--      ("%s | Ryan Realty — Central Oregon Real Estate") then appended a SECOND
--      time (double-brand), and the verbose tail "| Bend Oregon Homes &
--      Communities | Ryan Realty" blew past the SERP display width and was being
--      hard-cut mid-word to "| Rya". The code fix (lib/site/page-metadata.ts
--      cleanTitle) already neutralizes the breakage; this makes the STORED data
--      concise so the SERP title front-loads the keyword: "<Name> Real Estate in
--      Bend, Oregon" (the template appends the single canonical brand suffix).
--
--   2. old-bend seo_description carried the banned real-estate cliche "Charming"
--      (brand-voice violation, live in the Google snippet). The code guard
--      (neighborhood page bannedDescRe) already falls back; this fixes the source.

update public.neighborhoods
set seo_title = split_part(seo_title, ' | ', 1) || ' in Bend, Oregon'
where seo_title ilike '%ryan realty%';

update public.neighborhoods
set seo_description = replace(seo_description, 'Charming', 'Established')
where slug = 'old-bend';
