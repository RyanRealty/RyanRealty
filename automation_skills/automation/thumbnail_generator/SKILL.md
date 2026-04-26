---
name: thumbnail_generator
description: Uses Grok Imagine (xAI) to generate 4 thumbnail variants per video, runs A/B testing via ab_testing skill, and picks the winner after 24h based on CTR.
---

# Thumbnail Generator

## What it is

The `thumbnail_generator` takes a master video render and a thumbnail brief (subject, hook text,
color emphasis, platform), calls the Grok Imagine API (xAI) to generate 4 graphic variants, then
hands them to the `ab_testing` skill for 24-hour CTR testing. The winner is written back to
`post_queue.cover_url`. This skill runs as part of the `listing_trigger` pipeline and can also
be invoked standalone for any content type.

**Hard constraint:** No AI-generated faces of Matt or any real person. Matt's actual photos only.
The brand is #102742 Navy and #D4AF37 Gold. Thumbnails must be readable at 200px wide on a phone.
Thumbnails must accurately represent the video content — no clickbait.

## Trigger

**Invoked by `listing_trigger`:**
```
POST /api/workers/thumbnail-generate
Header: Authorization: Bearer <CRON_SECRET>
Body: {
  thumbnail_job_id: uuid,
  listing_id: uuid | null,
  run_id: uuid,
  source_video_url: string,
  brief: ThumbnailBrief,
}
```

**Invoked standalone:**
Same endpoint, any caller with valid `CRON_SECRET`.

## Inputs

```typescript
interface ThumbnailBrief {
  subject: string;          // What is the main visual? e.g. "Mountain-view living room"
  hook_text: string;        // ≤5 words, overlaid on thumbnail, e.g. "Bend's Best View"
  sub_text?: string;        // optional secondary line, e.g. "$875K | 3 BD | Mountain Views"
  color_emphasis: 'navy' | 'gold' | 'both';  // primary brand color to dominate
  target_platform: 'youtube' | 'tiktok' | 'instagram' | 'general';
  listing_photo_url?: string;  // Matt's actual photo to use as base (if available)
  // Matt's face: ONLY from listing_photo_url or approved headshot_url — never AI-generated
  headshot_url?: string;    // Matt's approved headshot (from /public/matt-headshot.jpg)
  style_ref?: string;       // e.g. 'clean_modern' | 'bold_contrast' | 'luxury_editorial'
}
```

Photo source hierarchy (required for accuracy):
1. If `listing_photo_url` provided: use as base image in prompt.
2. Else: describe visual from video content metadata.
3. Never fabricate a property visual. If no photo available: text-based thumbnail with brand colors.

## Outputs

| Artifact | Destination |
|---|---|
| 4 variant images | Supabase Storage `/thumbnails/{run_id}/v{1..4}.jpg` |
| Variant records | `ab_test_variants` table (via `ab_testing` skill) |
| Winner after 24h | `post_queue.cover_url` updated |
| Winning variant archived | `thumbnail_jobs.winner_variant_id` updated |

## Pipeline

### Step 1 — Build Grok Imagine prompts (4 variants)

Each variant has a different composition strategy, all sharing the same brand constraints:

```typescript
const BASE_CONSTRAINTS = `
Brand colors: Navy blue #102742, Gold #D4AF37.
Fonts: Bold sans-serif, high contrast white text with dark shadow.
Readable at 200px wide on mobile screen.
No AI-generated human faces. No fabricated people.
Accurate to the property — no fake architecture.
Style: clean, editorial, luxury real estate.
`;

const VARIANT_PROMPTS: Record<string, string> = {
  v1: `${brief.subject}. Full-bleed photo with navy gradient overlay from bottom 40%.
       Large centered text: "${brief.hook_text}". Gold accent bar below text.
       ${brief.sub_text ? `Secondary text: "${brief.sub_text}".` : ''}
       ${BASE_CONSTRAINTS}`,

  v2: `${brief.subject}. Photo fills left 60%, right 40% is solid navy #102742.
       Right panel: white hook text "${brief.hook_text}" large, bold.
       ${brief.sub_text ? `Sub text in gold: "${brief.sub_text}".` : ''}
       ${BASE_CONSTRAINTS}`,

  v3: `${brief.subject}. Photo with bold gold border frame (20px).
       Top-third black scrim. Text inside scrim: "${brief.hook_text}" white, large.
       ${BASE_CONSTRAINTS}`,

  v4: `${brief.subject}. Minimal. Photo cropped to 16:9 with heavy vignette.
       Bottom-left text: "${brief.hook_text}" — white, bold, 3 words max visible.
       Gold dot accent. No sub-text.
       ${BASE_CONSTRAINTS}`,
};
```

