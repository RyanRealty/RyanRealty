---
name: ai-video-production
description: Ryan Realty: AI Video Production Skill
---
# Ryan Realty: AI Video Production Skill

## When to Use

Use this skill when Matt asks to generate, produce, or plan AI-powered video content for social media, including photo-to-video animation, text-to-video generation, B-roll creation, or full viral video concepts.

## Before Starting

**STEP 0 (MANDATORY, READ FIRST):** `viral-video-quality-gate.md` in this folder. That is the hard enforcement gate — 6 phases (Concept, Prompt, Generation, Post-Processing, Viral Architecture, Post-Publish). Every single phase must clear before any API fires. All creator references and statistics in that skill were web-verified 2026-04-15 with source URLs. No exceptions, no bypass.

Then read these files in order:
1. `feedback_no_ai_video_slop.md`, Never fire a video API from narrative prose. Pull reference prompts, use block format, get Matt's approval on the brief first.
2. `feedback_cinematic_ai_video_prompt_architecture.md`, Mandatory prompt structure. This is the difference between professional output and generic AI garbage.
3. `feedback_no_real_estate_visuals.md`, Hard rule: zero houses, keys, families, neighborhoods. Science/nature/macro/abstract only. Stats are the only housing tether.
4. `feedback_no_branding_in_viral_video.md`, Hard rule: no logo, phone, URL, name inside the frame. IG handle in caption is the only attribution.
5. `feedback_ai_photo_to_video_scale.md`, Mandatory pre-flight checklist for every static-photo-to-video generation.

---

## AI Video Stack (April 2026)

### Photo-to-Video & Text-to-Video Models

**Kling 2.1 Standard** (via Replicate)
- Use case: scouting, B-roll variation, fast iteration
- Strength: depth inference, lateral tracking, 5-second clips without morph risk
- Cost: ~$0.02/5s at 720p
- Latency: 30-60 seconds
- Model slug: `kwaivgi/kling-v1-6-standard`

**Kling 3.0 Pro** (via Replicate, when available)
- Use case: long-form narrative (up to 120s), commercial hero shots
- Strength: narrative coherence, multi-scene stitching
- Cost: ~$0.08/clip
- Latency: 2-3 minutes
- Model slug: Check Replicate registry for current slug; Kling 3.0 launched mid-April 2026

**Veo 3.1** (via Gemini API, when available; typically requires native Google integration)
- Use case: commercial-grade 4K output, spatial audio, highest consistency
- Strength: camera control, temporal coherence, color consistency
- Cost: tier-based (typically $3-5/clip for hero work)
- Latency: 2+ minutes
- Status: not yet in Replicate; requires direct Gemini API. Flag as gap if Matt needs it.

**Flux Dev/Pro** (via Replicate)
- Use case: image generation for static frames or starter images for photo-to-video
- Strength: photorealism, design precision, text rendering
- Cost: $0.025/image (Dev), $0.05/image (Pro)
- Model slug: `black-forest-labs/flux-pro`

**Runway Gen-4 / Gen-4.5** (direct API, not in Replicate)
- Use case: camera control, arc orbits, crane moves, ads
- Status: KEY GAP, Matt does not have Runway API key. Add to gaps list.
- Do not recommend until key is acquired.

---

## Mandatory Prompt Architecture

Every AI video prompt MUST follow this block-format structure. Tag-stacking, narrative prose, and adjective-heavy prompts produce slop.

### Template

```
[SCENE in 1 narrative sentence, subject + specific action + location]
Camera: [focal length] + [movement] + [angle]
Lighting: [fixture/technique] + [time of day] + [color temp]
Film Stock/Reference: [specific stock OR DP name, NOT "cinematic"]
Color Palette: [3 named colors, NOT adjectives]
Speed: [f-stop OR fps for slow-mo]
Duration: [N seconds]
```

### Vocabulary Reference (Use These)

**Focal lengths (all recognized by modern AI models):**
- 24mm (wide, environmental)
- 35mm (documentary, naturalistic)
- 50mm (standard, neutral)
- 85mm (portrait compression)
- 100mm (macro)
- 135mm (extreme compression)

**Camera movement (use exact phrases):**
- dolly in/out (forward/backward)
- gimbal tracking (lateral smooth)
- crane up/down (vertical lift)
- whip pan (fast horizontal)
- handheld (micro-movements)
- locked-off (static on tripod)

**Lighting (reference-specific):**
- softbox (diffused, even)
- Kino Flo (flicker-free, theatrical)
- practicals (in-scene sources)
- rim light (backlit separation)
- chiaroscuro (high contrast, painterly)
- volumetric (god rays, particles)

**Time of day:**
- golden hour (3200K warm sidelight)
- blue hour (5600K, dusk)
- overhead noon (flat, high key)
- tungsten night (2700K, warm)

**Film stocks:**
- Kodak Ektachrome (saturated, vibrant)
- Kodak 2383 (warm, classic)
- ARRI Alexa (neutral, pro cinema)
- Fujifilm Provia (cool greens, tungsten-shift)
- Kodak Vision 250D (neutral, filmic)

