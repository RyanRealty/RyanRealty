# AI voiceover scripts that sound human

Last updated: 2026-10-14 (Grok TTS Eve made the default)

Ryan Realty binding: written voice stays [`marketing_brain_skills/brand-voice/VOICE.md`](../marketing_brain_skills/brand-voice/VOICE.md). Agent rules live in AGENTS.md "Ad copy, voiceover and captions." This file is the engine markup and caption process. Do not invent a second brand voice.

Words before markup (Matt 2026-10-14): the ad-strategist ([`.claude/agents/ad-strategist.md`](../.claude/agents/ad-strategist.md)) writes the script on the whiteboard first, in plain English a 75-year-old follows on first hearing, context first, dollars not percentages (VOICE.md "Plain English, context first"). This file only decides how an engine says those words; it never rewrites them.

**Default engine (Matt 2026-10-14): Grok TTS, voice Eve.** Every Studio and producer voiceover uses it unless ElevenLabs is explicitly opted in. So the engine is confirmed: write Grok markup first.

Rule zero: find out which engine AND model will render the voice before you format anything. Markup that one engine follows gets read aloud or ignored by another. If the engine isn't confirmed, write a clean plain script (punctuation only) plus one marked-up version per likely engine, and label each.

Continuity: follow this same process whichever tool or agent runs the work (any chat assistant, coding agent, or CLI). Never drop to a generic script because the tool changed. Apply the project's voice and caption rules every time.

Re-check the official docs if this file is more than about 3 months old, because engines change tag support often. (Researched Oct 2026.)

## 1. Per-engine practices

**ElevenLabs v3 / v4** (`eleven_v3`, `eleven_v4`)
- Pauses: no `<break>` tags. Use ellipses `...`, line breaks, and tags like `[short pause]` / `[long pause]`.
- Emphasis: CAPITALIZE the word, plus `?` and `!`.
- Emotion: audio tags in square brackets: `[laughs]`, `[sighs]`, `[exhales]`, `[whispers]`, `[curious]`, `[excited]`, or descriptive tags like `[warm, conversational tone]`. Match tags to the voice. Professional voice clones are not fully optimized for v3.
- Settings: stability presets are Creative, Natural, and Robust. Lower stability gives more range but can be erratic. Speaker boost isn't available on v3. (A third-party claim that Robust dampens tags is unverified, so test it.)
- Numbers: write money as spoken words in ads.
- Pronunciation: v4 takes IPA in slashes, plus alias pronunciation dictionaries.
- Timing: the `/with-timestamps` endpoint.

**ElevenLabs v2 family** (Multilingual v2, Turbo/Flash v2.5)
- Pauses: `<break time="1.5s" />` up to 3 s. Too many breaks cause speed-ups and artifacts. Ellipses and dashes are less consistent.
- No audio tags; they get read aloud.
- Settings: stability 0.5, similarity_boost 0.75, style 0 are the common start. Speed 0.7 to 1.2.
- Numbers: always spell out (Flash/Turbo misread figures like "$1,000,000").

**xAI / Grok TTS** (`/v1/tts`) — DEFAULT, voice `eve`
- Write it like a phone call: one idea per short sentence, contractions ("you'd", "it's"), a question to open ("Moving up?"). Questions and `?` lift the pitch naturally; `!` adds energy, so use it sparingly for a warm read.
- `[pause]` between ideas, `[long-pause]` only to let a number land. `"Or..."` gives a soft hesitation. Put one `[breath]` before the CTA at most.
- Speed 0.95 reads relaxed; 1.0 is brisk. Make two or three takes and pick by ear; there is no seed.
- Request `output_format: { codec: 'wav', sample_rate: 48000 }` for post-production; `with_timestamps` returns `graph_chars` / `graph_times` that `lib/studio/voice/words.ts` turns into caption words (tags are dropped).
- Tags the API refuses or reads aloud: none of the ElevenLabs bracket moods (`[warm]`, `[excited]`) are Grok tags; leave them out.
- Pauses: inline `[pause]`, `[long-pause]`, plus commas, periods, and paragraph breaks.
- Nonverbal inline tags: `[laugh]` `[chuckle]` `[giggle]` `[breath]` `[inhale]` `[exhale]` `[sigh]` `[tsk]`.
- Wrapping tags: `<whisper>...</whisper>` is confirmed. `<soft>`, `<slow>`, `<emphasis>` come from a third-party SDK page, so verify them.
- Place tags where the sound would naturally happen and pair them with punctuation. Never stack tags.
- No SSML.
- Settings: speed 0.7 to 1.5. `text_normalization` defaults to false, so turn it on or write numbers as words. Use the `replace` map for pronunciation and `with_timestamps: true` for caption timing. Default voice is `eve`; list voices with GET /v1/tts/voices.

