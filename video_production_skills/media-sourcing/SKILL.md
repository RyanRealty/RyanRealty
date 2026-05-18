---
name: media-sourcing
description: Canonical decision skill for choosing image, video, and audio sources across every Ryan Realty content build. Covers asset library, Unsplash, Shutterstock, Pexels, Pixabay, Supabase listing photos, AI image generation (Vertex Imagen 4, Nano Banana 2, Grok Imagine), AI video generation (Kling, Veo 3, Hailuo, Seedance, Wan, Luma Ray, LTX, Hunyuan), specialty pipelines (depth_parallax, depthflow, earth_zoom, Google Photorealistic 3D Tiles), and ambient audio (Veo native, ElevenLabs SFX, Foley Control). Use this skill BEFORE any video, blog, or ad render whenever the agent needs to pick where a photo / clip / SFX comes from. Use this skill whenever the user says "where should I get the photo for X", "what's the right tool for [B-roll / hero / drone / animation]", "make a video clip from this image", "generate an image of X", or any other media-sourcing decision. Use this skill ALSO when reviewing why a render's photos look generic, mismatched, or off-brand.  the answer is usually in the sourcing decision tree below.
---

# Media Sourcing Skill.  Ryan Realty

**Scope:** Single decision skill for choosing image, video, and audio sources for every Ryan Realty content build. Replaces the scattered "use Unsplash" defaults and ad-hoc fetch scripts with one routing document.

**Status:** Authored 2026-05-07 from the full media-tools audit. Cross-referenced from every video / blog / ad skill.

**Key insight:** the team has paid access or live integrations for ~20 distinct media sources. The agent's job is not to know every source.  it's to pick the right source FOR THIS ASK. This skill is the routing logic.

---

## 1. Hard rules (override everything below)

These rules trump every cost/speed/preference signal. If you are about to break one, halt and surface to Matt.

1. **No AI imagery for listing interiors, ever.** A listing video MUST use real MLS photos for every interior shot. AI substitutes for kitchens, bedrooms, bathrooms, etc. = compliance fail (misrepresentation) per Oregon real estate practice.
2. **No fabricated Bend geography.** AI generation is banned for Bend / Smith Rock / Mt. Bachelor / Old Mill / any specific Central Oregon landmark. Fake Pilot Butte = fake Bend = trust fail. Use a real photo (asset library / Shutterstock / Unsplash) or skip the visual.
3. **AI imagery requires the AI VISUALIZATION caption tag** when used for news clips, market reports, or anywhere the viewer might assume the image is real. Per `ANTI_SLOP_MANIFESTO.md`.
4. **Shutterstock requires per-asset license before production use.** Search and preview is free; rendering a licensed asset into a deliverable that ships is a compliance step. Track license IDs in `citations.json`.
5. **Supabase listing photos are the ONLY source for listing video photos.** No exceptions, no AI substitutes. Min 15 photos required to build a listing reel.  if fewer, halt.
6. **Imagen 4 sunsets June 30, 2026.** After that date, route to Nano Banana 2. Update any code path that still references `imagen-4` before the cutover.
7. **No photo repeats inside a single render.** Per `market-data-video/SKILL.md` §20. The diversity assertion in `build-cities.mjs::assignPhotoSlots()` enforces this.  never bypass it.
8. **No people-as-subject in market-report photos.** Photos with humans as the subject (rock climbers, hikers, models) are banned for market-report scenes per `market-data-video/SKILL.md` §9. Background figures are OK; foreground people are not.

---

## 1.5 Asset library is the canonical first lookup

Before reaching out to ANY external source (Unsplash, Shutterstock, Pexels,
Replicate, etc.), every photo / video / audio decision MUST start here:

```bash
node lib/asset-library.mjs search --geo <city> --type photo --unused-only
```

If the library has ≥ 10 unused approved photos for the target city, use them
and skip the external fetch entirely. The library de-duplicates API calls,
prevents photo repeats within a render, and tracks license compliance.

**Only fall through to external sources when the library lacks variety** (fewer
than the needed N unused approved photos). When you do fetch externally, the
fetch script (`fetch-photos.mjs`, `fetch-unsplash.mjs`, `fetch-pexels.mjs`,
`fetch-shutterstock.mjs`) auto-registers every download so the next build
finds it here.

Full documentation: `video_production_skills/asset-library/SKILL.md`.

---

## 2. Source registry

### 2.1 Stock photo libraries

