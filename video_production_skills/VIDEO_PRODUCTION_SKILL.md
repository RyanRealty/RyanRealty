# Video Production — Master Skill File

**This is non-negotiable. Every agent reads this BEFORE writing any video code or Remotion composition. No exceptions.**

**Pair-required reading (load all three before any build):**
1. **[`ANTI_SLOP_MANIFESTO.md`](ANTI_SLOP_MANIFESTO.md)** — banned-content gate. Twelve hard rules. Voice rules, fair-housing, AI disclosure, brand visual standards.
2. **[`VIRAL_GUARDRAILS.md`](VIRAL_GUARDRAILS.md)** — pre-publish virality gate. 100-point scorecard, format-specific minimum scores, frame-by-frame hook spec, platform-specific length / aspect / cadence specs. Every piece scores against this gate before it ships. Default ship floor: 80/100. Format minimums: listing video 85, market data 80, neighborhood 80, meme 75, earth zoom 85.
3. **This file** (the master skill) — codifies the *how* of video production.

The manifesto codifies *what's banned*. The viral guardrails codify *what's required to publish*. The master skill codifies *how the video is built*. All three are loaded before any build. They do not contradict — they layer.

This file replaces ad-hoc decisions across the v5 series of Schoolhouse listing videos and codifies what shipped vs what didn't. Every cinematic-short-film instinct that ate 130 seconds of a 45-second slot is documented here as a banned pattern. Every viral retention rule that landed is locked.

---

## 1. Hard constraints (ship blockers — not suggestions)

### ElevenLabs Voice — MANDATORY

- **Voice: Victoria — Voice ID: `qSeXEcewz7tA0Q0qk9fH`**
- Voice profile: middle-aged American, conversational, warm, trustworthy, relatable. Designed for explainer videos, viral social, and modern brand VO. Saved on account as "Victoria — Ryan Realty Anchor."
- Env vars in `.env.local`: `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH`, `ELEVENLABS_VOICE_ID_VICTORIA=qSeXEcewz7tA0Q0qk9fH`
- API key: `ELEVENLABS_API_KEY` in `.env.local`
- **ALWAYS use Victoria for ALL voiceover.** No other voice. No substituting. No asking.
- **Canonical model + settings**: `eleven_turbo_v2_5`, stability `0.50`, similarity_boost `0.75`, style `0.35`, `use_speaker_boost: true`. These match the market-report scorecards Matt approved. Different model or different settings = different-sounding voice = a rejected render.
- Use `previous_text` chaining for prosody continuity across sentences within a clip.
- Use IPA phoneme tags for tricky pronunciations (e.g., Deschutes → `<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme>`).
- Matt approved this voice 2026-04-27 — Victoria is the permanent voice. Do not switch without explicit Matt direction.

### Pacing Rule — First Scenes

- The first scene / hook text MUST stay on screen long enough for the viewer to read it completely. **Minimum 3 seconds** for any text-heavy opening scene.
- **No scene with readable text shorter than 2.5 seconds.**
- The hook should grab attention but NOT flash by so fast nobody can read it.
- This rule applies to every video format: news clips, listing reels, market reports, neighborhood guides, memes with text overlay.

### Length
- **Target: 30-45 seconds.**
- **Never exceed 60 seconds.** A 75s "cinematic" cut goes nowhere. Cap holds across all platforms.
- Default for any new build: **45s**.

### Hook (first 2 seconds)
- **First 2 seconds must have movement.** Never open static. Subtle push_in, slow_pan, or gimbal_walk on the hero photo from frame 0.
- **Address text on screen within 1 second.** Centered, large enough to read on a paused phone scroll.
- **Hook must create curiosity.** Strong visual + a question, an open loop, or a stat. Never a logo, never a title card on black, never a slow boundary draw, never a greeting.
- **VO begins within first 2 seconds.** First spoken word is content. No "hey," "today," "welcome," "what's up."

### Scene cuts
- **Standard: 2-3 seconds per beat.**
- **Luxury drone / cinematic: 3-4 seconds MAX.**
- **No beat over 4 seconds. Period.** If a photo deserves longer, it's because it has motion or layered text reveals — not because it's pretty.
- **Minimum 12-15 photo beats in a 45-second video.**

### Re-hooks
- **Re-hook at 25% mark.** New visual register or text-overlay shock. Anchored to a content beat, not a gimmick.
- **Re-hook at 50% mark.** Pattern interrupt — exterior cut into an interior tour, drone wide cut into closeups, etc.
- **Reveal in final 15%.** Kinetic stat moment (price, address, status). No brokerage attribution, no logo, no phone in the reveal frame.

