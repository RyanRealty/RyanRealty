# Code-composed score mastered to -14 LUFS

Source: prompt-motion research 2026-10-07 (cinetic: synthesised score, measured master)
Category: sound

Ready: implemented in `lib/studio/score/compose.ts`, held by `lib/studio/score/score.test.ts`.

## Recipe
A deterministic score in pure TypeScript (felt keys, warm pad, one bell, air), mastered to -14 LUFS with a true-peak limiter. The voice mixes over it with the bed ducked under speech (`lib/studio/voice/mix.ts`).

## Use
List `composed_score` in brief.techniques once it is ready. The renderer records it in the manifest when it runs; `video:check` fails a brief technique that never ran.
