# Tool Inventory — YouTube Market Report Video

Last verified: 2026-04-30.

## 1. Render Engine — Remotion 4.0.290

**Workspace:** `listing_video_v4/` — 17 registered compositions, all portrait 1080x1920, 30fps. For YouTube market reports, create new compositions at 1920x1080 landscape.

**Render command:**
```bash
cd listing_video_v4 && npx remotion render src/index.ts <CompId> out/<name>.mp4 \
  --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92
```
Concurrency=1 is required (Chrome OOMs higher).

**Existing reusable transitions (all in `listing_video_v4/src/transitions/`):**

| Component | Use For | Notes |
|-----------|---------|-------|
| CrossfadeTransition | Most scene changes | 15-frame standard |
| WhipPanTransition | High-energy reveals (Scene 5 to 6) | 10 frames |
| LightLeakTransition | Warm transitions (Scene 6 to 7) | 20 frames |
| PushTransition | Title card exits | 15 frames |
| SlideTransition | Chart-to-chart transitions | 15 frames |
| DepthParallaxBeat | 3D Ken Burns on photos | Used in Scene 7 background |

**Existing Recharts components:** 9 chart types available in the Remotion project. Build market report charts on top of these.

**Secondary Remotion projects:**
- `video/cascade-peaks/` — Google 3D Tiles aerial flyovers (Three.js + R3F). ACTIVE.
- `video/market-report/` — Clean Remotion project ready for YouTube compositions.
- `video/brand-outro/` — Brand sting MP3s.

**24 shipped MP4s** in `listing_video_v4/public/v5_library/`.

## 2. AI Video Generation — Replicate

All models reachable via `REPLICATE_API_TOKEN`. NONE used for production yet (only headshots).

### Primary Models (use these first)

| Model | Replicate ID | Cost | Duration | Best For | Scene |
|-------|-------------|------|----------|----------|-------|
| Kling v2.1 Master | `klingai/kling-v2.1-master` | ~$1.40/5s | 5-10s | Cinematic exteriors, neighborhoods | Scene 6 fallback |
| Kling 3.0 | `klingai/kling-v3.0` | ~$0.07-0.14/sec | 5-15s | 4K native, Motion Brush, current #1 ELO | Scene 0 fallback, Scene 6 aerial |
| Seedance 1 Pro | `seedance/seedance-1-pro` | ~$0.10/sec | 5-10s | Cheapest cinematic, fastest | Scene 2 B-roll underlayer |
| Hailuo 02 | `minimax/hailuo-02` | ~$0.27/sec | 5-10s | Human motion, walk-and-talks | Scene 4 B-roll intercut |
| Wan 2.5 i2v | `wan-video/wan2.5-i2v-480p-v3` | ~$0.20/sec | 5-10s | Best image-to-video fidelity | Fallback for any scene needing photo-to-video |

### Secondary Models (fallbacks and specialty)

| Model | Replicate ID | Cost | Best For |
|-------|-------------|------|----------|
| Veo 3 | Google via Replicate | ~$2.50/5s | Text-to-video with native ambient audio |
| Veo 3 Fast | Google via Replicate | ~$1.25/5s | 80% quality at half cost |
| Luma Ray 2 720p | `luma/ray-2` | ~$0.40/sec | Cinematic camera for luxury content |
| Ray Flash 2 540p | `luma/ray-flash-2` | ~$0.18/sec | Draft/exploration (needs upscale) |
| Hunyuan Video | via Replicate | ~$0.20/sec | Stylized/illustrative |
| LTX Video | via Replicate | ~$0.05/sec | Rapid iteration/scratch |
| Flux Schnell | `black-forest-labs/flux-schnell` | ~$0.003/image | Static image generation for backgrounds, title cards |

### Blocked/Unavailable
- Runway Gen-4/4.5: fal.ai balance dry. Do not use.
- Sora: Sunsetting Apr 26 app / Sep 24 API 2026. Do not use.

### Usage pattern for market report
```
Scene 0 background: Google Earth Studio primary -> Google 3D Tiles fallback -> Kling 3.0 fallback
Scene 2 B-roll: Seedance 1 Pro at 15% opacity ($0.50) -> Unsplash + DepthParallaxBeat (free)
Scene 4 B-roll: Hailuo 02 at full opacity intercut ($1.35) -> Wan 2.5 from Bend photo ($1.00)
Scene 6 aerial: Google 3D Tiles primary -> Kling 3.0 4K ($2.10) -> Google Maps Static (free)
Scene 7 background: Unsplash + MiDaS + DepthParallaxBeat (free) -> Seedance 1 Pro ($1.00)
```

