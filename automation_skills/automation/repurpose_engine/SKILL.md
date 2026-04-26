---
name: repurpose_engine
description: Takes one master video + copy block and produces 8 platform-specific variants via Remotion parameterized compositions and ffmpeg export presets, then writes them to post_queue.
---

# Repurpose Engine

## What it is

The `repurpose_engine` accepts a master 9:16 Remotion composition plus a master copy block and
listing/market metadata, then renders 8 platform-specific variants. Each variant gets its own
aspect ratio, duration cap, caption formatting, hashtag set, burnt-in captions or CC, watermark
placement, and music license check. Output rows land in `post_queue` for `post_scheduler` to
drain. This skill is invoked by `listing_trigger` after both video jobs complete, and can also
be invoked directly for market update or meme content.

## Trigger

**Invoked by `listing_trigger` (primary):**
```
POST /api/workers/repurpose
Header: Authorization: Bearer <CRON_SECRET>
Body: {
  listing_id: uuid | null,
  run_id: uuid,
  master_video_url: string,     // CDN URL of master Remotion render (9:16, 45s)
  master_copy: MasterCopy,
  metadata: ListingOrMarketMeta,
  format_tag: string,           // 'listing_reveal' | 'data_viz_video' | 'meme' | etc.
  platforms?: Platform[],       // optional subset — defaults to all 8
}
```

**Invoked directly (for market/trend content):**
Same endpoint, `listing_id = null`, `format_tag = 'data_viz_video' | 'meme'`.

## Inputs

```typescript
interface MasterCopy {
  hook_line: string;           // ≤7 words, used in burnt-in caption + VO
  body_lines: string[];        // array of copy blocks, voice-matched to Matt
  cta_line: string;            // e.g. "Link in bio for full tour"
  hashtags_base: string[];     // 5-8 evergreen brand hashtags
  hashtags_geo: string[];      // 3-5 geo/neighborhood hashtags
  hashtags_topic: string[];    // 3-5 topic hashtags (market, listing, etc.)
}

interface ListingOrMarketMeta {
  type: 'listing' | 'market';
  // listing fields (if type='listing'):
  address?: string;
  city?: string;
  list_price?: number;         // verified from listings.list_price
  bedrooms?: integer;
  bathrooms?: number;
  sqft?: integer;
  mls_number?: string;
  // market fields (if type='market'):
  market_metric?: string;
  market_value?: number;
  market_geo?: string;
  verification_trace?: string; // CLAUDE.md required for market data
}
```

## Outputs

8 rows in `post_queue`, one per platform variant:

| Variant | Platform | Aspect | Duration | Caption style |
|---|---|---|---|---|
| 1 | Instagram Reel | 9:16 | ≤90s | CC via IG auto-captions + hashtags in caption |
| 2 | Instagram Feed | 1:1 | ≤60s | Hashtags in first comment if > 5 tags |
| 3 | Instagram Story | 9:16 | ≤15s | No hashtags (story = zero hashtag benefit) |
| 4 | TikTok | 9:16 | ≤60s | Captions burnt-in (TikTok auto-caption supplement) |
| 5 | YouTube Short | 9:16 | ≤60s | CC via YouTube auto-captions |
| 6 | YouTube Long | 16:9 | ≤3min | Chapter markers in description |
| 7 | Facebook Reel | 9:16 | ≤90s | Description field (no hashtag algo benefit on FB) |
| 8 | LinkedIn | 1:1 | ≤3min | Text-heavy caption (500-700 chars), 3 hashtags |

Each row also gets: `format_tag`, `topic_tags`, `cover_url`, `hashtag_set`.

## Pipeline

### Step 1 — Copy prep

1. Run voice validation against Matt's brand rules (ANTI_SLOP_MANIFESTO):
   - No banned words: `stunning`, `nestled`, `boasts`, `gorgeous`, `breathtaking`, `must-see`,
     `welcome to your dream home`, `worth a serious look`.
   - No semicolons in copy.
   - No em-dashes. Replace with comma or period.
   - No AI filler: `delve`, `leverage`, `unlock`, `seamless`, `elevate`, `game-changer`.
   - Numbers carry units: `$475,000` not `475000`, `4 bedrooms` not `4br`.
   - Caption length: 80-140 chars for IG/TikTok sweet spot.
   ```typescript
   function validateCopy(copy: MasterCopy): ValidationResult {
     const banned = ['stunning','nestled','boasts','gorgeous','breathtaking',
                     'must-see','delve','leverage','unlock','seamless','elevate'];
     // ... check each field
   }
   ```

