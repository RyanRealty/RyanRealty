---
name: asset-library
description: >
  Single source of truth for every photo, video clip, audio file, and rendered MP4
  in the Ryan Realty media pipeline. Backed by Supabase Postgres (queryable index)
  and Supabase Storage (durable file store) with a local filesystem cache for
  build speed. Use this skill when the user says "check the asset library",
  "register this asset", "reuse the X photo", "what photos do we have for Bend",
  "ingest from Drive", "add this folder from Rich", or whenever a content build
  needs to fetch or store media.  because asset-library-FIRST is the default
  sourcing rule. If you are about to call an external API (Unsplash, Shutterstock,
  Pexels, Pixabay, Replicate, Vertex, etc.) to obtain a photo or video, check the
  asset library first. Use this skill also when a build fails on a photo-diversity
  assertion, when you need to track license costs, when ingesting a Drive folder
  Matt sends ("Here are the photos from Rich"), or when Matt asks "what do we
  have" for any media type. The library auto-registers every fetched stock photo,
  every generated AI image, every downloaded stock video, and every rendered MP4
  the pipeline produces.  closing the loop so future builds find them.
---

# Asset Library.  Ryan Realty

## Canonical references

This is a capability skill. The two top-tier rule layers.  [`design_system/ryan-realty/SKILL.md`](. /. /design_system/ryan-realty/SKILL.md) (brand) and [`social_media_skills/platform-best-practices/SKILL.md`](. /. /social_media_skills/platform-best-practices/SKILL.md) (platform rules).  apply to all output. Per CLAUDE.md "Skill self-binding", every Ryan Realty content piece loads both before producing.

---

**Version:** 1.0.  Authored 2026-05-07  
**Cross-references:** `media-sourcing/SKILL.md`, `market-data-video/SKILL.md`

---

## What the asset library is

A local manifest + filesystem store that tracks every media asset the team has
ever fetched, generated, or rendered. It de-duplicates external API calls (cost
saver), enforces photo diversity (no repeats in a render), and carries license
metadata so production compliance is auditable.

The library is the answer to: "Do we already have a good Pilot Butte photo, or
do we need to call Unsplash again?"

---

## Architecture (Supabase-backed, local cache)

```
PRIMARY (cloud, durable)
  Postgres table:  public.asset_library      ← queryable index, 30+ columns
  Storage bucket:  asset-library             ← public-read file store
  CDN URLs:        https://<project>.supabase.co/storage/v1/object/public/asset-library/<path>

CACHE (local, fast)
  data/asset-library/manifest.json           ← mirror of Postgres for offline builds
  data/asset-library/schema.json             ← schema doc for human reference
  public/asset-library/<type>/<source>/<file> ← cached copies of recently-used assets

FALLBACK (when offline)
  When Supabase is unreachable, search() reads the local manifest. register()
  still writes the file locally + queues a manifest entry. Next time the
  cloud is reachable, run `node lib/asset-library.mjs sync` to backfill.
```

**Postgres table layout** (every column tracked):

```
identity:   id, type, source, source_id, license, license_metadata
attribution: creator, creator_url
storage:    storage_bucket, storage_object_path, file_url, file_size_bytes
tags:       geo_tags[], subject_tags[], search_query
media:      width, height, duration_sec
lifecycle:  registered_at, last_used_at, used_in[]
curation:   approval, notes
```

**Storage object path pattern:** `{type}s/{source}/{uuid}.{ext}`

Examples:
```
photos/shutterstock/abc-123.jpg
photos/unsplash/c3f3-abcd.jpg
videos/pexels/8501234.mp4
videos/renders/bend-2026-04-short.mp4
audio/elevenlabs:bend:2026-05-07/voiceover.mp3
```

---

## Schema.  key fields per asset record

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Stable identifier. Used in `markUsed()` calls. |
| `type` | string | `photo` / `video` / `audio` / `render` |
| `source` | string | `unsplash` / `shutterstock` / `pexels` / `generated-replicate` / `render` |
| `source_id` | string | Original API ID (Unsplash photo ID, Shutterstock image ID, etc.) |
| `license` | string | `unsplash` / `shutterstock` / `pexels` / `cc0` / `proprietary` |
| `license_metadata` | object | `license_required`, `preview_only`, `license_cost_usd`, `license_id` |
| `creator` | string | Photographer / model credit |
| `creator_url` | string | Link to photographer profile |
| `file_path` | string | Repo-relative path to the downloaded file |
| `geo_tags` | string[] | e.g. `["bend", "central-oregon", "oregon"]` |
| `subject_tags` | string[] | e.g. `["mountain", "river", "sunset"]` |
| `search_query` | string | The query that surfaced this asset |
| `width` / `height` | number | Pixels |
| `registered_at` | ISO string | When first added |
| `last_used_at` | ISO string | When last copied into a render |
| `used_in` | array | `{ render_path, scene_id, render_type, used_at }` per use |
| `approval` | string | `approved` / `intake` / `rejected` / `expired` |

