# AI Video Generation Mastery — Ryan Realty Production Reference (2026)

**Purpose:** Operational guide for any agent producing video content for Ryan Realty. Read this before prompting any AI video model. Covers all models available via Replicate (plus Luma direct API), their real estate use cases, prompting mastery, costs, failure modes, and chaining recipes.

**Sources:** Verified 2026-05-29 from per-model research files in `docs/research/replicate-*.md` (all verified 2026-05-06), cross-referenced against real-estate AI video workflow guides (aivideobootcamp.com/blog/ai-video-tours-real-estate-kling-veo-seedance, mindstudio.ai/blog/ai-video-generation-2026-kling-topaz), pricing aggregators (awesomeagents.ai, evolink.ai, tokenmix.ai), and Google Cloud's official Veo 3.1 prompting guide (cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1).

**Canonical per-model detail files:** Each model below has a corresponding deep-dive in `docs/research/`:
- `replicate-kling-v2-1-master.md`
- `replicate-veo-3.md`
- `replicate-hailuo-02.md`
- `replicate-seedance-1-pro.md`
- `replicate-wan-2-5.md`
- `replicate-luma-ray-2.md`
- `replicate-platform.md` (auth, webhooks, error handling, rate limits)

---

## The 3-Tier Cost Ladder

Understanding this ladder is the single most important framework decision before any build:

| Tier | Models | Cost/5s clip | Use for |
|------|--------|-------------|---------|
| **Luxury** | Ray 2, Kling v2.1 Master | $0.80–$2.00 | $750K+ listings, hero shots, mood-driven market report opens |
| **Mid** | Veo 3 (audio), Hailuo 02 Pro, Seedance 1 Pro | $0.27–$6.00 | Standard inventory, audio-required beats, batch at quality |
| **Volume** | Wan 2.5 i2v, Hailuo 02 Standard, Seedance Fast | $0.13–$0.45 | Neighborhood b-roll, lifestyle filler, A/B drafts |

Route every clip through this decision before generation. The most common mistake is using Kling ($0.80/clip) for content where Hailuo Standard ($0.27/clip) or Wan 2.5 ($0.04/s) produces acceptable output.

---

## Model Profiles

### 1. Kling v2.1 Master

**Replicate slug:** `kwaivgi/kling-v2.1-master`

**What it's best at:**
Cinematic camera choreography with architectural subjects. Kling has the best-in-class camera-move execution among i2v models — dolly-in, crane-up, pull-back, orbit — with genuine parallax depth, not simulated zoom. Its 3D motion model creates credible spatial separation between foreground, midground, and background. Strong on mood (golden hour, deep shadows, dramatic light) and cinematic atmosphere. Not the leader on raw physics (fabric, fluids) but unmatched on camera fidelity at 1080p.

**Ideal real estate use:**
- Exterior hero reveal: pull-back to expose roofline + landscape + mountains
- Interior dolly: push-in from entryway threshold toward view glass
- Luxury cinemagraph: locked camera, water feature or foliage moves only
- Vertical Reels hook (9:16 portrait natively supported)
- $750K+ listings where the $0.80/clip cost is justified

**Prompting mastery:**

Structure: `[CAMERA_MOVE, SPEED] over [DURATION]s. [SUBJECT: specific architectural elements]. [ACTION/MOTION: what moves]. [LIGHT CONDITION, TIME OF DAY, ATMOSPHERIC DETAIL]. [LENS STYLE, DEPTH OF FIELD]. No people, no text, no distortion.`

Critical rules:
- **One camera move per clip.** Never combine (e.g., "push-in while panning right" produces warping). Pick one: slow push-in, slow pull-back, slow tilt up, slow crane up, slow pan right, slow dolly left.
- Always include a speed modifier: "slow" (default), never "fast."
- Name depth layers: "foreground stone path, midground facade, background pine ridge" — parallax requires them.
- i2v mode: **do not re-describe what's already in the image.** Describe motion and mood only (15–40 words).

Camera tokens Kling understands:
`slow push-in` · `slow pull-back` · `slow dolly left/right` · `slow tilt up/down` · `slow pan left/right` · `slow crane up/down` · `slow orbit` (limit 30 deg/5s) · `aerial drone` · `static locked-off` · `handheld drift`

Programmatic camera control (use for automation, not manual prompting):
```json
{
  "camera_control": {
    "type": "simple",
    "config": { "horizontal": 0, "vertical": 0, "pan": 0, "tilt": 0, "roll": 0, "zoom": 0 }
  }
}
```
Preset types: `"forward_up"` (push-in + crane), `"down_back"` (pull-back + descend), `"right_turn_forward"` (arc right), `"left_turn_forward"` (arc left).

Standard negative prompt: `blur, distortion, watermark, text overlay, oversaturated colors, flickering, inconsistent lighting, morphing geometry, camera shake, jittery movement, compression artifacts`

cfg_scale guidance: `0.5` default; `0.4` for more naturalistic drift (cinemagraphs); `0.7–0.8` when a specific camera move must be precise (risk: stiff motion above 0.8).

**Copy-ready real estate prompts:**

```
// 1. Exterior pull-back reveal (luxury listing, mountain view)
Slow pull-back over 5 seconds, starting close on the metal roof and timber
beam entry, retreating to reveal the full front elevation and driveway curve,
Three Sisters range visible on the horizon. Late afternoon light, long shadows
across basalt rock landscaping. Wide 24mm, deep focus, everything sharp.
No people, no text, no motion blur.

// 2. Interior dolly push-in (living room, Cascades view)
Slow push-in over 5 seconds, starting from the entryway threshold, advancing
toward the sliding glass door framing a backyard and high-desert sage. Warm
afternoon light cuts across engineered oak floors, casting long shadow stripes.
Dusty light motes in the air. 35mm, shallow depth of field.
No people, no camera shake, no distortion.

// 3. Aerial pull-back, market b-roll (neighborhood overview)
Slow aerial pull-back over 10 seconds, starting from a medium altitude showing
rooflines of a residential cluster, retreating upward to reveal the surrounding
high-desert landscape, volcanic buttes on the horizon. Golden hour, warm light
on sage-covered flats. Cinematic wide, anamorphic feel.
No distortion, no text, no flickering.
```