2. Compress copy per platform character limits:
   - IG Reel caption: 2,200 chars max, 80-140 chars above hashtag block for best reach.
   - TikTok: 2,200 chars. Burnt-in caption = hook_line only (stays in safe zone).
   - YouTube: full description with chapter markers, no char limit concern.
   - LinkedIn: 3,000 chars, lean into 500-700 chars for professional context.
   - FB: 63,206 chars, keep to 150-200 chars for feed.

3. Build per-platform hashtag sets:
   ```typescript
   const PLATFORM_HASHTAG_RULES = {
     instagram: { max: 20, placement: 'caption', separator: '\n\n' },
     tiktok:    { max: 5, placement: 'caption', separator: ' ' },
     youtube:   { max: 15, placement: 'description', separator: ' ' },
     facebook:  { max: 0, placement: 'none' },  // hashtags hurt FB reach
     linkedin:  { max: 3, placement: 'caption', separator: ' ' },
   };
   ```

### Step 2 — Variant rendering

For each of the 8 variants, invoke the Remotion render pipeline:

**9:16 variants (1, 3, 4, 5, 7):**
```typescript
// Reuse the master render — just trim to platform duration cap
// Remotion: pass props to parameterized composition
renderMedia({
  composition: 'PlatformVariant',
  outputLocation: `/tmp/variants/${post_id}_${platform}.mp4`,
  props: {
    masterVideoUrl: master_video_url,
    aspectRatio: '9:16',
    durationSeconds: DURATION_CAPS[platform],  // 15 for Story, 60 for TikTok/Short, 90 for Reel
    burntCaptions: platform === 'tiktok',      // only TikTok burns captions
    logoPlacement: logoPlacementFor(platform), // bottom-right safe zone for all
    watermark: false,                          // no watermark — brand is in caption
  },
});
```

**1:1 variants (2, 8):**
```typescript
renderMedia({
  composition: 'PlatformVariant',
  props: {
    masterVideoUrl: master_video_url,
    aspectRatio: '1:1',
    cropStrategy: 'center_crop',   // center-crop from 9:16 master
    durationSeconds: DURATION_CAPS[platform],
  },
});
```

**16:9 long-form (variant 6 — YouTube Long):**
If master is 9:16 Remotion render: pillarbox into 16:9 canvas with blurred background fill.
```typescript
// ffmpeg post-processing
execSync(`ffmpeg -i ${masterPath} \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,
       pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -crf 18 -preset slow \
  -c:a aac -b:a 192k \
  ${outputPath}`);
```
If a separate 16:9 source render is available (from `data_viz_video` skill): use that directly.

**Duration caps per platform:**
```typescript
const DURATION_CAPS: Record<Platform, number> = {
  instagram_reel:    90,
  instagram_feed:    60,
  instagram_story:   15,
  tiktok:            60,
  youtube_short:     60,
  youtube_long:     180,
  facebook_reel:     90,
  linkedin:         180,
};
```

### Step 3 — Music license check

All Remotion compositions use royalty-free tracks from the approved library. Before export:
```typescript
const track = await getTrackMeta(master_video_url);
if (!APPROVED_MUSIC_LIBRARY.includes(track.track_id)) {
  // Strip audio, replace with silence or approved ambient track
  await replaceAudio(outputPath, APPROVED_AMBIENT_FALLBACK);
}
```
Platform-specific music rules:
- **TikTok:** only TikTok Commercial Music Library tracks allowed for business accounts.
  Non-compliant audio = silent track (TikTok mutes it anyway).
- **YouTube:** Content ID claimed tracks are allowed IF license = creative commons or we own it.
- **Instagram/FB:** Meta Sound Collection or royalty-free only.
- **LinkedIn:** No audio monetization issues, but muted-viewing is common — captions carry value.

### Step 4 — Upload to CDN

```typescript
// Upload each variant to Supabase Storage or Vercel Blob
const variantUrl = await uploadToCDN({
  path: `/variants/${run_id}/${platform}_${aspectRatio}.mp4`,
  file: outputPath,
});
```

### Step 5 — Write to post_queue

```sql
INSERT INTO post_queue
  (listing_id, run_id, platform, media_type, media_url, caption,
   cover_url, hashtag_set, platform_metadata, scheduled_at,
   review_status, status, format_tag, topic_tags, created_at)
VALUES
  ($listing_id, $run_id, $platform, $media_type, $variant_url, $caption,
   $cover_url, $hashtags, $platform_metadata::jsonb, $optimal_window,
   'pending_human_review', 'approved', $format_tag, $topic_tags, now());
```

`scheduled_at` is computed by the scheduler: next available optimal window per platform,
respecting `POST_SCHEDULER_CONFIG.daily_caps`.

### Step 6 — Voice transformer pass

