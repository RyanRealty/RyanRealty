---
name: elevenlabs_voice
description: Use this skill whenever the user says "generate VO", "synth the voiceover", "TTS for the video", "ElevenLabs voice settings", "Victoria voice", "what voice settings do we use", "generate audio for this script", "record the narration", "what's the voice ID", or when any video production skill needs to call the ElevenLabs API. Covers Victoria voice ID + settings, model selection, IPA phoneme tags for tricky place names (Deschutes, Tumalo, etc.), previous_text chaining for prosody, number-spelling rules. ElevenLabs voiceover generation rules for Ryan Realty.
---

# ElevenLabs Voice Skill

## Canonical references

This is a capability skill. The two top-tier rule layers.  [`design_system/ryan-realty/SKILL.md`](. /. /design_system/ryan-realty/SKILL.md) (brand) and [`social_media_skills/platform-best-practices/SKILL.md`](. /. /social_media_skills/platform-best-practices/SKILL.md) (platform rules).  apply to all output. Per CLAUDE.md "Skill self-binding", every Ryan Realty content piece loads both before producing.

---

## Voice (LOCKED.  permanent as of 2026-04-27)

| Field | Value |
|---|---|
| Name | Victoria.  Ryan Realty Anchor |
| Voice ID | `qSeXEcewz7tA0Q0qk9fH` |
| Saved as | "Victoria.  Ryan Realty Anchor" on account |
| Locked | 2026-04-27.  permanent, no substitutions |

**No other voice is permitted.** Not Ellen (`BIvP0GN1cAtSRTxNHnWS`.  predecessor, superseded 2026-04-27). Not any other ElevenLabs voice. Not any other TTS provider. Victoria only.

---

## Model selection

| Model | When to use |
|---|---|
| `eleven_turbo_v2_5` | **All production VO.** Fast, high quality, correct prosody on standard English. |
| `eleven_v3` | **Only when an SSML `<phoneme>` tag is required** (tricky place names below). `eleven_v3` supports IPA phoneme override; `eleven_turbo_v2_5` does not. |
| `multilingual_v2` | **BANNED.** Never use. Different prosody character, does not match approved renders. |

Decision rule: if the script contains any place name from the IPA list below, use `eleven_v3`. Otherwise, always `eleven_turbo_v2_5`.

---

## Canonical voice settings (single source of truth)

> **This section is the authoritative spec.** Every other skill file that references ElevenLabs settings MUST match these values exactly. When in doubt, defer to this file.
>
> Updated 2026-05-07 per Matt directive.  tuned for conversational delivery; canonical source: `video_production_skills/elevenlabs_voice/SKILL.md`.

```json
{
  "stability": 0.40,
  "similarity_boost": 0.80,
  "style": 0.50,
  "use_speaker_boost": true
}
```

| Setting | Value | Rationale |
|---|---|---|
| `stability` | `0.40` | Lower = more expressive delivery; avoids robotic monotone |
| `similarity_boost` | `0.80` | Stronger Victoria identity across sessions |
| `style` | `0.50` | More dynamic delivery range |
| `use_speaker_boost` | `true` | Clarity on compressed social audio |

Any deviation produces a different-sounding voice and is grounds for re-render.

---

## `previous_text` chaining (prosody continuity)

Chain every sentence in a clip using `previous_text`. This gives ElevenLabs the prior sentence's context so the inflection at the start of each sentence sounds natural rather than isolated.

- For sentence N: `previous_text` = sentence N-1 (verbatim, no modifications).
- For the first sentence in a clip: `previous_text` = empty string or omit.
- Never skip chaining on interior sentences.  prosody breaks are audible and are a QA fail.

---

## IPA phoneme tags for Central Oregon place names

Use these when the model is `eleven_v3`. Wrap the place name in SSML:

```xml
<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme>
<phoneme alphabet="ipa" ph="ˈtuːməloʊ">Tumalo</phoneme>
<phoneme alphabet="ipa" ph="ˈtɛθəroʊ">Tetherow</phoneme>
<phoneme alphabet="ipa" ph="ˈɔːbri">Awbrey</phoneme>
<phoneme alphabet="ipa" ph="ˈtɛrəbɒn">Terrebonne</phoneme>
```

Plain-English pronunciation aide (for script review, not for API):

| Place | Pronunciation |
|---|---|
| Deschutes | "duh-SHOOTS" |
| Tumalo | "TOO-muh-low" |
| Tetherow | "TETH-er-oh" |
| Awbrey | "AW-bree" |
| Terrebonne | "TAIR-uh-bon" |

---

## Number-spelling rules

ElevenLabs renders numerals inconsistently. Spell all numbers out in the ingestion text:

