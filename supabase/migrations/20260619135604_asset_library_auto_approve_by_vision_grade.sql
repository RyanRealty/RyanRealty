-- Asset library: auto-approve good-graded geo photos so the site can use them.
--
-- Matt directive 2026-06-19: the Area Guide library is fully ingested (1,215
-- assets) but only ~37 are used — 812 sat UNAPPROVED so getSurfaceImage could not
-- serve them. Auto-approve the vision-screen-good (grade A/B), geo-tagged photos
-- so each location's hero/card surfaces can draw from its own footage. C-grade +
-- ungraded stay pending (curate manually in /admin/photos). Content notes in the
-- Area Guide Status sheet ("no homes / focus on park") are about subject, not
-- photo quality — a scenic/park still is a fine hero, so vision grade is the gate.

-- 1. Approve the good-graded, geo-tagged area-guide photos.
update public.asset_library
set approval = 'approved'
where type = 'photo'
  and vision_grade in ('A', 'B')
  and array_length(geo_tags, 1) > 0
  and approval <> 'approved';

-- 2. Card surface: every approved good geo photo is card-eligible.
update public.asset_library
set surface_tags = (select array_agg(distinct t) from unnest(coalesce(surface_tags, '{}') || array['card']) t)
where type = 'photo'
  and vision_grade in ('A', 'B')
  and array_length(geo_tags, 1) > 0
  and approval = 'approved'
  and not ('card' = any(coalesce(surface_tags, '{}')));

-- 3. Hero surface: only the BEST (grade A) also serves as a hero (heroes are
--    picky — keep the bar high so geo heroes stay strong).
update public.asset_library
set surface_tags = (select array_agg(distinct t) from unnest(coalesce(surface_tags, '{}') || array['hero']) t)
where type = 'photo'
  and vision_grade = 'A'
  and array_length(geo_tags, 1) > 0
  and approval = 'approved'
  and not ('hero' = any(coalesce(surface_tags, '{}')));