**i2v vs t2v:** Use i2v for every listing shot (fidelity to real photo is required). Use t2v only for abstract/lifestyle b-roll with no source image.

**Cost:** ~$0.80/5s clip, ~$1.60/10s clip at $0.16/s (Replicate). No audio output — layer separately.

**Limits / failure modes:**
- Max duration: 5s or 10s only
- No end-image support (first frame anchor only)
- Oversaturated colors: common at cfg_scale > 0.7 → add "oversaturated colors" to negative prompt + reduce cfg_scale
- Geometry morphing at beat boundaries: reduce motion speed, use 10s instead of 5s, one camera verb only
- Aspect ratio: i2v inherits from source image — pre-crop source to 9:16 (1080×1920) before submission
- Generation time: 2–5 minutes; set polling timeout 10+ minutes

**Output:** MP4, H.264, 1080p, 30fps, no audio track, 1-hour URL expiry — download immediately.

**Fallback:** `minimax/hailuo-02` (same prompt structure, 3–5× cheaper, slightly lower quality ceiling).

---

### 2. Google Veo 3

**Replicate slug:** `google/veo-3` (also: `google/veo-3-fast`, `google/veo-3.1`)

**What it's best at:**
The only model on the stack with native audio generation — ambient sound, SFX, and dialogue baked into the video in a single API call. Also excels at photorealistic physics (material rendering: fabric weave, water caustics, glass refraction) and understands professional photography terminology (f-stop framing, focal length concepts). Portrait 9:16 supported natively.

**Ideal real estate use:**
- Hook clips where ambient audio must sync to motion (creek, bird call, fireplace crackle)
- Lifestyle vignettes with natural sound environment
- Text-to-video market b-roll when no source photo exists
- Aerial earth-zoom style establishes
- Saves a separate audio-layering step — use when VO isn't needed but ambient sound matters

**Prompting mastery:**

Structure: `[SHOT TYPE + CAMERA POSITION]. [SUBJECT + PHYSICAL DETAIL]. [SETTING: location, time of day, weather]. [CAMERA MOVEMENT: direction + speed]. [LIGHTING: source, quality, color temp]. [ACTION: what moves]. Ambient noise: [2–3 specific environmental sounds]. SFX: [triggered sounds]. No subtitles, no on-screen text.`

Critical rules:
- Add `(thats where the camera is)` immediately after the camera position — significantly improves spatial coherence (community-verified).
- Name audio cues explicitly. Open-ended ambience causes hallucination. "steady creek flow 10 feet camera-left, wind through pine needles, no music" works; "cozy sounds" does not.
- Dialogue cap: under 6 words if used — lip-sync degrades at longer phrases.
- Concurrent audio: max 3 layers (ambient + SFX + music or ambient + dialogue + one SFX).
- Suppress on-screen text: append "No subtitles, no on-screen text, no captions." to every prompt — Veo sometimes generates burned-in captions.
- For precision real estate prompts with specific location data: set `"enhance_prompt": false` on Vertex AI — the default rewriter genericizes place names.

Camera movements Veo understands: dolly shot, tracking shot, crane shot, aerial view, slow pan, POV shot, push-in, pull-out, orbit/arc, handheld.

Veo 3.1 supports timestamp prompting (multi-shot in one generation):
```
[00:00-00:02] Wide shot of the front elevation, camera positioned at sidewalk level...
[00:02-00:06] Slow crane-up revealing the roofline and mountain backdrop...
```

Veo 3.1 also supports first-and-last-frame interpolation — generate start frame and end frame separately (with Gemini Image), then animate with Veo between them. Powerful for before/after transitions.

Standard negative prompt: `shaky camera, motion blur, watermark, logo overlay, text overlay, subtitles, blurry, overexposed, underexposed, lens flare, vignette, artificial bokeh, CGI render, 3D animation, cartoon`

**Copy-ready real estate prompts:**

```
// 1. Hook: waterfront listing opener with ambient audio
Slow push-in from wide to medium, camera at dock level pointing toward
the shoreline house (thats where the camera is). A waterfront home sits
300 feet away — cedar siding, floor-to-ceiling windows. Tumalo Reservoir
at golden hour, high desert sun dropping behind the Sisters. Light reflects
off flat water in horizontal bands. Ambient noise: light ripple against dock
pilings, one distant Canada goose call, no wind. No music.
No subtitles, no on-screen text.
[Duration: 6s | Aspect: 9:16]

// 2. Market data b-roll: SOLD sign reveal (no numbers in prompt — add via Remotion)
Extreme close-up of a real estate sign staked in dry grass, camera positioned
at sign-base level (thats where the camera is). Generic "SOLD" sign — red
lettering, white background. Slow crane-up from sign base to reveal skyline
of downtown Bend behind it, Pilot Butte visible far right. Bright noon light,
no clouds. Ambient noise: light traffic hum four blocks away, one car door
closing mid-clip, silence on crane-up apex. No music. No subtitles, no on-screen text.
[Duration: 8s | Aspect: 9:16]

// 3. Earth-zoom: aerial descent to Bend, OR
Aerial tracking shot starting at 3,000 feet altitude looking down at the high
desert, camera above and angled 30 degrees toward ground (thats where the
camera is). The Deschutes River glints silver. Downtown Bend visible at center
— Old Mill District grid and Mirror Pond clearly legible. Slow continuous
descent toward the city. Golden hour, Pilot Butte landmark visible center-right.
Ambient noise: high-altitude wind at start, softening to urban hum at 6 seconds.
No music. No subtitles, no on-screen text.
[Duration: 8s | Aspect: 9:16]
```

**i2v vs t2v:** Veo 3 on Replicate is primarily t2v. Veo 3.1 adds i2v with up to 3 reference images. For i2v with a specific listing photo, prefer Kling or Hailuo; use Veo for atmosphere + audio where no source image is required.