**DP references (instead of "cinematic"):**
- Roger Deakins (painterly, high-contrast, chiaroscuro)
- Emmanuel Lubezki (naturalistic, flowing, organic light)
- Bradford Young (rich, deep shadows, saturated)

### Banned Vocabulary (Never Use)

Delete these words entirely. They signal slop:
- cinematic
- epic
- breathtaking
- stunning
- beautiful
- amazing
- gorgeous
- premium
- creamy
- brooding
- heavy
- moody
- 4K
- ultra HD
- high quality
- masterpiece
- photorealistic (use specific film stock instead)

---

## Working Examples (Pass & Fail)

### PASS: Macro Ice Crystal Formation

```
Macro close-up of frost crystals forming on a leaf, golden hour backlit rim light with cool blue shadow fill. Camera slowly dollies left revealing additional crystals in soft bokeh.
Camera: 100mm macro, gimbal dolly left at 5% forward motion, f/1.4 shallow depth of field
Lighting: Golden hour rim backlight with cool blue shadows, diffused ambient fill
Film Stock: Kodak Ektachrome
Color Palette: cool cyan crystal, warm amber rim, charcoal leaf
Duration: 5 seconds
```

### PASS: Fluid Dynamics (Science/Nature Tether Only)

```
High-speed fluid dynamics: ink droplet impacts into still water, creating a mushroom cloud of expanding dye. Overhead locked camera, no movement, tungsten practical lights create amber-to-teal color separation.
Camera: 35mm, locked-off on overhead rig, f/8 sharp focus
Lighting: Tungsten practicals above subject, cool blue fill from below
Film Stock: ARRI Alexa
Color Palette: amber plume, teal water, charcoal background
Duration: 4 seconds
```

### FAIL: Generic Narrative (Banned Approach)

```
A beautiful stunning aerial drone footage of Bend, Oregon showing majestic mountains and cinematic golden hour light with amazing epic orchestral music vibes. This should be 4K ultra HD masterpiece quality.
```

Why it fails: narrative prose, banned adjectives ("beautiful," "stunning," "cinematic," "amazing," "epic"), no structured camera/lighting/stock data, vague duration.

### FAIL: Real Estate Visuals (Violates Hard Rule)

```
A realtor walking through a modern luxury kitchen with stainless steel appliances and granite countertops. Camera moves through the space showing the beautiful kitchen island and high-end finishes.
```

Why it fails: real estate interior, violates "zero housing visuals" rule. Reels must use science/nature/macro/abstract. Housing tether comes only from stat overlay.

---

## Photo-to-Video Pre-Flight Checklist

Run this BEFORE firing any Kling/Runway/Veo call. Skipping steps = slop.

### Source Photo Selection (Reject If Any Fail)

- [ ] **Depth**: clear foreground / subject / background layers (foreground ≥8 ft from subject)
- [ ] **One focal subject**: no crowds, no competing elements
- [ ] **No human motion required**: static poses only (walking/turning/gesturing = morph hell)
- [ ] **No visible text/signage**: AI hallucinates text mutations
- [ ] **Natural motion implied**: water, foliage, smoke, light, flags give permission for secondary motion
- [ ] **Center-weighted composition**: primary subject in center 40-60% of frame
- [ ] **No fine-detail edges**: nothing critical within 10% of frame edge
- [ ] **Landscape source, safe-crop to 9:16**: prefer 16:9 source, crop vertical after generation when possible

### Prompt Checklist

- [ ] Uses block-format template exactly (scene, camera, lighting, stock, palette, speed, duration)
- [ ] No banned adjectives (cinematic, epic, stunning, beautiful, amazing)
- [ ] Focal length specified (not "wide" or "tight")
- [ ] Camera movement explicit (dolly/track/lock, not vague "moves")
- [ ] Specific film stock or DP reference (not "high quality")
- [ ] Three named colors for palette (not adjectives)
- [ ] Duration 5-8 seconds unless explicit reason otherwise
- [ ] Negative prompt included verbatim (30+ terms from feedback_ai_photo_to_video_scale.md)

### Output Readiness

- [ ] Export path prepared (e.g., `~/Downloads/tumalo-hero-720.mp4`)
- [ ] Post-processing plan ready (CapCut or ffmpeg for stabilize + color lock + speed ramp)
- [ ] Review gates set: Matt approves brief before API fires, approves preview before finalizing

---

## API Integration: Replicate Video Generation

### Kling 2.1 Photo-to-Video: Node.js Fetch Example

