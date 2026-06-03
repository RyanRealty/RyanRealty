-- asset_library.surface_tags — approved display surfaces (hero / card) for the
-- photo-curation system. Set by the vision screen + the /admin/photos board;
-- consumed by getSurfaceImage to pick banner vs tile imagery per page so heroes
-- stop repeating site-wide. Additive + idempotent.
alter table public.asset_library
  add column if not exists surface_tags text[] default '{}';

comment on column public.asset_library.surface_tags is
  'Approved display surfaces: hero, card. Set by the vision screen; used by getSurfaceImage to pick banner vs tile imagery.';

-- GIN index so the contains() filter in getSurfaceImages stays fast as the
-- approved pool grows.
create index if not exists asset_library_surface_tags_gin
  on public.asset_library using gin (surface_tags);