Full schema: `data/asset-library/schema.json`.

---

## Approval states

| State | Meaning |
|---|---|
| `approved` | Ready to use in production renders. Free assets (Unsplash, Pexels) auto-approve on registration. |
| `intake` | Fetched but pending review. Shutterstock previews land here (watermarked; need license before production). |
| `rejected` | Failed QA.  wrong geography, people-as-subject, off-brand. Excluded from search results by default. |
| `expired` | License term ended or asset removed from source. Do not use. |

---

## Programmatic API (ESM import)

```js
import { search, register, markUsed, stats } from './lib/asset-library.mjs'

// Search
const photos = await search({
  geo: ['bend'],          // any-match against geo_tags
  type: 'photo',
  limit: 20,
  unusedOnly: true,       // exclude assets used in last 30 days
})

// Register a newly downloaded file
const asset = await register('/abs/path/to/file.jpg', {
  type: 'photo',
  source: 'shutterstock',
  source_id: '123456789',
  license: 'shutterstock',
  license_metadata: { license_required: true, preview_only: true },
  creator: 'Jane Smith',
  geo: ['bend', 'central-oregon'],
  subject: ['mountain', 'snow'],
  search_query: 'mount bachelor oregon',
  width: 1920, height: 1080,
  approval: 'intake',
})

// Record usage in a render
await markUsed(asset.id, {
  render_path: 'out/bend/market-report.mp4',
  scene_id: 'img_3',
  render_type: 'market-report',
})

// Library-wide stats
const s = await stats()
// { total_assets, by_type, by_source, by_license, total_usages, total_license_cost_usd }
```

---

## CLI

```bash
# Search by city + type
node lib/asset-library.mjs search --geo bend --type photo --tags "smith-rock"

# Search unused-only (for diversity-safe render)
node lib/asset-library.mjs search --geo bend --type photo --unused-only

# Register a file
node lib/asset-library.mjs register public/asset-library/photos/pexels/12345.jpg \
  --type photo --source pexels --source-id 12345 --license pexels \
  --geo "bend,central-oregon" --subject "mountain,river" \
  --search-query "bend oregon landscape" --creator "Jane Doe" \
  --width 4000 --height 6000

# Mark used in a render
node lib/asset-library.mjs mark-used <asset-id> \
  --render out/bend/market-report.mp4 --scene img_3 --render-type market-report

# Library stats
node lib/asset-library.mjs stats

# List recent additions
node lib/asset-library.mjs list --recent 20 --type photo
```

---

## Asset-library-FIRST sourcing principle

Every video, blog post, or ad build MUST query the asset library before calling
any external API. This saves API quota, avoids re-licensing the same Shutterstock
image twice, and prevents photo repeats within a render.

**Decision order:**
1. `search({ geo: [city], type: 'photo', unusedOnly: true, limit: 50 })`  
   If ≥ N unused approved photos found → use them, skip external fetch.
2. Otherwise → run `scripts/fetch-photos.mjs <city>` which fans out to:  
   Shutterstock (previews, `intake`) → Pexels (free, `approved`) → Unsplash (free, `approved`)
3. Re-query the library → now has new arrivals → pick top N.

The orchestrator for this is `video/market-report/scripts/fetch-photos.mjs`.

---

## How fetched photos reach a render

1. `fetch-shutterstock.mjs` / `fetch-pexels.mjs` / `fetch-unsplash.mjs` each
   download files to `public/asset-library/photos/<source>/` and call
   `register()` with full metadata.
2. `fetch-photos.mjs` (the orchestrator) calls `search()`, copies the top N
   files to `video/market-report/public/<slug>/img_1.jpg.. img_N.jpg` (the
   naming convention `build-cities.mjs` expects), and calls `markUsed()`.
3. `build-cities.mjs` calls `assignPhotoSlots()` which enforces the no-repeat
   rule via a `Set` diversity assertion.  throws rather than silently duping.

---

## How rendered MP4s get registered

After a Remotion render is approved and moved from `out/` to
`public/v5_library/`, the finalization step registers the output:

```js
await register('public/v5_library/bend-market-report-may-2026.mp4', {
  type: 'render',
  source: 'render',
  license: 'proprietary',
  geo: ['bend'],
  subject: ['market-report'],
  approval: 'approved',
})
```