### Text overlays
- **Safe zone: 900×1400 px centered inside 1080×1920** (90 px margin every edge — accounts for IG/TikTok UI chrome).
- **Display time: minimum 2 seconds per text block.**
- **Font sizes: minimum 48 px body, headline 64-80 px.**
- **Contrast: white text with shadow OR dark pill/scrim under the text.** Never white text on a white wall. Never gold text on a gold sky.
- **Word count: max 5-7 words per block.**
- **Numbers carry units.** "$3,025,000" not "3,025,000". "4 bedrooms" not "4 BR".

### Retention
- **70%+ retention through first 30 seconds is the target.** TikTok algorithmic floor; Instagram correlate.
- **Always include on-screen text/captions.** ~40% of IG views are muted, ~85% of FB. Captions carry the video for those viewers.
- **No filler.** Every second earns its place. If a beat doesn't add something new, it's cut.

### Motion
- **Gimbal/parallax motion on every photo beat.** No static photos ever (except a deliberate hold on the hero exterior at frame 0 for ~0.4s before motion engages).
- **Three movement types per video minimum.** Mix push_in, push_counter, slow_pan_lr/rl, multi_point_pan, gimbal_walk, cinemagraph mask. Variety is the difference between a viral edit and an AutoReel slideshow.

---

## 2. Creative direction

### Formula
**Hook → Intrigue → Value/Tour → Reveal/CTA.**

- **Hook (0-3s):** strongest visual + address overlay + intriguing one-line VO. Stop the scroll.
- **Intrigue (3-10s):** the second-strongest 1-2 shots that make the viewer wonder "what is this place?"
- **Value/Tour (10-35s):** the rest of the home + the place. Front-load hero interiors, back-load outdoor/wildlife/aerial. Pattern interrupt at 50%.
- **Reveal/CTA (final 15%):** kinetic stat moment. PENDING / price / address. The caption carries the CTA, not the video frame.

### Pacing curve
- **Fast start** — hook + 2-3 hero shots in first 9 seconds.
- **Breathe in middle** — 2.5-3s beats, slightly longer dwell on craft details.
- **Fast at end** — quick cuts into the reveal, then hold the kinetic stat for ~5s.

### Shot sequence (default)
1. Exterior establishing (hero exterior, 9:16 letterbox with blurred backdrop)
2. Signature detail (window+mountain, view doors, hero hearth — pick the one shot that defines the property)
3. Living spaces (great room, kitchen, dining — fast cuts)
4. Bedrooms / baths (briefer, 2.5s each, supporting beats)
5. Outdoor / views (sunroom, fire patio, decks)
6. Drone pullback (50% pattern interrupt — exterior wide showing setting)
7. Closing aerial (different drone shot than the pullback — pond, river, neighborhood context)
8. Reveal (kinetic stat)

### Register by price tier
- **Under $500K:** upbeat, faster cuts (2s avg), warmer grade, more on-screen text, more peppy VO.
- **$500K–$1M:** balanced (2.5-3s avg), measured VO, classic luxury grade.
- **Over $1M:** slower motion, more negative space, fewer overlays (text only at hook + reveal), deeper grade, more natural VO. The image carries it.

### Banned patterns
- **Never open with a logo, brokerage name, or "REPRESENTED BY" line.**
- **Never use generic VO** ("welcome to your dream home," "this stunning property," "nestled in the trees").
- **Never show the same room twice.** One shot per space.
- **Never letterbox to pure black** — always blurred-photo backdrop in the dead space.
- **Never reuse a clip or photo within a single video** — viewers register reuse as low budget.
- **Never use AI photo-to-video for interiors** (Kling/Runway/Hailuo melt mullions, drift cabinet pulls). Only deterministic Remotion motion on interiors. AI is reserved for aerials and exterior depth shots, with strict slop checks.
- **Never write "approximately," "roughly," "about"** in any number on screen or in VO. Real numbers or no number.

---

## 3. Rendering

**Remotion ONLY.** All compositions live under `listing_video_v4/src/` (or future `video/<name>/src/`).

- React + TypeScript, `useCurrentFrame()`, `spring()`, `interpolate()`.
- 1080×1920 portrait, 30 fps minimum.
- No Playwright video capture (banned per `feedback_no_playwright_video_capture.md`).
- No PIL composition for video frames (banned).
- No ffmpeg sampling as a substitute for animated rendering (use ffmpeg only for final encode + audio mux).

**Composition file structure:**
```
listing_video_v4/
  src/
    Listing.tsx        — main composition, BEATS array + audio sequencing
    PhotoBeat.tsx      — per-photo beat: cover / wide-mode / vignetteLetterbox
    OpenSequence.tsx   — optional intro (use sparingly — viral hook usually skips this)
    BrandOutro.tsx     — DO NOT USE for viral cuts (no branding rule)
    cameraMoves.ts     — motion primitives (push_in, push_counter, slow_pan_lr/rl,
                         multi_point_pan, gimbal_walk, cinemagraph)
    brand.ts           — color tokens, font tokens, filter chains
  public/
    audio/             — VO mp3 files, music_bed_v5.mp3
    v5_library/        — symlinked from public/images/v5_library
    images/            — symlinked dir + maps_z*.png
    fonts/             — Amboqia, AzoSans, Montserrat
    brand/             — stacked_logo_white.png (NOT used in viral cuts)
```

