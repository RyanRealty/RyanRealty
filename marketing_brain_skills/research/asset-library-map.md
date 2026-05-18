# Asset library map

**Phase 2.5 research bible · Ryan Realty autonomous marketing pipeline**
Written: 2026-05-16 · Author: pipeline orchestrator agent
Canonical path: `marketing_brain_skills/research/asset-library-map.md`

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Storage location A: Supabase Storage bucket `asset-library`](#2-storage-location-a-supabase-storage-bucket-asset-library)
3. [Storage location B: local manifest at `data/asset-library/manifest.json`](#3-storage-location-b-local-manifest)
4. [Storage location C: `video_production_skills/asset-library/SKILL.md` producer contract](#4-storage-location-c-asset-library-skill)
5. [Storage location D: `lib/asset-library.mjs` programmatic API](#5-storage-location-d-libasset-librarymjs)
6. [Storage location E: `public/list-kits/<address>/v3/`](#6-storage-location-e-publiclist-kits)
7. [Storage location F: `out/proof/<date>/` in-flight artifacts](#7-storage-location-f-outproofdate)
8. [Storage location G: AgentFire WordPress media library](#8-storage-location-g-agentfire-wordpress-media-library)
9. [Storage location H: Google Business Profile media library](#9-storage-location-h-google-business-profile-media-library)
10. [Storage location I: `listing_video_v4/public/`](#10-storage-location-i-listing_video_v4public)
11. [Storage location J: `listing_video_v4/out/`](#11-storage-location-j-listing_video_v4out)
12. [Storage location K: `design_system/ryan-realty/assets/`](#12-storage-location-k-design_systemryan-realtyassets)
13. [Schema upgrade recommendations (Phase 4.6 §7)](#13-schema-upgrade-recommendations)
14. [Reuse query patterns for producers](#14-reuse-query-patterns-for-producers)
15. [Recommended canonical store and migration path](#15-recommended-canonical-store-and-migration-path)
16. [Producer reuse contract (summary)](#16-producer-reuse-contract)

---

## 1. Executive summary

Ryan Realty's content pipeline currently stores assets across eleven distinct locations. Seven of these are reachable by producers at build time. Four are gitignored scratch areas. None share a single query interface. The result is that the same Bend landscape photo gets re-fetched from Unsplash on every market-report build, rendered videos cannot be discovered by the repurpose engine, and performance data has no path back to the asset that earned it.

The canonical solution is to treat the Supabase Postgres table `public.asset_library` backed by the Supabase Storage bucket `asset-library` as the single source of truth, with `data/asset-library/manifest.json` as a read-only offline cache. Every other location (list-kits, listing_video_v4, design_system, AgentFire, GBP) is either a delivery surface or an upstream input, not a peer store.

That unification is Phase 15 of this brief. Until that migration is complete, producers must follow the lookup order defined in section 16.

---

## 2. Storage location A: Supabase Storage bucket `asset-library`

### What it is

The primary durable file store for all Ryan Realty content pipeline assets. Hosted at Supabase project `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`). The bucket is named `asset-library` and is public-read on approved assets.

### Verified existence

The bucket exists and was used in production on 2026-05-14. Confirmed via `out/proof/2026-05-14/publish-status.json` which contains public URLs of the form:

```
https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/social-drops/2026-05-14/<property>/<file>
```

Properties published in that run: `schoolhouse`, `beaumont`, `saghali`, `simpson`. Files per property: `carousel-1.jpg` through `carousel-6.jpg` (schoolhouse) or `carousel-1.jpg` through `carousel-3.jpg` (others), `hero.jpg`, `reel.mp4`, `reel-cover.jpg`.

### Object path patterns (two conventions in use)

**Convention 1: asset-library-SKILL (media inputs)**

Used by `lib/asset-library.mjs` for photos, videos, and audio fetched from external sources. The pattern is:

```
{type}s/{source}/{uuid}.{ext}
```

Examples from code:
```
photos/shutterstock/abc-123.jpg
photos/unsplash/c3f3-abcd.jpg
videos/pexels/8501234.mp4
audio/elevenlabs/voiceover.mp3
videos/renders/bend-2026-04-short.mp4
```

Source values come from the `schema.json` enum: `shutterstock`, `unsplash`, `pexels`, `pixabay`, `curated`, `generated-imagen`, `generated-flux`, `generated-kling`, `generated-veo`, `generated-hailuo`, `generated-seedance`, `generated-wan`, `generated-luma`, `render-output`, `supabase-listing`, `earth-studio`, `elevenlabs-sfx`, `synthesia`.

**Convention 2: social-drops (published delivery artifacts)**

Used by `scripts/publish-2026-05-14-rollout.mjs` for the ready-to-publish content packets. Pattern:

```
social-drops/{YYYY-MM-DD}/{property-slug}/{file}
```

The `property-slug` matches the address slug used in `public/list-kits/`. File types per slot:
- `hero.jpg`: single-image IG / FB post asset
- `carousel-{n}.jpg`: IG / FB carousel frames, 1-indexed
- `reel.mp4`: vertical 9:16 reel
- `reel-cover.jpg`: reel cover thumbnail

The `DROP_PREFIX` constant in `scripts/publish-2026-05-14-rollout.mjs` is `social-drops/2026-05-14`, confirming the date-keyed structure.

### Supabase Postgres table: `public.asset_library`

Referenced throughout `lib/asset-library.mjs` (the `insertRow`, `searchSupabase`, `appendUsageSupabase` functions). The table is queried via PostgREST at `/rest/v1/asset_library`. An upsert conflict target of `source,source_id` is used (`?on_conflict=source,source_id`), meaning the table has a unique constraint on those two columns.

No migration file for this table was found in `supabase/migrations/` during this build. The table was created outside the tracked migration sequence, likely via the Supabase dashboard or a one-off SQL run. This is a gap noted in section 13.

### Who writes

- `lib/asset-library.mjs register()`: every producer that fetches a new media asset
- `scripts/publish-2026-05-14-rollout.mjs uploadToSupabase()`: the publish rollout script (writes to `social-drops/` prefix, not to the `{type}s/{source}/` prefix)
- `lib/drive-ingest.mjs`: bulk ingest from Google Drive folders

### Who reads

- `lib/asset-library.mjs search()`: any producer querying for reusable assets
- The social publish API (`/api/social/publish`): reads URLs from Supabase Storage to attach native media to platform posts
- `scripts/publish-2026-05-14-rollout.mjs`: reads the public URL returned after upload and passes it to platform APIs

### Retention policy

No TTL or automated deletion policy is documented in the skill or codebase. Assets in `social-drops/` are permanent once uploaded (no expiry set). Assets in `{type}s/{source}/` remain until manually removed or the bucket is cleared. The approval field (`approved`, `intake`, `rejected`, `expired`) in the Postgres row governs production eligibility, but does not trigger deletion.

### Reuse query pattern

```js
import { search } from './lib/asset-library.mjs'

const photos = await search({
  geo: ['bend'],
  type: 'photo',
  approval: 'approved',
  unusedOnly: true,
  limit: 20,
})
// Returns rows from public.asset_library via PostgREST with file_url populated
```

The `unusedOnly: true` flag filters to assets where `last_used_at` is null or older than 30 days, enforcing photo diversity across renders.

---

## 3. Storage location B: local manifest

**Path:** `data/asset-library/manifest.json`
**Size observed:** 1,527 lines, approximately 52 KB

### Schema (from `data/asset-library/schema.json`)

The manifest is a JSON envelope with four top-level keys:

```json
{
  "version": 1,
  "schema_version": 1,
  "updated_at": "2026-05-13T19:36:18.998Z",
  "description": "...",
  "assets": [ ...AssetRecord[] ]
}
```

Each `AssetRecord` has the following fields as documented in `data/asset-library/schema.json`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID v4 | yes | Stable identifier. Generated at registration. |
| `type` | enum | yes | `photo`, `video`, `audio`, `render` |
| `source` | enum | yes | 20 possible values including `shutterstock`, `unsplash`, `pexels`, `curated`, `render-output` |
| `source_id` | string | no | Source's own ID (Unsplash photo_id, Shutterstock image ID, etc.) |
| `license` | enum | no | `shutterstock`, `unsplash`, `pexels`, `pixabay`, `royalty-free`, `generated`, `owned`, `mls` |
| `license_metadata` | object | no | Tracks `license_id`, `license_cost_usd`, `license_required`, `preview_only` |
| `creator` | string | no | Photographer name or AI model |
| `creator_url` | string | no | Photographer profile link |
| `file_path` | string | yes | Repo-relative path, e.g. `public/asset-library/photos/unsplash/<uuid>.jpg` |
| `file_url` | string | no | Public CDN URL if available |
| `geo_tags` | string[] | no | Lowercase kebab-case, e.g. `["bend", "central-oregon", "smith-rock"]` |
| `subject_tags` | string[] | no | Content tags, e.g. `["mountain", "snow", "aerial"]` |
| `search_query` | string | no | Query that surfaced this asset (provenance trace) |
| `width` | integer | no | Pixels |
| `height` | integer | no | Pixels |
| `duration_sec` | number | no | For video/audio only |
| `registered_at` | ISO string | yes | When first added |
| `last_used_at` | ISO string | no | When last used in a render |
| `used_in` | array | no | Array of `{render_path, scene_id, render_type, used_at}` per use |
| `approval` | enum | no | `approved`, `intake`, `rejected`, `expired` |
| `notes` | string | no | Free-form curation notes |

### Current asset counts (verified from manifest.json)

As of 2026-05-13T19:36:18 (the manifest's `updated_at`):

- Total assets: 40
- By type: photo (16), video (24)
- By source: unsplash (12), wikimedia (3), stock (25)
- By approval: approved (40), intake (0), rejected (0), expired (0)

Note: the `source` enum in `schema.json` does not include `wikimedia` or generic `stock`, but these appear in the actual manifest data. The manifest has drifted from the schema. This is a gap to address in the Phase 4.6 upgrade.

### Who writes

`lib/asset-library.mjs register()` writes every newly registered asset to the local manifest as an offline cache after attempting the Supabase insert. `lib/asset-library.mjs markUsed()` appends to each record's `used_in` array locally.

### Who reads

`lib/asset-library.mjs search()` reads the local manifest as a fallback when Supabase is unreachable. The CLI (`node lib/asset-library.mjs list`) reads the manifest for the `list` command.

### Retention policy

The manifest is a running log. Records are never deleted. De-dup is handled at insert time by checking `source + source_id` against existing records. Stale records (e.g., pointing to files that no longer exist on disk) are not pruned automatically.

### Naming convention

Assets on disk follow: `public/asset-library/{type}s/{source}/{uuid}.{ext}` where `uuid` is the value stored as `id` in the manifest record. This means the local file system layout and the Supabase Storage object path use the same relative path under their respective roots.

---

## 4. Storage location C: asset-library SKILL

**Path:** `video_production_skills/asset-library/SKILL.md`

This is not a storage location. It is the operational contract that governs how producers interact with the library. It is documented here because every producer that touches media must load it before executing.

### How producers query the manifest (from the SKILL)

The SKILL defines a three-step decision process:

1. Call `search({ geo: [city], type: 'photo', unusedOnly: true, limit: 50 })`. If 50 or more unused approved photos are found, use them and skip all external API calls.
2. If fewer than 50 are found, run `scripts/fetch-photos.mjs <city>` which fans out to Shutterstock (preview, `intake`), then Pexels (free, `approved`), then Unsplash (free, `approved`).
3. Re-query the library and pick the top N.

The orchestrator for step 2 is `video/market-report/scripts/fetch-photos.mjs`.

### Auto-registration table (from the SKILL)

| Producer | Script | Registers as |
|---|---|---|
| ElevenLabs voiceover | `video/market-report/scripts/synth-vo.mjs` | `type=audio, source=elevenlabs` |
| Remotion render | `video/market-report/scripts/register-render.mjs` | `type=render, source=render-output, approval=intake` |
| Unsplash photo fetch | `fetch-unsplash.mjs` | `type=photo, source=unsplash` |
| Pexels photo fetch | `fetch-pexels.mjs` | `type=photo, source=pexels` |
| Shutterstock photo fetch | `fetch-shutterstock.mjs` | `type=photo, source=shutterstock, approval=intake` |
| Pexels video fetch | `fetch-pexels-video.mjs` | `type=video, source=pexels` |
| Drive ingest | `lib/drive-ingest.mjs` | `type=<inferred>, source=curated, source_id=drive:<file-id>` |
| AI image generation | (planned) | `type=photo, source=generated-<model>` |
| AI video generation | (planned) | `type=video, source=generated-<model>` |

### Core rule

The SKILL establishes "asset-library-FIRST" as the default sourcing principle: no producer may call an external API (Unsplash, Shutterstock, Pexels, Replicate, Kling, Veo, etc.) without first querying the library and confirming no suitable reusable asset exists.

---

## 5. Storage location D: `lib/asset-library.mjs`

**Path:** `lib/asset-library.mjs`

This is the single programmatic interface for all asset library operations. It is an ESM module with four named exports and a CLI runner.

### Exports

**`search(opts)`**

Searches Supabase Postgres first, falls back to local manifest if cloud is unavailable.

```typescript
interface SearchOpts {
  geo?: string[]        // any-match against geo_tags (PostgREST ov filter)
  subject?: string[]    // any-match against subject_tags
  type?: string         // 'photo' | 'video' | 'audio' | 'render'
  source?: string       // e.g. 'unsplash', 'shutterstock'
  approval?: string     // 'approved' | 'intake' | 'rejected' | 'expired'
  limit?: number        // default 20
  unusedOnly?: boolean  // excludes assets where last_used_at < 30 days ago
}
```

Returns an array of asset records. Empty array if no match.

**`register(filePath, meta)`**

Dual-writes to Supabase Storage (uploads the file), Supabase Postgres (upserts the row), and the local manifest cache. De-duplication is checked before insertion using `source + source_id`. Returns the asset record.

The function computes the storage object path as the relative path from `ASSETS_ROOT` (`public/asset-library/`) to the copied file. So the object path in Storage mirrors the local cache layout exactly.

**`markUsed(assetId, usage)`**

Appends a usage record to the row's `used_in` array in Supabase Postgres using a read-modify-write operation, then mirrors the update to the local manifest. Updates `last_used_at`. Returns the updated asset record.

```typescript
interface Usage {
  render_path: string    // e.g. 'out/bend/market-report.mp4'
  scene_id?: string      // e.g. 'img_3', 'intro'
  render_type?: string   // 'short-form' | 'youtube-long-form' | 'blog-post' | 'facebook-ad' | 'other'
}
```

**`stats()`**

Reads the local manifest and returns aggregate counts. Supabase is not queried (this is a local-only operation). Returns:

```typescript
interface StatsResult {
  total_assets: number
  by_type: Record<string, number>
  by_source: Record<string, number>
  by_license: Record<string, number>
  total_usages: number
  total_license_cost_usd: number
  last_updated: string
}
```

### CLI commands

```
node lib/asset-library.mjs search --geo bend --type photo --unused-only
node lib/asset-library.mjs register <file> --type photo --source pexels ...
node lib/asset-library.mjs mark-used <asset-id> --render <path> --scene <id>
node lib/asset-library.mjs stats
node lib/asset-library.mjs list --recent 20 --type photo
```

### Supabase client initialization

The client is lazy-initialized via `getSupabase()`. It requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. If either is absent, `getSupabase()` returns null and all cloud operations silently degrade to local-manifest-only mode. This is the intended offline fallback behavior.

### Storage constants

```js
const STORAGE_BUCKET = 'asset-library'       // bucket name
const MANIFEST_PATH = 'data/asset-library/manifest.json'
const ASSETS_ROOT = 'public/asset-library'   // local cache root
```

---

## 6. Storage location E: `public/list-kits/`

**Path:** `public/list-kits/`
**Git tracked:** yes (these are committed build artifacts, served by Next.js)

### Existing kits (verified via `ls`)

```
public/list-kits/
  beaumont/
    captions/
      beaumont-ig.md
    v3/
      pattern-b/
        hero-overlay.jpg
      pattern-d/
        panorama-1.jpg
        panorama-2.jpg
        panorama-3.jpg
        panorama-full-preview.jpg
      single-image/
        under-contract.jpg
```

Only one kit (`beaumont`) exists under `public/list-kits/`. The Tumalo Reservoir list kit (`19496-tumalo-reservoir`) is located under `out/list-kits/` (gitignored) and a mirror at `public/template-picker/list-kits/19496-tumalo-reservoir/` (confirmed by `scripts/render-tumalo-flyers.js`).

### Naming convention

`public/list-kits/{address-slug}/v{n}/{pattern-name}/{file}`

- `address-slug`: kebab-case street address, e.g. `beaumont`, `19496-tumalo-reservoir`
- `v{n}`: kit version, currently `v3`
- `{pattern-name}`: layout variant: `pattern-b`, `pattern-d`, `single-image`
- `{file}`: image filename, e.g. `hero-overlay.jpg`, `panorama-1.jpg`

### Who writes

Python generator scripts in `scripts/` (e.g. `build_tumalo_v3_kit.py`, `build_single_image_posts.py`, `build_tumalo_panorama_post.py`). These scripts also write to `out/list-kits/` first, then the approved outputs are moved to `public/list-kits/`.

### Who reads

- The Next.js app at `ryan-realty.com` (these files are statically served)
- The social publish rollout scripts (which generate the final `social-drops/` Supabase uploads from these source images)
- The contact sheet HTML at `out/proof/<date>/contact-sheet.html` embeds these paths for Matt's review

### Retention policy

Committed permanently. No TTL. Superseded kit versions (e.g., `v2`) would remain unless explicitly removed.

### Reuse query pattern

There is no programmatic query interface for list-kits. Producers locate assets by constructing the path directly:

```js
const heroPath = `public/list-kits/${addressSlug}/v3/single-image/hero-overlay.jpg`
```

This is a gap. List-kit assets are not registered in the asset library, meaning the `search()` API cannot discover them and the photo diversity check does not apply. This is flagged in the migration recommendation (section 15).

---

## 7. Storage location F: `out/proof/<date>/`

**Path:** `out/proof/<date>/`
**Git tracked:** no (gitignored)

### Purpose

Holds every in-flight and staging artifact for a dated publish run before Matt's approval and before uploading to Supabase Storage. This is the draft staging area mandated by the "Draft-First, Commit-Last" rule.

### Directory structure (verified from `out/proof/2026-05-14/`)

```
out/proof/2026-05-14/
  contact-sheet.html          contact sheet for Matt's review
  publish-plan.html           planning document
  publish-plan-v2.html
  publish-status.json         final post IDs after publish (the truth record)
  rebecca-email.md
  reels-spec.md
  research-broker-captions.md
  captions/
    beaumont-fb.md            per-property per-platform caption files
    beaumont-gbp.md
    beaumont-ig.md
    beaumont-linkedin.md
    beaumont-nextdoor.md
    beaumont-pinterest.md
    beaumont-threads.md
    beaumont-x.md
    schoolhouse-fb.md
    schoolhouse-gbp.md
  payloads/
    beaumont-pending.json
    schoolhouse-sold-intro.json
    schoolhouse-sold.json
  photos/
    beaumont
    beaumont_carousel
    saghali_src
    schoolhouse
    schoolhouse_carousel
    ...
  rendered/
    beaumont-carousel/
    beaumont-pending.png
    beaumont-v3/
    broker-cards/
    reels/
    saghali-v3/
    schoolhouse-carousel/
    schoolhouse-sold.png
    schoolhouse-v3/
    schoolhouse-video/
    simpson-v3/
```

### Naming convention

`out/proof/{YYYY-MM-DD}/{artifact}`

Artifacts can be flat files (captions, specs, status) or subdirectories (rendered output per property). The date must match the scheduled publish date.

### Who writes

The producer scripts and orchestrator run in this session. Python generators write rendered images to `rendered/`. Caption files are generated separately.

### Who reads

Matt reads `contact-sheet.html` to approve content. The publish script reads `captions/` and `rendered/` to assemble the Supabase upload payload.

### Retention policy

Gitignored. Retained indefinitely on the local machine. No automated cleanup.

### Reuse query pattern

Not queryable programmatically. Artifacts here are transient. Once Matt approves and the content is uploaded to Supabase Storage, the `out/proof/` copy becomes redundant. The source of truth after publication is `out/proof/<date>/publish-status.json`.

---

## 8. Storage location G: AgentFire WordPress media library

**Path (REST):** `https://ryan-realty.com/wp-json/wp/v2/media`
**Infrastructure:** AgentFire-managed WordPress at `ryan-realty.com`
**Source:** `marketing_brain_skills/tools_registry/agentfire-wordpress/SKILL.md`

### Purpose

Featured images for blog posts are stored in the WordPress media library. A blog post cannot have a featured image unless the image is first uploaded to this endpoint and the returned `media.id` is passed as `featured_media` in the post body.

### Upload endpoint

```
POST https://ryan-realty.com/wp-json/wp/v2/media
```

Authentication: HTTP Basic with `AGENTFIRE_WP_USER` and `AGENTFIRE_WP_APP_PASSWORD` from `.env.local`. The application password uses the format:

```ts
const credentials = Buffer.from(
  `${process.env.AGENTFIRE_WP_USER}:${process.env.AGENTFIRE_WP_APP_PASSWORD}`
).toString('base64')
```

Required headers:
```
Authorization: Basic {credentials}
Content-Disposition: attachment; filename="{image-filename}"
Content-Type: image/jpeg
```

Body: raw binary image buffer.

### Naming convention

WordPress assigns its own integer ID to each media item. The filename in `Content-Disposition` becomes the attachment title and file name in WordPress. Convention: `{topic}-{date}.jpg`, e.g. `bend-market-may-2026.jpg`.

### Who writes

The `blog-post` producer via the AgentFire WordPress tool skill.

### Who reads

The WordPress frontend (AgentFire theme) displays the featured image in blog post headers, RSS feeds, and social OG tags.

### Retention policy

Permanent within WordPress unless manually deleted from the WP admin media library. No automated TTL. AgentFire caches output aggressively at the CDN layer. Published images may take 5 to 15 minutes to propagate.

### Reuse query pattern

```
GET https://ryan-realty.com/wp-json/wp/v2/media?per_page=100&mime_type=image
```

Returns an array of media items. Each item has `id`, `source_url`, `alt_text`, and `date`. There is no geo or subject tag system in WordPress media. Reuse requires human lookup or a naming convention search by filename substring. This is a significant gap: the asset library does not know about media uploaded to WordPress, and WordPress does not know about the asset library.

### Integration gap

Media uploaded to WordPress is not registered back into the Supabase `asset_library` table. This means the repurpose engine cannot discover blog featured images for reuse as social assets. The migration plan (section 15) addresses this.

---

## 9. Storage location H: Google Business Profile media library

**Endpoint:** `https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/media`
**Cron route:** `app/api/cron/gbp-media-refresh/route.ts` (verified to exist)

### Purpose

GBP media is uploaded to the Google Business Profile location page. Photos appear in Google Maps and Google Search results. The cron job `gbp-media-refresh` runs on a schedule and uploads listing photos for active Matt Ryan listings.

### How it works (from `app/api/cron/gbp-media-refresh/route.ts`)

1. Queries Supabase `listings` table for active listings where `ListOfficeName` matches `GBP_BROKER_OFFICE_NAME` (default: `Ryan Realty LLC`) and `ListAgentName` contains "matt".
2. Filters to listings that have a `PhotoURL`.
3. Sorts by `ModificationTimestamp` descending and takes the top N.
4. For each listing, calls `uploadPhotoToGbp()` which POSTs to the GBP API with `mediaFormat: 'PHOTO'`, `sourceUrl` (the MLS photo URL), and `locationAssociation: { category: 'ADDITIONAL' }`.

### Naming convention

GBP assigns its own media IDs. The upload uses `sourceUrl` (the MLS `PhotoURL` value), so no local file is staged. The photo is pulled from MLS infrastructure directly by Google.

### Who writes

The cron job at `/api/cron/gbp-media-refresh`. Protected by `CRON_SECRET` via the `x-cron-secret` header or `Authorization: Bearer {secret}`.

### Who reads

Google Maps, Google Search, the GBP location page.

### Retention policy

Persistent on GBP until the listing is delisted or Google removes it. No automated cleanup from this pipeline.

### Reuse query pattern

No query interface. GBP media is write-once from this pipeline. The post ID returned by GBP (e.g., `accounts/110.../locations/338.../localPosts/5525...` from `publish-status.json`) is stored in `marketing_brain_actions.executor_response` but is not cross-referenced back to the asset library.

---

## 10. Storage location I: `listing_video_v4/public/`

**Path:** `listing_video_v4/public/`
**Git tracked:** yes (these are Remotion static assets, committed)

### Top-level contents (verified via `ls`)

```
listing_video_v4/public/
  audio/             ambient music beds and VO segments (mp3 files)
  brand/             logo assets for Remotion compositions
  fonts/             AzoSans, Amboqia and other font files
  fonts3d/           3D font variants
  generated/         AI-generated images for use in Remotion
  reels-photos/      property photos for listing reel compositions
  source_clips/      source video clips
  v5_library/        committed rendered MP4 deliverables (the canonical video archive)
  video_clips/       additional raw video footage
```

### `v5_library/` contents (verified, 38 items)

The v5_library holds committed, Matt-approved rendered videos. A sample of confirmed files:

```
animal_scan.md
bend_policy_pulse_part1.mp4 through part3.mp4
boundary_draw_test_v5.mp4 through v9.mp4
depth/
historic/
historic_extra_web/
manifest.json
masks/
news_golden_handcuffs.mp4
news_remax_real_merger.mp4
news_sunbelt_collapse.mp4
news_sunbelt_correction.mp4
news_tariffs.mp4
schoolhouse_v51.mp4 through schoolhouse_v59.mp4
```

The `manifest.json` inside `v5_library/` is distinct from `data/asset-library/manifest.json`. It is the Remotion-specific asset index for this directory.

### `brand/` contents (verified)

```
listing_video_v4/public/brand/
  stacked_logo_white.png       canonical end-card logo per CLAUDE.md
  youtube/                     YouTube-specific assets
```

### Naming convention

Rendered files: `{topic}_{version}.mp4` or `{topic}_{part}.mp4`, e.g. `news_tariffs.mp4`, `schoolhouse_v51.mp4`, `bend_policy_pulse_part2.mp4`.

### Who writes

The Remotion render pipeline (`npx remotion render`). After Matt approves a render from `listing_video_v4/out/`, it is moved to `listing_video_v4/public/v5_library/` and committed to `main`.

### Who reads

The Remotion dev server and render process use `listing_video_v4/public/` as its static assets root. The Next.js app does not serve from this path directly. The social publisher uploads from `v5_library/` paths to platform APIs.

### Retention policy

Committed permanently. The `v5_library/` grows with every approved render. No automated cleanup.

### Reuse query pattern

There is no programmatic query API. To find a video, producers must either know the filename or read `v5_library/manifest.json`. These videos are not registered in `data/asset-library/manifest.json`, creating a blind spot for the repurpose engine.

---

## 11. Storage location J: `listing_video_v4/out/`

**Path:** `listing_video_v4/out/`
**Git tracked:** no (gitignored)

### Purpose

Scratch area for in-flight Remotion renders. Every `npx remotion render` writes its output here. This is the mandatory draft staging area for video deliverables per the Video Review Gate rule.

### Contents (verified via `ls`)

```
listing_video_v4/out/
  beaumont_drive/
  bend_policy_pulse_part2_frame600.jpg   (QA frame capture)
  news_golden_handcuffs.scorecard.json
  news_remax_merger/
  news_remax_real_merger/
  news_sunbelt_correction.scorecard.json
  news_tariffs.scorecard.json
  tumalo_v4/
```

Each render subdirectory typically contains:
- `{name}.mp4`: the rendered video
- `scorecard.json`: viral scorecard results
- `citations.json`: data verification traces per figure
- `frames/`: extracted frame stills for QA

### Naming convention

`listing_video_v4/out/{name}/` where `{name}` is the render identifier, e.g. `news_tariffs`, `beaumont_drive`, `tumalo_v4`.

### Workflow

1. Render: `cd listing_video_v4 && npx remotion render src/index.ts <CompId> out/<name>.mp4 --codec h264 --concurrency 1`
2. QA gate: blackdetect, duration check, frame extraction
3. Score: write `out/<name>/scorecard.json`
4. Draft: show Matt the path
5. Approve: move to `public/v5_library/`, commit, push

---

## 12. Storage location K: `design_system/ryan-realty/assets/`

**Path:** `design_system/ryan-realty/assets/`
**Git tracked:** yes (canonical brand assets)

### Subdirectories (verified)

```
design_system/ryan-realty/assets/
  brand/
    blue-dog.png                Jax mascot (navy background version)
    email-banner.png
    ig-highlight-community.png
    ig-highlight-swan.png
    illustration-01.png through illustration-14.png   heritage wordmark variations
    lab.png
    logo-black.png
    (note: logo-blue.png and white-dog.png referenced in CLAUDE.md but not seen in ls output)
  hero/
    README.md
    banner-1024x576-gbp.jpg
    banner-1128x191-linkedin.jpg
    banner-1500x500-x.jpg
    banner-2048x1152-youtube.jpg
    banner-800x450-pinterest.jpg
    banner-820x312-facebook.jpg
    hero-old-mill-banner-2048x1152.jpg
    hero-old-mill-master-4k.jpg              canonical brand hero photo (locked)
    hero-old-mill-source-1280x720.jpg
  social/                       approved social platform assets
  team/
    matt-ryan.jpg
    matt-ryan.png               transparent-bg canonical version
    paul-stevenson.jpg
    paul-stevenson.png
    rebecca-peterson.jpg
    rebecca-peterson.png
```

Byte-identical mirrors of the broker headshots exist at `public/images/brokers/` under web-convention names.

### Naming convention

Brand assets: `{asset-type}-{color-variant}.png` (e.g., `logo-black.png`, `blue-dog.png`).
Heritage illustrations: `illustration-{nn}.png` (two-digit zero-padded).
Hero photos: `hero-old-mill-{variant}.jpg` or `banner-{dimensions}-{platform}.jpg`.
Broker headshots: `{first-last}.png` (transparent) or `{first-last}.jpg` (white background).

### Who writes

Only humans (Matt or the design system setup process). These are locked brand assets. No automated script writes to this directory.

### Who reads

Any producer that needs brand assets, logos, mascot illustrations, or broker headshots. The CLAUDE.md design system rules mandate using these paths directly.

### Retention policy

Permanent. Locked by brand decision. The canonical hero photo at `hero-old-mill-master-4k.jpg` is locked per Matt's 2026-05-13 directive. Broker headshots are locked until a roster change.

### Reuse query pattern

No programmatic query. Producers resolve paths by convention. For the broker headshot:

```typescript
function brokerHeadshotPath(email: string): string {
  const map: Record<string, string> = {
    'matt@ryan-realty.com': 'design_system/ryan-realty/assets/team/matt-ryan.png',
    'paul@ryan-realty.com': 'design_system/ryan-realty/assets/team/paul-stevenson.png',
    'rebecca@ryan-realty.com': 'design_system/ryan-realty/assets/team/rebecca-peterson.png',
  }
  return map[email] ?? map['matt@ryan-realty.com']
}
```

---

## 13. Schema upgrade recommendations

Per Phase 4.6 §7 of the pipeline brief, the following fields must be added to the asset record schema. These are documented here with purpose and a worked example.

### New fields

**`tags: string[]`**

Purpose: a unified, flat tag array combining both `geo_tags` and `subject_tags` plus format or campaign tags that do not fit either category. Enables a single-array search path for producers that do not need to distinguish geography from subject matter. Example tags: `ig_reel`, `under-contract`, `schoolhouse`, `just-listed`, `market-report-may-2026`.

Relationship to existing fields: `geo_tags` and `subject_tags` remain for backward compatibility and structured queries. `tags` is additive.

**`performance_score: number | null`**

Purpose: a normalized score (0.0 to 1.0) populated by the performance ingestion loop after 48h or 7d post-publish. Derived from platform engagement metrics (saves, shares, completion rate, reach) normalized against the cohort of same-format assets. `null` means not yet scored. Producers query this field to prefer high-performing asset variants for repurposing.

Example: `0.87` for a schoolhouse carousel that earned 3.2x the average save rate for sold-property posts in NE Bend.

**`surface: string`**

Purpose: the platform surface this asset was designed for. Values drawn from the platform-bible enum. Enables a producer to ask "what assets do we have that were designed for ig_reel?" without parsing free-form tag strings.

Valid values: `ig_reel`, `ig_carousel`, `ig_single`, `fb_feed`, `fb_reel`, `fb_carousel`, `x_post`, `linkedin_document`, `linkedin_single`, `gbp_post`, `youtube_short`, `youtube_long`, `tiktok`, `threads`, `blog_featured`, `email_header`, `print_flyer`, `yard_sign`.

**`asset_type: string`**

Purpose: distinguishes the file format independent of `type`. `type` tells you `photo` vs `video` vs `audio`. `asset_type` tells you `jpeg`, `png`, `mp4`, `mp3`, `pdf`, `docx`, etc. Needed for the repurpose engine to know whether an asset can be natively attached to a given platform API.

**`fingerprint: string`**

Purpose: SHA-256 hash of the file content for deduplication across sources. Prevents the same image from being registered twice under different source IDs (e.g., an Unsplash photo that was also downloaded via a direct URL and added as `source=curated`). The `lib/asset-library.mjs` file already imports `createHash` from `node:crypto`, so computing this at registration time is a small addition.

**`last_used_at: ISO string`**

Purpose: already in the `schema.json` as an optional field. Should be promoted to required with an explicit `null` default at registration. The `unusedOnly` filter in `search()` depends on this field being reliably set.

**`originated_from_action_id: uuid | null`**

Purpose: links the asset back to the `marketing_brain_actions` row that caused it to be created. Closes the loop between the brain's action log and the media it produced. Enables the query "what did action_id X produce and how did it perform?"

### Worked example record with all new fields

```json
{
  "id": "9f3c1a2b-88d4-4f7e-b123-456789abcdef",
  "type": "video",
  "source": "render-output",
  "source_id": "schoolhouse-reel-2026-05-14",
  "license": "owned",
  "license_metadata": { "license_required": false },
  "creator": "Ryan Realty pipeline",
  "file_path": "listing_video_v4/public/v5_library/schoolhouse_v59.mp4",
  "file_url": "https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/videos/renders/schoolhouse_v59.mp4",
  "geo_tags": ["bend", "nw-crossing"],
  "subject_tags": ["sold", "listing", "single-family"],
  "search_query": null,
  "width": 1080,
  "height": 1920,
  "duration_sec": 38.4,
  "registered_at": "2026-05-14T16:54:12.000Z",
  "last_used_at": "2026-05-14T16:54:12.000Z",
  "used_in": [
    {
      "render_path": "listing_video_v4/out/schoolhouse_v59/schoolhouse.mp4",
      "scene_id": "full-reel",
      "render_type": "short-form",
      "used_at": "2026-05-14T16:54:12.000Z"
    }
  ],
  "approval": "approved",
  "notes": "v59 final approved by Matt. Schoolhouse 1011 sold reel.",
  "tags": ["ig_reel", "fb_reel", "sold", "schoolhouse", "nw-crossing", "may-2026"],
  "performance_score": null,
  "surface": "ig_reel",
  "asset_type": "mp4",
  "fingerprint": "a3f8c1d2e9b74a6c83f1e2d4c5b6a7e8d9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
  "originated_from_action_id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d"
}
```

### Migration SQL for `public.asset_library`

The following migration adds the new columns. No migration file for this table exists yet, so this should be the first tracked migration:

```sql
-- Phase 4.6 §7: asset_library schema upgrade
ALTER TABLE public.asset_library
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS performance_score numeric(5,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS surface text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS asset_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fingerprint text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS originated_from_action_id uuid DEFAULT NULL REFERENCES public.marketing_brain_actions(id) ON DELETE SET NULL;

-- Index tags for fast array search
CREATE INDEX IF NOT EXISTS idx_asset_library_tags ON public.asset_library USING gin(tags);

-- Index surface for producer filter queries
CREATE INDEX IF NOT EXISTS idx_asset_library_surface ON public.asset_library(surface);

-- Index fingerprint for dedup checks
CREATE INDEX IF NOT EXISTS idx_asset_library_fingerprint ON public.asset_library(fingerprint);

-- last_used_at already exists; ensure index for unusedOnly filter
CREATE INDEX IF NOT EXISTS idx_asset_library_last_used_at ON public.asset_library(last_used_at);
```

---

## 14. Reuse query patterns for producers

These are the four queries every producer should run before spending API quota or render time on fresh content.

### Query 1: has this content type / address / topic been featured in the last 30 days?

**Purpose:** prevent redundant content about the same property or topic in the same 30-day window.

**TypeScript signature:**

```typescript
async function hasBeenFeaturedRecently(
  opts: { topic?: string; addressSlug?: string; surface?: string }
): Promise<boolean>
```

**Sample SQL:**

```sql
SELECT COUNT(*)::int AS count
FROM public.asset_library
WHERE
  last_used_at >= NOW() - INTERVAL '30 days'
  AND (
    $1::text IS NULL OR tags @> ARRAY[$1]
  )
  AND (
    $2::text IS NULL OR tags @> ARRAY[$2]
  )
  AND (
    $3::text IS NULL OR surface = $3
  )
  AND approval = 'approved';
```

Parameters: `$1 = topic` (e.g., `'schoolhouse'`), `$2 = addressSlug`, `$3 = surface` (e.g., `'ig_reel'`).

**Expected result shape:**

```json
{ "count": 3 }
```

`count > 0` means the topic was recently featured on that surface. The producer should consider a different topic or defer this content.

### Query 2: what variant of a surface performed best on this address last cycle?

**Purpose:** when building the next post for an address, use the layout variant with the highest performance score from the previous cycle.

**TypeScript signature:**

```typescript
async function bestPerformingVariant(
  addressSlug: string,
  surface: string
): Promise<{ asset_type: string; tags: string[]; performance_score: number } | null>
```

**Sample SQL:**

```sql
SELECT
  id,
  asset_type,
  tags,
  performance_score,
  file_url
FROM public.asset_library
WHERE
  tags @> ARRAY[$1]
  AND surface = $2
  AND performance_score IS NOT NULL
  AND approval = 'approved'
ORDER BY performance_score DESC
LIMIT 1;
```

Parameters: `$1 = addressSlug` (e.g., `'schoolhouse'`), `$2 = surface` (e.g., `'ig_carousel'`).

**Expected result shape:**

```json
{
  "id": "9f3c1a2b-...",
  "asset_type": "jpeg",
  "tags": ["ig_carousel", "schoolhouse", "sold", "may-2026"],
  "performance_score": 0.91,
  "file_url": "https://dwvlophlbvvygjfxcrhm.supabase.co/..."
}
```

A null result means no prior performance data exists for this address and surface combination. The producer proceeds with the default template.

### Query 3: is there a reusable asset for a given surface?

**Purpose:** before generating fresh creative, check if an approved, recently-unused asset already exists.

**TypeScript signature:**

```typescript
async function findReusableAsset(
  geo: string[],
  surface: string,
  assetType?: string
): Promise<AssetRecord[]>
```

**Sample SQL:**

```sql
SELECT
  id,
  file_url,
  file_path,
  geo_tags,
  subject_tags,
  tags,
  last_used_at,
  performance_score
FROM public.asset_library
WHERE
  geo_tags && $1::text[]
  AND surface = $2
  AND ($3::text IS NULL OR asset_type = $3)
  AND approval = 'approved'
  AND (
    last_used_at IS NULL
    OR last_used_at < NOW() - INTERVAL '30 days'
  )
ORDER BY
  performance_score DESC NULLS LAST,
  registered_at DESC
LIMIT 10;
```

Parameters: `$1 = geo` (e.g., `ARRAY['bend', 'nw-crossing']`), `$2 = surface`, `$3 = asset_type` (optional).

**Expected result shape:**

An array of up to 10 `AssetRecord` objects ordered by performance score descending, then registration date descending. The producer uses the first result if available, and falls back to fresh generation only if the array is empty.

### Query 4: IG Reel with the most saves in the last 90 days for under-contract posts in NE Bend

**Purpose:** demonstrates the full cross-table query that will be possible once `content_performance` is wired to asset library back-references.

**TypeScript signature:**

```typescript
async function topReelBySavesForUnderContractNEBend(
  lookbackDays?: number
): Promise<{ file_url: string; saves_90d: number; posted_at: string } | null>
```

**Sample SQL (requires `content_performance.asset_library_refs` column from Phase 4.6):**

```sql
SELECT
  al.id,
  al.file_url,
  al.tags,
  cp.metrics_90d->>'saves' AS saves_90d,
  cp.posted_at
FROM public.asset_library al
JOIN public.content_performance cp
  ON al.id = ANY(cp.asset_library_refs::uuid[])
WHERE
  al.surface = 'ig_reel'
  AND al.tags @> ARRAY['under-contract']
  AND al.geo_tags && ARRAY['ne-bend']
  AND cp.posted_at >= NOW() - INTERVAL '90 days'
  AND cp.metrics_90d->>'saves' IS NOT NULL
ORDER BY
  (cp.metrics_90d->>'saves')::int DESC
LIMIT 1;
```

**Expected result shape:**

```json
{
  "id": "a1b2c3d4-...",
  "file_url": "https://dwvlophlbvvygjfxcrhm.supabase.co/storage/v1/object/public/asset-library/...",
  "tags": ["ig_reel", "under-contract", "ne-bend", "saghali"],
  "saves_90d": "847",
  "posted_at": "2026-04-22T14:00:00.000Z"
}
```

This query is not operational until `content_performance` is migrated with `asset_library_refs text[]` (Phase 4.6 §1, `asset_library_refs text[]`). Until then, the producer uses the simplified Query 2 approach via `performance_score` on the asset record itself.

---

## 15. Recommended canonical store and migration path

### Current state: fragmented across eleven locations

| Location | Type | Query API | Performance link | Coverage |
|---|---|---|---|---|
| Supabase `asset-library` bucket | Cloud file store | none (URL construction only) | none | Social drop uploads, render-output |
| `public.asset_library` Postgres | Cloud index | PostgREST via `lib/asset-library.mjs` | none | Photos, videos, audio fetched by producers |
| `data/asset-library/manifest.json` | Local cache | `lib/asset-library.mjs` fallback | none | Mirror of above |
| `public/list-kits/{slug}/v3/` | Committed static files | none | none | List-kit output images |
| `out/proof/<date>/` | Gitignored scratch | none | none | In-flight render staging |
| AgentFire WP media library | WordPress | WP REST API | none | Blog featured images |
| GBP media library | Google API | none (write-only) | none | GBP location photos |
| `listing_video_v4/public/v5_library/` | Committed MP4s | none | none | Approved rendered videos |
| `listing_video_v4/out/` | Gitignored scratch | none | none | In-flight video renders |
| `listing_video_v4/public/` subdirs | Committed static | none | none | Remotion source assets |
| `design_system/ryan-realty/assets/` | Committed static | none | none | Brand and broker headshots |

### Target state: Supabase as canonical, others as delivery surfaces

The canonical single source of truth is `public.asset_library` (Postgres) backed by the `asset-library` Supabase Storage bucket. Every asset that enters the pipeline is registered in this table. Every asset that exits (is published) has its `used_in`, `last_used_at`, and `originated_from_action_id` populated. Every published asset gets a `performance_score` populated by the performance ingestion cron 48 hours and 7 days after publish.

All other locations become read-only delivery surfaces or upstream inputs:

- `public/list-kits/` remains a Next.js static asset directory, but every file written here is also registered in `public.asset_library` with `surface='ig_carousel'` or `surface='ig_single'` as appropriate.
- `listing_video_v4/public/v5_library/` remains the committed video archive, but every approved render is registered in `public.asset_library` with `type='render'`.
- `design_system/ryan-realty/assets/` is read-only brand input. Brand assets are not registered in the asset library (they are not content deliverables and have no performance lifecycle).
- AgentFire WordPress media uploads are registered back into the asset library immediately after a successful `POST /wp-json/wp/v2/media` call.
- GBP media uploads are registered back (using the MLS `PhotoURL` as `file_url` and `source='supabase-listing'`).
- `out/proof/<date>/` remains gitignored scratch. Nothing here is registered until Matt approves.

### Migration path (four steps)

**Step 1: Create the tracked migration for `public.asset_library`.**

Write `supabase/migrations/20260516000000_asset_library_v1.sql` that creates the `public.asset_library` table with all columns including the Phase 4.6 additions. The table currently exists but has no tracked migration. This creates the migration baseline.

**Step 2: Register existing `v5_library/` videos.**

Run a one-time script that iterates `listing_video_v4/public/v5_library/*.mp4` and calls `register()` for each with `type='render'`, `source='render-output'`, `approval='approved'`, inferred `geo_tags` from filename, and `file_url` pointing to either a Supabase Storage upload or the local committed path.

**Step 3: Register list-kit outputs as producers create them.**

Update the Python generator scripts (`build_tumalo_v3_kit.py`, `build_single_image_posts.py`) to call `lib/asset-library.mjs register` via a `subprocess` call after each image is written to `public/list-kits/`.

**Step 4: Wire `content_performance` back-references.**

After Phase 4.6 adds `asset_library_refs text[]` to `content_performance`, update the social publish rollout script to write the Supabase asset URLs into `asset_library_refs` on the corresponding `content_performance` row created at publish time.

### What stays fragmented and why

`design_system/ryan-realty/assets/` should not be registered in the asset library. Brand assets have no performance lifecycle and are not content deliverables. Tracking them would pollute search results with non-content records.

`out/proof/<date>/` and `listing_video_v4/out/` should remain gitignored. They are scratch areas, not archives. Registering assets here before Matt's approval would violate the Draft-First rule.

---

## 16. Producer reuse contract

Every producer, before generating or fetching any media asset, executes the following steps in this order. No deviation is allowed.

**Step 1: Query the asset library.**

```js
import { search } from '../lib/asset-library.mjs'

const existing = await search({
  geo: [citySlug],
  type: 'photo',       // or 'video', 'audio', 'render'
  approval: 'approved',
  unusedOnly: true,
  limit: 50,
})
```

If `existing.length >= N` (where N is the number of assets needed for this render), skip steps 2 and 3. Use `existing` and proceed to step 4.

**Step 2: Fetch from external source (only if library is insufficient).**

Call the appropriate fetch script. Each script auto-registers to the library:
- Photos: `scripts/fetch-photos.mjs <city>` (fans out to Pexels, Unsplash, Shutterstock)
- Videos: `scripts/fetch-pexels-video.mjs` or `scripts/fetch-shutterstock-video.mjs`
- Audio: generated by `video/market-report/scripts/synth-vo.mjs`
- AI-generated: wrap the Replicate/Kling/Veo call and call `register()` with `source='generated-<model>'`

**Step 3: Re-query to include new arrivals.**

```js
const assets = await search({ geo: [citySlug], type: 'photo', approval: 'approved', limit: N })
```

**Step 4: Use the assets, then mark them used.**

```js
import { markUsed } from '../lib/asset-library.mjs'

for (const asset of assetsUsedInThisRender) {
  await markUsed(asset.id, {
    render_path: outputPath,
    scene_id: sceneId,
    render_type: 'short-form',
  })
}
```

**Step 5: Register the rendered output.**

After the render completes and before showing it to Matt:

```js
await register(renderPath, {
  type: 'render',
  source: 'render-output',
  source_id: renderIdentifier,
  license: 'owned',
  geo: [citySlug],
  subject: [formatTag],
  approval: 'intake',           // Matt has not approved yet
  originated_from_action_id: actionId,
  surface: primarySurface,
})
```

**Step 6: After Matt approves and the asset is published.**

Update the record's approval to `'approved'` and populate `last_used_at`:

```js
// via direct Supabase PATCH or via a post-publish hook
PATCH /rest/v1/asset_library?id=eq.{id}
Body: { "approval": "approved", "last_used_at": "2026-05-14T17:00:00.000Z" }
```

**Invariants (non-negotiable).**

1. Never call an external media API without first running Step 1. Every skip of the library check is a cost leak and a potential photo repeat.
2. Never commit a rendered output to `v5_library/` without registering it in the asset library.
3. Never pass a stat or number from memory into an asset caption or VO without a verification trace in `citations.json`. The asset library stores the asset; `citations.json` stores the data provenance.
4. Shutterstock preview assets (`approval: 'intake'`) must not appear in any production render. The library's `approval` filter enforces this when `unusedOnly: true` is combined with `approval: 'approved'`.
5. The `fingerprint` field must be populated at registration using SHA-256 of the file buffer. The `randomUUID` import already in `lib/asset-library.mjs` coexists with `createHash` from `node:crypto`, so this is a one-line addition to the `register()` function.

**References every producer loads before executing.**

1. `video_production_skills/asset-library/SKILL.md`: this operational contract in skill form
2. `design_system/ryan-realty/SKILL.md`: brand visual system (asset paths, color, type)
3. `social_media_skills/platform-best-practices/SKILL.md`: per-surface format rules
4. `CLAUDE.md §0`: data accuracy mandate (outranks all instructions above)
5. `CLAUDE.md §0.5`: draft-first, commit-last (governs when assets are registered as `approved` vs `intake`)