**Cost:** $0.75/s on Replicate = $6.00/8s clip (full + audio). Veo 3 Fast: ~$0.16/s = $1.25/8s. Veo 3.1 Fast: $0.10/s = $0.80/8s. Use Fast for b-roll; reserve standard for hero audio clips.

**Limits / failure modes:**
- Max duration: 8s per clip
- Content filter is strict (Google SafeSearch baked in) — avoid financial references, property pricing, superlatives in prompts
- Audio doesn't match scene: enumerate exact environmental sounds + "Music: none"
- SynthID watermark: invisible/forensic on API output (not a visible watermark problem)
- Generation time: 60–180s — do not poll faster than 8-second intervals; use webhook for production

**Output:** MP4, 1080p, 24fps, AAC stereo audio baked in. Post-mix with VO: `ffmpeg -i veo_output.mp4 -i elevenlabs_vo.mp3 -filter_complex "[0:a]volume=0.2[ambient];[1:a]volume=1.0[vo];[ambient][vo]amix=inputs=2:duration=first[mix]" -map 0:v -map "[mix]" -c:v copy -c:a aac composited.mp4`

**Fallback:** Kling v2.1 Master + manual Remotion ambient-sound layer.

---

### 3. MiniMax Hailuo 02

**Replicate slug:** `minimax/hailuo-02`

**What it's best at:**
Physics-accurate micro-motion on organic and material subjects: water surface, fabric, foliage, steam, light shifts. Strong i2v fidelity to the source image's geometry and materials. The budget-to-mid workhorse for batch listing video production. Also the best model for human motion and facial consistency when people need to be in frame (agent walk-and-talk, couple on patio).

**Ideal real estate use:**
- Cinemagraph-style beats: curtain drift, pool ripple, coffee steam, candlelight flicker
- Mid-market listing inventory batches ($400K–$700K range) where $0.27/clip Standard vs $0.80/clip Kling matters
- Any clip where a person is in frame (face and body consistency)
- Drone pullbacks over neighborhoods (1080p Pro recommended)
- Lifestyle b-roll at volume: porch, deck, outdoor scenes

**Prompting mastery:**

Structure: `[Subject and setting] — [Camera motion] — [Ambient detail] — [Light condition]`

Rules:
- Lead with the physical subject. Never open with adjectives.
- One motion verb per clause.
- Disable `prompt_optimizer` when the prompt is precisely engineered — the rewriter amplifies motion energy and may add unwanted camera moves.
- Output aspect ratio follows the source image — pre-crop to 9:16 for portrait output.
- `end_image_url` is supported — use to constrain where motion resolves (controlled dolly endpoints, pan stops).

Camera motion keywords:
`slow dolly push` · `overhead bird's eye view rotating` · `tracking shot alongside` · `camera rises from ground level` · `handheld energy` · `static locked-off wide shot` · `pan slowly right/left` · `tilt up/down`

**Copy-ready real estate prompts:**

```
// 1. Interior pan, mid-market listing (Standard 768p, $0.27)
Open living room with vaulted ceiling and exposed wood beams, camera pans
slowly right, afternoon light from south-facing windows moves across the wood
floor, no people in frame
[prompt_optimizer: false | duration: 6 | resolution: 768P]

// 2. Cinemagraph: curtain drift, luxury master bedroom ($0.48)
Sheer white curtain moves gently in a light breeze through an open window,
rest of the bedroom is perfectly still, morning light, no motion outside the
curtain, no camera movement
[prompt_optimizer: false | duration: 6 | resolution: 1080P]

// 3. Lifestyle: deck with mountain view
Deck with two Adirondack chairs, steaming coffee mug on the rail, Mt. Bachelor
visible in the distance, light morning breeze moves through pine trees at the
yard edge, camera holds still, no people in frame
[prompt_optimizer: false | duration: 6 | resolution: 768P]
```

**i2v vs t2v:** Strong i2v — first-frame anchor with `start_image`/`image_url`. End-image supported for constrained motion arcs.

**Cost:** $0.045/s Standard (768p) = $0.27/6s clip; $0.08/s Pro (1080p) = $0.48/6s clip. Pro is 6s only; Standard supports 10s. Replicate direct and fal.ai are the primary pathways.

**Limits / failure modes:**
- Max duration: 10s Standard, 6s Pro (hard caps)
- No explicit aspect_ratio parameter — output inherits from source image dimensions
- Face/person artifacts beyond 2–3s: add "no people in frame" when avoiding people
- Motion too fast: add "light," "slow," "subtle" before every motion verb
- Subject geometry drift (10s clips): use 6s clips for architectural subjects; provide end_image_url to anchor final frame
- Texture confusion on fine detail (brick, tile, wood grain): use full-res source images, no heavy JPEG compression

**Output:** MP4, 25fps, 768p or 1080p, no audio track.

**Fallback:** fal.ai `fal-ai/minimax/hailuo-02/standard/image-to-video` (same model, separate infrastructure).

---

### 4. ByteDance Seedance 1 Pro

**Replicate slug:** `bytedance/seedance-1-pro` (fast variant: `bytedance/seedance-1-pro-fast`)

**What it's best at:**
Named-camera-move execution at higher accuracy than other models. When you specify "slow orbit" or "crane shot," Seedance executes it more literally than Kling for architecture-scale prompts. Strong on spatial depth cues from source photos — reads foreground/background layering to guide dolly and push motion. Also the most cost-efficient path to 1080p 9:16 portrait output from a real listing photo at volume.

**Ideal real estate use:**
- Exterior orbit shots (slow 90-degree arc around a home)
- Vertical reveals (tilt up from foundation to roofline)
- Budget-constrained listing batches at 1080p where camera-move accuracy matters
- Draft/proof-of-motion pass before committing to Kling budget
- Neighborhood b-roll volume at Fast tier

**Prompting mastery:**

Structure: `[Shot size — establishing/medium/close]. [Camera move + direction + target, speed adjective]. [Subject description + location]. [Lighting]. [Secondary motion in scene if any].`

