---
name: tool-mastery
description: >
  Deep, current (2026) operating manual for every AI generation tool Ryan Realty can call —
  Replicate video models (Kling, Veo 3, Hailuo, Seedance, Wan, Luma Ray), ElevenLabs full audio
  suite (TTS, forced-alignment, SFX, music), and AI image models (Flux.2, Ideogram, Grok Imagine).
  Per-tool prompting templates, a shot→model→cost decision matrix, the full audio mix recipe, image/
  carousel/thumbnail rules, and multi-shot chaining pipelines. Load this BEFORE generating any AI
  media so the right tool is chosen and prompted correctly instead of scratching the surface. This is
  the "how to actually use the tools" layer; viral-playbook is the "what to make" layer.
---

# Tool Mastery — AI Generation Operating Manual (2026)

**Status:** Canonical
**Locked:** 2026-05-29
**Full research backing:** `docs/research/TOOL_MASTERY_ai_video_2026.md`, `TOOL_MASTERY_audio_2026.md`, `TOOL_MASTERY_image_static_2026.md`. Read those for per-model depth + sources; this skill is the operating summary an agent loads at produce-time.

**Why this exists:** our tool stack (the full Replicate SOTA video menu, ElevenLabs' complete audio suite, Flux/Ideogram/Grok image, Synthesia) can do far more than our producers were using. This skill encodes correct, current usage so every render uses the *right* tool, prompted the *right* way, at known cost — not a stub.

**Reads under §0 (data accuracy) and §0.5 (draft-first), which outrank everything here.** Never fabricate a real listing's look or any number. Render to `out/`, show Matt, then commit.

---

## 0. The one rule that prevents most AI-video slop

**One camera move per clip.** Every model warps geometry or ignores half the prompt when asked for concurrent moves ("push in WHILE orbiting AND tilting"). Pick ONE verb per clip: dolly **or** orbit **or** crane **or** tilt **or** push-in. Visual variety comes from the *edit* (cutting between single-move clips), never from overloading one clip. This single rule eliminates the most common failure across all video models.

---

## 1. Video — Replicate model decision matrix

All via `REPLICATE_API_TOKEN` (account billed to Matt's GitHub). Endpoint: `POST https://api.replicate.com/v1/predictions` (poll, or pass `webhook=`). Always call through a shared helper (build `lib/replicate-video.ts` if absent) — never inline per producer.

| Shot / job | Default model | Slug | ~Cost | Why |
|---|---|---|---|---|
| Listing hero, $750K+ | **Kling v2.1 Master** | `kwaivgi/kling-v2.1-master` | ~$0.80/5s | Best camera-choreography fidelity (dolly/crane/pullback), 1080p 9:16 |
| Mid-market listing batch | **Hailuo 02** | `minimax/hailuo-02` | ~$0.27-0.48/6s | 3-5× cheaper than Kling, strong physics, best face/body consistency |
| Cinemagraph (water, curtains, foliage, steam) | **Hailuo 02** | `minimax/hailuo-02` | ~$0.27/6s | Best subtle physics micro-motion |
| Hook needing ambient SOUND | **Veo 3 Fast** | `google/veo-3-fast` | ~$1.25/8s | Only model with native synced audio — skips the post-audio pass |
| Premium ambient-sound hero | **Veo 3** | `google/veo-3` | ~$6/8s | Highest realism + native audio; reserve for marquee |
| Neighborhood / lifestyle b-roll volume | **Wan 2.5 i2v** | `wan-video/wan-2.5-i2v` | cheapest | Volume tier. NOTE 16fps native → transcode `ffmpeg -i in.mp4 -vf fps=30 out.mp4` for Remotion |
| Text-to-video b-roll (no start photo) | **Wan 2.5** / **Seedance** | `bytedance/seedance-1-pro` | cheap | When no real photo to start from |
| Atmospheric/mood luxury | **Luma Ray 2 720p** | `luma/ray-2-720p` | ~$0.40/s | Cinematic tracking/parallax language |
| Draft a move before paying for hero | **Seedance Fast** / **Ray Flash** | `luma/ray-flash-2-540p` | ~$0.18/s | Cheap exploration → upscale the keeper |

**i2v vs t2v:** start from the real listing photo (image-to-video) whenever the subject must stay recognizable — listing heroes, anything property-specific. Use text-to-video only for generic/atmospheric b-roll (seasons, nature, abstract). i2v + a real photo also keeps us honest under §0 (we're animating the real home, not inventing one).

### Video prompt template (copy-ready, adapt the bracketed parts)

```
[ONE camera move] [subject + setting], [time of day / light], [mood], [lens feel], cinematic, photoreal, 9:16
```

Real-estate examples:
- Hero (Kling, i2v from listing photo): `slow cinematic push-in toward a modern single-level home, warm golden-hour light, calm and aspirational, shallow depth of field, photoreal, 9:16`
- Lifestyle b-roll (Hailuo, t2v): `gentle handheld walk along a Deschutes River trail in autumn, low morning sun through ponderosa pines, peaceful, photoreal, 9:16`
- Ambient hook (Veo 3 Fast): `static shot of a stone fireplace with crackling fire, embers drifting, cozy mountain-home interior, natural fire ambient sound, photoreal, 9:16`
- Flyover (Luma Ray): `smooth aerial drone push over a high-desert neighborhood toward the Cascade mountains, clear blue sky, expansive, photoreal, 16:9`

Rules: one move; name the light; add "photoreal" + aspect; keep it ONE sentence; negative-prompt only to remove artifacts (`blurry, warped, extra limbs, text`), not to add direction.

### Multi-shot pipeline (a 30-45s listing reel)
1. 8-12 beats, 2-4s each. ONE move per beat, vary the move across beats (push → orbit → tilt → static cinemagraph → pullback).
2. Hero beats (3-4) from real listing photos via Kling/Hailuo i2v. Connective b-roll via Wan/Seedance. One ambient-sound beat via Veo 3 Fast if budget allows.
3. Draft cheap (Seedance/Ray Flash) → pick → re-render keepers at hero quality → upscale (`nightmareai/real-esrgan` on Replicate) if needed.
4. Assemble + caption + audio in Remotion (Remotion owns text/charts/kinetic — NEVER ask a video model for on-screen numbers).
5. Typical batch cost: ~$3-6 for a full reel. Smoke-test ONE clip first.

---

## 2. Audio — ElevenLabs full suite

Voice **Victoria** `qSeXEcewz7tA0Q0qk9fH`, model `eleven_turbo_v2_5`, **stability 0.40 / similarity 0.80 / style 0.50**, `use_speaker_boost:true`. All VO through `scripts/_voice_lib.py` (Python) or `lib/voice/alignment.ts` (Node) — never inline.

**Three untapped capabilities to start using:**
1. **SFX** (`POST /v1/sound-generation`) — generate a transition whoosh / stat-reveal hit / ambient room tone from a text prompt. One SFX punch at t=0 rewards unmuted viewers and lifts production quality above the feed.
2. **Music** (`POST /v1/music`) — already paid, commercial-clear (kills Suno/Udio copyright risk). Prompt a mood + BPM, then beat-sync Remotion cuts to it.
3. **Pronunciation dictionary** — upload a PLS lexicon once, attach `dictionary_id` per request; lets delivery tags + correct place-name pronunciation coexist.

**Single biggest VO-quality lever:** add `next_text` chaining (not just `previous_text`) to `_voice_lib.synth_vo()`. Without it the model hits closing intonation on every mid-clip sentence — the telltale "AI voice ends every line." One-line fix, improves every render.

**TTS delivery:** short sentences, two clauses max; commas where a real speaker pauses; split long lines into segments; chain `previous_text`+`next_text`; IPA for place names (Deschutes `dəˈʃuːts`, Tumalo `TUM-uh-low`).

**Forced-alignment caption recipe:** after synth, call `/v1/forced-alignment` (mp3 + transcript) → per-word `{word,startSec,endSec}` → drive the canonical `SingleWordCaption` (one word at a time, Amboqia, synced to speech, ≤100ms crossfade). Never clock-time slots.

**Listing-reel mix (5 layers):** hook SFX at t=0 (-10 dBFS); music 90 BPM ducked -20→-8 dB under VO (100ms attack/500ms release); Victoria VO -11 dBFS peak; ambient room tone -28 dBFS; one transition SFX at the 25% interrupt. Master to **-16 LUFS / -1 dBFS true peak** so platform normalization lands near -14 LUFS without squashing.

---

## 3. Image — Flux / Ideogram / Grok + static/carousel/thumbnail

| Job | Model | ~Cost | Notes |
|---|---|---|---|
| Photoreal architectural / lifestyle scene | **Flux.2 Pro** (`black-forest-labs/flux-2-pro`) | ~$0.015+/MP | Natural-language prompt + real camera spec (e.g. "Sony A7IV, 50mm f/1.8"); NO keyword lists, NO negatives, NO MJ flags |
| Text-in-image (badges, quote cards) | **Ideogram v3** | ~$0.075 | 90-95% text accuracy |
| Fast A/B thumbnail grid | **Grok Imagine** | ~$0.02 (10 variants) | Quick exploration |
| Branded data card (market stat, just-listed) | **canvas/PIL composite** | $0 | Our navy/cream system; NOT AI-gen |
| Real listing imagery | **the actual MLS photos** | $0 | §0: never AI-fabricate a real home's look |

**AI vs stock vs real decision:** real listing → real photos. Generic atmosphere/season/concept → Flux. Need exact words rendered → Ideogram. Branded numeric card → composite. Stock (Unsplash/Pexels/Shutterstock) only for a real identifiable landmark AI would get wrong.

**Carousel = the save-engine** (3.1× engagement, 2× saves vs Reels; re-served to non-swipers). Adopt the **8-10 slide market-data carousel**: cover hook = one local number that feels incomplete without swiping; one stat per slide (flashcard); soft CTA ~slide 6; direct CTA final slide. Maps onto our Supabase market data.

**Thumbnail = curiosity gap:** thumb shows the number alone ("↑ 42%") or an expression; title explains. 3-4 words max, 64-80px, 60-30-10 color (60% bg / 30% subject / 10% accent text). Local specificity wins ("Tumalo" > "Central Oregon").

**Slop-avoidance:** Flux natural-language prompts + real camera specs read premium; keyword-soup reads cheap. Keep brand (navy `#102742` / cream `#faf8f4`) consistent; never ship warped hands/text or a fabricated version of a real property.

---

## 4. How to load this skill

Referenced as a mandatory ref in `marketing_brain_skills/producers/TEMPLATE.md` (Tier 3 — video/image producers), `automation_skills/content_engine/SKILL.md`, and registered in `marketing_brain_skills/producers/REGISTRY.md` Section G. Any producer generating AI media loads this + `viral-playbook` (the what-to-make layer) before specifying a deliverable. The format-specific skill (listing_reveal, market-data-video, etc.) still governs the build; this governs tool choice + prompting.