**OpenAI `gpt-4o-mini-tts`**
- No inline tags. Describe tone, emotion, pacing, and accent in the free-text `instructions` field (not supported on tts-1 or tts-1-hd). Input is capped at 4,096 characters.

**Google Cloud TTS**
- Full SSML: `<break>`, `<emphasis>`, `<prosody>`, `<say-as interpret-as="currency">`, `<phoneme>`, `<sub>`, and `<mark>` for timepoints. The newest Chirp voices have limited SSML. Recheck the docs before relying on this.

Sources:
- https://elevenlabs.io/docs/best-practices/prompting
- https://elevenlabs.io/docs/capabilities/text-to-speech
- https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://cloud.google.com/text-to-speech/docs/ssml

## 2. Script format template

```
TITLE / VERSION:
ENGINE + MODEL:            (e.g. ElevenLabs eleven_v3, voice <id>)
VOICE:                     (gender, age feel, accent)
SETTINGS:                  (stability/preset, speed, normalization)
TARGET LENGTH:             (seconds; about 2.3 to 2.7 spoken words per second for warm delivery)

PLAIN SCRIPT (for review, no markup):
Line 1.
Line 2.

ENGINE MARKUP (paste-ready):
<engine-specific text>

PRONUNCIATION NOTES:
ON-SCREEN TEXT / DISCLAIMERS: (anything that must appear but not be spoken)
```

Keep the plain script and the markup version word-for-word identical apart from markup, so reviewers approve the words once.

## 3. Warm conversational style

- One idea per sentence, mostly 3 to 10 words.
- Talk to one person: "you", contractions, everyday words.
- Light filler, used sparingly ("Okay, so...", "Honestly,", "Here's the thing."), one or two per 30 seconds.
- Pause where a person would breathe: after the hook, before the key number, before the call to action.
- Say numbers the way people say them: "about fifty-five dollars a month", not "$55/mo".
- No broadcast or market-report voice, and no stacked clauses.
- Fewer tags are better: one tone tag at the top, maybe one nonverbal tag per 15 seconds.
- Never put a fact in a tone tag; facts go in the words.
- Read it out loud. If you stumble or run out of breath, rewrite.

## 4. TikTok-style captions and SRT

- 1 to 4 words per card, broken at natural phrase and pause boundaries.
- Each card stays on screen for at least about 0.4 s.
- Digits are fine on captions ("$169/mo") but must match the spoken number.
- Time captions from the engine's timestamps or forced alignment on the FINAL audio. Never estimate from a draft.
- Leave filler and nonverbal sounds out unless they carry meaning.
- Standard SRT: cue number, `00:00:00,000 --> 00:00:00,600`, text, blank line.

## 5. Pre-delivery checklist

- [ ] Engine and model are confirmed, and the markup matches them (no `<break>` on ElevenLabs v3/v4, no `[tags]` on v2/Flash/Turbo, no inline tags on OpenAI).
- [ ] Plain and markup scripts have the same words.
- [ ] Every fact, number, source, and date is unchanged from the approved brief.
- [ ] Numbers, currency, percents, and URLs are written as spoken words, or normalization is on.
- [ ] Hard names are respelled or mapped.
- [ ] Sentences are short, filler is light, and pauses fall at the hook, the key number, and the CTA.
- [ ] Tags are few, not stacked, and fit the voice.
- [ ] Settings are noted.
- [ ] Runtime is estimated against the target length.
- [ ] Captions are 1 to 4 words, timed from the final audio, and match the speech.
- [ ] The project's brand rules are applied (banned words, punctuation, required on-screen disclaimers).
- [ ] Nothing is published or sent without the owner's approval.
