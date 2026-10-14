# TikTok burned-in captions

Source: Matt rule 2026-10-13
Category: type

Ready: implemented in `lib/studio/voice/captions.ts` (cards) and `lib/studio/voice/captionStyle.ts` (look), held by `lib/studio/voice/captions.test.ts`.

## Recipe
Word timings from the FINAL audio (ElevenLabs v3 with timestamps, `lib/studio/voice/elevenlabs.ts`), never estimated. 1 to 4 words per card, broken where a person pauses, each card at least 0.4 s and starting on its first word. Digits only through the brief's approved display map ("sixty-three percent" shown as 63%). Look: Geist Bold 84 px, cream #faf8f4 with a 6 px navy #102742 outline, inside x 120 to 960 and y 1160 to 1360 (navy and cream only; white Inter is off brand). `video:check` check 8 measures sync and coverage.

## Use
List `tiktok_caption_burn` in brief.techniques.