Camera tokens confirmed to work:
| Token | Effect |
|-------|--------|
| `slow dolly push-in` | Camera advances forward at measured pace |
| `dolly pull-back` | Reveals context as camera retreats |
| `slow orbit` / `orbital track` | Circles subject; use "30 degrees" or "90 degrees" to specify arc |
| `crane shot` | Starts low, rises; reveals roofline or landscape |
| `tilt up` / `lift` | Camera rises in place |
| `tilt down` / `lower` | Downward reveal |
| `pan left` / `pan right` | Lateral sweep |
| `follow` | Tracks moving subject (water, smoke, curtain) |
| `static locked-off shot` | Locks camera; natural motion in scene only |

Tokens that get ignored:
- Focal length numbers ("85mm" — ignored)
- Compound moves: pick one primary verb per clip
- "Zoom" alone: use "dolly push-in" for forward motion

**Copy-ready real estate prompts:**

```
// 1. Cinematic dolly into great room
Establishing shot. Slow dolly push-in from the entryway threshold toward
the great room, eye level, steady pace. Warm afternoon light through
west-facing windows, wood floors, cathedral ceiling. Dust motes visible
in light shafts.
[duration: 5 | resolution: 1080p | aspect_ratio: 9:16]

// 2. Exterior orbit, lakefront luxury
Wide shot. Slow orbital track counterclockwise around the home, starting
at the driveway corner, ending at the dock. Late golden hour, long shadows
across the lawn. Mountain reflection visible in still water.
[duration: 5 | resolution: 1080p | aspect_ratio: 9:16]

// 3. Vertical tilt reveal, craftsman facade
Low-angle shot. Camera lifts slowly from ground level at the front foundation,
tilting up to reveal the full facade and roofline. Overcast soft light. Cedar
siding, black window trim, mature Ponderosa pines framing both sides.
[duration: 5 | resolution: 1080p | aspect_ratio: 9:16]
```

**i2v vs t2v:** Full i2v support via `image` parameter. No `camera_fixed` boolean — camera behavior is purely prompt-driven. For static scenes, say "static locked-off shot" in the prompt.

**Cost:** ~$0.74/5s clip, ~$1.40/10s clip (1080p Pro on Replicate). Fast variant: ~$0.30/5s (60% lower cost, 30–60% faster, slightly softer motion). Use Fast for drafts; Pro for final publish renders. No free tier.

**Limits / failure modes:**
- Camera language ignored on compound moves: one verb per clip
- Motion drift on 10s clips: use 5s clips for architectural subjects; anchor with "camera moves, building stays fixed in frame"
- Scene change artifacts at clip boundaries (10s): ensure described motion fills the full duration ("slow orbit, full 90 degrees")
- Generic bokeh on vague prompts: always name the camera move explicitly
- Lighting mid-clip shifts: pin light direction ("west-facing, light from camera-left") rather than time-of-day shorthand

**Output:** MP4, H.264, 1080p or 480p, 30fps, no audio, 9:16 delivered natively when specified.

**Fallback:** `bytedance/seedance-1-pro-fast` → then Kling v2.1.

---

### 5. Wan 2.5 i2v (Alibaba)

**Replicate slug:** `wan-video/wan-2.5-i2v`

**What it's best at:**
High-volume batch generation at the lowest cost on the stack. Open-source (Apache 2.0) weights allow self-hosting for near-zero marginal cost at scale. Reliable slow camera moves, gentle environmental animation, and product/architectural orbit shots. Native one-pass audio/visual sync (VO + lip-sync in one generation call) is a unique differentiator for multilingual content. The go-to model for neighborhood b-roll, lifestyle filler, and A/B motion drafts before committing to Kling budget.

**Ideal real estate use:**
- Neighborhood b-roll volume at 720p (20+ clips per batch for ~$8–15 vs ~$60–100 at Kling)
- A/B draft: render Wan first, escalate to Kling only if it fails quality gate
- Lifestyle b-roll filler: coffee shop, trail, outdoor dining, street scenes
- Market report ambient b-roll where high camera fidelity is not required

**Prompting mastery:**

Structure: `[Subject/entity] + [Environment] + [Camera move] + [Motion description] + [Lighting/atmosphere] + [Style tag]`

Target 80–120 words. Name the camera move. Name what physically moves. Avoid abstract adjectives. `enhance_prompt: true` (default) is helpful for short prompts; set `false` when prompt is already detailed.

Camera vocabulary: `slow push-in` · `gentle orbit` · `subtle parallax` · `slow pan left/right` · `camera holds perfectly still` · `slow pull-back` · `tilt up/down` · `tracking shot`

Wan's motion profile is subtle and conservative. Add explicit magnitude when you need visible motion: "visibly ripples," "leaves sway noticeably," "light shifts distinctly" — Wan defaults to subdued motion that can be too quiet for muted-feed viewing.

Negative prompt: `camera shake, handheld jitter, lens breathing, motion blur, overexposed windows, dark interiors, fisheye distortion, visible people, watermark, text overlay, logo`

**Copy-ready real estate prompts:**

```
// 1. Entryway cinemagraph, IG Reel beat (720p, $0.04–0.06/s)
Elegant entryway with hardwood floors and a large pendant light,
late-afternoon light streaming through side windows, camera holds perfectly
still, chandelier sways very slightly, light plays across the floor in slow
shifting patterns, warm amber tones, architectural interior photography,
no motion blur, no people
[duration: 5 | resolution: 720p | aspect_ratio: 9:16]

// 2. Neighborhood street, volume batch
[NEIGHBORHOOD NAME] street with mature trees lining sidewalk, Pacific Northwest
afternoon light, camera slow push-in along the street, tree leaves move gently
in a light breeze, parked cars still, golden hour light, residential neighborhood,
no people, cinematic
[enhance_prompt: false | resolution: 720p | duration: 5 | seed: fixed per neighborhood]

// 3. Lifestyle b-roll: outdoor coffee patio
Outdoor dining patio at a Bend Oregon coffee shop, mid-morning light, camera
slow pan right across empty tables with chairs, dappled tree shadow moves across
the surface, warm natural light, no people in frame, documentary style,
smooth motion, no camera shake
[duration: 5 | resolution: 720p | aspect_ratio: 9:16]
```

