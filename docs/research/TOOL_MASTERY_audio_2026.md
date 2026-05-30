# Audio Mastery for Viral Short-Form Video — 2026

> Researched 2026-05-29. Covers ElevenLabs full capability map, TTS delivery mastery, forced-alignment caption recipe, SFX + music, 2026 viral audio strategy, and a complete listing reel mix recipe. Builds on and extends `docs/research/elevenlabs-victoria.md` and `video_production_skills/elevenlabs_voice/SKILL.md` — do not duplicate, reference those for Victoria settings + IPA phoneme library.

---

## 1. ElevenLabs Capability Map — What We Use vs. Untapped

### Full API surface (verified 2026-05-29)

| Capability | Endpoint | We use it? | Status |
|---|---|---|---|
| Text-to-Speech (standard) | `POST /v1/text-to-speech/{voice_id}` | YES — canonical via `_voice_lib.py` | Fully wired |
| TTS with inline timestamps | `POST /v1/text-to-speech/{voice_id}/with-timestamps` | NO | UNTAPPED — eliminates separate alignment call (char-level) |
| Forced alignment | `POST /v1/forced-alignment` | YES — in `_voice_lib.py` | Wired for captions |
| Sound effects (SFX) | `POST /v1/sound-generation` | NO | UNTAPPED — transition whooshes, ambient, cinematic hits |
| Music generation | `POST /v1/music` | NO | UNTAPPED — beat-matched background tracks |
| Speech-to-text (Scribe v2) | `POST /v1/speech-to-text` | NO | Available if needed |
| Voice changer / isolation | — | NO | Not relevant to current pipeline |
| Pronunciation dictionary | `POST /v1/pronunciation-dictionaries` | NO | UNTAPPED — solves eleven_v3 place-name problem |
| Streaming TTS (WebSocket) | `wss://.../stream-input` | NO | Future: agent applications |

### The three highest-value untapped capabilities

**1. Sound Effects API (`/v1/sound-generation`)**
We generate video transitions with only music and VO. A single SFX punch on the stat reveal, a subtle whoosh on a cut, ambient room tone under the listing tour — all achievable from a text prompt. Cost: ~40 credits/second when specifying duration. This is the single fastest win.

**2. Music Generation API (`POST /v1/music` — model `music_v1`/`music_v2`)**
We are currently licensed to use ElevenLabs-generated music for all commercial purposes on paid plans (Film/TV use requires Enterprise). Tracks from 3 seconds to 10 minutes. Natural-language prompts control genre, mood, structure, instrumentation. No separate Suno subscription needed. Stems available on Pro plans for mixing isolation.

**3. Pronunciation Dictionary API**
When we use `eleven_v3` for its superior prosody (audio tags, emotional range), we lose phoneme tag support. The Pronunciation Dictionary solves this: upload a PLS lexicon once, attach `pronunciation_dictionary_id` to every TTS request, and the model pronounces Deschutes/Tumalo/Paulina correctly without per-script phoneme markup. One-time setup, persistent across all requests.

---

## 2. Model Selection — 2026 Reality

| Model | Latency | Char limit | Languages | Phoneme tags | Audio tags | Credits/char | Best for |
|---|---|---|---|---|---|---|---|
| `eleven_v3` | 1–2s | 5,000 | 70+ | NO (silently skipped) | YES — `[laughs]` `[whispers]` etc. | ~1x | Emotional narration, hook lines, drama |
| `eleven_turbo_v2_5` | Medium | 40,000 | 32 | YES (IPA + CMU) | NO | ~0.5x | **Canonical production VO — locked** |
| `eleven_flash_v2_5` | ~75ms | 40,000 | 32 | NO | NO | ~0.5x | Bulk, real-time, cost-sensitive |
| `eleven_flash_v2` | ~75ms | 30,000 | English | YES | NO | ~0.5x | Phoneme-critical + speed |
| `eleven_multilingual_v2` | 1–2s | 10,000 | 29 | NO | NO | ~1x | BANNED per skill |

