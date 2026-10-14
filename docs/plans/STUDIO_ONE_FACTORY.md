# One video factory, measured output (Matt 2026-10-13)

Status 2026-10-13: built and in use. `npm run studio:render` (`lib/studio/timeline/`,
`scripts/studio-render.ts`) renders brief + timeline through the motion stage over a
footage plate (`lib/video/plate.ts`), with the voice and captions (`lib/studio/voice/`),
the score, the locked end card (`lib/studio/motion/endcard.ts`) and the loop seam, writes
the manifest, then runs `npm run video:check` (`lib/studio/qa/`). Sample:
`lib/studio/timeline/fixtures/bend-mos.*.json`.

Matt's ruling, 2026-10-13: "One factory + output check." Every video, from any bot (Claude,
Grok, Imagine, Cursor), renders through the repo's Studio code (`lib/studio`). Grok
Imagine supplies footage clips only, never a finished cut. Nothing reaches Matt until the
finished MP4 passes a check that opens the file and measures it, and a separate reviewer
has watched and listened to it.

Why: the prompt-motion research and the technique library lived in documents, and the
only check (`video_gate.mjs`) read the brief and timeline JSON, never the video. A bot
could name every technique, pass, and hand Matt a flat cut. Techniques that live in the
renderer cannot be skipped; a check that measures the file cannot be talked past.

