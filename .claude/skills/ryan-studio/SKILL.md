---
name: ryan-studio
description: >-
  Use before any Ryan Realty video, Reel, ad, or social creative (Claude Code or
  Grok CLI): Matt's locked rulebook, per-type video rule cards, the brief schema,
  and the video_gate that must pass before any render.
---
## MANDATORY VIDEO RULES (read before making any video; Matt, locked 2026-10-13)
These are the spec, not a review step. Every brief must fill `spec_rules` in `.claude/skills/ryan-studio/templates/brief.schema.json`; a brief without them is invalid.
- [ ] Hook lands in the first 1-2 s.
- [ ] Inside the video type's own length window (`tools/video_types.json`: 15-30 s for most types, story teasers 7-15 s, brand films up to 90 s).
- [ ] Real footage (plates and maps sit on real footage, never instead of it).
- [ ] One or two real numbers, each sourced.
- [ ] Readable with sound off: TikTok-style burned-in captions synced to a female, warm, conversational voiceover.
- [ ] Loopable (last frame flows into frame 0).
- [ ] Locked end card: logo, then Quality / Local / Service, then "Call now" 541.703.3095. A topic CTA gets its own card before the end card, never in place of it.
- [ ] VO script follows the engine's own best practices. ElevenLabs v3: ellipses, audio tags, CAPS for emphasis, numbers spelled out, no break tags. Grok TTS: [pause] / [breath], with_timestamps.
- [ ] Same process whatever tool runs it (Grok, Claude, Imagine, Cursor).
- [ ] No "top team" wording. No 3 s clips of a price next to "closed".
- [ ] Pick techniques by name from `.claude/skills/ryan-studio/techniques/registry.json` and list them in `brief.techniques`. A base technique must be `ready` or `approved`; a signature technique must be `approved` (Matt saw its reel). Every film runs at least one approved signature technique (a floor, not a target). Nothing is approved by an agent: an approval holds only with `approved_by: "matt"`, an ISO `approved_on` and a `reel` that exists, and a commit that adds one needs `Approved-by: matt` naming it.
- [ ] Fill `brief.creative` before the story: `feel`, `constraint`, `lineage`, `one_sentence` (`.claude/skills/creative-brain`), each at most 200 characters.
- [ ] **RENDER GATE (hard fail, mandatory):** run `python3 .claude/skills/ryan-studio/tools/video_render_gate.py <final.mp4> [--silent]` on the FINAL mp4. It OCRs the frames and HARD-FAILS (exit 1) on: end sequence not logo -> Quality/Local/Service -> "Call now" + 541.703.3095 in the last 4 s (or any other CTA there), non-loopable ending (first vs last frame mean diff > 0.20 or SSIM < 0.35), length outside the type's window (`--type`), no hook text by 2 s, missing burned-in captions on a voiced cut (buyer_ad silent cut needs `--silent`), "top team" anywhere, any <= 3 s price + closed/sold segment. No warnings, no overrides.
- [ ] **Delivery only through `tools/deliver_video.sh <final.mp4> <dest>`** (Ryan Reels, Desktop, Drive, chat). It refuses unless the render gate wrote a passing `<file>.gate.json` stamp for that exact sha256. Never cp/AirDrop/upload a video any other way.
`video_gate.mjs` is the backup check that confirms the brief, not the primary enforcement. `video_render_gate.py` checks the actual render (`video:check` check 17 runs it) and is mandatory before anything leaves the box.

**Rules refuse before render; video:check is proof, not discovery** (Matt 2026-10-14). `studio:render` refuses before the paid voice (text rules: checks 7, 8, 9, 10, 15, 16), before any frame (the planned manifest: 3, 4, 5, 7, 8, 9, 10, 12, 13, 15, 16) and before the full render (the layout probe: 9, 11). Only 1 Provenance, 2 Format, 6 Motion, 14 Review and 17 Pixels wait for the MP4. The table is `CHECK_PHASES` in `lib/studio/qa/phases.ts`.

# Ryan Studio (the repo is the one source; Claude Code, Grok CLI, Cursor)

**One factory (Matt 2026-10-13).** Every video renders through this repo's `lib/studio` code, on Matt's Mac mini or in a cloud session: same code, same check, same result. Imagine makes footage clips only, never a finished cut. The old box pipeline (`/workspace/motion-clips` HTML + `render.mjs`) is retired (RULEBOOK C10). Contract: `docs/plans/STUDIO_ONE_FACTORY.md`.

**The spine is the same in every video; the creative layer is different every time.** The spine (hook, length, holds, no frozen frame, the female voice with captions synced to it, sourced numbers, loudness, safe area, loop, locked end card) is measured on the finished file. The creative layer is chosen per film from `techniques/registry.json`: only `ready` and `approved` techniques exist as code, every film needs a hook, scene and type technique and at least one signature technique Matt approved, and its hook device and scene set may not repeat any earlier film of its type (`data/studio/film-ledger.jsonl`). A `planned` technique is an idea with a named home; build it before you brief it.

1. Read `references/RULEBOOK.md` (Matt's locked rules; wins over every other skill) and the creative brain (`.claude/skills/creative-brain`): one feeling, one sentence, one constraint, before anything else.
2. Pick the type card in `rules/VIDEO_TYPES.md`: listing, market_update, news_civic, closing, neighborhood_spotlight, buyer_ad, brand_film, story_teaser. Every card = hook, intro, body, payoff, end card.
3. Write `brief.json` to `templates/brief.schema.json` (video_type, hook text + time, length, every number with source and exact window, footage with rights, end card, the techniques, the creative block) and `timeline.json` (beats with role, start, end, text, number, footage, scene, cards, optional text boxes; voice script; topic CTA).
4. Run `node .claude/skills/ryan-studio/tools/video_gate.mjs brief.json timeline.json`. Non-zero exit = fix it; do not render. Tests: `node --test .claude/skills/ryan-studio/tools/tests/`.
5. Render through the one factory: `npm run studio:render -- brief.json timeline.json` (runs video_gate, the preflight steps b, c and d, renders to `out/studio/<slug>/final.mp4` with its manifest, then `video:check`, which proves on the file what the preflight already decided). The slug names the film (never `film`, `test-2`); the builder is `STUDIO_BUILDER` (default claude), and the reviewer may not share a word with it. Sample: `lib/studio/timeline/fixtures/bend-mos.*.json` (refused at the signature floor until Matt approves a signature technique). Contract: `docs/plans/STUDIO_ONE_FACTORY.md`.
6. Measure: `npm run video:check -- final.mp4` opens the file and runs every check in the contract. Look at `final.contact.png` yourself.
7. Review: a separate agent (never the builder) watches the contact sheet, listens to the audio and writes `final.review.json`. Then `npm run video:check -- final.mp4 --final` must pass. Only a `--final` pass goes to Matt. Matt posts himself; never publish.
8. Then follow `motion-stats-craft`, `imagine-video-craft`, `motion-render-quality`. Creative Desk watches every render with audio.

Craft: `.claude/skills/motion-design/SKILL.md` (pure function of t, sound read off the picture's own curves). Ad copy, VO markup and captions: `docs/ai-voiceover-scripts.md`. Items marked PROPOSED in VIDEO_TYPES.md are not rules until Matt says yes.
