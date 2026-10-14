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
The admin Studio path (`/admin/studio`, `lib/studio/produce.ts` composeMotion, the
studio-slate cron) stays frozen until it routes through `studio:render`.

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
  15) and a film whose hook device and scene set repeat any earlier film of its type
  (check 16, the repeat check). The reviewer (check 14) judges taste on top.

## Rules refuse before render (Matt 2026-10-14)

**Rules refuse before render; video:check is proof, not discovery.** "I expect you to know
the rules before you build a video." Every rule that the brief, the timeline, the voice
words and the planned layout can decide is decided before a frame is rendered, and before
the paid voice where the script alone decides it. `lib/studio/timeline/preflight.ts` builds
a planned manifest and runs the SAME evaluators video:check runs (`lib/studio/qa/evaluate.ts`,
`techniques.ts`, `ledger.ts`); no rule has a second copy. The phase of every check is
`CHECK_PHASES` in `lib/studio/qa/phases.ts`. `lib/studio/qa/phases.test.ts` fails an
unclassified check; `lib/studio/timeline/preflight.test.ts` fails a preflight check that a
broken brief or timeline does not trip at each step its row names (the step c cases build
the planned manifest from the broken brief or timeline exactly as the renderer does, and
name the planner refusal when planFilm itself holds the rule).

`studio:render` runs, in order, and each step lists every problem at once:

- a. `video_gate.mjs` and the strict brief and timeline readers (`validate.ts`).
- b. Text: the script (read with even word timing and captioned through the same display
  rules) and every string the film draws. Checks 7, 8, 9, 10, 15, 16. Before any download
  and before ElevenLabs is paid.
- c. Plan: after the voice and `planFilm`, the planned manifest. Checks 3, 4, 5, 7, 8, 9,
  10, 12, 13, 15, 16. Before any frame.
- d. Layout: the layout probe (the same page, set to each card's and caption's still and read
  back, no frames encoded). Checks 11 and 9 (authored rows bound to their drawn boxes).
- e. Only then the full render, then video:check on the file.

| Phase | Checks |
|---|---|
| preflight (also run before render) | 3 Length, 4 Hook, 5 Holds, 7 Sound (the voiceover; loudness is file-only), 8 Captions, 9 Numbers, 10 Copy, 11 Safe area, 12 End card (timing; SSIM and the pixel start are file-only), 13 Loop (present; SSIM is file-only), 15 Techniques ran, 16 Not a repeat |
| file-only (only the MP4 can show it) | 1 Provenance, 2 Format, 6 Motion, 14 Review, 17 Pixels |

## Techniques: built is not approved (Matt 2026-10-14)

Every technique in `.claude/skills/ryan-studio/techniques/registry.json` has a tier and a
status. Tier: `signature` (the visible craft from the research: map_pins_pop,
one_dot_thread, paper_cutout_layers, words_become_structure, bucket_drain, collision_notes,
milestone_timeline, outline_draw_zoom, line_draw_riding_dot) or `base` (spine and polish).
Status rungs: `planned` (an idea with a home) -> `ready` (code and test, built) ->
`approved` (Matt saw its showcase reel and said yes; the entry carries `approved_by: "matt"`,
`approved_on` and `reel`). A base technique runs when ready or approved; a signature
technique only when approved.

Interim, until Matt's /admin approvals live in the database, an approval holds only when
`approved_by` is `"matt"`, `approved_on` is an ISO date and `reel` exists: a file in the
checkout, or an https URL that answers a HEAD request within the timeout. One rule,
`.claude/skills/ryan-studio/tools/technique-approval.mjs`, read by video_gate,
`ci:studio-techniques`, the render preflight and check 15. A commit that adds or changes
an approved row needs an `Approved-by: matt` line naming the technique
(`scripts/check-technique-approval.mjs`, commit-msg; no override). The committed registry
has zero approved rows today, and a test holds that. A test's registry approves only with
the test approver (`"test-only stub"`, never `"matt"`), and only through a code seam. Every film runs at least one approved signature technique:
that is a floor, not a target. video_gate, the render preflight (step b) and check 15
refuse a film below it. Nothing is approved by an agent; until Matt approves a signature
technique, no film starts (the sample `bend-mos` fixture is refused there on purpose).