This supersedes RULEBOOK conflict C10 (the box HTML + `render.mjs` pipeline as "the real
pipeline"). CLAUDE.md §4 already said one factory; this makes it the only path.

## Two layers (Matt 2026-10-13)

"It shouldn't matter where the video is built ... The code needs to be the same." and "I
don't want every video to look the same, but it has to have the same underlying elements
... We're not looking at the same regurgitated content every time."

- **Where:** anywhere the repo runs (Matt's Mac mini or a cloud session). The factory is
  this code, not a machine. Same code, same check, same result.
- **The spine, identical in every video and measured** (checks 1 to 13 below): hook by
  the type's limit, length window, every hold at least 2.5 s, nothing frozen, the female
  voice with captions synced to it, sourced numbers, loudness, safe area, the loop, the
  locked end card, navy and cream, our fonts, the logo only on the end card.
- **The creative layer, different in every video:** every technique in
  `.claude/skills/ryan-studio/techniques/registry.json` names the `lib/studio` module that
  implements it and the test that holds it; a technique with no code is not on the menu
  (a gate holds the registry to the code). Each brief names a one-sentence idea, the
  feeling (creative-brain pipeline), and at least one hook device, one scene device and
  one type treatment. The renderer records the techniques it actually ran in the
  manifest (`techniques`), and the check fails a brief technique that never ran (check
  15) and a film whose hook device and scene set repeat any of the last five films
  (check 16, the repeat check). The reviewer (check 14) judges taste on top.

## The path, every video

1. Brief + timeline, written to the ryan-studio schema (`.claude/skills/ryan-studio/templates/brief.schema.json`). `video_gate.mjs` still runs first, on the paperwork.
2. `npm run studio:render -- <brief.json> <timeline.json>` renders through `lib/studio`
   and writes `final.mp4` plus `final.manifest.json` (below).
3. `npm run video:check -- <final.mp4>` measures the file against the manifest and the
   type rules in `.claude/skills/ryan-studio/tools/video_types.json`, writes
   `final.check.json` and `final.contact.png`, and exits non-zero on any failure.
4. A separate agent (never the one that built it) reviews the contact sheet and the
   audio and writes `final.review.json`. `npm run video:check -- <final.mp4> --final`
   additionally requires that review, bound to the file's sha256, with verdict `ship`.
5. Only a `--final` pass goes to Matt. Matt posts himself.

## Render manifest (`<name>.manifest.json`), written by the factory

```jsonc
{
  "factory": "lib/studio",
  "manifestVersion": 1,
  "video": { "file": "final.mp4", "sha256": "<hex>", "width": 1080, "height": 1920, "fps": 30, "duration": 27.5 },
  "videoType": "buyer_ad",                       // a key of video_types.json types
  "techniques": ["eased_number_reveal"],         // names from techniques/registry.json
  "beats": [                                      // hook, intro, body, payoff, cta, endcard, in order
    { "id": "hook", "role": "hook", "start": 0, "end": 3.1 }
  ],
  "texts": [                                      // every word drawn on screen, with when and where
    { "text": "63% cut their price", "start": 0.2, "end": 3.1, "box": { "x": 90, "y": 400, "w": 860, "h": 220 }, "kind": "card|caption|endcard|cta|label" }
  ],
  "numbers": [                                    // every figure on screen or in a caption
    { "onScreen": "63%", "source": "Supabase ...", "window": "2026-07-01..2026-09-30", "geography": "Bend", "definition": "..." }
  ],
  "voice": {                                      // null for a film with no voiceover
    "engine": "elevenlabs", "model": "eleven_v3", "voiceId": "<id>",
    "words": [ { "word": "Okay,", "start": 0.12, "end": 0.41 } ]
  },
  "captions": [ { "text": "63% CUT", "start": 0.12, "end": 0.71, "words": [0, 1] } ],
  "audio": { "lufs": -14.0, "truePeakDb": -1.7, "silent": false },
  "endcard": { "start": 24.45, "quality": 24.45, "local": 24.85, "service": 25.25, "call": 25.7, "out": 27.5 },
  "loop": { "seconds": 0.3 }                      // the last 0.3 s carries the cut back into frame 0
}
```

## What `video:check` measures (from the file, not the paperwork)

| # | Check | Measured how | Fails when |
|---|---|---|---|
| 1 | Provenance | sha256 of the MP4 vs `manifest.video.sha256`; `factory` is `lib/studio` | no manifest, hash differs, other factory |
| 2 | Format | ffprobe | not 1080x1920, not 30 fps, not h264 yuv420p, duration differs from manifest by > 0.05 s |
| 3 | Length | ffprobe duration vs the type's `min_s` / `max_s` / `hard_max_s` | under min; over hard max; over max with no `length_reason` in the brief |
| 4 | Hook | first beat is `hook`; a non-caption text is on screen by the type's `hook_max_s`; the frame at `hook_max_s` differs from a blank frame | late or missing hook |
| 5 | Holds | every beat in the manifest and every scene cut ffmpeg `scdet` finds in the file | a beat or a shot shorter than `min_hold_s` (2.5 s); the end card's word pops are not shots |
| 6 | Motion | ffmpeg `freezedetect` | any frozen stretch of 1.2 s or more ("everything animated", RULEBOOK §2) |
| 7 | Sound | ffmpeg `ebur128` on the file | integrated outside -15..-13 LUFS, true peak above -1.0 dBTP, or no audio stream on a voiced type |
| 8 | Captions | `voice.words` vs `captions` | a caption over 4 words or under 0.4 s, a caption starting more than 0.08 s off its first word, a spoken word no caption shows, caption text that is not the spoken words |
| 9 | Numbers | every number token in `texts` and `captions` | a figure with no `numbers` row, or a row missing source, window, geography or definition |
| 10 | Copy | `texts`, `captions`, voice words | em or en dash, `banned_phrases` from video_types.json, "top team", "buyer's market"; verdict words that disagree with a months-of-supply reading's band (lib/market/classify.ts) |
| 11 | Safe area | every non-endcard `texts` box | box beyond x 960 or y 1640 |
| 12 | End card | manifest times vs END_CARD_SPEC; the frame at `endcard.call + 0.5 s` vs the locked golden still (SSIM) | missing, out of order, words over ~1.2 s, call hold under 1.5 s, SSIM below 0.92 |
| 13 | Loop | SSIM of the last frame vs frame 0 | below 0.85 |
| 14 | Review (`--final` only) | `<name>.review.json`: `sha256`, `reviewer`, `watched`, `listened`, `verdict` | missing, wrong hash, same author as the build, verdict not `ship` |
| 15 | Techniques ran | brief `techniques` vs manifest `techniques` (what the renderer executed) | a brief technique the renderer never ran; fewer than one hook device, one scene device and one type treatment |
| 16 | Not a repeat | this manifest vs the last five manifests in the film ledger | same hook device and the same scene set as any of the last five |

Thresholds live in one place (`lib/studio/qa/thresholds.ts`) so a change is one line and a
test. A check that cannot be measured fails, never passes by default.

## Where each piece lives

- `lib/studio/qa/`: the checker, pure measurement helpers, thresholds; CLI `scripts/video-check.ts` (`npm run video:check`).
- `lib/studio/motion/endcard.ts`: the locked end card as a pure function of t (END_CARD_SPEC), plus its golden still.
- `lib/studio/voice/`: ElevenLabs v3 with timestamps, caption cards from word timings, VO mixed over the score.
- `lib/studio/timeline/` + `scripts/studio-render.ts`: brief + timeline in, film + manifest out.
  timeline.json keeps today's beats (id, role, start, end, text, number, boxes) and adds per
  beat `footage` ({ src, in, move }), `scene` ({ kind: a registry scene technique, ...params })
  and `cards` (text, number, question, turn), plus top-level `voice` ({ script, voice,
  display, start }), `cta` (its own card before the end card) and `score` (mood). The
  renderer records in `manifest.techniques` only what it proved the page drew.
- `lib/video/plate.ts`: each beat's clip trimmed, scaled to cover at one scale and cropped
  (recorded), 30 fps, audio stripped; cream paper for a beat with no footage; frame 0 held
  under the end card for the loop seam.