## 3. Voice and Audio — ElevenLabs

**Status:** Active. Creator tier. ~99K characters headroom this billing cycle.

**Victoria voice (LOCKED 2026-04-27, permanent):**
- Voice ID: `qSeXEcewz7tA0Q0qk9fH`
- Profile: middle-aged American, conversational, warm, trustworthy
- Saved on account as "Victoria — Ryan Realty Anchor"

**API calls:**

TTS generation:
```
POST https://api.elevenlabs.io/v1/text-to-speech/qSeXEcewz7tA0Q0qk9fH
{
  "model_id": "eleven_turbo_v2_5",
  "voice_settings": {
    "stability": 0.50,
    "similarity_boost": 0.75,
    "style": 0.35,
    "use_speaker_boost": true
  },
  "text": "...",
  "previous_text": "...",
  "output_format": "mp3_44100_128"
}
```

Forced alignment (MANDATORY for caption sync):
```
POST https://api.elevenlabs.io/v1/forced-alignment
```
Returns word-level timestamps. Convert to Remotion frames: `Math.round(timestamp * 30)`.

**BLOCKER:** `lib/voice/alignment.ts` helper NOT YET BUILT. Must build before first video.

**Env vars:** `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH`

**Existing assets:** 161 VO files in `listing_video_v4/public/audio/`. Synthesis scripts: `listing_video_v4/scripts/synth_vo_v5x.py`.

**Pronunciation overrides (IPA on eleven_v3 model):**
- Deschutes: `<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme>` ("duh-shoots")
- Tumalo: "TOO-muh-low"
- Tetherow, Awbrey, Terrebonne: add IPA tags as needed.

**Script rules:**
- Numbers spelled out: "475,000" becomes "four hundred seventy five thousand"
- Short sentences, two clauses max
- No commas where Matt would not pause
- No em-dashes, no semicolons
- `previous_text` chained across all lines

## 4. Maps and Geography

### Google Photorealistic 3D Tiles
**Status:** Active. `REMOTION_GOOGLE_MAPS_KEY` configured.
**Project:** `video/cascade-peaks/` — Three.js r128 + React Three Fiber + `3d-tiles-renderer` 0.4.10.
**Use:** Scene 6 aerial base layer. Camera path: 3,000m centered on Bend descending to ZIP centroids.
**Cost:** Free tier ~2,500 root tile loads/month. One render uses ~500-1,000.
**Settings:** `maximumScreenSpaceError: 16`.

### Google Earth Studio
**Status:** Free (browser tool, no API key needed).
**Use:** Scene 0 hook background. 8s zoom from 800km to 600m.
**Export:** 1920x1080, 30fps JPEG sequence. FFmpeg to H.264.

### Google Maps Static API
**Status:** Active. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
**Use:** Fallback for Scene 6 if 3D Tiles render fails. Styled satellite map of Bend.

### Google Geocoding
**Status:** NOT ENABLED. Returns 404. Needs toggle in Cloud Console.

### Census TIGER/Line GeoJSON
**Status:** Needs download and processing.
**Use:** ZIP code boundaries for Scene 6 `<BendZipMap>` SVG overlay.
**Processing:** Mapshaper to clip ZCTA shapefile to 97701/97702/97703/97708.

## 5. Imagery

### Unsplash API
**Status:** Active.
**Use:** Lifestyle photos for Scene 7 depth-parallax background. Community hero banners.
**Query examples:** "bend oregon family neighborhood", "central oregon landscape", "pacific northwest home"

### MiDaS v3.1 DPT-Large
**Status:** Available locally (PyTorch).
**Use:** Depth maps from Unsplash photos for `DepthParallaxBeat` 3D Ken Burns effect.
**Pipeline:** Unsplash photo -> MiDaS depth PNG -> DepthParallaxBeat component at `parallaxIntensity: 0.03`.

### Depth Anything V2
**Status:** Available locally (PyTorch).
**Use:** Alternative to MiDaS. Per-pixel depth for DepthFlow 2.5D parallax.

### Grok Imagine (xAI)
**Status:** Active. `XAI_API_KEY` configured.
**Use:** YouTube thumbnails. 4 variants per video.
**Prompt pattern:** "professional YouTube thumbnail, key stat overlay, Bend Oregon imagery, navy/cream color scheme, 1280x720"
**A/B test:** `thumbnail_generator` pipeline, epsilon-greedy 70/30, 1,000 impression minimum before winner.
**Fallback:** Flux Schnell on Replicate + Canva Connect API template.

