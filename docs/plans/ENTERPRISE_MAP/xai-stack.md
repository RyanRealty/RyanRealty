# xAI stack — the only generative product

**SoR for G32 / R-213.** Official docs: [https://docs.x.ai/overview](https://docs.x.ai/overview).  
**Auth:** `XAI_API_KEY` → `https://api.x.ai/v1`. One key, one vendor.

A session that generates social, video, voice, stills, or content-model text **must read this file and the linked xAI pages before writing a call.** Do not invent a second client. Do not add Replicate / fal / Synthesia / ElevenLabs / OpenAI images / Kling / Veo / Hailuo.

## What xAI covers (2026-08-16, from docs.x.ai)

| Need | xAI surface | Model / endpoint | Our wrapper |
|---|---|---|---|
| Text, tools, structured out | Responses / chat | `grok-4.6` — `POST /v1/responses` | `lib/grok-text.ts` |
| Stills + edits | Imagine Images | `grok-imagine-image-quality` or `grok-imagine-image-2.0` — `POST /v1/images/generations` + `/v1/images/edits` | `lib/grok-image.ts` |
| Video (t2v, i2v, ref, edit, extend) | Imagine Video | `grok-imagine-video-1.5` — `POST /v1/videos/generations` | `lib/grok-video.ts` |
| Voiceover | Voice TTS | `POST /v1/tts` — `voice_id` (default `eve`, override `XAI_VOICE_ID`), IPA `replace`, `with_timestamps` | `lib/grok-voice.ts` |
| Call transcripts | Voice STT | Speech-to-text REST / streaming | same voice module |
| Realtime voice | Voice API | speech-to-speech `grok-voice-think-fast-2.0` | only if a product path needs it |

Pricing (docs.x.ai/developers/models, do not hard-code into public copy): image $0.02–$0.05/image · video $0.05–$0.08/sec · TTS $15/1M chars · STT $0.10/hr REST.

## Hard rules for the executor

1. **Read first:** [overview](https://docs.x.ai/overview) · [models](https://docs.x.ai/developers/models) · [Imagine](https://docs.x.ai/developers/model-capabilities/imagine) · [TTS](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech) · [STT](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text) · [custom voices](https://docs.x.ai/developers/model-capabilities/audio/custom-voices).
2. **One chokepoint.** New generate calls go through `lib/grok-*.ts` (or a later `lib/xai/` barrel that re-exports them). Producers, Today, listing-tour i2v, VO synth, and call transcription do not call a third-party gen URL.
3. **Remotion stays.** It composites. It is not a gen vendor. Do not cancel Remotion.
4. **MLS / Spark / Twilio / Meta / maps stay.** Those are product rails, not gen APIs.
5. **§0 still outranks a pretty render.** Imagine may not invent a listing or the view from an address. Place chrome may be reference-conditioned from a real still.
6. **Voice lock.** Pick one xAI `voice_id` (or a custom clone of Victoria via Custom Voices) and write it in `lib/grok-voice.ts`. Do not rotate voices per render. IPA `replace` for Deschutes, Tumalo, Tetherow, Awbrey, Terrebonne, Paulina, Madras.
7. **Captions.** Use TTS `with_timestamps: true` instead of ElevenLabs forced-alignment. Still render through `SingleWordCaption`.
8. **Temp URLs.** Imagine video URLs expire. Download into our storage (`lib/social/imagine-produce.ts` already does this).
9. **Approval model unchanged.** No public post, no outbound to real people, no ad spend, no OAuth. Drafts only.
10. **Cancel list.** `xai-stack-accept.json` is the artifact Matt uses to cancel billed vendors. Do not tell him to cancel a vendor whose live path still calls it.

## D10 (already locked)

Broker OS D10: Grok Imagine is the only generative image/video camera. This file extends D10 to **voice + content text**. The zoo (Kling, Veo, Hailuo, Luma, Wan, Seedance, fal, Synthesia, ElevenLabs, OpenAI images) is residue to cancel.

## Accept

G32 is done when `xai-stack-accept.json` has every billed gen vendor dispositioned `cancel-now` | `cancel-after-cutover` | `keep-not-gen`, the chokepoint exists for image + video + voice + text, and Matt can cancel every `cancel-now` row today without breaking a required live path.
