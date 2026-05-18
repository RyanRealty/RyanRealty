---
name: clip_compilation
description: Stitches multiple existing short video clips from the asset library into a themed compilation reel (best-of-month, neighborhood highlight, year-in-review), using ffmpeg concat and Remotion bridging transitions, targeting IG Reels, FB Reels, TikTok, and YouTube Shorts.
action_types:
  - content:clip_compilation
output_type: video
target_platforms: ['ig_reel', 'fb_reel', 'tt', 'yt_short']
asset_destination: data/asset-library/manifest.json and Supabase asset-library bucket per asset-library-map.md §2
auto_inputs: [clip inventory from data/asset-library/manifest.json via lib/asset-library.mjs search()]
required_inputs: [theme_slug, date_range_start, date_range_end]
optional_inputs: [max_clips (default: 6), clip_duration_sec (default: 5), include_vo (default: true), filter_tags]
estimated_runtime_min: 8
cost_usd_estimate: $0.00 (ffmpeg concat, no external APIs) + ElevenLabs VO per char if include_vo=true
thumbnail_uri: out/proof/2026-05-17/exemplars/clip_compilation/sample.jpg
example_outputs: []
    label: Best of May 2026 listing reels compilation
    surface: ig_reel
  - uri: out/proof/2026-05-17/exemplars/clip_compilation/northwest_crossing_highlights_9x16.mp4
    label: NW Crossing neighborhood highlight reel
    surface: fb_reel
  - uri: out/proof/2026-05-17/exemplars/clip_compilation/bend_2026_year_in_review_9x16.mp4
    label: Bend 2026 year-in-review compilation
    surface: yt_short
---

# Clip Compilation Producer

**Scope:** This is a repurpose producer. It queries the Ryan Realty asset library for existing short video clips, trims each to a specified duration, stitches them together with crossfade transitions via ffmpeg concat + Remotion bridging, optionally adds a Victoria VO intro and outro, and outputs a single compiled reel. It handles `content:clip_compilation` only. It does NOT generate new footage or AI video (use listing-tour-video, map_route_video, or market_pulse_short for new content). It does NOT caption individual source clips retroactively (captions are added only to the intro/outro VO portions of the compilation). It does NOT pull clips from external social platforms. All source clips must exist in the local asset library manifest or Supabase Storage bucket. This producer is zero-cost for render (no external APIs beyond optional ElevenLabs VO) and is the primary tool for the brain's monthly repurpose cycle.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/proof/2026-05-17/exemplars/clip_compilation/`

---

## 1. What it makes

A single compiled 1080x1920 portrait MP4, duration determined by the number of clips and clip_duration_sec (default: 6 clips x 5s each = 30s, plus 3s intro + 3s outro = 36s). The video structure:

**Intro beat (0-3s):** Title card on navy background. Amboqia Boriango display type. Theme title in cream (e.g. "May 2026" or "Northwest Crossing" or "A Year in Bend"). Optional VO intro line from Victoria narrating the theme.

**Clip reel (3s onward):** Source clips play sequentially, each trimmed to `clip_duration_sec` seconds. A 0.3s crossfade transition between each clip (Remotion overlapping Sequence with opacity ramp). No freeze-frames at transitions.

**Outro beat (final 3s):** CTA text on navy. "Follow @ryanrealtybend for more." No Ryan Realty logo in the viral variant (logo-is-a-closer doctrine).

The compilation carries no new market data, no price figures, and no property-specific claims unless those appear in the source clips themselves (in which case they were already verified when the source clip was produced). This producer does NOT re-verify source clip data; it trusts the asset library's `approved_at` field as evidence of prior verification.

Supported theme_slugs:
- `best_of_month` - top-performing listing reels from a calendar month (ranked by `plays` in manifest)
- `neighborhood_highlights` - clips tagged with a specific neighborhood_slug
- `year_in_review` - clips from a full calendar year, sampled across months
- `just_listed` - all just-listed reels from a date range
- `sold_highlights` - clips tagged as sold/closed
- `market_updates` - market pulse or market data clips from a date range

---

## 2. Input contract (auto / required / optional)

### Auto-resolved