| Source | Status | Cost | Speed | Env vars | Best for |
|---|---|---|---|---|---|
| **Asset Library** | ✅ Live | $0 (internal, curated) | Instant local query | (CLI: `python3 ~/Documents/Claude/Projects/ASSET_LIBRARY/asset_index.py`) | **First lookup for any photo**.  Bend-specific curated set, approval-tracked |
| **Unsplash** | ✅ Live | Free, attribution required | Instant API (50 req/hr) | `UNSPLASH_ACCESS_KEY` | Free fallback for landmark photos when asset library lacks variety |
| **Shutterstock** | ✅ Live (search free, license per-use) | ~$1.50-$10 / image, paid plan req'd for video | Instant search | `SHUTTERSTOCK_API_KEY`, `SHUTTERSTOCK_API_SECRET` | Premium quality + iconic Bend photography. License before render. |
| **Pexels** | ⚠️ Key in `.env.local` (commented out) | Free, no attribution | Instant API | `PEXELS_API_KEY` (uncomment) | Secondary fallback to Unsplash, different photo pool |
| **Pixabay** | ⚠️ Key may be unprovisioned | Free, no attribution, commercial OK | Instant API | `PIXABAY_API_KEY` | Free B-roll **video**.  Shutterstock free plan covers images only, Pixabay covers video |
| **Supabase listing_photos** | ✅ Live | $0 (own data) | Near-instant query | `SUPABASE_SERVICE_ROLE_KEY` | **Listing videos only.** Real MLS photos. Min 15 per listing. |

### 2.2 AI image generation

| Source | Status | Cost | Best for |
|---|---|---|---|
| **Vertex AI Imagen 4** | ✅ Live, **sunsets 2026-06-30** | $0.04 / image | Brand-color-accurate marketing graphics. Migrate to Nano Banana 2 before sunset. |
| **Nano Banana 2** (Gemini 3.1 Flash Image, fal.ai exclusive) | ⚠️ Balance exhausted on fal.ai | $0.08 / image (1K) | Imagen 4 successor. **In-image text rendering** (price, address, dates baked into the image). |
| **Nano Banana Pro** (Gemini 3 Pro Image) | ⚠️ Balance exhausted on fal.ai | $0.15 / image | Higher quality variant of Nano Banana. |
| **xAI Grok Imagine** (Aurora) | ✅ Live | ~$0.04 / image (CometAPI) | Stylized non-photoreal illustrations for evergreen content. Signals "teaching moment." |
| **Replicate FLUX Schnell** | ✅ Live | $0.003 / megapixel | Cheapest, fastest. Iteration / test / scratch. |
| **Replicate FLUX Pro** | ✅ Live | $0.05 / image | Higher quality FLUX tier. |
| **OpenAI DALL-E** | ✅ Live (low priority) | $0.04-0.08 / image | Lower quality than Imagen / FLUX.  not used in production. GPT-4o vision IS used for photo classification. |

### 2.3 AI video.  image-to-video

| Model | Status | Cost | Endpoint | Best for |
|---|---|---|---|---|
| **Kling v2.1 Master** (Replicate) | ✅ Live | ~$1.40 / 5s, ~$2.80 / 10s | `kwaivgi/kling-v2.1-master` | **Default for listing hero shots.** Best motion realism. |
| **Kling v3 Pro** (fal.ai exclusive) | ⚠️ Balance | $0.112-0.196 / s | `fal-ai/kling-video/v3/pro/image-to-video` | 4K + native audio + multi-character lip sync. fal-only. |
| **Veo 3** (Replicate) | ✅ Live | ~$2.50 / 5s | `google/veo-3` | **Native synced ambient audio** (creek, fireplace, wind). Luxury beats. |
| **Veo 3 Fast** (Replicate) | ✅ Live | ~$1.25 / 5s | `google/veo-3-fast` | Market report B-roll. ~80% Veo 3 quality at half the cost. |
| **Veo 3.1** (Vertex AI direct) | ✅ Live, separate billing | $0.10-0.50 / s | Vertex AI SDK | Cheaper long-term path for sustained volume. |
| **Hailuo 02** (Replicate) | ✅ Live | ~$0.27 / s | `minimax/hailuo-02` | Lifestyle B-roll with **people** (best face consistency). |
| **Seedance 1 Pro** (Replicate) | ✅ Live | ~$0.10 / s | `bytedance/seedance-1-pro` | **Cheapest cinematic tier.** Bulk market-report B-roll. |
| **Seedance 2.0** (fal.ai exclusive) | ⚠️ Balance | TBD / s | `fal-ai/seedance-2.0` | **Multi-shot narrative video**.  one prompt = sequence with cuts. fal-only. |
| **Wan 2.5 i2v** (Replicate) | ✅ Live | ~$0.20 / s | `wan-video/wan-2.5-i2v` | Best **start-frame fidelity** when source photo must remain recognizable. |
| **Luma Ray 2 720p** (Replicate) | ✅ Live | ~$0.40 / s | `luma/ray-2-720p` | **Luxury hero shots.** Drone-style sweeps. |
| **Luma Ray Flash 2 540p** (Replicate) | ✅ Live | ~$0.18 / s | `luma/ray-flash-2-540p` | Draft / exploration before final Ray 2 render. |
| **Hunyuan Video** (Replicate) | ✅ Reachable | ~$0.20 / s | `tencent/hunyuan-video` | Stylized / meme / social-only content. |
| **LTX Video** (Replicate) | ✅ Live | ~$0.05 / s | `lightricks/ltx-video` | **Scratch / iteration.** Near-realtime, not production quality. |