Every brief carries the creative-brain piece brief, `creative`: `feel` (one target emotion),
`constraint` (one formal constraint chosen before the story), `lineage` (the non-AI
artistic lineage it borrows from) and `one_sentence` (the idea in one sentence), each
non-empty and at most 200 characters. video_gate and the brief reader refuse it empty; the
manifest carries it for the reviewer.

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
  "manifestVersion": 2,
  "video": { "file": "final.mp4", "sha256": "<hex>", "width": 1080, "height": 1920, "fps": 30, "duration": 27.5 },
  "videoType": "buyer_ad",                       // a key of video_types.json types
  "techniques": ["eased_number_reveal"],         // names from techniques/registry.json
  "beats": [                                      // hook, intro, body, payoff, cta, endcard, in order
    { "id": "hook", "role": "hook", "start": 0, "end": 3.1 }
  ],
  "texts": [                                      // every word drawn on screen, with when and where
    { "text": "<FIGURE> <words>", "start": 0.2, "end": 3.1, "box": { "x": 90, "y": 400, "w": 860, "h": 220 }, "kind": "card|caption|endcard|cta|label" }
  ],
  "numbers": [                                    // every figure on screen, in a caption or said
    { "onScreen": "<FIGURE>", "source": "<table + filter>", "window": "<date range>", "geography": "<place>", "definition": "<what was counted>" },
    // an authored figure (a scale mark, an as-of date) covers only the drawn boxes it lists
    { "onScreen": "4 mo", "source": "lib/market/classify.ts ...", "window": "none: ...", "geography": "...", "definition": "...", "boxes": [ { "x": 243, "y": 510, "w": 70, "h": 39 } ] }
  ],
  "voice": {                                      // null for a film with no voiceover
    "engine": "elevenlabs", "model": "eleven_v3", "voiceId": "<id>",
    "words": [ { "word": "Okay,", "start": 0.12, "end": 0.41 } ]
  },
  "captions": [ { "text": "<FIGURE> <WORD>", "start": 0.12, "end": 0.71, "words": [0, 1] } ],
  "audio": { "lufs": -14.0, "truePeakDb": -1.7, "silent": false },
  "endcard": { "start": 24.45, "quality": 24.45, "local": 24.85, "service": 25.25, "call": 25.7, "out": 27.5 },
  "loop": { "seconds": 0.3 },                     // the last 0.3 s carries the cut back into frame 0
  "builtBy": "claude",                            // STUDIO_BUILDER in the factory's environment, else "claude"; check 14 refuses a reviewer id sharing a word with it
  "briefSha256": "<hex>",                         // the brief file it was rendered from (check 1)
  "slug": "bend-go-in-with-a-plan",               // [a-z0-9-], from the brief; never generic ("film", "test-2"); with creative.one_sentence it names the film
  "creative": { "feel": "<one emotion>", "constraint": "<one formal constraint>", "lineage": "<artistic lineage>", "one_sentence": "<the idea>" }
}
```

## What `video:check` measures (from the file, not the paperwork)

| # | Check | Measured how | Fails when |
|---|---|---|---|
| 1 | Provenance | sha256 of the MP4 vs `manifest.video.sha256`; sha256 of the brief vs `manifest.briefSha256`; `factory` is `lib/studio` | no manifest, no brief, either hash differs (a brief edited after the render), other factory, type or slug not the brief's |
| 2 | Format | ffprobe | not 1080x1920, not 30 fps, not h264 yuv420p, duration differs from manifest by > 0.05 s |
| 3 | Length | ffprobe duration vs the type's `min_s` / `max_s` / `hard_max_s` | under min; over hard max; over max with no `length_reason` in the brief |
| 4 | Hook | first beat is `hook`; a non-caption text is on screen by the type's `hook_max_s`; the frame at `hook_max_s` differs from a blank frame | late or missing hook |
| 5 | Holds | every beat in the manifest and every scene cut ffmpeg `scdet` finds in the file | a beat or a shot shorter than `min_hold_s` (2.5 s); the end card's word pops are not shots, and only cuts after the start the pixels show (the cream field's first frame) are taken as word pops |
| 6 | Motion | ffmpeg `freezedetect` | any frozen stretch of 1.2 s or more ("everything animated", RULEBOOK §2) |
| 7 | Sound | ffmpeg `ebur128` on the file | integrated outside -15..-13 LUFS, true peak above -1.0 dBTP; no voice or no audio stream when the type (`requires_voiceover`, default true) or the brief (`spec_rules.voiceover`) asks for a voiceover. "Declared silent" passes only for a type and brief that ask for none |
| 8 | Captions | `voice.words` vs `captions` | a caption over 4 words or under 0.4 s, a caption starting more than 0.08 s off its first word, a spoken word no caption shows, caption text that is not the spoken words; no voice words or no captions when a voiceover is required |
| 9 | Numbers | every figure token in `texts`, `captions` and the voice, with its prefix, magnitude and unit word in one form ($, #, %, K, M; mo, days, homes, sales, listings and the rest; fullwidth digits read as digits); every number, ratio, fraction or dozen said or written in words | a figure no row IS in the same unit ("4" is not "4 mo", "$475" is not "$475K", "3.5 days" is not 3.5 months of supply); an authored row, or a brief row whose window is "none" (a threshold), covering anything but its own bound boxes (never a caption or the voice); a spoken figure ("doubled", "a quarter", "a dozen" too) its caption does not show as a measured brief row's figure; a quantity with no single figure said ("most", "dozens", "hundreds of"); a figure written in words on screen; a row missing source, window, geography or definition |
| 10 | Copy | `texts`, `captions`, voice words | em or en dash, `banned_phrases` from video_types.json, "top team", "buyer's market"; video_gate's fair housing flags, addresses and names in any case ("SOLD AT 123 MAIN ST", "Sarah and Tom just closed"); a verdict that disagrees with a months-of-supply reading's band (lib/market/classify.ts): a side word (buyers, sellers) within four words of an edge word (leverage, edge, upper hand, in charge, in control, favor, advantage, power), or "buyer's/seller's market"; the supply row is found by its stat id or by a definition of active listings over monthly or six-month sales |
| 11 | Safe area | every non-endcard `texts` box | box beyond x 960 or y 1640 |
| 12 | End card | manifest times vs END_CARD_SPEC; the frame at `endcard.call + 0.5 s` vs the locked golden still (SSIM); the cream field's first frame in the pixels | missing, out of order, `endcard.start` not the end card beat's start, a start earlier than the pixels show the card, words over ~1.2 s, call hold under 1.5 s, SSIM below 0.92 |
| 13 | Loop | SSIM of the last frame vs frame 0 | below 0.85 |
| 14 | Review (`--final` only) | `<name>.review.json`: `sha256`, `reviewer`, `watched`, `listened`, `verdict` | missing, wrong hash, a reviewer id sharing a word with `builtBy` (STUDIO_BUILDER), verdict not `ship`. Both ids are self-reported until the server certifier names the reviewer |
| 15 | Techniques ran | brief `techniques` vs manifest `techniques` (what the renderer executed) | a brief technique the renderer never ran; fewer than one hook device, one scene device and one type treatment; no approved signature technique ran (an approval holds only with Matt, an ISO date and a reel that exists) |
| 16 | Not a repeat | this manifest vs every earlier film of the same type in the film ledger | a generic slug ("film", "video", "ad", "test", "draft", "untitled", with or without numbers); the same hook device and the same scene set as any earlier film of the type, except the immediately previous version of the same film (the same slug AND the same `creative.one_sentence`); the failure lists the ready hook + scene pairs not used. The ledger append skips a line whose slug and sha256 are already there |
| 17 | Pixels | the ryan-studio render gate (`video_render_gate.py`, OCR via tesseract + opencv) on the MP4; every claimed text read back off its own box at its own time; the gate's OCR samples scanned for figures | a render gate finding (its 15 to 30 s LENGTH is left to check 3); a claimed caption, card or figure the pixels do not show; a figure-shaped token the pixels show in two samples running that is not exactly a figure the manifest lists (no near matches; only the phone's own tokens are skipped); OCR tooling missing (fails with the install line) |

Thresholds live in one place (`lib/studio/qa/thresholds.ts`) so a change is one line and a
test. A check that cannot be measured fails, never passes by default. `--golden`, `--ledger`
and `--registry` are refused with `--final`; a draft run that uses one records it in
`final.check.json` (`overrides`).

## Where each piece lives

- `lib/studio/qa/`: the checker, pure measurement helpers, thresholds; CLI `scripts/video-check.ts` (`npm run video:check`).
- `lib/studio/motion/endcard.ts`: the locked end card as a pure function of t (END_CARD_SPEC), plus its golden still.
- `lib/studio/voice/`: ElevenLabs v3 with timestamps, caption cards from word timings, VO mixed over the score.
- `lib/studio/timeline/` + `scripts/studio-render.ts`: brief + timeline in, film + manifest out.
  timeline.json keeps today's beats (id, role, start, end, text, number, boxes) and adds per
  beat `footage` ({ src, in, move }), `scene` ({ kind: a registry scene technique, ...params };
  today `meter_fill_verdict` and `outline_draw_zoom`, the latter a place's outline from the
  boundaries table, named in `brief.outlines` and read through the DAL at render time)
  and `cards` (text, number, question, turn), plus top-level `voice` ({ script, voice,
  display, start }), `cta` (its own card before the end card) and `score` (mood). The
  renderer records in `manifest.techniques` only what it proved the page drew.
- `lib/video/plate.ts`: each beat's clip trimmed, scaled to cover at one scale and cropped
  (recorded), 30 fps, audio stripped; cream paper for a beat with no footage; frame 0 held
  under the end card for the loop seam.