**Decision tree for Ryan Realty:**
- Standard VO → `eleven_turbo_v2_5` (canonical locked)
- Script has Deschutes/Tumalo/Paulina + no `eleven_v3` audio tags needed → `eleven_flash_v2` with phoneme tags
- Script has `eleven_v3` audio tags (`[laughs]`, `[sighs]`, etc.) + place names → `eleven_v3` + Pronunciation Dictionary
- High-drama hook line only (no place names) → `eleven_v3` with `[sarcastic]` / `[excited]` tags

### eleven_v3 Audio Tags — currently unused, high value

Works only on `eleven_v3`. Inject bracketed directives inline in the script text:

```
[sighs] After 38 days on market, the sellers finally had their offer.
```

Available tags (confirmed 2026):

| Category | Tags |
|---|---|
| Voice effects | `[laughs]` `[whispers]` `[sighs]` `[exhales]` `[clears throat]` |
| Emotional | `[sarcastic]` `[curious]` `[excited]` `[crying]` `[nervous]` |
| Sound effects | `[applause]` `[clapping]` `[gasps]` `[sings]` |
| Pacing | `[pause]` — explicit breath pause |
| Accent | `[strong Southern accent]` — accent control |

**Best use cases for Ryan Realty:**
- Hook-opening sigh/exhale before a counterintuitive stat: `[sighs] Three offers in four days. Sellers' market.`
- Genuinely curious delivery: `[curious] What does four months of supply actually mean for buyers?`
- Subtle laugh on a relatable listing fact: `[laughs] The garage fit exactly one car. If you parked perfectly.`

Use sparingly — one tag max per video. Over-tagging sounds theatrical.

---

## 3. TTS Prompting for Natural, Non-Robotic Delivery

### The core problem

ElevenLabs processes each API call in isolation. Without deliberate scripting, outputs sound like someone reading bullet points. The script is the delivery — the API only performs what the text implies.

### Script architecture rules (ordered by impact)

**Rule 1: Sentence length ceiling — 15 words max**
Every sentence over 15 words risks speed creep (delivery accelerates through the end). Two clauses maximum per sentence is the CLAUDE.md rule. The empirical target is 10–14 words.

Bad: "The median home price in Bend climbed four percent last quarter, while inventory dropped to just two point one months of supply."
Good: "Bend median prices climbed four percent. Inventory? Down to two point one months."

**Rule 2: Punctuation is delivery direction**
- Period = full stop, voice drops and resets
- Comma = half-beat pause, voice continues same energy
- Ellipsis `...` = dramatic hesitation, voice trails
- Question mark = rising intonation, voice lifts
- Em-dash is BANNED per brand voice; use period or comma instead

Practical use: add a comma where you want a micro-pause inside a clause. Remove commas where the AI pauses at the wrong moment.

**Rule 3: Opening word determines energy**
The TTS model reads opening words as energy setters. Starting with a strong active verb or number puts the voice in forward motion. Starting with "The" or "In" gives a neutral, slightly formal read.

Strong openings:
- "Three offers. Four days. That is Bend right now."
- "Forty-two homes closed last month."
- "Your offer needs to be different."

Weak openings (avoid):
- "In today's market..."
- "The latest data shows..."
- "We are going to talk about..."

**Rule 4: Write for how it sounds, not how it reads**
Read every script line aloud before sending to API. If you stumble, rewrite. If a word sounds like "sales copy" when spoken, cut it.

- Replace passive voice with active: "prices rose" not "prices were seen rising"
- Replace nominalizations: "analyze" not "conduct an analysis"
- Replace hedges: use the actual number instead of "approximately"

**Rule 5: Comma placement controls pacing cadence**
For dense numeric content (market stats), force pacing by splitting at every logical boundary:

Bad: "Active listings in Bend sit at one hundred and twelve homes representing two point one months of supply which is down from two point eight this time last year."

Good: "Active listings: one hundred twelve homes. Two point one months of supply. Down from two point eight a year ago."

**Rule 6: `previous_text` chaining — never skip it**
Chain every sentence in a multi-segment clip. The model uses the prior utterance to calibrate pitch and energy entry for the next. Omitting it causes audible prosody resets between clips.

Pattern already in `_voice_lib.py` via `synth_vo_chain()`.