### 2.4 Specialty pipelines

| Pipeline | Status | Best for |
|---|---|---|
| **depth_parallax** (MiDaS) | ✅ Coded, deps required | Hero exterior shots with strong depth layers.  turns a still photo into a dolly-zoom effect |
| **depthflow_pipeline** (Depth Anything V2) | ⚠️ Scaffolded, not installed | Better than MiDaS at depth discontinuities (eaves, rooflines). Install before next listing build. |
| **cinematic_transitions** | ✅ Live | 5 Remotion transition components: Crossfade, LightLeak, WhipPan, Push, Slide |
| **audio_sync** | ✅ Live | Beat-detection + match-cuts via ffmpeg + librosa |
| **earth_zoom** | ✅ Live (manual step) | Google Earth Studio (browser) → PNG sequence → Remotion. Aerial-to-ground intros. |
| **Google Photorealistic 3D Tiles** | ✅ Live | Property flyovers from lat/lng. Already used in `video/cascade-peaks/`. |
| **Synthesia** (avatar video) | ✅ Live | Matt avatar weekly market updates. AI disclosure required. |

### 2.5 Ambient audio / SFX

| Source | Status | Best for |
|---|---|---|
| **Veo 3 native ambient audio** | ✅ Live | Generated SYNCHRONOUSLY with video.  fireplace crackle, creek, wind.  perfect lip sync to motion |
| **ElevenLabs Sound Effects** | ✅ Live (same key as VO) | One-off SFX: whoosh, sub-bass thump, transition sounds. `/v1/sound-generation` |
| **Foley Control** (fal.ai) | ⚠️ Balance | Generates synced ambient SFX from a silent video input. Unique.  no equivalent on Replicate. |
| **Hand-curated royalty-free music** | ✅ Existing library | `public/audio/`.  hand-curated tracks from Pixabay Music, Uppbeat, YouTube Audio Library, Artlist, Epidemic Sound |

---

## 3. Decision tree.  pick a source by asset need

### Need a real Bend / Central Oregon landmark photo
Asset library (`asset_index.py search --geo bend`) → Unsplash with landmark-specific query (Pilot Butte, Mt. Bachelor, Old Mill, Drake Park, Smith Rock, Tumalo Falls, Three Sisters) → Shutterstock licensed search → **Do NOT** use AI generation (Hard rule §1.2).

### Need a listing exterior or interior photo
Supabase `listing_photos` table ONLY. No substitutes. If <15 photos available, halt and wait for photographer delivery.

### Need cinematic motion FROM a listing photo (animated B-roll for listing reels)
Kling v2.1 Master (default, $1.40 / 5s) → Wan 2.5 i2v (when start-frame fidelity matters) → Hailuo 02 (lifestyle / people) → Seedance 1 Pro (budget volume). **Never** for listing interiors.  depth_parallax or Ken Burns only for interior shots.

### Need city B-roll for a market report
Veo 3 Fast via Replicate ($1.25 / 5s, includes ambient audio) → Veo 3 ($2.50, higher quality) → Asset library + Ken Burns → Unsplash with **landmark-specific** queries (NOT generic "mountain" stock).

### Need a luxury property video (Tetherow, Awbrey, $1.5M+)
Luma Ray 2 720p ($0.40 / s, drone-language sweeps) + Veo 3 for ambient-audio beats + licensed Shutterstock 4K luxury interior footage **only when it does not contradict the actual home's reality**.

### Need a stylized illustration (evergreen / educational content)
Grok Imagine (`grok-imagine-image-pro`) → Replicate FLUX Schnell (cheap, fast) → Imagen 4 (brand color discipline, sunset 2026-06-30) → Nano Banana 2 post-cutover.