**Render command:**
```bash
cd listing_video_v4 && npx remotion render SchoolhousePortrait \
  --concurrency=1 --output=out/<name>.mp4
```

`concurrency=1` is required — higher values OOM Chrome on this Mac.

**After render, ALWAYS:**
```bash
ffmpeg -i out/<name>.mp4 -vf "blackdetect=d=0.03:pix_th=0.05" -an -f null - 2>&1 | grep black_start
```
Empty output = zero true-black sequences. Anything else = ship-blocker, fix the transition.

**Compress to under 100 MB before delivery:**
```bash
ffmpeg -i out/<name>.mp4 -c:v libx264 -crf 24 -preset medium -c:a copy \
  -movflags +faststart out/<name>_c.mp4
```

---

## 4. AI video generation pipeline (when actually warranted)

**Default: do not use AI video for listing interiors.** This is a hard learning from the v4b round — Wan 2.7 cloud drift, Kling i2v on a horse, Hailuo on a stagecoach all shipped as slop. AI is reserved for **aerials and exterior depth shots**, never interior architecture, never reflective surfaces, never faces.

### Tier 1 — real-estate-specific tools (no API, manual workflow)
- **Reel-E** — $44/mo, no API. Cinematic motion + beat sync + 4 variants in <2 min from a photo set. Used by the Selling Sunset / Million Dollar Listing LA production team. Best in class for the "looks like a real estate Reel" register.
- **Vidzee** (vidzee.ai) — similar registers, browser-only.
- **PhotoAIVideo** — push-in on every shot, branded title cards. Cheap floor.

### Tier 2 — API available
- **Runway Gen-4** — $1.50 / 5-second clip, Node SDK. Best motion brush UX, best face/character consistency. Reserve for exterior lifestyle shots WITH a person.
- **Luma Ray 2** — cheapest per-clip among the API tools, Node SDK. Great color/HDR grade. Use for landscape / abstract beauty inserts. Keyframe-only motion (no spatial brush).
- **Kling 2.1 Master** — enterprise only, no consumer API at time of writing. Best architectural-line preservation; preserves perspective lines + casework geometry. The model the elite cinematographers reach for. Get on enterprise once available.

### Tier 3 — aerials
- **Google Earth Studio** — free, browser-only, KML export. Best for high-altitude orient → property zoom-in opens that a satellite-tile pan can't replicate. Manual workflow.

### Pipeline (when AI is in scope)
1. **Categorize photos.** Hero exterior + drones get AI eligibility. Interiors get Remotion deterministic motion only. Faces never.
2. **Generate one i2v clip per hero exterior** (Runway Gen-4) at 720p.
3. **Generate one i2v clip per landscape insert** (Luma Ray 2) at 720p.
4. **Slop check at 0.25× playback** — window/door warping, casework melt, hardware drift, ghost objects, perspective collapse, texture slip. Any failure → drop the clip, fall back to deterministic Remotion motion on the original still.
5. **Composite into Remotion** as `<OffthreadVideo>` masked behind the still where possible (cinemagraph technique — animate one organic element, rest static).

### Cost ceiling
- **No-AI build: $0 marginal cost** (Remotion + ElevenLabs VO at the existing tier).
- **Selective AI build: $2-25 / video** (1 Runway hero + 2 Luma inserts is ~$8; full Reel-E subscription is $44/mo amortized).

---

## 5. Brand rules for video

### Colors (from `brand.ts`)
- **Navy:** `#102742` — closing reveal background ONLY. Never inside the body of a viral cut.
- **Gold:** `#C8A864` (current) / `#D4AF37` (alternate) — kinetic title gold, boundary glow.
- **Cream:** `#F2EBDD` — body text on dark backgrounds.
- **Charcoal:** `#1a1714` — composition AbsoluteFill background (never visible if Sequence overlap is correct).

### Fonts
- **Amboqia** — headlines (kinetic title, reveal price).
- **AzoSans** — body text, captions, sub overlays.
- **Montserrat Bold + Black** — only used as fallback / SANS for sans-serif overlays.
- **NO BUTCHER in videos.** Butcher is for static print and email — not video.

### Banned words in copy (VO + on-screen)
Per `feedback_copy_writing_rules.md` and the Ryan Realty brand voice:
- `stunning`
- `nestled`
- `boasts`
- `gorgeous`
- `breathtaking`
- `must-see`
- `welcome to your dream home`
- `worth a serious look`
- `as a Bend homeowner` (or any reader-identity callback)
- em-dashes (—) in prose copy
- hyphens in prose ("4-bedroom" → "4 bedrooms" or rephrase)