| field | source | method |
|---|---|---|
| `source_clips` | `data/asset-library/manifest.json` via `lib/asset-library.mjs search()` | Filtered by theme_slug logic, date_range, and optional filter_tags |
| `clip_file_paths` | Manifest entries, `local_path` field | Verified to exist on disk before render starts |

### Required

```typescript
interface ClipCompilationPayload {
  theme_slug: string;       // One of the supported theme slugs above
  date_range_start: string; // ISO date, e.g. "2026-05-01"
  date_range_end: string;   // ISO date, e.g. "2026-05-31"
}
```

### Optional

```typescript
interface ClipCompilationOptions {
  max_clips?: number;           // default: 6; minimum: 3; maximum: 12
  clip_duration_sec?: number;   // default: 5 (each source clip trimmed to this length)
  include_vo?: boolean;         // default: true (Victoria intro/outro VO)
  filter_tags?: string[];       // additional tag filters applied to manifest search
  title_override?: string;      // overrides auto-generated title card text
  rank_by?: "plays" | "saves" | "recency"; // default: "plays" for best_of_month; "recency" for others
}
```

---

## 3. Tool stack (cite tool-inventory.md)

Per `marketing_brain_skills/research/tool-inventory.md`:

| tool | purpose | env var / path | status |
|---|---|---|---|
| `lib/asset-library.mjs` `search()` function | Query manifest for source clips by tag, date, theme | local lib | Active |
| ffmpeg (static-ffmpeg) | Trim clips, concat filter, crossfade, encode h264/aac output | PATH via static-ffmpeg symlink | Active |
| Remotion (`npx remotion render`) | Bridging title card and outro (Remotion for text/VO sync; ffmpeg for raw concat) | `cd listing_video_v4` | Active |
| ElevenLabs API (optional) | Victoria VO intro/outro if include_vo=true | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH` | Active |
| Supabase MCP | Update marketing_brain_actions row | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Active |

No Google Maps APIs, no Mapbox, no Replicate. This producer is fully local once the asset library is populated.

ffmpeg concat strategy:
- For clips with matching codecs (h264/aac, same resolution): use concat demuxer (no re-encode, fast).
- For clips with mismatched codecs or resolution: use concat filter with `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2` to normalize.
- Default to concat filter (slower but more compatible) unless all clips pass a pre-flight codec check.
- Crossfade via `xfade=transition=fade:duration=0.3` between each clip pair.

---

## 4. Platform stack (cite platform-bible.md)

Per `marketing_brain_skills/research/platform-bible.md`:

| platform | section | key constraints |
|---|---|---|
| Instagram Reels | §2 | 9:16, 15-90s (target 30-45s), hook by 0.4s, no logo in viral variant, captions on intro/outro VO |
| Facebook Reels | §6 | 9:16, same rules |
| TikTok | §10 | 9:16, hook by 0.4s, geo hashtags in caption |
| YouTube Shorts | §12 | 9:16, max 60s (keep compilation under 60s for Shorts; go to YouTube long-form if over 60s) |

Logo in frame: per platform-bible.md §26 logo-is-a-closer doctrine, no Ryan Realty logo in any frame of the viral compilation variant. The outro CTA uses the handle `@ryanrealtybend`, not the brokerage name or logo.

---

## 5. The recipe (end-to-end testable, numbered steps with exact tool calls)

**Step 1. Read and validate the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2. Load mandatory references**

- `CLAUDE.md` §0 (Data Accuracy) and §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `video_production_skills/asset-library/SKILL.md` (asset library producer contract)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`

**Step 3. Query asset library for source clips**

```javascript
import { search } from '../../lib/asset-library.mjs';

const clips = await search({
  type: 'video',
  tags: themeToTags(theme_slug),       // maps theme_slug to tag filter array
  date_range: { start: date_range_start, end: date_range_end },
  approved: true,                       // only clips with approved_at set
  rank_by: rank_by,
  limit: max_clips
});
```