When to break the chain deliberately:
- Scene cuts between radically different topics (exterior to price reveal)
- Going from news-anchor delivery to conversational delivery
- After a silence beat in the video

**Rule 7: `next_text` — the underused lever**
The `/v1/text-to-speech` API also accepts `next_text`. This tells the model what comes after the current line, so it doesn't drop to final-period intonation when the sentence is actually mid-thought. The TypeScript pattern in `elevenlabs-victoria.md` already includes it. The Python `synth_vo()` in `_voice_lib.py` does NOT currently pass `next_text`. This is a one-line fix that improves mid-clip prosody continuity.

**Fix to add to `_voice_lib.py`:**
```python
def synth_vo(text, out_path, *, previous_text="", next_text="", settings=None, model=None, timeout=60):
    body = { ... }
    if previous_text: body["previous_text"] = previous_text
    if next_text: body["next_text"] = next_text  # ADD THIS
```

**Rule 8: A/B test new scripts before locking production audio**
Three canonical variants already in `_voice_lib.py`:
- `baseline` (0.40/0.80/0.50) — most scripts
- `expressive` (0.30/0.80/0.60) — hook-heavy openers, market drama
- `controlled` (0.55/0.80/0.40) — dense numeric reads

Dense stat-read scripts (market reports) often sound better on `controlled`. Run `synth_vo_ab()` on the first time any new producer generates VO, listen, lock the winner.

### Emotional arc scripting

Don't sustain one emotional register across a 40-second video. Build movement:

1. **Hook (0–5s):** High energy, specific claim, urgency without hype
2. **Context (5–20s):** Measured, confident, informational
3. **Insight (20–35s):** Slight uplift — this is the "so what" moment
4. **CTA (35–45s):** Direct, warm, first-person (if appropriate) — softer energy, not a sales push

---

## 4. Forced-Alignment Caption Recipe — Production-Ready

### Endpoint comparison

| Endpoint | Returns | When to use |
|---|---|---|
| `/v1/text-to-speech/{id}/with-timestamps` | char-level timestamps inline with audio (base64) | When generating fresh VO and only need char precision |
| `/v1/forced-alignment` | word-level timestamps + per-word confidence `loss` score | **Preferred for caption sync** — word-grouped, confidence-scored |

For single-word Amboqia captions (CLAUDE.md canonical format), word-level timestamps from `/v1/forced-alignment` are required. The `with-timestamps` endpoint gives only character-level data — you'd need to reconstruct word boundaries yourself.

### Full forced-alignment response schema

```json
{
  "characters": [
    { "text": "H", "start": 0.0, "end": 0.05 }
  ],
  "words": [
    { "text": "Hello", "start": 0.0, "end": 0.43, "loss": 0.008 }
  ],
  "loss": 0.012
}
```

`loss` is alignment confidence (lower = more confident). Values above 0.05 on a word warrant a listen-check on that word's timing.

### Request spec

```
POST https://api.elevenlabs.io/v1/forced-alignment
Header: xi-api-key: {key}
Body: multipart/form-data
  - file: binary audio (any major format, max 1GB)
  - text: plain string only — no JSON, no SSML markup
```

**Critical:** strip all SSML tags (`<phoneme>`, `<break>`) from the transcript before submitting to forced alignment. The endpoint expects the text as it was spoken, not as it was marked up.

### Python recipe (complete pipeline)

```python
from scripts._voice_lib import synth_vo, get_forced_alignment, alignment_to_caption_words

# 1. Generate VO
path = synth_vo("Bend prices climbed four percent.", Path("out/vo/s01.mp3"))

# 2. Get word-level timestamps (auto-saves .words.json alongside .mp3)
alignment = get_forced_alignment(path, "Bend prices climbed four percent.")

# 3. Map to SingleWordCaption-ready format
words = alignment_to_caption_words(alignment)
# → [{"text": "Bend", "startSec": 0.0, "endSec": 0.28}, ...]

# 4. Quality check: flag any high-loss words
for w in alignment["words"]:
    if w["loss"] > 0.05:
        print(f"Low-confidence alignment: '{w['text']}' (loss={w['loss']:.3f})")
```

