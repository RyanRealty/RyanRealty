-- Cost of living and property tax guides: titles and metas that carry the questions Search
-- Console shows people ask (SEO & AEO Desk brief 2026-10-08, GSC low-CTR pages, 6.4 and 6.5).
-- Matt's OK is required before merge. Each seo_title is held to 46 (the layout appends
-- " | Ryan Realty"); each seo_description is 155 or less and uses only figures already on
-- the page (Oregon DOR 2026 income tax rates; DOR FY 2025-26 Deschutes rate and effective
-- rate; Deschutes County 2026 due date and 3% discount). The H1 / title column is untouched
-- (scripts/check-aeo-hub-guides.mjs). scripts/blog-content/aeo-guides-2026-09.ts carries the
-- same values, so `npx tsx scripts/seed-blog-posts.ts --only aeo-guides-2026-09` keeps them.
-- Idempotent. To revert, run the REVERT block at the end of this file.

update public.blog_posts as b set seo_title = v.seo_title, seo_description = v.seo_description, updated_at = b.updated_at
from (values
  ('cost-of-living-bend-oregon', 'Is Bend, Oregon Expensive? Cost of Living 2026', 'Housing is the cost that decides whether Bend works. Live home prices, Oregon''s no-sales-tax and 4.75%-9.9% income tax trade, utilities, and a budget.'),
  ('property-taxes-deschutes-county', 'Bend Property Taxes: Deschutes Rate, Due Dates', 'Deschutes County averages $16.80 per $1,000 of assessed value, about 0.7% of market value. 2026 bills are due Nov. 16; pay in full for a 3% discount.')
) as v(slug, seo_title, seo_description)
where b.slug = v.slug;

-- REVERT
-- update public.blog_posts as b set seo_title = v.seo_title, seo_description = v.seo_description, updated_at = b.updated_at
-- from (values
--   ('cost-of-living-bend-oregon', 'Cost of Living in Bend, Oregon (2026)', 'What it costs to live in Bend: live housing numbers, Oregon income and property tax rules, insurance, utilities, and how to build a budget before you tour.'),
--   ('property-taxes-deschutes-county', 'Property Taxes in Bend and Deschutes County', 'How Oregon property tax works in Deschutes County: assessed vs market value under Measure 50, the DIAL lookup, the November 15 calendar, and relief programs.')
-- ) as v(slug, seo_title, seo_description)
-- where b.slug = v.slug;