```javascript
const generateKlingVideo = async (imageUrl, prompt, duration = 5) => {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "kwaivgi/kling-v1-6-standard",
      input: {
        image_url: imageUrl,
        prompt: prompt,
        duration: duration,
        aspect_ratio: "9:16"
      }
    })
  });
  
  const prediction = await response.json();
  return prediction.id; // Poll this ID for status
};

// Poll for completion
const pollVideo = async (predictionId) => {
  let done = false;
  let videoUrl = null;
  
  while (!done) {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` } }
    );
    const prediction = await response.json();
    
    if (prediction.status === "succeeded") {
      videoUrl = prediction.output;
      done = true;
    } else if (prediction.status === "failed") {
      throw new Error(`Generation failed: ${prediction.error}`);
    }
    
    if (!done) {
      await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
    }
  }
  
  return videoUrl;
};
```

### Kling 2.1 Text-to-Video: Curl Example

```bash
curl -X POST https://api.replicate.com/v1/predictions \
  -H "Authorization: Token $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "kwaivgi/kling-v1-6-standard",
    "input": {
      "prompt": "Macro close-up of frost crystals forming on a leaf, golden hour backlit rim light...",
      "duration": 5,
      "aspect_ratio": "9:16"
    }
  }'
```

### Cost Control Strategy

**Default workflow:**
1. Scout on Kling 2.1 Standard 720p, 5 seconds (~$0.02/clip)
2. Iterate 1-2 variations (still $0.02 each)
3. Matt approves concept
4. Generate hero on Kling 2.1 Pro 1080p, 8-10 seconds (~$0.08), OR if client quality required, wait for Veo 3.1 access

Never batch-generate at 1080p before Matt's approval. The upside isn't worth the cost.

---

## Workflow: From Brief to Upload

### 1. Brief Phase (Async with Matt)

Create a brief.md file with:
- Idea (one sentence)
- Hook (why this stat matters)
- Platform (IG Reel, TikTok, Facebook, Story)
- Aspect ratio
- Visual concept (science/nature/macro/abstract only)
- Stat or voiceover line (the housing tether)
- Reference mood (e.g., "similar to [elite creator] work on X")

### 2. Source Image Selection

Pull from:
- **Unsplash API** (use `UNSPLASH_ACCESS_KEY`) for stock: `/photos/random?query=frost+crystal`
- **Flux text-to-image** (via Replicate) for custom starter images
- **Matt-provided photos** (from Drive or camera roll)

Run source photo through pre-flight checklist. Reject if any criteria fail.

### 3. Prompt Draft in Block Format

Write in structured-block format from `feedback_cinematic_ai_video_prompt_architecture.md`. Strip banned adjectives. Show to Matt for approval before API call.

### 4. Generate (Scout Phase)

Fire Replicate API on Standard/720p/5s. Poll until complete. Download to `~/Downloads/` with naming convention `{concept}-{duration}-{quality}.mp4` (e.g., `frost-crystals-5-720.mp4`).

### 5. Matt Review

Share preview with Matt. If approved, proceed to final. If iterate, ask what to change and regenerate (usually 1-2 variations max).

### 6. Post-Processing (CapCut or ffmpeg)

**Stabilization pass:**
- CapCut: Effects > Stabilize, subtle slider (0.3-0.6)
- Do not over-stabilize; preserve intentional parallax

**Color lock:**
- First frame white balance as reference
- Grade tail frames if drift >5%

**Speed ramp:**
- Slow final 15% to 0.85x for landing feel

**Export:**
- H.264, 1080x1920, 24-30fps, 6 Mbps target bitrate

### 7. Post to IG or TikTok

**Instagram Reel:** Use Meta Graph API endpoint or Chrome MCP fallback (see api-integration-wrappers.md)
**TikTok:** Use Chrome MCP until TikTok Business API is app-review cleared
**Facebook:** Use Meta Graph API or Chrome MCP

Include caption with DM CTA (e.g., "DM me 'strategy'"), stat recap, and hashtags. No branding in video; branding lives in caption and bio.

---

## Output Artifacts (Always Deliver These)

Whenever a video production completes, save these files:

```
tumalo-market-update/
  ├── brief.md (idea, hook, platform, visual concept)
  ├── prompt.md (final approved block-format prompt)
  ├── preview_720.mp4 (scout phase output)
  ├── final_1080.mp4 (post-processed hero)
  ├── thumb.png (1080x1920 frame grab for cover)
  ├── caption.md (platform captions with DM CTA + hashtags)
  └── dm_trigger.md (DM keyword + expected followup)
```

Store in Drive under `06_Marketing & Brand > Marketing > Video Production > [Season]/[Month]`.

---

## Verification Checklist

Before saying a video is done:

- [ ] Brief was written and Matt approved it before any API call
- [ ] Prompt uses block-format structure with zero banned adjectives
- [ ] Pre-flight checklist was run and all items checked
- [ ] No real estate visuals (zero houses, keys, families, neighborhoods)
- [ ] No branding inside video frame (zero logo, phone, URL, name)
- [ ] Stat overlay or voiceover is the ONLY housing tether
- [ ] Visual could run on science/nature YouTube channel unmodified
- [ ] Post-processing applied (stabilize, color lock, speed ramp)
- [ ] Export specs match: 1080x1920, H.264, 24-30fps, 6 Mbps
- [ ] All output artifacts saved to Drive with proper naming
- [ ] Caption written with DM CTA (e.g., "DM me 'strategy'")
- [ ] Posted to platform via API or Chrome MCP