`themeToTags()` mapping:
- `best_of_month`: `['listing_reel', 'listing_reveal']`
- `neighborhood_highlights`: `[neighborhood_slug, 'area_guide']`
- `year_in_review`: `['listing_reel', 'market_pulse_short', 'neighborhood_reel']`
- `just_listed`: `['just_listed']`
- `sold_highlights`: `['sold', 'closed']`
- `market_updates`: `['market_pulse_short', 'market_data_short']`

If fewer than `min_clips` (3) are returned: surface to Matt. "Only <N> approved clips found in the asset library for theme '<theme_slug>' in the date range <start> to <end>. Minimum is 3 clips for a compilation. Expand the date range or choose a different theme."

**Step 4. Verify source clip files exist on disk**

```bash
for clip in "${clips[@]}"; do
  if [ ! -f "$clip" ]; then
    echo "MISSING: $clip"
    exit 1
  fi
done
```

If any clip file is missing from disk but in the manifest, check Supabase Storage for the file and download it:

```javascript
const { data } = await supabase.storage.from('asset-library').download('<object_path>');
```

Save to the local draft path. If download fails, remove that clip from the selection and log the gap.

**Step 5. Pre-flight codec check**

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height \
  -of csv=p=0 "<clip_path>"
```

Run for each clip. Group into: (a) matching h264/1080x1920 (can use concat demuxer) and (b) mismatched (must use concat filter with scale normalization). Log the group assignment for each clip.

**Step 6. Write VO script (if include_vo=true)**

Intro template (3-4 words for the hook, then 1 sentence context):
- `best_of_month`: "May was a busy month. Here are the listings that moved fastest."
- `neighborhood_highlights`: "[Neighborhood] has a lot going on. Here is a quick look."
- `year_in_review`: "A year in Bend. Every listing tells a story."
- `just_listed`: "New to market. A look at what just came up."
- `sold_highlights`: "These sold. Here is what moved recently in [city/area]."
- `market_updates`: "The market this week. What the numbers are actually saying."

Outro (universal): "Follow @ryanrealtybend to stay current."

Brand voice check: no em-dashes, no banned words, sentence case, no exclamation marks.

**Step 7. Synthesize VO (if include_vo=true)**

Per `video_production_skills/elevenlabs_voice/SKILL.md`:

```json
{
  "model_id": "eleven_turbo_v2_5",
  "voice_settings": {
    "stability": 0.40,
    "similarity_boost": 0.80,
    "style": 0.50,
    "use_speaker_boost": true
  }
}
```

Save intro MP3 to `out/clip_compilation/<slug>/vo_intro.mp3`. Save outro MP3 to `vo_outro.mp3`. Save forced-alignment JSONs.

**Step 8. Trim source clips**

For each clip, trim to `clip_duration_sec` using ffmpeg:

```bash
ffmpeg -ss 0 -t <clip_duration_sec> -i "<input_path>" \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -crf 22 -preset fast \
  -c:a aac -b:a 128k \
  "out/clip_compilation/<slug>/clip_<N>_trimmed.mp4"
```

**Step 9. Render title card and outro with Remotion**

```bash
cd /Users/matthewryan/RyanRealty/listing_video_v4
npx remotion render src/index.ts ClipCompilationIntro \
  out/clip_compilation/<slug>/intro.mp4 \
  --codec h264 --concurrency 1 --crf 22 \
  --props '{"title":"<theme_title>","voMp3":"out/clip_compilation/<slug>/vo_intro.mp3","alignment":"out/clip_compilation/<slug>/vo_intro_alignment.json"}'

npx remotion render src/index.ts ClipCompilationOutro \
  out/clip_compilation/<slug>/outro.mp4 \
  --codec h264 --concurrency 1 --crf 22 \
  --props '{"ctaText":"Follow @ryanrealtybend to stay current","voMp3":"out/clip_compilation/<slug>/vo_outro.mp3","alignment":"out/clip_compilation/<slug>/vo_outro_alignment.json"}'