### Shutterstock
**Status:** Active. Licensed footage for news clips, luxury inserts.

## 6. Data Sources

### Supabase (Primary)
**Project:** `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`).
**Tables:** `listings` (589K+), `listing_history` (4.3M), `price_history` (345K), `market_pulse_live` (10), `market_stats_cache` (1.4K).
**View:** `beacon_comparable_listings_v` (analytics, adds computed DOM). Note: legacy DOM computation via CloseDate–OnMarketDate. For video stats, use `days_to_pending` column on `listings` directly.
**Crons:** `refresh-market-stats` every 6h, `refresh-reporting-cache` daily 3:15am, `market-report` Sat 2pm.

### Spark API (Cross-check)
**Status:** Active. `SPARK_API_KEY` + `SPARK_API_BASE_URL` verified.
**URL:** `https://replication.sparkapi.com/v1`
**Use:** Hard pre-render gate. Cross-check every video figure. >1% delta = abort.
**Wins for:** Active inventory, current days-active for active listings.
**Loses to Supabase for:** Reconciled historical close data.

### SchoolDigger API
**Status:** Configured. `SCHOOLDIGGER_API_KEY`.
**Use:** School ratings for neighborhood deep-dive content.

## 7. Distribution

### YouTube Data API v3
**Status:** Enabled at project level. Upload code NOT in production.
**Auth:** Service account + domain-wide delegation.
**Upload:** Resumable upload protocol.
**Metadata:** Title, description, tags, thumbnail, category (22 = People & Blogs or 25 = News & Politics).

### YouTube Shorts
**Use:** 3 auto-extracted from long-form render (Scene 0 as 30s, Scene 6 as 60s, Scene 2 as 45s). Separate 1080x1920 portrait compositions.

### Social (blocked/limited)
- Instagram/Facebook: META_PAGE_ACCESS_TOKEN expired. Dead.
- TikTok: Draft state only. Sandbox.
- LinkedIn: Engagement bot only, no publishing.

## 8. Orchestration

### Inngest
**Status:** Active. Background job runner.
**Use:** Video pipeline trigger and fan-out. Named steps with `waitForEvent` for human review.
**Trigger:** Existing Vercel cron `/api/cron/market-report` (Saturday 2pm).

### Vercel Crons (12 active)
Key crons for video data freshness:
- `sync-delta`: every 10 min (keeps listings current)
- `refresh-market-stats`: every 6 hours
- `refresh-reporting-cache`: daily 3:15am
- `market-report`: Saturday 2pm (pipeline trigger)

## 9. Script Generation

### Claude API
**Use:** Generate VO script from storyboard template + data. Anti-slop rules baked into system prompt.
**Cost:** ~$0.10-0.15 per script.
**Output:** Filled `{{variable}}` template + SEO title/description/tags.

### OpenAI GPT-4o
**Status:** Active.
**Use:** Vision photo classification in listing workflow. Backup for script gen.

## 10. Synthesia (Avatar)
**Status:** Active (endpoint path quirk).
**Use:** Optional broker avatar market updates (not for monthly report format).
**Cost:** ~$3.15/45s.
**Note:** Market reports use faceless format. Synthesia is for the `avatar_market_update` skill, not this one.

## Cost Summary Per Video

| Component | Minimal | With AI B-roll |
|-----------|---------|---------------|
| ElevenLabs VO (~9,000 chars) | $0.30 | $0.30 |
| Claude script | $0.10 | $0.10 |
| Remotion Lambda render | $0.05-0.15 | $0.05-0.15 |
| Seedance Scene 2 B-roll | — | $0.50 |
| Hailuo Scene 4 B-roll | — | $1.35 |
| Grok thumbnails (4 variants) | $0.15 | $0.15 |
| S3/storage | $0.01 | $0.01 |
| **Total** | **~$0.60** | **~$2.60** |

## Critical Blockers (must resolve before first video)

1. `lib/voice/alignment.ts` — ElevenLabs forced-alignment helper not built. Required for caption sync. Est: 4h.
2. Census TIGER/Line GeoJSON for Bend ZIPs — not downloaded/processed. Required for Scene 6 map. Est: 2h.
3. YouTube upload code — API enabled but no production upload function. Est: 4h.
4. Inngest pipeline function — designed but not deployed. Est: 8h.
