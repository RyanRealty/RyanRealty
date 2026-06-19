-- Asset library: re-tag + approve the per-location Area Guide videos so the site
-- can serve each location its own guide video.
--
-- The 162 "Area Guide - <Location> - ..." marketing cuts (covering 79 locations)
-- were in the library but tagged generically (geo: central-oregon) + unapproved
-- (intake), so getSurfaceVideo could not serve them per location. Parse the
-- location from the note ("Ingested from Google Drive (Area Guide - Bend - ...)"),
-- slugify it to the site geo slug, set geo_tags = [<slug>, central-oregon], mark
-- approved, and add the 'area-guide' surface tag. These are finished marketing
-- cuts (voiceover/overlays) -> they serve the area-guide VIDEO slot (click-to-play
-- with audio), never a silent hero.

update public.asset_library
set
  geo_tags = array[
    trim(both '-' from lower(regexp_replace(substring(notes from 'Area Guide - (.+?) -'), '[^a-zA-Z0-9]+', '-', 'g'))),
    'central-oregon'
  ],
  approval = 'approved',
  surface_tags = (select array_agg(distinct t) from unnest(coalesce(surface_tags, '{}') || array['area-guide']) t)
where type = 'video'
  and notes ilike '%Area Guide -%'
  and substring(notes from 'Area Guide - (.+?) -') is not null
  and trim(both '-' from lower(regexp_replace(substring(notes from 'Area Guide - (.+?) -'), '[^a-zA-Z0-9]+', '-', 'g'))) <> ''
  and file_url is not null;