This lets the pipeline find rendered outputs for repurposing (thumbnail
extraction, YouTube upload, clip trimming) without scanning the filesystem.

---

## Cost tracking

Shutterstock assets carry `license_metadata.license_cost_usd` once licensed.
`stats()` returns `total_license_cost_usd`.  the running total across all
licensed assets. This feeds the monthly media cost report.

Pexels and Unsplash are free; their records carry `license_required: false`.

Shutterstock preview fetches (`approval: 'intake'`) are NOT production-usable
until licensed via the Shutterstock `/v2/images/licenses` endpoint and the
record is updated to `approval: 'approved'` with the license ID.

---

## Google Drive ingestion

When Matt sends photos / videos from Rich (or any Drive folder), use
`lib/drive-ingest.mjs` to bulk-import directly into the asset library.

**CLI:**

```bash
# Bulk-import every file in a Drive folder (recursive by default)
node --env-file=.env.local lib/drive-ingest.mjs \
  --folder "https://drive.google.com/drive/folders/1abc_XYZ" \
  --geo "bend,old-mill" \
  --subject "drone,aerial" \
  --source curated \
  --license owned \
  --approval approved

# Single file
node --env-file=.env.local lib/drive-ingest.mjs \
  --file "https://drive.google.com/file/d/1xyz/view" \
  --type photo \
  --geo "bend"

# Dry-run to see what's in a folder before ingesting
node --env-file=.env.local lib/drive-ingest.mjs --folder <id> --dry-run
```

**What happens:**
1. JWT-authenticates against the Google service account (`GOOGLE_SERVICE_ACCOUNT_*`)
2. Lists every file in the folder (recursive.  descends into subfolders)
3. For each file, infers type from MIME / extension (photo / video / audio)
4. Downloads to `/tmp/rr-drive-ingest/<uuid>.<ext>`
5. Calls `register()`.  uploads to Storage, inserts the row, links source_id `drive:<file-id>` for future dedup
6. Carries Drive metadata into `license_metadata.drive_file_id` so we can trace back

**The service account must have read access to the folder.** Either:
- Matt shares the folder with the service account email (`<account>@ryan-realty-tc.iam.gserviceaccount.com`)
- Or the folder is in a shared drive the service account is a member of

**Tagging strategy on ingest:**
- `--geo` accepts CSV: `--geo "bend,old-mill,deschutes-river"`.  every ingested file gets all the tags
- `--subject` same: `--subject "exterior,architecture,evening-light"`
- For mixed folders, ingest in batches with different tags. E.g. all of `Bend Listings/123 Main St/exterior/` gets `--geo "bend" --subject "exterior,123-main-st"`

## Auto-registration (closing the loop)

Every script that produces a media asset registers it automatically:

| Producer | Script | Registers as |
|---|---|---|
| ElevenLabs voiceover | `video/market-report/scripts/synth-vo.mjs` | `type=audio, source=elevenlabs` |
| Remotion render | `video/market-report/scripts/register-render.mjs` (called after `npx remotion render`) | `type=render, source=render-output, approval=intake` (Matt approves before publish) |
| Stock photo fetch | `fetch-unsplash.mjs`, `fetch-pexels.mjs`, `fetch-shutterstock.mjs` | `type=photo, source=<provider>` |
| Stock video fetch | `fetch-pexels-video.mjs`, `fetch-pixabay-video.mjs`, `fetch-shutterstock-video.mjs` | `type=video, source=<provider>` |
| AI image generation | (future: wrap Imagen / Nano Banana / FLUX call) | `type=photo, source=generated-<model>` |
| AI video generation | (future: wrap Kling / Veo / Hailuo call) | `type=video, source=generated-<model>` |
| Drive ingest | `lib/drive-ingest.mjs` | `type=<inferred>, source=curated, source_id=drive:<file-id>` |

**The rule:** if you write a new script that fetches or generates a media file, register it into the asset library before exiting. Otherwise the next build won't find it and we'll re-fetch (waste cost + hit rate limits).

## Cross-references

- `media-sourcing/SKILL.md` §1.5.  asset-library is the canonical first lookup
  before any external source in every sourcing decision.
- `market-data-video/SKILL.md` §20.  photo diversity rule (no repeats per
  render) enforced by `assignPhotoSlots()` which reads image slots from library.
- `market-data-video/SKILL.md` §21.  Shutterstock integration roadmap
  (Matt's go/no-go on production licensing pending).
- `video/market-report/scripts/fetch-photos.mjs`.  the asset-library-FIRST
  orchestrator for market-report photo pipelines.