After copy compression for each platform, run a final voice check:
```typescript
function voiceTransformerPass(caption: string): string {
  // 1. Strip any surviving em-dashes -> comma or period
  // 2. Strip any surviving semicolons -> period
  // 3. Ensure numbers carry units
  // 4. Check banned word list
  // 5. Confirm sentence structure sounds like Matt (direct, no filler)
  return cleaned;
}
```
This is NOT an AI rewrite that changes substance. It is a rules-based cleanup pass only.
If the voice check fails (banned word can't be safely removed without rewrite), the row is
set to `review_status = 'pending_human_review'` with `last_error = 'voice_check_failed'`.

## Database schema

This skill uses `post_queue` and `automation_runs` (defined in `post_scheduler` and
`listing_trigger` SKILL.md respectively). No additional tables required.

New column on `post_queue` for repurpose traceability:
```sql
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS
  source_variant text;
  -- 'ig_reel' | 'ig_feed' | 'ig_story' | 'tiktok' | 'yt_short' | 'yt_long'
  -- | 'fb_reel' | 'linkedin'
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **Rule 1 — No banned words.** Enforced in Step 1 copy validation. Hard failure if found.
- **Rule 2 — No AI rewrite that changes substance.** Step 6 is rules-based only. If copy needs
  a rewrite for a platform, flag for human review — do not silently alter meaning.
- **Rule 6 — No watermarks that obscure content.** No watermark overlaid on key visual elements.
  Brand presence is through caption attribution and consistent visual style only.
- **Rule 9 — No fake engagement bait.** Story variant does NOT add poll sticker asking leading
  questions (e.g. "Would you buy this for $500K?" is borderline fair-housing violation territory).
  Story polls must be generic engagement (e.g. "Love this view?") and vetted for fair housing.
- **Rule 10 — Thumbnail accuracy.** Cover URL passed to `thumbnail_generator` skill —
  thumbnail must represent actual video content. No clickbait.

## Error handling + observability

- **Render failures:** if Remotion render fails for a variant, that variant is skipped (logged
  to `automation_runs.output_summary`). Other variants continue. Matt is not blocked.
- **CDN upload failures:** 3 retries. On third failure, variant is skipped and flagged.
- **Voice check failures:** variant enters `pending_human_review` with error note. Does not block
  other variants.
- **Music license failure:** audio is stripped, post continues with silent or ambient fallback.
  Logged to `automation_runs`.

Structured log per variant:
```json
{ "skill": "repurpose_engine", "run_id": "...", "variant": "tiktok",
  "status": "complete", "duration_ms": 8420, "voice_check": "pass" }
```

## Configuration

```typescript
export const REPURPOSE_ENGINE_CONFIG = {
  // Approved music track IDs (Supabase storage keys)
  approved_music_library: ['track_001_ambient', 'track_002_corporate', ...],
  approved_ambient_fallback: 'track_000_silence',

  // Crop strategy for 9:16 -> 1:1 conversion
  crop_strategy: 'center_crop',  // alt: 'smart_crop' using ffmpeg scene detection

  // Whether to burn captions into video (TikTok = true, others = false)
  burnt_captions: {
    tiktok: true,
    instagram_reel: false,
    instagram_feed: false,
    instagram_story: false,
    youtube_short: false,
    youtube_long: false,
    facebook_reel: false,
    linkedin: false,
  },

  // Remotion composition name for platform variants
  remotion_composition: 'PlatformVariant',

  // ffmpeg CRF for export (18 = high quality, 23 = good/smaller)
  export_crf: 18,
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | CDN upload via Supabase Storage |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `CRON_SECRET` | API route authorization |
| `REMOTION_SERVE_URL` | Remotion bundle serve URL for server-side render |

## Manual override / kill switch

**Skip a specific platform:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'repurpose_engine_platform_linkedin_enabled';
-- keys: repurpose_engine_platform_{instagram_reel|instagram_feed|instagram_story
--       |tiktok|youtube_short|youtube_long|facebook_reel|linkedin}_enabled
```

**Re-run repurpose for a failed run:**
```
POST /api/workers/repurpose
Body: { run_id: '<existing-run-id>', force_rerun: true }
```
Force-rerun skips the idempotency check in `automation_runs`.

## See also

- `automation_skills/triggers/listing_trigger/SKILL.md` — primary caller
- `automation_skills/automation/post_scheduler/SKILL.md` — drains output rows
- `automation_skills/automation/thumbnail_generator/SKILL.md` — generates cover_url variants
- `automation_skills/automation/ab_testing/SKILL.md` — A/B tests caption and hook variants
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master video constraints
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — content quality enforcement