### Crossfade timing spec (SingleWordCaption)

Per `video_production_skills/captions/canonical/SingleWordCaption.tsx`:
- `CROSSFADE_SEC = 0.08` — 80ms crossfade between adjacent words
- Gaps < 100ms: crossfade outgoing into incoming
- Gaps > 500ms: render true silence (no caption visible)
- Word appears at `startSec`, fades at `endSec`

---

## 5. Sound Effects API — Production Recipes

### Endpoint

```
POST https://api.elevenlabs.io/v1/sound-generation
Header: xi-api-key: {key}
Content-Type: application/json

{
  "text": "prompt here",
  "model_id": "eleven_text_to_sound_v2",  // default, looping support
  "duration_seconds": 2.0,               // null = auto (0.5–30s range)
  "prompt_influence": 0.3,               // 0–1, default 0.3
  "loop": false                          // seamless loop for ambient
}

Response: binary audio (application/octet-stream)
Output formats: mp3_44100_128, pcm_16000, opus_48000_96, etc.
```

Cost: ~40 credits/second when specifying duration. Auto-duration costs vary.

### Prompt formula

`[Source/Object] + [Action] + [Environment/Context] + [Mood modifier]`

### Prompt library for Ryan Realty video production

**Transition whooshes (scene cuts):**
```
Cinematic left-to-right swoosh, clean and fast, minimal reverb
Quick light whoosh, airy, for a smooth video scene transition
Subtle air movement whoosh, natural, not dramatic, 0.8 seconds
```

**Stat reveals / impact hits:**
```
Deep cinematic bass hit, dramatic, suitable for data reveal moment
Soft percussive punch, accent note, real estate presentation style
Rising musical sting, hopeful, 1.5 seconds, no reverb tail
```

**Ambient room tone (listing tour):**
```
Quiet indoor ambience, suburban home, slight room hum, very subtle, loop
Bright open-plan kitchen ambient, faint sounds of a comfortable home, loop
Outdoor Pacific Northwest residential neighborhood, light breeze, birds distant, loop
```

**Market data context:**
```
Gentle market-floor ambience, light crowd hum, financial atmosphere
Typing sounds, notification chimes, light modern office background, subtle
```

**Hook openers (attention grab):**
```
Sharp camera shutter click, single, crisp
Vinyl record scratch, one beat, attention-getting
Short sharp whoosh followed by a soft impact, cinematic opening
```

### Prompt influence tuning

- 10–25%: Organic, unpredictable — good for ambient textures
- 30% (default): Balanced — use for most production SFX
- 40–60%: Tighter to prompt — use when prompt is detailed and specific
- 70–100%: Literal — adjust in 10% increments only, can sound stiff

### Loop strategy for ambient

Generate ambient sounds at 30 seconds with `loop: true`. Layer 2–3 variations offset by a few seconds for a richer bed. Download as WAV (48 kHz) for professional post-processing, deliver as MP3 (44.1 kHz/128 kbps) for video pipeline.

### Iteration protocol

1. Start with the prompt at 30% influence
2. If too generic: add material + environment specifics, bump influence to 40–50%
3. If too stiff: simplify to core sound, drop influence to 20%
4. Most SFX finalize within 2–3 cycles

---

## 6. Music Generation API — Production Setup

### Endpoint

```
POST https://api.elevenlabs.io/v1/music
Header: xi-api-key: {key}
Content-Type: application/json

{
  "prompt": "natural-language description of genre, mood, structure, instrumentation",
  "duration_ms": 30000,    // 3,000–600,000ms (3s–10min)
  // Optional: composition plan for section-by-section control
}

Response: binary audio
Output formats: mp3 (up to 192kbps), PCM (44.1 kHz for Pro plans), Opus
Model: music_v1 / music_v2 (newer)
```

**Commercial use:** All generated music available for broad commercial use on paid plans. Film/TV requires Enterprise. Real estate social video = clear commercial use, no restrictions.

### Prompting recipes for listing reels

**30-45s listing reel background (warm, aspirational):**
```
Warm acoustic guitar, minimal percussion, optimistic mood, house purchase feeling,
modern editorial style, gentle tempo 80 BPM, no lyrics, fades smoothly
```