### Brand contact
- Phone: **541.213.6706**
- Instagram: **@MattRyanRealty**
- Web: **ryan-realty.com**
- Email: **matt@ryan-realty.com**

These live in the Instagram post caption + bio, **never inside the video frame** for viral cuts.

---

## 6. Quality gate (run BEFORE every delivery)

Cannot ship without all of these green:

```
[ ] Length 30-45s (target 45, hard cap 60)
[ ] First frame has motion engaged by frame 12 (0.4s)
[ ] Address text on screen by frame 30 (1s)
[ ] No beat over 4s
[ ] Pattern interrupt at 25% mark
[ ] Pattern interrupt at 50% mark
[ ] Reveal in final 15%
[ ] Text in 900×1400 safe zone
[ ] No black bars: ffmpeg blackdetect strict pix_th=0.05 returns zero sequences
[ ] No frozen frames (motion on every photo beat)
[ ] Brand compliance: no logo / no "Ryan Realty" / no phone / no agent name in frame
[ ] PhotoBeat parent divs are transparent (so previous Sequence shows through fade-in)
[ ] Default crossfadeOut: 0 (next beat covers previous before AbsoluteFill exposed)
[ ] OpenSequence (if used) extended 0.5s past Beat 1's startSec for overlap
[ ] No banned words in VO or on-screen text
[ ] All numbers carry units
[ ] Three movement types minimum
[ ] Audio: VO clear, no overlap between adjacent VO lines, music ducks under VO
```

If any item is unchecked, the video is not ready. Fix and re-render.

**This quality gate is the production-correctness check. It does NOT replace the virality gate in [`VIRAL_GUARDRAILS.md`](VIRAL_GUARDRAILS.md).** Every piece runs both gates before publish:

1. **§6 quality gate (above)** — does the video render correctly? No black bars, no frozen frames, motion engaged, brand-compliant frame.
2. **VIRAL_GUARDRAILS.md scorecard** — is the video engineered to win? 100-point scorecard, hook spec, retention structure, engagement triggers, format-specific minimum score.

A piece that passes §6 but scores under the format minimum on the virality scorecard does not ship — the bones may be technically correct but the piece is not engineered for distribution. Run both. Pass both. Ship.

---

## 7. Common failures + the fix

### 1. Black bars / charcoal flashes at transitions
- **Symptom:** ffmpeg blackdetect flags sub-second sequences at every beat boundary; visually "blinks" between cuts.
- **Cause:** PhotoBeat's parent `<div>` had an opaque dark background (`#0a0805`). During every fade-in, the parent painted over the previous Sequence for 0.3-0.5s.
- **Fix:**
  - Set parent `<div>` background to `transparent` always.
  - Default `crossfadeOut: 0` on every beat.
  - Each beat's `<Sequence>` starts 0.5s before its declared `startSec` and runs 0.5s longer. The previous beat stays at full alpha while the next beat's fade-in covers it on top.
  - Reveal `<Sequence>` overlaps the last beat by 0.5s; navy fades in over the still-visible aerial.
- **File:** `listing_video_v4/src/PhotoBeat.tsx` line ~365 (parent div), `Listing.tsx` Sequence wrappers.

### 2. Audio mismatch / closing line tone different from rest
- **Symptom:** Final VO line sounds like a different speaker or wildly different prosody.
- **Cause:** ElevenLabs random seed varies per generation. Same model + same voice settings still produce different cadence per call.
- **Fix:** Pass `previous_text` parameter when synthing each line — chains prosody from the prior sentence. For multi-line scripts, walk the script in narrative order with `previous_text` set to the prior line's text.
- **File:** `scripts/synth_vo_v56.py` for the chaining pattern.

### 3. Deschutes pronunciation comes out wrong
- **Symptom:** Synth says "DESS-chutes" instead of "duh-SHOOTS" (rhymes with "the shoots").
- **Cause:** `eleven_multilingual_v2` mispronounces the literal spelling.
- **Fix:** Use SSML phoneme tag with IPA on `eleven_v3` model:
  ```
  <phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme>
  ```
  Or fall back to phonetic respelling like "Dish Shoots" or "duh-Shoots" — but the IPA path is the durable fix.
- **File:** `scripts/synth_vo_v55.py` for the IPA + model switch pattern.