### Need news clip footage
Shutterstock (licensed, preferred for credibility) → Unsplash (free fallback for generic B-roll) → Remotion code-generated graphics → AI generation as last resort with required "AI VISUALIZATION" caption tag.

### Need a drone / aerial shot
Google Photorealistic 3D Tiles + Remotion (property flyover from `listings.Latitude/Longitude`) → Google Earth Studio (free, browser-only, earth-zoom intro) → Luma Ray 2 T2V with "aerial sweep" prompt → Real drone footage (when delivered by photographer).

### Need lifestyle / community B-roll (dog parks, trails, breweries)
Asset library first → Pixabay video (free, commercial OK, no attribution) → Shutterstock images (free plan) → Unsplash stills + Ken Burns motion.

### Need ambient audio / SFX for a video
Veo 3 native ambient audio (generated WITH the visual clip) → ElevenLabs Sound Effects (one-off SFX, same key as VO) → Foley Control on fal.ai (when balance restored) → Hand-curated track from `public/audio/`.

### Need an in-image text overlay (price, address, date baked in)
Nano Banana 2 (post-fal-balance-restore).  unique capability, no equivalent on Replicate. If unavailable, fall back to Remotion text overlay rendered separately.

---

## 4. Per-format sourcing matrix

| Content type | Photos | Cinematic motion | Stock video | AI video | AI image | Ambient audio |
|---|---|---|---|---|---|---|
| **Market report (short-form)** | Asset lib → Unsplash landmark | Ken Burns only | Veo 3 Fast for hero | Banned for fake Bend geography | Charts only (data viz) | Veo 3 native or none |
| **YouTube long-form** | Same as short-form + drone | Ken Burns + Kling | Veo 3 Fast (bulk B-roll) | Same constraint | Charts + agent-bg illustrations | Veo 3 native + ElevenLabs SFX |
| **Listing reel (standard)** | Supabase MLS only | Kling v2.1 Master, Wan 2.5 | Banned (use real photos) | Banned for interiors | Banned for interiors | Hand-curated music, no Veo SFX |
| **Listing reel (luxury, $1.5M+)** | Supabase MLS + licensed lux interior B-roll | Luma Ray 2 720p | Shutterstock 4K interior (licensed) | Allowed for non-interior beats | Banned for interiors | Veo 3 ambient (creek, fireplace) |
| **News clip** | Shutterstock licensed → Unsplash | Veo 3 Fast for context | Shutterstock licensed | Allowed with AI VISUALIZATION tag | Allowed with disclosure | ElevenLabs SFX |
| **Neighborhood overview** | Asset library Bend-specific → Unsplash landmark | Veo 3 Fast for sweeps | Pixabay (free video) | Banned for fake Bend geography | Stylized illustrations OK | Hand-curated music |
| **Evergreen / educational** | Grok Imagine illustrations + Unsplash | Veo 3 Fast | Pixabay | Allowed (signals teaching) | Allowed | ElevenLabs SFX |
| **Meme / viral cut** | Asset lib → Unsplash | Hunyuan Video (stylized) | Pixabay | Allowed | Allowed | Trending audio |
| **Avatar market update** | Synthesia avatar | N/A | N/A | N/A | N/A | Synthesia native |
| **Blog post hero image** | Same as the matching video | N/A | N/A | N/A | Imagen 4 / Nano Banana 2 OK | N/A |
| **FB lead-gen ad creative** | Re-uses short-form video | Re-uses short-form | N/A | N/A | N/A | N/A |

---

## 5. Cost ledger (per video / deliverable)

| Format | Typical media cost | Notes |
|---|---|---|
| Market report short-form | $0 (Unsplash).  $30 (Shutterstock images) | Free path is the default. Upgrade to Shutterstock when Unsplash inventory is thin for the city. |
| YouTube long-form | $5.  $50 | Adds ~5 Veo 3 Fast clips ($6) + maybe one Luma Ray hero ($2). |
| Listing reel (standard) | $20.  $40 | 6-12 Kling v2.1 Master clips at $1.40 each = $8-$17. Plus depth_parallax (free). |
| Listing reel (luxury) | $60.  $200 | Luma Ray 2 hero ($2) + Veo 3 ambient beats ($10) + Shutterstock 4K interior B-roll ($15-50) + Kling ($30). |
| News clip | $5.  $25 | Shutterstock licensed footage if used ($10) + maybe one Veo 3 Fast ($2). |
| Neighborhood overview | $0.  $20 | Asset library + Unsplash + Pixabay video = $0. Upgrade if production volume justifies. |
| Avatar market update | ~$3 (Synthesia minute fee) | + ElevenLabs ~$0.50 for VO. |
| Blog hero image | $0.  $0.20 | Imagen 4 or Grok Imagine. Or screenshot a chart from the video for free. |
| FB lead-gen ad | $0 incremental | Re-uses the short-form video.  no additional media cost. |