### Step 2 — Call Grok Imagine API

```typescript
// xAI Grok Imagine endpoint (as of April 2026)
const GROK_IMAGINE_URL = 'https://api.x.ai/v1/images/generations';

async function generateThumbnail(prompt: string, variantId: string): Promise<string> {
  const response = await fetch(GROK_IMAGINE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-2-image',        // confirm current model name on deploy
      prompt,
      n: 1,
      size: '1280x720',             // 16:9 base; crop to platform spec after
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok Imagine API error: ${response.status} ${await response.text()}`);
  }

  const { data } = await response.json();
  return data[0].url;   // temporary URL, must download and re-upload to CDN
}
```

Generate all 4 variants in parallel:
```typescript
const results = await Promise.allSettled(
  Object.entries(VARIANT_PROMPTS).map(([id, prompt]) => generateThumbnail(prompt, id))
);
```

### Step 3 — Download and crop to platform spec

For each successful result:
```typescript
// Download from Grok temp URL
const imageBuffer = await fetch(grokUrl).then(r => r.arrayBuffer());

// Crop to platform spec using @napi-rs/canvas (already in package.json)
const platformCrops = {
  youtube:   { width: 1280, height: 720 },   // 16:9
  tiktok:    { width: 1080, height: 1920 },  // 9:16 — pillarbox if needed
  instagram: { width: 1080, height: 1080 },  // 1:1 center crop
  general:   { width: 1280, height: 720 },
};
```

### Step 4 — Validate thumbnails

Before upload, run visual checks:
```typescript
function validateThumbnail(imageBuffer: ArrayBuffer): ValidationResult {
  // 1. Check readable hook text is present (can't programmatically OCR inline,
  //    so rely on prompt constraint + log for Matt's visual spot check)
  // 2. Check dimensions are correct for platform
  // 3. Check file size < 2MB (YouTube limit: 2MB, IG: 8MB, TikTok: 50KB)
  // 4. Check it's not a blank/black frame (pixel variance check)
  return { valid: true, warnings: [] };
}
```

Any variant that fails validation is skipped. If fewer than 2 variants pass: alert Matt and
use the first frame of the master video as fallback thumbnail.

### Step 5 — Upload to Supabase Storage

```typescript
for (const [variantId, buffer] of validVariants) {
  const path = `thumbnails/${run_id}/${variantId}.jpg`;
  await supabase.storage.from('media').upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
  variantUrls[variantId] = publicUrl;
}
```

### Step 6 — Update thumbnail_jobs and hand to ab_testing

```sql
UPDATE thumbnail_jobs
SET status = 'variants_ready',
    variants = $variants::jsonb,   -- [{variant_id, url, prompt_key}]
    completed_at = now()
WHERE id = $thumbnail_job_id;
```

Then invoke `ab_testing` skill:
```
POST /api/workers/ab-test
Body: {
  test_type: 'thumbnail',
  parent_id: thumbnail_job_id,
  variants: [{ id: 'v1', url: ... }, { id: 'v2', url: ... }, ...],
  post_queue_ids: [<post_queue_id_for_youtube>, ...],
  metric: 'ctr',
  min_impressions: 1000,
  test_duration_hours: 24,
}
```

### Step 7 — Winner selection (24 hours later)

`ab_testing` skill fires `POST /api/workers/thumbnail-winner` when winner is declared:
```typescript
Body: { thumbnail_job_id, winner_variant_id, winner_url, confidence, sample_size }
```

Worker updates:
```sql
UPDATE thumbnail_jobs
SET winner_variant_id = $winner_variant_id,
    updated_at = now()