**i2v vs t2v:** Full i2v via `image` parameter. Open-source weights available at `Wan-AI/Wan2.5-I2V` on HuggingFace for self-hosting.

**Cost:** ~$0.04–$0.06/finished second on Replicate (H100 GPU billing). ~$0.46–$0.76/5s clip, $0.92–$1.52/10s clip (estimate; Replicate bills GPU-second, not flat per clip). At 1,000 clips/month at 8s each, ~$320 — 4.4× cheaper than Kling, 1.8× cheaper than Seedance.

**Important:** Wan 2.5 outputs at 16fps natively. Always transcode to 30fps before Remotion integration: `ffmpeg -i input.mp4 -vf fps=30 output.mp4`

**Limits / failure modes:**
- Subject identity drift on 10s clips: use 5s; simplify to one focal subject
- Reflective surface flickering (polished marble, large glass): escalate to Kling
- Overexposed windows / dark interiors: pre-process source image in Lightroom before ingest
- Motion too subtle for muted feed: add explicit magnitude to motion verbs
- No concurrent Replicate batch > 5 predictions — cold-start latency spikes; stagger 30s between submissions

**Output:** MP4, H.264, 16fps native (transcode to 30fps for Remotion), 480p/720p/1080p, optional AAC audio.

**Fallback:** fal.ai Wan i2v → Atlas Cloud Wan 2.5 → Kling.

---

### 6. Luma Ray 2

**Replicate slugs:** `luma/ray-2-720p`, `luma/ray-2-540p`
**Preferred endpoint for i2v:** Luma API direct (`api.lumalabs.ai/dream-machine/v1/generations`) or fal.ai (`fal-ai/luma-dream-machine/ray-2/image-to-video`)

**What it's best at:**
Atmospheric, mood-driven cinematic quality — the photorealism ceiling when lighting complexity matters. Ray 2 runs on 10× the compute of its predecessor and excels at physically accurate lighting: golden-hour lens fall-off, blue-hour glow, mixed interior/exterior temperature, mote-in-beam visibility, snow flurry ambience. When a clip needs to intercut with live-action or drone footage without looking AI-generated, Ray 2 is the closest match. Also supports 15+ camera motion concepts composable in natural language.

**Ideal real estate use:**
- Luxury hero shots ($750K+) where atmospheric mood is the deliverable
- Blue-hour exterior: warm interior glow against cobalt sky
- Snow-flurry/rain ambience: high-desert winter listing
- Sunrise shaft through kitchen window (motes visible)
- Any clip that intercutting with real drone footage must match

**Prompting mastery:**

Structure: `[Subject] [Action/motion beat] [Lighting descriptor] [Atmosphere/air quality] [Camera move] [Lens character]`

Ray 2 responds to physics-first language, not style adjectives. Lead with motion physics, not "cinematic" or "film noir." Specificity over adjectives.

Lighting tokens that work:
- `golden hour light raking across [surface]`
- `blue-hour ambient with interior warmth bleeding through windows`
- `overcast diffused light, soft directionless fill, Pacific Northwest mood`
- `thin snow-flurry haze, cold ambient, flat grey sky`
- `sunrise shaft at [angle] hitting [surface], motes visible in air`
- `practical lamp sources warm against cool exterior`
- `soft falloff from bright zone to shadow, 3-stop contrast ratio`

15+ camera motion concepts (composable — max 2 per clip):
`Push in` · `Pull out` · `Orbit left/right` · `Crane up/down` · `Pan left/right` · `Tilt up/down` · `Truck left/right` · `Pedestal up/down` · `Zoom in/out` · `Aerial drone` · `Static` · `Elevator` · `Bolt cam`

Compose: `"push in with crane up"` · `"orbit left and zoom in simultaneously"` — triple combos break physics.

Keyframe feature (first + last frame): define both start and end states for predictable motion trajectories. Use Gemini 2.5 Flash Image to generate both frames, then animate with Ray 2. Most powerful technique for controlled property reveals.

Avoid: `vibrant`, `whimsical`, `hyper-realistic`, `stunning`, `breathtaking`, `gorgeous` — test consistently worsen Ray 2 output.

**Copy-ready real estate prompts:**

```
// 1. Golden hour reveal, mountain-view luxury home
Slow push-in toward floor-to-ceiling windows, golden hour light raking across
wide-plank white oak floors, long shadow bars extending from window mullions,
Cascades snow line visible on horizon, no people, push in with crane up,
lens flare at frame left as sun angle shifts, warm 3200K interior against 5500K exterior sky.
[duration: 9s | aspect_ratio: 9:16 | resolution: 720p]

// 2. Blue-hour exterior, contemporary high-desert
Static exterior front elevation, blue-hour transition, interior pendant lights
and kitchen warmth glowing gold through glazing, ambient sky shifting cobalt to
deep blue, juniper silhouette in foreground, no wind motion, subtle light spill
on driveway concrete, pull out very slowly, cool exterior 7000K against warm 2700K interior.
[duration: 9s | aspect_ratio: 9:16 | resolution: 720p]

// 3. Sunrise shaft, kitchen interior atmosphere
Kitchen island with waterfall-edge stone counter, sunrise shaft entering at
10-degree angle from east-facing window, air motes visible in beam, warm 2400K
shaft against cool ambient pre-dawn fill, steam rising from espresso cup in
foreground (soft focus), slow push-in, no people, no motion except motes and steam.
[duration: 9s | aspect_ratio: 9:16 | resolution: 720p]
```

**Key parameter:** Always choose `duration: "9s"` — same price as `"5s"` on fal.ai and Luma API. 4× more footage per dollar.

**i2v vs t2v:** Both supported. i2v via `keyframes.frame0.url` (Luma API) or `image_url` (fal.ai). Start+end keyframes supported for interpolated transitions. Replicate slugs are primarily t2v; use Luma API or fal.ai for i2v.

**Cost:** Ray 2 (5s, 540p): ~$0.50 via fal.ai. Ray 2 (5s, 720p): ~$1.00. Ray 2 (5s, 1080p): ~$2.00. Ray 2 Flash (5s): ~$0.30 at $0.06/s. Always choose 9s for same dollar — same price, more footage.

