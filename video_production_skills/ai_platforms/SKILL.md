# AI Video Platforms — Selection, Pricing, Prompt Architecture

**When to use.** You're picking *which* AI generation tool to fire and *what* prompt format to use. Image generation, photo-to-video, text-to-video, multi-image-to-video, voiceover, music. This skill is the source of truth for the platform landscape, current pricing, API access status, and the block-format prompt template that produces non-slop output.

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) §4 (the "AI when warranted" rules — interiors banned, hero exteriors + landscape inserts only). Then [`../quality_gate/SKILL.md`](../quality_gate/SKILL.md) — every AI clip must clear the 6-phase gate before it's stitched.

**Companion file:** [`platform_research.md`](platform_research.md) — competitive research dump from 2026-04-14 covering Veo, Kling, Runway, Pika, Luma, Sora-sunsetting, ElevenLabs, Suno, Synthesia, fal.ai. Refer back when a new model ships and you need a benchmark.

---

## The hard rule (re-read every time)

**No AI video for listing interiors.** Locked in v4b — Wan 2.7 cloud drift, Kling on a horse, Hailuo on a stagecoach all shipped as slop. AI is reserved for **aerials and exterior depth shots, abstract/macro/nature B-roll, stat-card backgrounds, and Synthesia-only avatars**. Never interior architecture, never reflective surfaces, never faces (except Synthesia, which is a separate skill at [`../news_video/SKILL.md`](../news_video/SKILL.md)).

For viral video specifically: **zero real estate visuals**. Visuals are science / nature / macro / abstract only. The stat overlay or VO is the only housing tether. (See [`../quality_gate/SKILL.md`](../quality_gate/SKILL.md) §1.3.)

---

## Tool selection matrix (verified April 2026)