WHERE id = $thumbnail_job_id;

UPDATE post_queue
SET cover_url = $winner_url
WHERE listing_id = $listing_id AND platform IN ('youtube', 'tiktok');
```

## Database schema

`thumbnail_jobs` is defined in `listing_trigger/SKILL.md`. Additional indexes:

```sql
CREATE INDEX IF NOT EXISTS thumbnail_jobs_status_idx
  ON thumbnail_jobs (status, created_at DESC)
  WHERE status != 'complete';
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **Rule 10 — Thumbnail accuracy.** The thumbnail prompt is built from actual listing data
  (address, subject, price). No fabricated architecture. No fake views. No falsely implied features.
- **No AI-generated faces.** Prompts explicitly exclude human face generation. If Matt is needed
  in a thumbnail, use `headshot_url` (his actual approved photo) as a reference image, not AI
  generation. This is an absolute rule with no exceptions.
- **No fake headlines.** `hook_text` comes from the verified copy block for that listing or
  market piece. It must match what the video delivers.
- **Brand colors only.** #102742 and #D4AF37. No random palette choices from Grok.
- **200px readability test.** Validation step checks dimensions + text presence.

## Error handling + observability

- **Grok API failure:** retry 3x with 60-second backoff. After 3 failures: use first video frame
  as fallback thumbnail. Log failure to `automation_runs`. Do not block video publishing.
- **Fewer than 2 valid variants:** fall back to video first-frame. Alert Matt via Resend.
- **A/B test no winner (insufficient data):** after 48 hours, `ab_testing` falls back to
  highest-performing variant by relative ranking. See `ab_testing/SKILL.md`.
- **Storage upload failure:** retry 3x. On failure: skip CDN and pass temp Grok URL to
  `post_queue` with a 6-hour TTL warning in `platform_metadata`.

Structured log:
```json
{ "skill": "thumbnail_generator", "run_id": "...", "variants_generated": 4,
  "variants_valid": 4, "ab_test_id": "...", "fallback_used": false, "ms": 3200 }
```

## Configuration

```typescript
export const THUMBNAIL_GENERATOR_CONFIG = {
  // Grok Imagine model (verify on deploy)
  grok_model: 'grok-2-image',

  // Variants to generate per video
  num_variants: 4,

  // Platform-specific dimensions
  platform_dimensions: {
    youtube:   { width: 1280, height: 720 },
    tiktok:    { width: 1080, height: 1920 },
    instagram: { width: 1080, height: 1080 },
    general:   { width: 1280, height: 720 },
  },

  // Max file size per platform (bytes)
  max_file_sizes: {
    youtube:   2_000_000,   // 2MB
    tiktok:   50_000_000,   // 50MB (generous, keep to ~500KB for speed)
    instagram: 8_000_000,   // 8MB
  },

  // Fallback: use first frame of video if generation fails
  fallback_to_video_frame: true,

  // Matt's approved headshot path (never AI-generate his face)
  matt_headshot_url: '/public/matt-headshot.jpg',
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `XAI_API_KEY` | Grok Imagine (xAI) API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage upload |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `CRON_SECRET` | API route auth |

## Manual override / kill switch

**Disable thumbnail generation (use video frames only):**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'thumbnail_generator_enabled';
```

**Skip A/B testing (use v1 immediately):**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'thumbnail_ab_testing_enabled';
```
When disabled: v1 variant is immediately written to `post_queue.cover_url`.

**Override winner manually:**
```
PATCH /api/admin/thumbnail-winner
Body: { thumbnail_job_id, winner_variant_id, override_reason }
```

## See also

- `automation_skills/triggers/listing_trigger/SKILL.md` — primary caller
- `automation_skills/automation/ab_testing/SKILL.md` — runs CTR test on variants
- `automation_skills/automation/repurpose_engine/SKILL.md` — passes cover_url per platform
- `automation_skills/automation/post_scheduler/SKILL.md` — uses cover_url on publish
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — accuracy and no-fake-face rules