### 4. Missing assets at render time (404 in browser console, render aborts)
- **Symptom:** Bundle copy succeeds but render errors mid-frame with `404 (Not Found)` on a photo, font, or audio file.
- **Cause:** External process wiped untracked files between sessions (most v4 / v5 work products live in `public/v5_library/` and `public/images/` and were never committed). Or build_v5_library.py never re-ran after a worktree reset.
- **Fix BEFORE every render:**
  1. Verify `public/images/v5_library` symlink → `public/v5_library/`
  2. Verify `public/images/maps_z15.png` exists (refetch via Static Maps API if missing)
  3. Verify `public/audio/brand_sting.mp3`, `public/brand/stacked_logo_white.png`, `public/fonts/AzoSans-Medium.ttf` exist
  4. Run `build_v5_library.py` to re-pull Drive photos if `public/v5_library/modern/` empty
  5. Verify all VO files in `public/audio/` referenced by Listing.tsx
- Pre-render asset audit catches this before the renderer hits a wall.

### 5. Flat creativity / generic real-estate-Reel feel
- **Symptom:** Output looks like every other realtor's content. Same push-in on every photo. Generic VO. No pattern interrupt.
- **Cause:** Agent skipped Section 2 (Creative direction) and defaulted to AutoReel-tier slideshow.
- **Fix:** Re-read Section 2 before scaffolding the BEATS array. Specifically the **Pacing curve**, **Shot sequence**, and **Register by price tier**. If the BEATS array uses the same `move` value on adjacent beats, that's a tell — break the pattern.

### 6. Agent skips the quality gate before delivery
- **Symptom:** Matt finds an obvious bug (black bar, wrong duration, missing reveal element) on first review.
- **Cause:** Agent assumes the render came out right, skips Section 6 verification.
- **Fix:** Run Section 6 quality gate every single time. blackdetect, frame-extract every beat boundary, view the frames via the Read tool. Don't claim success before personal verification.

---

## 8. The Schoolhouse v5 lesson log

Each major rule above is anchored to a specific Schoolhouse v5 round where the failure shipped. Reading the change log of the v5 series in commit history (`feat(listing-video-v5)`) is the fastest way to internalize WHY each rule exists.