**Limits / failure modes:**
- Max 9s per generation (chain to ~30s with quality degradation past 20s)
- No native audio generation — add ambient bed in Remotion post-mix
- Excessive atmospheric haze: specify quantity explicitly ("light snow flurry, sparse" not "heavy snow")
- Lighting drift on 9s clips: anchor one primary light source; avoid "shifting from X to Y"
- Over-stylized (painting look): use one style word max; anchor to real-world light sources
- Max 2 camera motion concepts — triple combos break physics
- URL expiry: download within 1 hour

**Output:** MP4, H.264, 540p/720p/1080p, 24fps (some outputs 30fps — confirm at render), no audio, 1-hour URL expiry. Aspect ratios: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 9:21.

**Fallback:** Hailuo 02 Pro (1080p, $0.48) → Kling v2.1 Master → Ray 2 Flash for iteration.

---

### 7. Additional Models on Replicate Stack

These are confirmed available but less frequently used for Ryan Realty's core content types.

**LTX Video (`wan-video/wan-2.2-i2v-fast`):**
Fast, open-source, good for rapid prototyping. Lower quality ceiling than Kling/Ray 2. Use for storyboard passes only.

**HunyuanVideo:**
Open-source from Tencent. Strong on human motion and video consistency. Available on Replicate. Less tested for architectural real estate content. Useful if Kling/Seedance are capacity-limited.

**Grok Imagine Video (`xai/grok-imagine-video`):**
xAI's text-to-video. Short clips, native audio. Available on Replicate. Pricing at ~$0.0639/video at press time (very low). Experimental — not production-tested for listing content. See `docs/research/grok-imagine.md`.

**Real-ESRGAN (upscaling) on Replicate:**
Multiple models available. Standard upscaling workflow: render at 540p/720p, upscale to 1080p/4K via Real-ESRGAN. For listing videos, prefer native 1080p generation over upscaling — upscale artifacts on sharp architectural lines (window mullions, tile edges) are visible. Use upscaling only for lifestyle/atmospheric b-roll where edge sharpness is less critical.

**Topaz Starlight 2.5 (upscaling, off-Replicate):**
$299/yr Personal, $699/yr Pro. Temporal analysis preserves grain without amplifying it. Avoids soap-opera effect. The pro reference standard for upscaling AI video to 4K for luxury listing use. Run locally via Topaz Video AI desktop app.

**Frame Interpolation (RIFE, open-source):**
Wan 2.5's 16fps output must be interpolated to 30fps for Remotion. RIFE is the standard open-source tool. Run: `ffmpeg -i input.mp4 -vf fps=30 output.mp4` (simple; RIFE required for true high-quality interpolation at 2× or 4× frame rates).

---

## Decision Matrix: Shot Type → Model → Cost

| Shot Type | Primary Model | Why | Cost/clip | Alt |
|-----------|--------------|-----|-----------|-----|
| Exterior pull-back/reveal, $800K+ listing | Kling v2.1 Master | Best camera choreography, architectural depth | $0.80/5s | Seedance 1 Pro ($0.74) |
| Interior dolly push-in, luxury | Kling v2.1 Master | Spatial parallax, cinematic mood | $0.80/5s | Hailuo 02 Pro ($0.48) |
| Cinemagraph: water/fire/curtain | Hailuo 02 Standard | Best physics micro-motion, lowest cost | $0.27/6s | Wan 2.5 ($0.20–0.30) |
| Hook with native ambient audio | Veo 3 | Only model with baked-in audio | $6.00/8s | Veo 3 Fast ($1.25) |
| Lifestyle vignette, people in frame | Hailuo 02 Standard | Best facial/body consistency | $0.27/6s | Veo 3 Fast |
| Exterior orbit, architecture scale | Seedance 1 Pro | Best named-move execution for orbit | $0.74/5s | Kling v2.1 |
| Blue-hour / snow-flurry / atmospheric mood | Ray 2 (720p) | Photorealism ceiling for lighting | $1.00/9s | Kling v2.1 Master |
| Neighborhood b-roll, 20+ clips/batch | Wan 2.5 i2v (720p) | Lowest cost at volume | $0.04–0.06/s | Seedance Fast ($0.30) |
| Market report b-roll (text-to-video) | Veo 3 Fast | T2V + ambient audio, fast | $1.25/8s | Wan 2.5 ($0.05/s) |
| Draft/proof-of-motion before hero render | Seedance Fast | 60% lower cost than Pro | $0.30/5s | Wan 2.5 (cheapest) |
| Aerial drone-style establishing | Kling v2.1 Master | Aerial pull-back + depth + mood | $1.60/10s | Veo 3 ($6.00, adds audio) |
| Intercut with real drone footage | Ray 2 (720p) | Photorealism ceiling closest to real camera | $1.00/9s | Kling v2.1 |
| High-desert exterior, winter ambience | Ray 2 (720p) | Snow flurry, cold light, mote rendering | $1.00/9s | Veo 3 Fast |
| Agent walk-and-talk (avatar, talking head) | Hailuo 02 Pro | Face + body consistency | $0.48/6s | Synthesia (avatar) |

**Budget routing rule:**
- $1M+ listing: always Kling or Ray 2 for hero clips
- $500K–$999K: Kling for hero + Hailuo for interiors/fillers
- Below $500K: Hailuo 02 Standard or Wan 2.5 for the full set
- Market report/news clip (non-listing): Wan 2.5 for volume b-roll + Veo 3 Fast for hero audio beat

---

## Multi-Shot Pipeline Examples

### Pipeline A: 30–45 Second Listing Reel (Standard Format, ~$5–8 total)

Ryan Realty standard: 9 beats × 5s each = 45s. Mix models by listing price tier.

**$600K mid-market listing (Hailuo-first strategy):**