**Market report news clip (authoritative):**
```
Corporate news background, piano and strings, informational tone, steady tempo 90 BPM,
broadcast quality, no lyrics, subtle rhythm, confident but not dramatic
```

**Luxury property hook (premium feel):**
```
Modern minimal piano, light percussion, sophisticated, 70 BPM, clean production,
aspirational without being emotional, 30 seconds
```

**Neighborhood overview (outdoor/community feel):**
```
Upbeat acoustic folk, light banjo and guitar, Pacific Northwest outdoor feeling,
walking pace 95 BPM, sunny and energetic, no lyrics, 40 seconds
```

### Stem separation (Pro plan)

If on Pro: request stem separation to get isolated track layers (vocals, bass, drums, melody). This lets you lower individual elements under VO with surgical precision rather than ducking the full mix.

---

## 7. 2026 Viral Audio Strategy — What Actually Drives Retention

### Muted-first reality

80% of short-form video on IG Reels, TikTok, and FB Reels is watched muted initially. Audio is the retention multiplier once the viewer taps to unmute — but the hook must work visually first. This means:

- Captions are not a nicety. They are the primary text layer for the muted audience.
- Single-word Amboqia captions (our canonical format) serve muted viewers better than sentence-bands because they are large, legible, and read at speaking speed.
- Audio design is still worth doing — because viewers who unmute watch longer, comment more, and share more than muted viewers.

### Sound as a retention signal

Research finding: creators who opened with counterintuitive audio (unexpected silence in a music-dominated feed, or a sharp SFX punch instead of a music fade-in) achieved measurable completion-rate lifts. Pattern interrupts work in audio the same way they work visually.

Applications:
- Start the video with a sharp SFX hit (camera shutter, vinyl scratch, subtle whoosh) in the first 0.5s — before the VO begins. This rewards the unmuted viewer immediately.
- At the 25% pattern interrupt mark, shift the music register (lower the volume, change the chord, or drop to VO-only for one beat) to re-engage wandering attention.

### Trending audio vs. original VO — the tradeoff

| Approach | Algorithm boost | Brand identity | Copyright risk | Works for Ryan Realty? |
|---|---|---|---|---|
| Trending platform audio | HIGH during peak trend (3–7 days) | NONE — you sound like everyone else | HIGH — one wrong pick = muted video | Only for meme/reaction content |
| Original VO (Victoria) | LOW algorithm signal | HIGH — distinctive voice = recognizable brand | ZERO | YES — primary strategy |
| Original VO + generated background music | Medium — original audio flag | HIGH | ZERO — EL commercial license clear | YES — recommended |
| Trending sound + VO layered | Medium | Medium | Medium risk | Only if the sound has been trending 3+ days |

**Verdict for Ryan Realty:** Always original VO + generated background music. When the video's topic is tied to a cultural moment (Fed rate announcement, housing news), briefly riding a trending audio underlay (at low volume) can boost discovery — but only if the trend is still active and copyright is clear. Never trending audio for listing tours or market reports.

### Loudness targets — 2026 platform specs

| Platform | Target loudness | Peak |
|---|---|---|
| TikTok | -14 LUFS integrated | -1 dBFS true peak |
| Instagram Reels | -14 LUFS integrated | -1 dBFS true peak |
| YouTube Shorts | -14 LUFS integrated | -1 dBFS true peak |
| Facebook Reels | -14 LUFS integrated | -1 dBFS true peak |

All major short-form platforms normalize to -14 LUFS. Deliver at -16 LUFS so platform normalization pushes it to exactly -14, not louder. A track mastered at -10 LUFS gets attenuated by 4 dB, which can make the mix feel over-compressed.

**Practical target:** Master your final mix to -16 LUFS, -1 dBFS true peak. Deliver as stereo MP3 44.1 kHz / 320 kbps minimum, or AAC 256 kbps.

### Beat-sync editing

Beat-synced cuts create an almost hypnotic viewer pull. The principle: major visual transitions (exterior → interior, wide → closeup, photo → stat overlay) land on the downbeat of the music.