- **v1, v2, v3:** wrong register (cinematic short film instead of viral). 110-130s ships nowhere on social.
- **v4 / v4b:** AI photo-to-video shipped as slop. Wan 2.7 cloud drift, Kling on a horse. Locked: no AI i2v on listing interiors.
- **v5.0:** Sonnet subagent built composition, defaulted every interior to multi_point_pan. Locked: per-photo motion is judgment work, never delegated.
- **v5.1:** rockpile pan only showed one kid (slow_pan_lr translated 6% on a 1.6-aspect photo). Locked: pan amplitude must traverse the photo, not nudge it.
- **v5.2:** fire patio fireplace cropped out of frame (cinemagraph drift on off-center subject). Locked: cinemagraph only on dead-center subjects; for off-center subjects use objectPosition bias.
- **v5.3:** delivered cinematic 122s. "Per-photo motion is judgment work" round.
- **v5.4:** added blurred-vignette letterbox. First "no black bars" attempt — still had brightness 0.42 corners reading as black.
- **v5.5:** brightness fixed (0.62), still had black flashes at every beat-to-beat transition.
- **v5.6:** root cause found — opaque parent div `#0a0805`. Made parent transparent. ffmpeg blackdetect strict = zero black sequences. ENDING: cinematic 127s shipped, Matt called too long.
- **v5.7:** approved closing line, approved Locati continuation. 133s. Matt hard-pivoted to viral.
- **v5.8:** first viral cut — 45s, 15 beats, address-on-hero hook, history pattern interrupt at 50%.
- **v5.9:** all history removed (Matt's call), 14 home-only beats, no music, hook line "A Jerry Locati design. On the Little Deschutes."

The v5.7 → v5.8 → v5.9 jump is the most important lesson: a brokerage-credibility cinematic short film and a viral Reel are different products with different rules. Don't conflate them.

---

## 9. How to use this skill

**Every video build begins with this file.** Before scaffolding a `Listing.tsx` BEATS array, before synthing VO, before picking photos:

1. Read this entire file top to bottom.
2. Read [`ANTI_SLOP_MANIFESTO.md`](ANTI_SLOP_MANIFESTO.md) — the banned-content gate.
3. Read [`VIRAL_GUARDRAILS.md`](VIRAL_GUARDRAILS.md) — the pre-publish scorecard. Internalize the 100-point rubric and the format-specific minimum score for the format you are building.
4. Open `VIRAL_VIDEO_CONSTRAINTS.md` (the production quick-reference card) and `VIRAL_SCORECARD_QUICKREF.md` (the scoring quick-reference card) and pin both next to your editor.
5. Read the Cowork session memory at `feedback_short_form_retention_rules.md`, `feedback_no_branding_in_viral_video.md`, `reference_listing_video_spec.md`, `reference_viral_video_stats_verified.md`. They are the research underneath this file.
6. Scaffold the BEATS array against Section 2 (Creative direction). Engineer against the VIRAL_GUARDRAILS scorecard from beat 0 — do not "score later."
7. Synth VO with `previous_text` chaining.
8. Render with `concurrency=1`.
9. Run Section 6 quality gate (production correctness). Fix anything red.
10. Run VIRAL_GUARDRAILS.md scorecard. Compute the score, write `out/<deliverable>/scorecard.json`. If under format minimum, identify the lowest category, re-cut, re-score.
11. Compress, push to `main`, email Matt.

If both gates are green, the video ships. If anything is red, fix it before delivery — no "good enough."

---

## 10. Skill index — the unified library

All sub-skills live under `video_production_skills/`. None replace the rules above — they extend what's possible inside them. Each ships with its own `SKILL.md`. Read the relevant one before reaching for the capability.

### Operations & reference (top-level files)

- **[`AGENT_HANDOFF.md`](AGENT_HANDOFF.md)** — operations manual. API key inventory, ENV vars, DB schemas, priority tasks, mount instructions for the Cowork agent flow. The "first read on a fresh session" file.
- **[`ASSET_LOCATIONS.md`](ASSET_LOCATIONS.md)** — index of where rendered MP4s live on disk (BRAND MANAGER, SOCIAL MEDIA MANAGER folders). Updated 2026-04-26.
- **[`VIRAL_GUARDRAILS.md`](VIRAL_GUARDRAILS.md)** — **mandatory pre-publish virality gate**. 100-point scorecard with format-specific minimum scores. Frame-by-frame hook spec, retention-structure timing, platform specs, engagement-trigger menu, real-estate viral patterns. Every piece scores against this before it ships. Default ship floor: 80/100; format minimums per §10 of that file.
- **[`VIRAL_SCORECARD_QUICKREF.md`](VIRAL_SCORECARD_QUICKREF.md)** — index-card version of the scorecard. Pin next to the editor for ship-day pre-flight.
- **[`VIRAL_VIDEO_CONSTRAINTS.md`](VIRAL_VIDEO_CONSTRAINTS.md)** — 30-second production checklist (the *building* gate, not the *publishing* gate). Pin next to the editor.

### Hard gate (mandatory on every AI clip)

- **[`quality_gate/SKILL.md`](quality_gate/SKILL.md)** — 6-phase hard gate (Concept, Prompt, Generation, Post-Processing, Viral Architecture, Post-Publish). All AI video must pass every phase before stitch. Web-verified creator references and statistics with inline source URLs (verified 2026-04-15).

### Production capabilities — Remotion pipeline extensions

- **[`depth_parallax/SKILL.md`](depth_parallax/SKILL.md)** — 3D Ken Burns. MiDaS depth map → bg/mid/fg alpha layers → `<DepthParallaxBeat>` with per-layer translate + scale. Drop-in replacement for `<PhotoBeat>` on hero exteriors and shots with strong depth. Banned on flat photos and faces. `python video_production_skills/depth_parallax/generate_depth_map.py --input photo.jpg --output-dir public/images/v5_library/depth/<key>/`.
- **[`gaussian_splat/SKILL.md`](gaussian_splat/SKILL.md)** — flythrough renders for premium listings. COLMAP camera poses → nerfstudio splatfacto training → camera-path render → 5–10s MP4 via `<OffthreadVideo>`. $1M+ listings with 30+ photos. **Inherited rule: any clip in a viral cut obeys the 4s/beat cap.** Recommended path `--cloud-gpu` ($0.40/scene on RunPod / vast.ai 4090). Wrapper: `python scripts/gaussian_flythrough.py --photos ./photos --output flythrough.mp4 [--cloud-gpu]`.
- **[`cinematic_transitions/SKILL.md`](cinematic_transitions/SKILL.md)** — Crossfade / LightLeak / WhipPan / Push / Slide drop-in Remotion components under `listing_video_v4/src/components/`. 0.3–0.5s each. Default Crossfade. LightLeak + WhipPan are register-changing — 1–2 per video max, anchored to 25% / 50% pattern interrupts. WhipPan + LightLeak banned on $1M+ register. All render over transparent background (preserves §7 #1 Sequence-overlap pattern).
- **[`audio_sync/SKILL.md`](audio_sync/SKILL.md)** — beat-aligned cuts. `librosa` writes `beats.json`; comp loads via `listing_video_v4/src/lib/beats.ts` and snaps `BeatDef.startSec` to nearest beat ±0.15s. `enforceBeatBounds()` keeps snapped sequence inside 2–4s/beat (§1). Loose on luxury (re-hooks only); aggressive sub-$500K (every cut); skip on VO-only. `python scripts/detect_beats.py --audio music_bed.mp3 --output beats.json`.

### Production capabilities — alternative renderers

- **[`market_report_video/SKILL.md`](market_report_video/SKILL.md)** — pure-ffmpeg 9:16 stat-card generator. The lighter-weight sibling of `listing_video_v4/` (Remotion). Default for monthly market data drops where the visual is "stat in the middle, photo Ken-Burnsing behind it." Ships with `generate_market_report.sh`, `market_report_config_example.json`, `media_asset_catalog.json`. Hard rules baked in (1.08× max zoom, 4s/beat cap).
- **[`news_video/SKILL.md`](news_video/SKILL.md)** — Synthesia avatar workflow. Talking-head video where the speaker is Matt's avatar (or stock approved). Right fit: weekly market update, listing first-look, FAQ series, neighborhood mini-tour, lead-magnet promo. Wrong fit: viral video, testimonials, controversial topics, cold-audience paid ads. Synthesia handles mouth-sync — the carve-out from "no AI faces."
- **[`google_maps_flyover/SKILL.md`](google_maps_flyover/SKILL.md)** — Google Earth Studio + 3D Tiles cinematic aerials. The "impossible drone shot" and "zoom from space → land at the front door" register. Workflow: Earth Studio camera path → 4K image sequence + 3D tracking JSX → After Effects compositing (birds, clouds, haze, color grade, lens effects) → music sync. Verified creator playbooks (@andras.ra, @ai.otiv, Emberlite, AI Earth Zoom-Out trend, April 2026). Half-day to full-day production cost — reserve for hero deliverables.

### Creative & strategy

- **[`brand_assets/SKILL.md`](brand_assets/SKILL.md)** — visual system, photo selection, creative intelligence. Two color registers (light-forward editorial for static / print, dark-forward feed-native for video). Typography hierarchy (Butcher / AzoSans / Amboqia). Photo selection workflow + per-purpose evaluation criteria + Tumalo Reservoir Rd canonical asset reference. Real-estate creators worth studying. Run the QA checklist before every commit.
- **[`listing_launch/SKILL.md`](listing_launch/SKILL.md)** — per-property full launch package (MLS description, 3 Reel scripts, 7-frame Story sequence, IG static, FB post, sphere email). Features → Lifestyle → Benefits framework. Banned-words enforcement.
- **[`area_guides/SKILL.md`](area_guides/SKILL.md)** — 19-neighborhood Reel format. 30–45s text-on-B-roll cut with rotating overlay stats, no VO. Ships with `scripts.md` (per-neighborhood hooks + overlay rotations).
- **[`ai_platforms/SKILL.md`](ai_platforms/SKILL.md)** — AI generation tool selection, current pricing, API access status, mandatory block-format prompt template, banned vocabulary. Photo-to-video pre-flight checklist. Replicate Node example. Cost-control strategy (scout-then-hero). Companion file [`ai_platforms/platform_research.md`](ai_platforms/platform_research.md) for the competitive research dump (Veo, Kling, Runway, Pika, Luma, Sora-sunsetting, ElevenLabs, Suno, Synthesia, fal.ai).

### Pipeline orchestration

- **[`content_pipeline/SKILL.md`](content_pipeline/SKILL.md)** — master 6-stage operating system: DIRECT → GENERATE → PRODUCE → DRAFT → PUBLISH → MONITOR. Matt never touches a tool. Read first for any content task. Format library (Friday Hype Reel, Listing Launch Package, Market Commentary, Neighborhood Spotlight, Quick Tip, Trending Format). Per-platform publish APIs (Meta Graph, TikTok Content Posting, YouTube Data, GBP Local Posts).
- **[`social_calendar/SKILL.md`](social_calendar/SKILL.md)** — 3 posts/week per active listing. `scripts/generate_content_calendar.py` reads a listing manifest and produces a JSON calendar. Mix: 1 full-tour video, 1 single-room highlight (15s), 1 lifestyle moment. Template-based captions (no LLM), brand-voice compliant, fails loudly on banned words. Numbers come from the manifest — never invented (per `CLAUDE.md` §0).

---

## 11. Viral content format skills

The six format skills below pair the production rules above with specific viral formats. Each ships with a SKILL.md that lays out tool chain, step-by-step workflow, anti-slop guardrails, brand rules, data verification, and a quality gate. All six reference `ANTI_SLOP_MANIFESTO.md` and obey every rule in this master skill.

**Note on overlap with §10 skills.** Several §11 skills overlap conceptually with skills introduced in §10: `earth_zoom` ↔ `google_maps_flyover`, `neighborhood_tour` ↔ `area_guides`, `listing_reveal` ↔ `listing_launch`, `data_viz_video` ↔ `market_report_video`. The two sets currently coexist. When invoking, pick the version whose tool chain and length-target match the deliverable; do not run both for the same output.

### `earth_zoom/` — Google Earth zoom-to-listing
A "from space to front door" cinematic intro for new listings. Earth Studio scripted descent → Remotion composite with logo, address, hook, ElevenLabs VO. Works as a 6-10s opener for `listing_reveal` or as a stand-alone 15s teaser. Anti-slop: no fake satellite imagery, no AI-generated landscapes, terminal frame must match the actual address (overlay-on-MLS-photo QA). Skill file: `video_production_skills/earth_zoom/SKILL.md`.

### `data_viz_video/` — animated market stats from Supabase
30-60s vertical video where every CountUp number traces to a freshly-pulled `market_pulse_live` query. JSON snapshot per render is the single source of truth — citations pill bottom-right names the source and pull date. Anti-slop: no "approximately", no rounded marketing numbers, every figure has a citation, audio cuts beat-synced via `audio_sync`. Skill file: `video_production_skills/data_viz_video/SKILL.md`.

### `listing_reveal/` — formalized Tumalo-style photo-to-cinematic
The Tumalo Reservoir 16-beat formula codified for every new listing. 16 beats × 2.5-3s = 40-48s reel using `depth_parallax` on hero shots, Ken Burns on detail shots, `audio_sync` to a beat-detected score. Anti-slop: no generic real estate words (manifesto rule 1), every still in the render is a still in the actual MLS photo set, no AI-generated photos. Skill file: `video_production_skills/listing_reveal/SKILL.md`.

### `meme_content/` — trend-jacking with vlipsy clips
Real-time meme + trend response format. vlipsy clip + Matt's voice on-screen text + 15-25s caption-driven cut (no VO by default). Anti-slop: no AI humor (manifesto rule 9), no clips without fair-use review, no trend that contradicts data we just published. Voice grader pass before render — does this sound like a 40-something Bend broker, or like ChatGPT trying to be funny? Skill file: `video_production_skills/meme_content/SKILL.md`.

### `avatar_market_update/` — Synthesia weekly stats avatar
Weekly Mon-AM 60s video, Synthesia avatar delivering market pulse over branded intro/outro and stat overlays. AI-disclosure pill required (manifesto rule 5) for the entire avatar segment. Script enforced against voice rules, numbers traced to Supabase. Human review gate ON for first 4 weeks (manifesto rule 8). Skill file: `video_production_skills/avatar_market_update/SKILL.md`.

### `neighborhood_tour/` — 19 area guides with Earth Studio + data overlay
Library generator: 19 named Bend-area neighborhoods (11 cities + 8 communities, sourced from `scripts/seed.ts`). Each tour: 60-90s vertical with Earth Studio polygon flythrough → Remotion overlays (median price, schools, drive-time, demographics) → ElevenLabs VO from per-neighborhood script template. Every claim mapped to a source in the per-city `citations` array. Anti-slop: no demographic stereotyping, no school rankings without authoritative source, no AI-generated neighborhood photos, fair-housing safe. Skill file: `video_production_skills/neighborhood_tour/SKILL.md`.

---

## 12. Sister skill libraries

Two sibling directories at the repo root extend this skill library with social/brand intelligence and end-to-end automation:

### `social_media_skills/` — platforms, content production, ops, intelligence
The social and brand intelligence layer. Platform algorithm briefs, channel specs, viral hook library, content calendar, cross-platform repurposing rules, analytics feedback loop, community management playbook, ads + lead nurture. Plus four intelligence docs (Paid Ads, Organic Growth, Marketing, Canva/CapCut) that codify what we know about each surface. Read `social_media_skills/README.md` for the index. Every video skill that crosses into a platform-specific concern (caption format, hashtag set, posting cadence, thumbnail spec) reads the relevant file in `social_media_skills/platforms/` first.

### `automation_skills/` — triggers + automation pipelines
The autonomous content engine. Three triggers (`listing_trigger`, `market_trigger`, `trend_trigger`) and six automation skills (`post_scheduler`, `performance_loop`, `repurpose_engine`, `engagement_bot`, `thumbnail_generator`, `ab_testing`). Defines 19 database tables, the OAuth token flow for Meta/TikTok/YouTube/LinkedIn, the post queue with first-30-days human review gate, the format performance scoring formula, and the FUB lead capture path from inbound DMs/comments. Every automation references `ANTI_SLOP_MANIFESTO.md` and refuses to publish content that violates it.

---

## How to use this index

Every video skill invocation, every Remotion composition, every `Listing.tsx` rewrite opens THIS file (the master) FIRST, then `ANTI_SLOP_MANIFESTO.md`, then the relevant sub-skill for the capability you're reaching for. Don't wait for review — self-enforce on every build.

The index is the contract. If a sub-skill claims a capability that contradicts §1–§9 above, the master wins. Sub-skills extend; they do not override. The manifesto outranks the master where the two intersect on content gating.