| Beat | Time | Model | Prompt Theme | Cost |
|------|------|-------|-------------|------|
| 1 Hook | 0–5s | Hailuo 02 Pro | Exterior facade, slow push-in, 9:16 portrait | $0.48 |
| 2 Interior 1 | 5–10s | Hailuo 02 Std | Great room dolly, afternoon light | $0.27 |
| 3 Interior 2 | 10–15s | Hailuo 02 Std | Kitchen island push-in detail | $0.27 |
| 4 Pattern interrupt 25% | 15–20s | Wan 2.5 | Aerial neighborhood pullback | $0.25 |
| 5 Interior 3 | 20–25s | Hailuo 02 Std | Master bedroom curtain drift | $0.27 |
| 6 Register shift 50% | 25–30s | Wan 2.5 | Outdoor patio, lifestyle lifestyle | $0.20 |
| 7 Interior 4 | 30–35s | Hailuo 02 Std | Bathroom vessel sink tilt up | $0.27 |
| 8 Detail | 35–40s | Wan 2.5 | Backyard/landscaping pan | $0.20 |
| 9 Kinetic reveal | 40–45s | Hailuo 02 Pro | Exterior pull-back + Cascades reveal | $0.48 |
| **Total** | | | | **~$2.69** |

Add: ElevenLabs VO (flat monthly), Remotion text overlays (local compute). Total production: ~$3–5 with VO.

**$1.1M luxury listing (Kling + Ray 2 strategy):**

| Beat | Time | Model | Prompt Theme | Cost |
|------|------|-------|-------------|------|
| 1 Hook | 0–5s | Ray 2 | Blue-hour exterior, warm glow through glazing | $1.00 |
| 2 Interior 1 | 5–10s | Kling v2.1 | Great room dolly, golden-hour atmosphere | $0.80 |
| 3 Interior 2 | 10–15s | Kling v2.1 | Kitchen island push-in, mote detail | $0.80 |
| 4 Pattern interrupt | 15–20s | Kling v2.1 | Aerial pull-back, Three Sisters horizon | $1.60 (10s) |
| 5 Lifestyle | 20–25s | Hailuo 02 Pro | Deck + coffee steam + Cascade view | $0.48 |
| 6 Register shift | 25–30s | Ray 2 | Sunrise shaft through master bath skylight | $1.00 |
| 7 Interior 3 | 30–35s | Kling v2.1 | Fireplace cinemagraph (water-feature style) | $0.80 |
| 8 Detail | 35–40s | Hailuo 02 Pro | Wine cellar or bonus room reveal | $0.48 |
| 9 Kinetic reveal | 40–45s | Kling v2.1 | Full exterior pull-back, mountain horizon lock | $0.80 |
| **Total** | | | | **~$7.76** |

**Cost for a 10-listing week at mid-market:** ~$27 in AI generation. At luxury tier: ~$78. Both well inside the economics of a single side of commission.

---

### Pipeline B: 30-Second Market Report B-Roll Sequence (~$3–4 total)

Used for news clips, monthly market reports, and area guides. Mix t2v + i2v; no listing photos required.

| Beat | Time | Model | Prompt Theme | Cost |
|------|------|-------|-------------|------|
| Hook 0–3s | 0–3s | Veo 3 (8s clip, cut to 3s) | SOLD sign crane-up, ambient traffic hum | $6.00 |
| Stat reveal context | 3–8s | Wan 2.5 | Aerial Bend neighborhood, autumn trees | $0.25 |
| Data beat 1 | 8–13s | Wan 2.5 | Downtown Bend exterior, morning activity | $0.25 |
| Register shift | 13–18s | Hailuo 02 Std | Coffee shop lifestyle, Bend feel | $0.27 |
| Data beat 2 | 18–23s | Wan 2.5 | High-desert landscape, Cascades visible | $0.25 |
| Kinetic reveal | 23–30s | Veo 3 Fast | Aerial descent to Mirror Pond, ambient audio | $1.25 |
| **Total** | | | | **~$8.27** |

Note: Veo 3 at $6.00/clip is expensive — reserve for the hook where native audio payoff matters most. Veo 3 Fast at $1.25 for the closing descent is the budget alternative. Full market report b-roll sequence using only Wan 2.5: ~$1.50 total.

---

### Pipeline C: Draft → Upscale → Publish (Cost-Efficiency Chaining)

Use this pattern when the hero shot must be high-quality but budget is constrained:

1. **Draft pass** at 480p or 540p with Seedance Fast ($0.12/5s) or Wan 2.5 ($0.04/s): confirm motion direction, framing, and camera move work.
2. **Approval pass**: show draft to Matt before committing to full-resolution render.
3. **Hero render** at 1080p with Kling v2.1 Master ($0.80) or Seedance 1 Pro ($0.74) using the identical prompt.
4. **Upscale if needed**: Topaz Starlight 2.5 for 4K output (luxury listings where MLS accepts 4K). Not needed for social-first content — 1080p native is sufficient.
5. **Frame interpolation**: Wan 2.5 output must be transcoded from 16fps → 30fps before Remotion: `ffmpeg -i input.mp4 -vf fps=30 output.mp4`

Cost savings: draft at ~$0.12 → hero at ~$0.80 saves nothing but validates prompt. Skip the draft pass when using Hailuo 02 Standard — at $0.27/clip, it is itself the draft price point.

---

### Pipeline D: Ray Flash 2 → Ray 2 Upgrade Path

Ray 2 Flash is the draft model for Ray 2 Standard. Same prompt, same model family, 1/3 the cost:

1. Generate at Ray Flash 2 (~$0.30/5s): confirm lighting mood, atmospheric rendering, camera motion arc.
2. If approved: render at Ray 2 (720p, ~$1.00/9s) using identical prompt — always choose 9s, same price as 5s.
3. For architectural content with sharp lines: stay at 720p native (avoid 4K upscale — upscale artifacts appear on mullions and tile edges).

---

## The Single Highest-Leverage Prompting Insight

**One camera move per clip, always.**

Every model on the stack (Kling, Veo, Seedance, Hailuo, Wan, Ray 2) degrades when the prompt contains two or more camera movements in the same clip. "Slow push-in then pan right" produces warping, geometry drift, or a compromise motion that satisfies neither. "Push in while orbiting left and tilting up" breaks physics on all of them.