Implementation for our Remotion pipeline:
1. Generate background music first
2. Extract BPM from the generated track (or specify BPM in the generation prompt: "90 BPM")
3. Calculate beat interval: 60s / BPM. At 90 BPM = 0.667s per beat
4. Map video beat boundaries (25%, 50%, 75% pattern interrupt marks) to the nearest musical downbeat
5. Adjust `durationInFrames` on each Remotion `<Sequence>` to align with the beat grid

---

## 8. Complete Audio Mix Recipe — 30–45s Listing Reel

This is the canonical audio mix architecture for a Ryan Realty listing reel. Five layers, each with a specific role.

### Layer architecture

```
Layer 1: Background music (generated via ElevenLabs Music API)
Layer 2: VO (Victoria, eleven_turbo_v2_5, _voice_lib.py)
Layer 3: Transition SFX (generated via ElevenLabs SFX API)
Layer 4: Ambient room tone (generated via ElevenLabs SFX API, looped)
Layer 5: Hook SFX (single sharp punch at t=0)
```

### Level targets (relative to -14 LUFS final mix)

| Layer | Level | Notes |
|---|---|---|
| Background music (under VO) | -18 to -20 dBFS | Ducked 6–8 dB below VO during speech |
| Background music (no VO) | -14 to -15 dBFS | Full level during silent beats, opening, closing |
| VO (Victoria) | -12 to -10 dBFS peak | Should sit clearly above music; intelligible on phone speaker |
| Transition SFX | -16 dBFS peak | Present but not jarring; shorter duration = higher peak acceptable |
| Ambient room tone | -28 dBFS | Barely audible; adds depth and prevents the "dead studio" feeling |
| Hook SFX (t=0 punch) | -10 dBFS | Louder than music; single hit, no tail |

### Ducking spec

