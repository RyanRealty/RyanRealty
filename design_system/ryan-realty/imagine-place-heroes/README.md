# Imagine place heroes (2026-08-21)

Grok Imagine originals for Ryan Realty place pages.

- **Shared bot computer:** `/workspace/place-heroes/` (same files)
- **This folder:** `design_system/ryan-realty/imagine-place-heroes/`
- **Live home when shipped:** Supabase Storage + `public.asset_library` (`file_url`, `geo_tags`, `subject_tags`, `surface_tags` hero/card, `approval=approved`, `vision_grade` A/B). Place pages resolve via `getGeoTileImages` / `getSurfaceImages`.

Do not invent a new bucket. Files are large (~256MB); keep binaries on the shared computer / Storage, not as a casual git dump unless LFS is set.

Naming: `city-*.png`, `neighborhood-*.png`, `community-*.png`, `sub-tetherow-*.png`. The Glen bright set is in `bright/`.