This is not a suggestion — it is the single fastest way to produce unusable output. Pick one move. Use one clip per move. Cut between them. The visual variety comes from the edit, not from asking one clip to do too much.

**Secondary insight:** For i2v models (Kling, Hailuo, Seedance, Wan), never re-describe the source image. The model sees the image. Describe only motion, lighting changes, and camera action. "Slow push-in, morning light shifts left across oak floors, no people" (15 words) outperforms "slow push-in toward a beautiful living room with warm wood floors and natural light coming from the south-facing windows" (30 words) every time.

---

## Chaining and Upscaling Reference

**Extend duration beyond 9s (Luma Ray 2):** Chain sequential generations. Each new generation starts from the last frame of the prior clip. Quality degrades past 20s — use splice editing (not chaining) for longer sequences.

**Extend duration beyond 10s (Kling/Seedance):** Not supported in a single generation. Generate 5s or 10s clips and edit them together in Remotion `<Sequence>` blocks with crossfade transitions.

**Upscaling options:**
| Tool | Cost | Quality | Best for |
|------|------|---------|---------|
| Topaz Starlight 2.5 | $299/yr | Pro reference | Luxury listing 4K output |
| Real-ESRGAN (Replicate) | Pay-per-run | Good | Volume upscaling |
| ffmpeg scale filter | Free | Basic | Quick resolution bump only |

**Frame interpolation (Wan 2.5 16fps → 30fps):**
```bash
ffmpeg -i wan_output.mp4 -vf fps=30 wan_30fps.mp4
```
For high-quality slow-motion (2× frame rate): use RIFE open-source tool (requires local GPU or Replicate wrapper).

**Remotion integration pattern:**
All AI video clips integrate via `<Video>` component inside a `<Sequence>`:
```tsx
<Sequence from={0} durationInFrames={180}>  {/* 6s at 30fps */}
  <Video src={staticFile("ai-clips/beat-1.mp4")} startFrom={0} />
</Sequence>
```
Download clips to `public/ai-clips/` before render. Wan 2.5 must be transcoded to 30fps first.

---

## Platform Integration: Replicate

**Auth:** `Authorization: Bearer $REPLICATE_API_TOKEN` (confirmed in `.env.local`).

**All video models are async.** Create prediction → poll or use webhook → download output URL within 1 hour.

**Webhook pattern (production recommended):** Pass `webhook: "https://ryan-realty.com/api/replicate/webhook"` and `webhook_events_filter: ["completed"]` on prediction create. Replicate POSTs completed prediction to your endpoint. Eliminates held connections for long-running video generations (2–5 min for Kling).

**Output URLs expire in 1 hour.** Download immediately via `requests.get(url)` or `fetch(url)` in webhook handler. Store in Supabase Storage bucket `v5_library` at path `videos/<prediction_id>.mp4`.

**Rate limits:** 600 req/min on POST `/v1/predictions`; 3000 req/min other endpoints. Stagger batch submissions for Wan 2.5 (max 5 concurrent predictions — cold-start spikes under load).

**Model version pinning:** Always pin `owner/model:version_hash` for production. Track current hashes in `video_production_skills/API_INVENTORY.md`. Versionless slugs auto-update to latest — acceptable for experimentation, not for content engine production.

**Fallback chain when Replicate is down:**
1. Vertex AI Veo 3 direct (see `docs/research/vertex-veo-3.md`)
2. Grok Imagine (see `docs/research/grok-imagine.md`)
3. Graceful degradation: Ken Burns animation via Remotion `interpolate()` — zero AI video cost, maintains beat structure

---

## Sources

All verified 2026-05-29:

- `docs/research/replicate-kling-v2-1-master.md` — verified 2026-05-06
- `docs/research/replicate-veo-3.md` — verified 2026-05-06
- `docs/research/replicate-hailuo-02.md` — verified 2026-05-06
- `docs/research/replicate-seedance-1-pro.md` — verified 2026-05-06
- `docs/research/replicate-wan-2-5.md` — verified 2026-05-06
- `docs/research/replicate-luma-ray-2.md` — verified 2026-05-06
- `docs/research/replicate-platform.md` — verified 2026-05-06
- [Google Cloud: Ultimate prompting guide for Veo 3.1](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1)
- [AI Video Tours for Real Estate: Kling vs Veo vs Seedance](https://aivideobootcamp.com/blog/ai-video-tours-real-estate-kling-veo-seedance/)
- [MindStudio: AI Video Generation 2026 — Kling 4K, Topaz 2.5](https://www.mindstudio.ai/blog/ai-video-generation-2026-kling-topaz)
- [Atlas Cloud: Best AI Video Generation Models 2026](https://www.atlascloud.ai/blog/guides/best-ai-video-generation-models-2026)
- [Kling AI Camera Movement Prompts 2026](https://videoai.me/blog/kling-ai-camera-movement-prompts)
- [Atlabs: Ultimate Seedance 1 Pro Prompting Guide](https://www.atlabs.ai/blog/ultimate-seedance-1-pro-prompting-guide)
- [Segmind: Wan i2v Prompts Guide 2026](https://blog.segmind.com/wan-i2v-prompts-tips-guide/)
- [Hailuo 02 Complete Guide](https://www.cliprise.app/learn/guides/model-guides/hailuo-02-complete-guide)
- [Luma Ray 2 FAQ](https://lumalabs.ai/learning-hub/dream-machine-guide-ray2)
- [Awesome Agents: AI Video Generation Pricing April 2026](https://awesomeagents.ai/pricing/video-generation-pricing/)
- [Luma Ray Flash 2 on Replicate](https://replicate.com/luma/ray-flash-2-540p)
- [Replicate Image-to-Video Collection](https://replicate.com/collections/image-to-video)
- [EvoLink: Best AI Video APIs 2026](https://evolink.ai/blog/best-ai-video-generation-models-2026-pricing-guide)
- [Veed.io: Kling AI Prompting Guide 2026](https://www.veed.io/learn/kling-ai-prompting-guide)
- [AmbienceAI: Kling Prompting Guide](https://www.ambienceai.com/tutorials/kling-prompting-guide)