Music ducks under VO using gain automation:
- Duck starts: 0.3s before VO begins
- Duck depth: -8 dB (relative to music's free-run level)
- Attack: 100ms (fast enough to not be noticeable)
- Release: 500ms after VO ends (slow return prevents a jarring music jump)

In ffmpeg, ducking is achieved via the `sidechaincompress` filter or manual gain keyframes. In DaVinci Resolve / Logic, use sidechain compression with the VO as the key.

### Beat-by-beat audio design (30-second listing reel)

```
t=0.0s   Hook SFX punch (sharp camera click or whoosh) — rewards unmuted viewer
t=0.0s   Music begins at ducked level (-20 dBFS) — VO arrives at t=0.5s
t=0.5s   VO starts — address hook statement / stat
t=0.0–8s  Hook beat: music stays ducked, VO carries the audio; single-word captions
t=8s     Music level rises briefly at beat boundary (0.5s ramp) — registers scene shift
t=8–20s  Context beats: music at -19 dBFS, VO clear
t=20s    Pattern interrupt: transition SFX whoosh + music chord shift or level drop
t=20–32s  Insight + stat reveal: music at -20 dBFS, VO at -11 dBFS; kinetic stat on screen
t=32s    VO ends; music rises to -15 dBFS (release) for CTA / end card
t=35–40s  Ambient tail: music full level, room tone audible, no VO
```

### ffmpeg mix command (reference)

```bash
ffmpeg -i video.mp4 -i music.mp3 -i vo.mp3 -i sfx_transition.mp3 -i hook_sfx.mp3 \
  -filter_complex "
    [1:a]volume=0.2[music];
    [2:a]volume=0.85[vo];
    [3:a]volume=0.3[sfx];
    [4:a]volume=0.7[hook];
    [music][vo]sidechaincompress=threshold=0.01:ratio=8:attack=100:release=500[music_ducked];
    [music_ducked][sfx][hook]amix=inputs=3:duration=first[sfx_mix];
    [sfx_mix][vo]amix=inputs=2:duration=first[final_mix];
    [final_mix]loudnorm=I=-16:TP=-1:LRA=11[out]
  " \
  -map 0:v -map "[out]" \
  -codec:v copy -codec:a aac -b:a 256k \
  -movflags +faststart out/listing_reel_mixed.mp4
```

Adjust `volume=` knobs to hit your level targets before the `loudnorm` filter normalizes to -16 LUFS.

---

## 9. Pronunciation Dictionary API — Setup Guide

Use this when running `eleven_v3` (audio tags) + place names in the same script.

### Create dictionary (one-time, reuse by ID)

```python
import requests, os

API_KEY = os.environ["ELEVENLABS_API_KEY"]

# Upload PLS lexicon file
with open("ryan_realty_oregon.pls", "rb") as f:
    resp = requests.post(
        "https://api.elevenlabs.io/v1/pronunciation-dictionaries/add-from-file",
        headers={"xi-api-key": API_KEY},
        files={"file": ("ryan_realty_oregon.pls", f, "application/pls+xml")},
        data={"name": "Ryan Realty Oregon Place Names"}
    )
    
dict_id = resp.json()["id"]
version_id = resp.json()["version_id"]
print(f"Dictionary ID: {dict_id}")
# Store these as env vars: ELEVEN_DICT_ID, ELEVEN_DICT_VERSION
```

### PLS lexicon file (alias-based, works on all models)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<lexicon version="1.0"
         xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
         alphabet="ipa" xml:lang="en-US">
  <lexeme><grapheme>Deschutes</grapheme><alias>duh SHOOTS</alias></lexeme>
  <lexeme><grapheme>Tumalo</grapheme><alias>TUM uh low</alias></lexeme>
  <lexeme><grapheme>Terrebonne</grapheme><alias>TERRA bon</alias></lexeme>
  <lexeme><grapheme>Paulina</grapheme><alias>pol EYE nuh</alias></lexeme>
  <lexeme><grapheme>Metolius</grapheme><alias>muh TOE lee us</alias></lexeme>
  <lexeme><grapheme>Klamath</grapheme><alias>CLAM ath</alias></lexeme>
  <lexeme><grapheme>Willamette</grapheme><alias>will LAM et</alias></lexeme>
  <lexeme><grapheme>Newberry</grapheme><alias>NOO ber ee</alias></lexeme>
</lexicon>
```

### Attach to TTS request

```python
body = {
    "text": "[sighs] Deschutes County had its strongest quarter yet.",
    "model_id": "eleven_v3",
    "voice_settings": {...},
    "pronunciation_dictionary_locators": [
        {
            "pronunciation_dictionary_id": os.environ["ELEVEN_DICT_ID"],
            "version_id": os.environ["ELEVEN_DICT_VERSION"]
        }
    ]
}
```

---

## 10. Anti-Patterns — What Kills Audio Quality

| Anti-pattern | Result | Fix |
|---|---|---|
| Sentences over 18 words | Speed creep — delivery rushes the end | Split at clause boundaries |
| Opening with "The" or "In" | Flat, formal read with no energy | Start with a number, verb, or noun |
| Skipping `previous_text` | Prosody resets between clips — sounds like multiple takes | `synth_vo_chain()` in `_voice_lib.py` |
| Not passing `next_text` | Final-period intonation on mid-clip sentences | Add `next_text` to `synth_vo()` |
| Phoneme tags on `eleven_v3` | Silently skipped — wrong pronunciation | Use Pronunciation Dictionary instead |
| Music at full level under VO | VO becomes intelligible only at high volume | Duck music -8 dB during speech |
| No SFX or ambient | Audio feels sterile, viewer attention drifts | Add one hook SFX + subtle ambient |
| Final mix over -14 LUFS | Platform normalization attenuates, sounds squashed | Target -16 LUFS; let platform normalize |
| Over-using audio tags | Theatrical, unnatural — sounds like a commercial | One tag max per video; use sparingly |
| Using Suno/Udio for background music | Separate subscription, copyright uncertainty | ElevenLabs Music API: same key, clear commercial license |

---

## 11. Quick-Reference Checklist — Pre-Production Audio

Before any video render:

```
[ ] Script passes brand voice grep (no banned words, no em-dashes, no semicolons)
[ ] All numbers spelled out for TTS ingestion (see elevenlabs-victoria.md §number-spelling)
[ ] Sentences ≤ 15 words each, two clauses max
[ ] Opening word is strong (number, verb, specific noun — not "The" or "In")
[ ] previous_text chaining configured (synth_vo_chain in _voice_lib.py)
[ ] next_text parameter added where applicable
[ ] Place names: phoneme tags (eleven_flash_v2) OR Pronunciation Dictionary (eleven_v3) OR phonetic spelling
[ ] Model selected: eleven_turbo_v2_5 (canonical) unless audio tags or phoneme dict needed
[ ] A/B test run for new producers (synth_vo_ab — 3 variants, pick winner)
[ ] Forced alignment called post-TTS — .words.json saved alongside .mp3
[ ] SingleWordCaption component gets word timestamps (startSec, endSec per word)
[ ] Background music generated (ElevenLabs Music API at 90–95 BPM for listing reels)
[ ] Hook SFX generated (ElevenLabs SFX API — sharp punch or whoosh for t=0)
[ ] Ambient room tone generated (ElevenLabs SFX API — looped, -28 dBFS in mix)
[ ] Music ducked -8 dB under VO (sidechain or gain keyframes)
[ ] Final mix targets: -16 LUFS integrated, -1 dBFS true peak
[ ] Audio format: stereo, 44.1 kHz, AAC 256 kbps minimum in deliverable MP4
```

---

## Sources

- [ElevenLabs API overview](https://elevenlabs.io/api)
- [ElevenLabs models documentation](https://elevenlabs.io/docs/overview/models)
- [Sound effects capability docs](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
- [Sound effects API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- [Forced alignment capability docs](https://elevenlabs.io/docs/overview/capabilities/forced-alignment)
- [Forced alignment API reference](https://elevenlabs.io/docs/api-reference/forced-alignment/create)
- [TTS with timestamps endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- [Eleven Music API](https://elevenlabs.io/music-api)
- [ElevenLabs 2026 complete guide — eleven_v3, agents, music, Scribe](https://medium.com/the-ai-entrepreneurs/elevenlabs-in-2026-the-complete-guide-to-v3-agents-music-and-scribe-7f3c3bdfd201)
- [ElevenLabs cheat sheet 2026 — models, voices, API, agents](https://www.webfuse.com/elevenlabs-cheat-sheet)
- [ElevenLabs sound effects prompting guide](https://aiproductivity.ai/guides/elevenlabs-sound-effects-guide/)
- [Short-form video mastery 2026 — ALM Corp](https://almcorp.com/blog/short-form-video-mastery-tiktok-reels-youtube-shorts-2026/)
- [Writing better prompts for AI voiceovers — Quest Studio](https://queststudio.io/blog/how-to-write-better-prompts-for-ai-voiceovers)
- [Humanizing AI TTS tips — Mixcord](https://www.mixcord.co/blogs/content-creators/humanizing-ai-text-to-speech-pro-narrator-tips)
- [Eleven Music available in API — ElevenLabs blog](https://elevenlabs.io/blog/eleven-music-now-available-in-the-api)
- [ElevenLabs SFX how we built SB1 — ElevenLabs blog](https://elevenlabs.io/blog/how-we-created-a-soundboard-using-elevenlabs-sfx-api)
- [ElevenLabs SFX prompting and essentials — Scenario](https://help.scenario.com/en/articles/elevenlabs-sound-effects-sfx-the-essentials/)
- [Short-form video strategy 2026 — noiz.ai](https://noiz.ai/use-cases/en/article/guide-to-creating-viral-short-form-videos-2026)

---

## Canonical cross-references

- Full Victoria voice settings + IPA phoneme library: `docs/research/elevenlabs-victoria.md`
- Python TTS + alignment shared library: `scripts/_voice_lib.py`
- TypeScript TTS + alignment shared library: `lib/voice/alignment.ts`
- Single-word caption component: `video_production_skills/captions/canonical/SingleWordCaption.tsx`
- Caption safe zones: `video_production_skills/safe-zones/canonical/safe-zones.ts`
- Caption skill rules: `video_production_skills/captions/SKILL.md`
- ElevenLabs voice skill (settings + A/B variants): `video_production_skills/elevenlabs_voice/SKILL.md`