| In video | In VO script sent to API |
|---|---|
| $475,000 | "four hundred seventy five thousand dollars" |
| $3,025,000 | "three million twenty five thousand dollars" |
| 4.3 months | "four point three months" |
| 12% | "twelve percent" |
| 2,847 | "two thousand eight hundred forty seven" |

Do not use commas as separators in spelled-out numbers. Do not use "and" before the last element (say "four hundred seventy five" not "four hundred and seventy five").  Victoria reads it cleaner without "and."

---

## Sentence writing rules

- **Short sentences.** Two clauses maximum per sentence.
- **No commas where Matt wouldn't pause.** If a comma would cause a weird mid-phrase pause in speech, remove it or split into two sentences.
- **No em-dashes.** No semicolons. No AI filler ("delve," "leverage," "tapestry," "navigate," "robust," "seamless," "comprehensive," "elevate," "unlock").
- **No banned real estate words** in VO: stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout.
- **First spoken word is content.** No "hey," "today," "welcome," or "let's talk about" openings.

---

## Shared client libraries (locked 2026-05-20 — single source of truth)

**Every producer that generates VO MUST import from one of these two shared modules.** Do NOT hardcode the voice ID, model, or settings inline — a one-line change here propagates to every producer.

| Caller language | Import from | Exports |
|---|---|---|
| Python (scripts/build_*.py) | `scripts/_voice_lib.py` | `synth_vo`, `synth_vo_chain`, `synth_vo_ab`, `get_forced_alignment`, `alignment_to_caption_words`, `wrap_phonemes`, `VOICE_ID`, `DEFAULT_SETTINGS`, `AB_VARIANTS`, `IPA_PHONEMES` |
| Node / TS (scripts/*.mjs, lib/) | `lib/voice/alignment.ts` | `VICTORIA_VOICE_ID`, `VICTORIA_MODEL_ID`, `VICTORIA_SETTINGS`, `VICTORIA_AB_VARIANTS`, plus the `synthVoiceSegment()` + `getForcedAlignment()` helpers |

### Python usage (canonical)

```python
from scripts._voice_lib import (
    synth_vo,
    synth_vo_chain,
    get_forced_alignment,
    alignment_to_caption_words,
    wrap_phonemes,
)

# Single segment
path = synth_vo("Bend home prices climbed four percent.", Path("out/vo/s01.mp3"))

# Multi-segment with previous_text chaining
sentences = [
    "Bend home prices climbed four percent this quarter.",
    "The median closed at four hundred seventy five thousand dollars.",
    "Inventory sits at two point one months of supply.",
]
paths = synth_vo_chain(sentences, Path("out/vo/news_bend_market"), slug="news_bend_market")

# Tricky place names — wrap with phoneme tags (auto-picks eleven_v3)
text_with_phonemes = wrap_phonemes("Deschutes county home prices rose two percent.")
# → '<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme> county...'
synth_vo(text_with_phonemes, Path("out/vo/deschutes.mp3"))

# Forced-alignment for captions
alignment = get_forced_alignment(paths[0], sentences[0])
caption_words = alignment_to_caption_words(alignment)  # ready for SingleWordCaption.tsx
```

The library writes `<audio>.words.json` alongside every MP3. The captions component reads from that file at render time — see [`video_production_skills/captions/SKILL.md`](../captions/SKILL.md).

---

## A/B testing — locked 2026-05-20 (Matt directive)

**Run an A/B test for any new producer + for any script that may read robotic before locking the production VO.** The default settings (0.40 / 0.80 / 0.50) are tuned for the average Ryan Realty script, but extreme cases (very short sentences, very long run-ons, dense numeric content, dramatic news clips) sometimes benefit from a different setting.

### The three canonical variants

| Variant | stability | similarity_boost | style | When it wins |
|---|---|---|---|---|
| **baseline** | 0.40 | 0.80 | 0.50 | Default conversational delivery — the majority of scripts |
| **expressive** | 0.30 | 0.80 | 0.60 | Hook-heavy openers, market drama, news clips, when baseline reads flat |
| **controlled** | 0.55 | 0.80 | 0.40 | Dense numeric reads, longer measured sentences, when baseline over-emotes |

### A/B workflow

```python
from scripts._voice_lib import synth_vo_ab

# Generate all three variants for a single representative line
paths = synth_vo_ab(
    "Median home price in Bend hit four hundred seventy five thousand last quarter.",
    out_dir=Path("out/vo-ab/news_bend_april"),
)
# → out/vo-ab/news_bend_april/baseline.mp3
# → out/vo-ab/news_bend_april/expressive.mp3
# → out/vo-ab/news_bend_april/controlled.mp3
```

Listen to all three. Pick the most natural-sounding variant. Lock those settings via the `settings` arg on the production `synth_vo()` calls for that producer:

```python
from scripts._voice_lib import synth_vo, AB_VARIANTS

# Lock 'expressive' for the news clip producer
NEWS_CLIP_SETTINGS = AB_VARIANTS['expressive']
path = synth_vo(text, out_path, settings=NEWS_CLIP_SETTINGS)
```

### When to re-run A/B

- First time a new producer is built (always).
- When Matt flags a producer's voice as "stiff" / "robotic" / "over-emotional."
- After a meaningful ElevenLabs model update (rare).
- When a new format with different cadence is added (e.g. micro-clip 6-second hooks vs. 45-second market explainers).

Lock the chosen variant in the producer source. Do not A/B test on every render — that's wasteful API spend. The A/B is a one-time calibration per producer.

---

## Legacy inline pattern (deprecated, kept for reference)

```python
# DEPRECATED — do NOT copy this into new producers.
# Use scripts/_voice_lib.py instead.

import os, requests, json
ELEVEN_API_KEY = os.environ["ELEVENLABS_API_KEY"]
VOICE_ID = "qSeXEcewz7tA0Q0qk9fH"
url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
payload = {
    "text": text,
    "model_id": "eleven_turbo_v2_5",
    "voice_settings": {
        "stability": 0.40, "similarity_boost": 0.80,
        "style": 0.50, "use_speaker_boost": True,
    },
}
# ... etc
```

This pattern is duplicated across ~15 producer scripts as of 2026-05-20. Each producer should migrate to `scripts/_voice_lib.py` on its next rebuild.

---

## Forced-alignment (required for captions)

After every VO generation call, immediately call `/v1/forced-alignment` to get word-level timestamps for captions:

```python
def get_forced_alignment(audio_path: str, transcript: str) -> dict:
    """
    Fetch word-level timestamps for a generated VO file.
    Save the result as <audio_path>.words.json.
    """
    url = f"https://api.elevenlabs.io/v1/forced-alignment"
    headers = {"xi-api-key": ELEVEN_API_KEY}
    with open(audio_path, "rb") as f:
        files = {"audio_file": (audio_path, f, "audio/mpeg")}
        data = {"text": transcript}
        response = requests.post(url, headers=headers, files=files, data=data)
    response.raise_for_status()
    result = response.json()
    words_path = audio_path.replace(".mp3", ".words.json")
    with open(words_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Alignment written: {words_path} ({len(result.get('words', []))} words)")
    return result
```

The returned JSON contains `words[]` with `{ text, start, end }` in seconds. Map `start` → `startSec`, `end` → `endSec` before passing to `<KineticCaptions>`. Save the `.words.json` file alongside the `.mp3`. Captions will not sync correctly without it.

---

## Pre-flight checklist (before any VO generation)

```
[ ] ELEVENLABS_API_KEY loaded from.env.local (key name "ryan-realty-automation")
[ ] Voice ID confirmed: qSeXEcewz7tA0Q0qk9fH (Victoria.  do not look this up from memory)
[ ] Model: eleven_turbo_v2_5 (switch to eleven_v3 only if phoneme tags needed)
[ ] Settings object typed out: stability 0.40, similarity_boost 0.80, style 0.50, use_speaker_boost true
[ ] previous_text chained for every sentence after the first
[ ] All numbers spelled out in full
[ ] Banned words grep: stunning/nestled/boasts/charming/luxurious/spacious/cozy etc. ZERO hits
[ ] No em-dashes, no semicolons in script
[ ] IPA tags in place for any Central Oregon place name in the IPA list above
[ ] Forced-alignment call queued to run immediately after each MP3 generates
[ ] Output paths match the comp's staticFile() references before render
```

---

## Anti-patterns (instant re-generate triggers)

| Anti-pattern | Why it fails |
|---|---|
| Using any voice other than Victoria | Different prosody, different timbre.  rejects at QA |
| Using `multilingual_v2` model | Wrong prosody character for English-only content |
| Using `eleven_v3` for non-phoneme clips | Slower, different voice character than approved renders |
| Skipping `previous_text` on interior sentences | Prosody breaks audible at sentence boundaries |
| Sending numerals ("$475,000") instead of spelled-out text | ElevenLabs mispronounces currency figures inconsistently |
| Using Ellen voice ID `BIvP0GN1cAtSRTxNHnWS` | Predecessor voice, superseded 2026-04-27, do not use |
| Skipping forced-alignment call | Captions will fall back to clock-time sync.  violates caption hard rules |
| stability > 0.65 | Voice becomes monotone; loses the warmth that makes Victoria work for real estate |