```

**Step 10. Concat all segments with ffmpeg xfade**

Build an ffmpeg filter_complex string with xfade crossfades between each consecutive pair (intro, clip_1, clip_2, ..., clip_N, outro):

```bash
ffmpeg \
  -i out/clip_compilation/<slug>/intro.mp4 \
  -i out/clip_compilation/<slug>/clip_1_trimmed.mp4 \
  ... \
  -i out/clip_compilation/<slug>/outro.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.3:offset=<t0>[v01];[v01][2:v]xfade=transition=fade:duration=0.3:offset=<t1>[v012];..." \
  -map "[vout]" -map 0:a \
  -c:v libx264 -crf 22 -preset fast \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  out/clip_compilation/<slug>/compilation_9x16.mp4
```

Compute xfade offsets: each offset = cumulative duration of prior segments minus 0.3 (for 0.3s overlap).

**Step 11. Run QA gate, register in asset library, surface draft**

Per §8. Write `citations.json` (source clip paths, approved_at dates, theme). Write `scorecard.json`. Register in asset library. Update action row to 'ready'. Surface per §6.

---

## 6. Asset library wiring (cite asset-library-map.md)

Per `marketing_brain_skills/research/asset-library-map.md`:

- **Source clips:** queried from `data/asset-library/manifest.json` via `lib/asset-library.mjs search()`.
- **Draft location:** `out/clip_compilation/<theme_slug>_<date_range>/` (gitignored).
- **After approval:** Supabase Storage `asset-library` at `clip-compilation/<date>/<theme_slug>/compilation_9x16.mp4`.
- **Manifest entry:** `lib/asset-library.mjs register()` with `theme_slug`, `date_range`, `source_clip_ids` (array of manifest IDs from the source clips), `clip_count`, `created_at`.
- Circular reference note: the compilation's manifest entry references the source clips' manifest IDs. The `repurpose_engine` automation uses this linkage to avoid re-using the same source clip in two compilations in the same month.

---

## 7. Publishing flow

1. Matt approves.
2. Content engine publishes to IG Reel (primary), then FB Reel.
3. TikTok and YouTube Shorts queued via `post_scheduler` (check OAuth status before queuing).
4. Caption: theme title + 1-line summary + 3-5 geo hashtags (#BendOregon #CentralOregon + theme-specific tag). No exclamation marks. No emoji in caption body.
5. Scheduling: compilations are best posted on days with no other content in the queue. The brain's `repurpose_engine` sets scheduling to avoid collision with new listing launches or market reports.

---

## 8. QA gate (format-specific checks)

| check | pass condition | tool |
|---|---|---|
| Duration | 15-60s (3 clips min at 5s each = 18s; 12 clips max at 5s each = 60s + intro/outro) | ffprobe |
| Codec | h264 video, aac audio | ffprobe |
| Black frames | 0 sequences at transitions | ffmpeg blackdetect strict |
| No freeze frames at transition boundaries | Visual scrub at each transition point | frame extraction at each transition offset timestamp |
| File size | Under 100 MB | stat |
| Aspect ratio | 1080x1920 | ffprobe |
| Source clip count | 3-12 clips present in compilation | citations.json source_clip_ids count |
| All source clips approved_at | approved_at field is non-null for every source clip | manifest validation |
| Banned words | 0 hits in VO script and title card text | grep |
| No logo in frame | No Ryan Realty logo or text in any source clip frame after 0s (visual spot-check of 3 random source clips at mid-point) | frame extraction |
| citations.json | Source clip IDs, approved_at dates, theme, date_range present | file valid |

Viral scorecard minimum: 80. Hook discipline is critical even for compilations: the first source clip's most compelling moment should be at 3s (after the 3s intro). Consider trimming source clips to start at their best visual moment, not at 0s.

---

## 9. Failure modes + recovery

| failure | symptoms | recovery |
|---|---|---|
| Fewer than 3 approved clips in manifest for the theme/date range | search() returns <3 results | Surface to Matt: "Only <N> approved clips found for theme '<theme_slug>' in <start> to <end>. Minimum 3 required. Options: (1) expand date range, (2) choose a different theme, (3) add more clips to the asset library." Kill action row. |
| Source clip file missing from disk | File not found error | Attempt download from Supabase Storage. If download fails, remove clip from selection. If remaining clips < 3, surface to Matt. |
| Codec mismatch normalization slow | ffmpeg concat filter takes >5 min | This is expected for clips with different codecs; do not kill. Log the codec group assignment and warn Matt in the contact sheet that render took longer than usual. |
| xfade offset miscalculation | Audio or video pops at transition | Recompute offsets from actual ffprobe duration readings (not assumed clip_duration_sec). Clips may be slightly under or over the target duration after trimming. |
| ElevenLabs 429 | Rate limit on VO | Retry after 30s x 3. If still failing, render without VO (title card text only). Flag in contact sheet. |
| Compilation exceeds 60s | Too many clips at default duration | Auto-reduce: trim each clip to 4s instead of 5s. If still over 60s at 3 clips, surface to Matt to choose fewer clips. |
| Banned word in VO | Grep hit | Auto-fix with approved phrasing. 2 attempts max, then surface to Matt. |

---

## 10. Mandatory references

1. `CLAUDE.md` §0 (Data Accuracy) - no new market figures introduced; source clips were already verified at production time; approved_at field in manifest is the evidence.
2. `CLAUDE.md` §0.5 (Draft-First, Commit-Last) - render to `out/`; no commit until Matt's explicit approval.
3. `design_system/ryan-realty/SKILL.md` - title card and outro design: navy background, cream Amboqia display, Geist CTA text; no off-brand hex.
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - VO intro/outro script enforcement; no banned words; sentence case.
5. `marketing_brain_skills/research/tool-inventory.md` - ffmpeg (static-ffmpeg symlink, Active); ElevenLabs (Active); lib/asset-library.mjs (Active); Supabase MCP (Active).
6. `marketing_brain_skills/research/platform-bible.md` - §2 IG Reels spec; §10 TikTok spec; §12 YouTube Shorts spec; §26 logo-is-a-closer doctrine; no logo in viral variant.
7. `marketing_brain_skills/research/asset-library-map.md` - manifest query patterns (§14), lookup order (§16), storage destination after approval (§2).
8. `marketing_brain_skills/research/bend-market-bible.md` - neighborhood slugs for tag filtering in neighborhood_highlights theme; geography context for VO script.
9. `automation_skills/content_engine/SKILL.md` - all content:* actions execute through here; this producer is dispatched by the engine.
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer; repurpose content performs 15-30% higher with fresh VO vs. mute compilation per platform research.
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - no new AI-generated footage added to source clips without disclosure; ElevenLabs Victoria only for VO.
12. `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard minimum 80; hook engineering even for repurpose content; scorecard.json per render.