| Need | Tool | Access | Cost | Status |
|------|------|--------|------|--------|
| Hero shot, best quality (#1 ELO) | **Kling 3.0** | Replicate or Kling Studio $6.99/mo, Pro $29.99/mo, Ultra $59.99/mo (4K) | 5s 1080p ≈ 20 credits | Shipped Feb 5, 2026 — multi-character lip-sync, 15s clips, 4K, Motion Brush |
| Multi-character dialogue | Kling 3.0 | Same | Same | Use this over Veo if dialogue is needed |
| Cost-effective API | **Veo 3.1** | Google AI Pro $19.99/mo (90 videos) OR API $0.10–0.50/sec | Recent price cut April 2026 | Best Gemini integration |
| Pro camera control (dolly/crane/orbit) | Runway Gen-4 / Gen-4.5 | $12/mo Standard (625 credits), $28–35/mo Pro | Gen-4.5 = 5 credits/sec; Gen-4 = 10 credits/sec | Best motion brush UX |
| Physics-compliant motion + natural-language object edits | Luma Dream Machine | $30/mo+ | — | "Modify with Instructions" is the differentiator |
| Photo-to-video (default workflow) | Kling 2.1 / 3.0 i2v via Replicate | `REPLICATE_API_TOKEN` | $0.02–0.07/clip | Default for scout phase |
| Static image generation | Flux Pro / Midjourney / Grok Imagine | Replicate or direct | $0.025 (Flux Dev) — $0.05 (Flux Pro) per image | Flux Pro for photoreal, Grok for speed + native audio |
| Speed/value iteration | **Grok Imagine** | xAI subscription, SuperGrok $30/mo | $0.04/sec via CometAPI | Fastest — under 20s gen, native audio sync |
| Stock-avatar talking head | Synthesia (150+ stock + custom) | `SYNTHESIA_API_KEY` | Per-minute metered | Use [`../news_video/SKILL.md`](../news_video/SKILL.md) |
| AI voiceover | ElevenLabs | Direct API | Tier-based | Use SSML phoneme tags for "Deschutes" (master skill §7.3) |
| Original music | Suno | Direct API | Tier-based | Future — not yet keyed |
| Aerial flythrough (free) | Google Earth Studio | Browser, manual | Free | See [`../google_maps_flyover/SKILL.md`](../google_maps_flyover/SKILL.md) |
| Aggregator (one key, many models) | fal.ai | `FAL_KEY` | Per-model passthrough | Useful when juggling 4+ models |

### Deprecations / changes you must know

- **Sora (OpenAI) is sunsetting.** App ends April 26, 2026; API ends Sept 24, 2026. Source: help.openai.com/en/articles/20001071-sora-1-sunset-faq. **Do NOT build new pipelines on Sora.** Paul Trillo's Washed Out and Nik Kleverov's Toys R Us / Memory Maker pipelines are both transitioning away.
- **Luma raised $900M Series C** and is building Project Halo with Humain. "Modify with Instructions" is the new differentiator.
- **Kling 3.0** is currently #1 on video-gen ELO benchmarks.

### Currently keyed in Matt's environment

| Service | ENV var | Status |
|---------|---------|--------|
| Replicate | `REPLICATE_API_TOKEN` | KEYED |
| OpenAI (DALL-E + GPT Image) | `OPENAI_API_KEY` | KEYED |
| xAI (Grok) | `XAI_API_KEY` | KEYED |
| Google (Veo, GBP, YT) | `GOOGLE_SERVICE_ACCOUNT_*` | KEYED |
| Synthesia | `SYNTHESIA_API_KEY` | KEYED |
| fal.ai | `FAL_KEY` | KEYED |
| Meta Graph (IG+FB) | `META_PAGE_ACCESS_TOKEN` | KEYED |
| TikTok | `TIKTOK_CLIENT_KEY/SECRET` | KEYED (needs OAuth) |
| ElevenLabs | — | NOT KEYED |
| Runway | — | NOT KEYED |

---

## Mandatory prompt architecture

Every AI video prompt MUST use block format. Narrative prose paragraphs are BANNED. Tag-stacking is BANNED. Adjective-heavy prompts produce slop.

```
[SCENE: 1 sentence. Subject + specific action + location]
Camera: [focal length] + [movement type] + [angle]
Lighting: [specific fixture/technique] + [time of day] + [color temperature]
Film Stock / DP Reference: [named stock OR DP name. NEVER "cinematic"]
Color Palette: [3 specific named colors]
Speed: [f-stop for DOF OR fps for slow-mo]
Duration: [N seconds]
Negative prompt: [artifacts to avoid]
```

### Vocabulary that works

**Focal lengths:** 24mm (wide environmental), 35mm (documentary), 50mm (standard), 85mm (portrait compression), 100mm (macro), 135mm (extreme compression).

**Camera movement:** dolly in/out, gimbal tracking, crane up/down, whip pan, handheld, locked-off. Use exact phrases — vague verbs like "moves" produce inconsistent results.

**Lighting:** softbox, Kino Flo, practicals, rim light, chiaroscuro, volumetric.

**Time of day:** golden hour (3200K warm sidelight), blue hour (5600K dusk), overhead noon (flat high key), tungsten night (2700K warm).

**Film stocks:** Kodak Ektachrome (saturated vibrant), Kodak 2383 (warm classic), ARRI Alexa (neutral pro cinema), Fujifilm Provia (cool greens), Kodak Vision 250D (neutral filmic).

**DP references (instead of "cinematic"):** Roger Deakins (painterly high-contrast), Emmanuel Lubezki (naturalistic flowing), Bradford Young (rich deep shadows).

### Banned vocabulary (zero tolerance)

Delete these before the prompt fires. They signal slop:

`cinematic`, `epic`, `breathtaking`, `stunning`, `beautiful`, `amazing`, `gorgeous`, `premium`, `creamy`, `brooding`, `heavy`, `moody`, `4K`, `ultra HD`, `8K`, `high quality`, `masterpiece`, `professional`, `award-winning`, `best quality`, `extremely detailed`, `dramatic`, `magical`, `enchanting`, `mystical`, `ethereal`, `otherworldly`, `mind-blowing`, `jaw-dropping`, `photorealistic` (use specific film stock instead).

### Working examples

**PASS — Macro ice crystal formation:**
```
Macro close-up of frost crystals forming on a leaf.
Camera: 100mm macro, gimbal dolly left at 5% forward motion, f/1.4
Lighting: Golden hour rim backlight with cool blue shadows, diffused ambient fill
Film Stock: Kodak Ektachrome
Color Palette: cool cyan crystal, warm amber rim, charcoal leaf
Duration: 5 seconds
```

**PASS — Fluid dynamics (housing tether via stat overlay only):**
```
High-speed fluid dynamics: ink droplet impacts still water, mushroom cloud of expanding dye.
Camera: 35mm, locked-off on overhead rig, f/8 sharp focus
Lighting: Tungsten practicals above subject, cool blue fill from below
Film Stock: ARRI Alexa
Color Palette: amber plume, teal water, charcoal background
Duration: 4 seconds
```

**FAIL — Generic narrative (banned):**
> A beautiful stunning aerial drone footage of Bend, Oregon showing majestic mountains and cinematic golden hour light with amazing epic orchestral music vibes. 4K ultra HD masterpiece quality.

**FAIL — Real estate visual (violates hard rule):**
> A realtor walking through a modern luxury kitchen with stainless steel appliances and granite countertops.

---

## Photo-to-video pre-flight checklist

Run BEFORE firing any Kling / Runway / Veo call. Skipping = slop.

### Source photo (reject if any fail)

- [ ] **Depth:** clear foreground / subject / background layers (FG ≥ 8 ft from subject)
- [ ] **One focal subject** (no crowds, no competing elements)
- [ ] **No human motion required** (static poses only — walking/turning = morph hell)
- [ ] **No visible text/signage** (AI hallucinates text mutations)
- [ ] **Natural motion implied** (water, foliage, smoke, light, flags = permission for secondary motion)
- [ ] **Center-weighted composition** (primary subject in center 40–60%)
- [ ] **No fine-detail edges** (nothing critical within 10% of frame edge)
- [ ] **Landscape source, safe-crop to 9:16** (prefer 16:9 source, vertical-crop after generation)

### Prompt

- [ ] Block-format template exactly (scene, camera, lighting, stock, palette, speed, duration)
- [ ] Zero banned vocabulary
- [ ] Focal length specified (not "wide" or "tight")
- [ ] Camera movement explicit (dolly/track/lock — not vague "moves")
- [ ] Specific film stock or DP reference (not "high quality")
- [ ] Three named colors for palette (not adjectives)
- [ ] Duration 5–8 seconds unless explicit reason otherwise
- [ ] Negative prompt verbatim from `feedback_ai_photo_to_video_scale.md`

### Approval

- [ ] Matt has seen the brief and approved BEFORE the API call fires.

---

## Cost control strategy

```
1. Scout phase   → Kling 2.1 Standard, 720p, 5s, ≈ $0.02/clip
2. Iterate       → 1–2 variations at the same cheap tier
3. Matt approves
4. Hero render   → Kling 2.1 Pro 1080p 8–10s ≈ $0.08, OR wait for Veo 3.1 access
```

Never batch-generate at 1080p before Matt's approval. Iteration belongs at the cheap tier.

Elite-creator multi-tool workflow (confirmed across all 7 profiles in `quality_gate/`):
1. Concept iterations in cheap/fast tool (Kling 2.1, Grok Imagine Speed)
2. Hero shot in quality tool (Kling 3.0, Veo 3.1, Runway Gen-4.5)
3. Enhancement in Topaz Video AI (denoise + upscale)
4. Color grade in DaVinci Resolve or CapCut (kill the digital plastic look)
5. Edit + audio in CapCut (beat sync, text overlays, transitions)

Paul Trillo accepted a 95%+ reject rate (700 clips → 55 selected for the Sora music video). Treat AI as a camera that's expensive to roll, not a magic wand.

---

## Replicate Node example (Kling 2.1 i2v)

```javascript
const generateKlingVideo = async (imageUrl, prompt, duration = 5) => {
  const r = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "kwaivgi/kling-v1-6-standard",
      input: { image_url: imageUrl, prompt, duration, aspect_ratio: "9:16" }
    })
  });
  return (await r.json()).id;  // poll this
};
```

Poll every 2s until `status === "succeeded"` → `prediction.output` is the video URL.

---

## Output artifacts (save these every render)

```
<concept-name>/
  ├── brief.md              — idea, hook, platform, visual concept
  ├── prompt.md             — final approved block-format prompt
  ├── preview_720.mp4       — scout output
  ├── final_1080.mp4        — post-processed hero
  ├── thumb.png             — 1080×1920 first-frame grab
  ├── caption.md            — per-platform captions + DM CTA + hashtags
  └── dm_trigger.md         — DM keyword + expected followup
```

Store in Drive: `06_Marketing & Brand > Marketing > Video Production > [Season]/[Month]`.

---

## Verification checklist before "done"

- [ ] Brief written; Matt approved BEFORE any API call
- [ ] Prompt in block format with zero banned vocab
- [ ] Pre-flight checklist all green
- [ ] No real estate visuals (zero houses/keys/families/neighborhoods) for viral content
- [ ] No branding inside the video frame
- [ ] Stat overlay or VO is the ONLY housing tether
- [ ] Visual could plausibly air on a science/nature YouTube channel
- [ ] Post-processing applied (stabilize, color lock, speed ramp, grain)
- [ ] Export: 1080×1920, H.264, 24–30 fps, 6 Mbps
- [ ] Artifacts saved to Drive with naming convention above
- [ ] Caption written with DM CTA ("DM me 'strategy'")
- [ ] Posted via Meta Graph / TikTok Content Posting / YouTube Data API
