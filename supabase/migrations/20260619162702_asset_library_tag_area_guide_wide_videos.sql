-- Mark the landscape (16x9) area-guide cuts with surface_tag 'area-guide-wide'
-- so getAreaGuideVideo prefers them over the portrait 9x16 socials (which only
-- letterbox in the 16:9 player). Applied to hosted Supabase 2026-06-19.
update public.asset_library
set surface_tags = (select array_agg(distinct t) from unnest(coalesce(surface_tags, '{}') || array['area-guide-wide']) t)
where type = 'video'
  and 'area-guide' = any(surface_tags)
  and (notes ilike '%16x9%' or notes ilike '%youtube%' or notes ilike '%landscape%')
  and not ('area-guide-wide' = any(coalesce(surface_tags, '{}')));