Additional references:
- `video_production_skills/asset-library/SKILL.md` - asset library producer contract; search() and register() function signatures.
- `video_production_skills/elevenlabs_voice/SKILL.md` - Victoria voice ID, model, and settings.
- `automation_skills/automation/repurpose_engine/` - higher-level orchestrator that calls this producer; manages scheduling to avoid clip reuse collision.
- `marketing_brain_skills/producers/REGISTRY.md` - Section B row `clip_compilation`, action_type `content:clip_compilation`.

---

## 11. Tool gap suggestions

| gap | current workaround | suggested improvement |
|---|---|---|
| Manifest does not have a `plays` field for all clips | rank_by="plays" falls back to "recency" when plays field is null | Wire `performance_loop` Sunday cron to write plays/saves metrics from IG Graph API back to manifest.json and Supabase asset_library table |
| xfade filter_complex string generation | Hand-constructed ffmpeg command | Encapsulate in a small Node.js helper `scripts/build_xfade_filter.mjs` that takes a clip list and returns the filter_complex string and audio merge map |
| Source clip thumbnail for contact sheet | Not implemented | Add a `ffmpeg -ss 2 -frames:v 1` thumbnail extraction step for each source clip before concat; embed thumbnails in contact sheet as a clip selection grid |
| Clip selection by engagement, not just recency | rank_by="plays" requires plays data | See performance_loop suggestion above; without plays data, best_of_month degrades to most-recent ordering |
| Year-in-review theme auto-selects too many clips | max_clips=6 may miss some months if the year had 50+ clips | Add month-stratified sampling for year_in_review: select top 1-2 clips per calendar month, then cap at max_clips across the year |

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`