Multiply by city count for monthly market reports across 6 cities. Budget guidance: Matt sets a monthly cap; pipeline tracks running total in `citations.json`.

---

## 6. Status.  last verified 2026-05-07

| Service | Status | Notes |
|---|---|---|
| Unsplash | ✅ | 50 req/hr cap noted |
| Shutterstock | ✅ Search free / license per-use | Video plan upgrade pending |
| Pexels | ⚠️ Commented out | Uncomment to enable as Unsplash secondary |
| Pixabay | ⚠️ Provisioning unconfirmed | Verify before relying on for video |
| Asset Library | ✅ | CLI at `~/Documents/Claude/Projects/ASSET_LIBRARY/` |
| Supabase listing_photos | ✅ | Service role key live |
| Vertex AI Imagen 4 | ✅ until 2026-06-30 | Migrate to Nano Banana 2 before sunset |
| Vertex AI Veo 3.1 | ✅ | Direct billing path |
| Replicate (Kling, Veo, Hailuo, Seedance, Wan, Luma, LTX, Hunyuan) | ✅ | `REPLICATE_API_TOKEN` |
| fal.ai | ⚠️ Balance exhausted | Top up to unlock Kling v3 Pro, Seedance 2.0, Nano Banana 2, Foley Control |
| Grok Imagine | ✅ | `XAI_API_KEY` |
| Synthesia | ✅ | `SYNTHESIA_API_KEY` |
| Google Photorealistic 3D Tiles | ✅ | Maps key live |
| ElevenLabs Sound Effects | ✅ (same key as VO) | Untapped.  wire into pipelines that need SFX |

When a service is down, fall through the priority order in §3 and surface the substitution to Matt before render.

---

## 7. Integration code snippets (canonical patterns)

The fully-working scripts live at the paths below. Reference rather than copy-paste.

| Source | Script |
|---|---|
| Unsplash fetch | `video/market-report/scripts/fetch-unsplash.mjs` (Bend-specific landmark search + scoring) |
| Asset library lookup | `python3 ~/Documents/Claude/Projects/ASSET_LIBRARY/asset_index.py for {city} --type photo --filter approved` |
| Supabase listing photos | See `listing_reveal/SKILL.md` Step 1 SQL pattern |
| Replicate Kling | See `listing_reveal/SKILL.md` and `listing-tour-video/SKILL.md` for the canonical fetch + poll loop |
| Vertex AI Imagen | `@google/genai` SDK, project `ryan-realty-tc`, location `us-central1` |
| Shutterstock search | See `lifestyle-community/SKILL.md` curl pattern |
| ElevenLabs SFX | `POST /v1/sound-generation` (same auth as VO) |

When the same call appears in 3+ skills, lift it to a script in `video/shared/scripts/` and have skills reference it (single source of truth, kills copy-paste drift).

---

## 8. Cross-references

- `video_production_skills/API_INVENTORY.md`.  service status (this skill cross-references; do not duplicate status here)
- `video_production_skills/VISUAL_STRATEGY.md`.  creative brief per content type (this skill is operational; that is creative)
- `video_production_skills/ai_platforms/SKILL.md`.  AI model routing (deeper specs per model)
- `video_production_skills/depth_parallax/SKILL.md`.  image-to-3D effect (specialty pipeline)
- `video_production_skills/depthflow_pipeline/SKILL.md`.  depth-based parallax (specialty pipeline, install pending)
- `video_production_skills/earth_zoom/SKILL.md`.  aerial-to-ground intros
- `video_production_skills/cinematic_transitions/SKILL.md`.  Remotion transitions
- `video_production_skills/audio_sync/SKILL.md`.  beat-matched cuts
- `video_production_skills/listing_reveal/SKILL.md`.  uses MLS photos + AI motion (canonical example)
- `video_production_skills/market-data-video/SKILL.md` §20.  photo diversity rule (no repeats per render)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned content rules (canonical)
- `social_media_skills/blog-post/SKILL.md`.  uses media-sourcing for hero image + chart screenshots
- `social_media_skills/facebook-lead-gen-ad/SKILL.md`.  re-uses video from short-form market report
