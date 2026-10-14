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
- [ ] 15-30 s long.
- [ ] Real footage (plates and maps sit on real footage, never instead of it).
- [ ] One or two real numbers, each sourced.
- [ ] Readable with sound off: TikTok-style burned-in captions synced to a female, warm, conversational voiceover.
- [ ] Loopable (last frame flows into frame 0).
- [ ] Locked end card: logo, then Quality / Local / Service, then "Call now" 541.703.3095. A topic CTA gets its own card before the end card, never in place of it.
- [ ] VO script follows the engine's own best practices. ElevenLabs v3: ellipses, audio tags, CAPS for emphasis, numbers spelled out, no break tags. Grok TTS: [pause] / [breath], with_timestamps.
- [ ] Same process whatever tool runs it (Grok, Claude, Imagine, Cursor).
- [ ] No "top team" wording. No 3 s clips of a price next to "closed".
- [ ] Pick techniques by name from `.claude/skills/ryan-studio/techniques/registry.json` and list them in `brief.techniques`. A base technique must be `ready` or `approved`; a signature technique must be `approved` (Matt saw its reel). Every film runs at least one approved signature technique (a floor, not a target). Nothing is approved by an agent.
- [ ] Fill `brief.creative` before the story: `feel`, `constraint`, `lineage`, `one_sentence` (`.claude/skills/creative-brain`), each at most 200 characters.
`video_gate.mjs` is the backup check that confirms the brief, not the primary enforcement.

**Rules refuse before render; video:check is proof, not discovery** (Matt 2026-10-14). `studio:render` refuses before the paid voice (text rules: checks 7, 8, 9, 10, 15, 16), before any frame (the planned manifest: 3, 4, 5, 7, 8, 9, 10, 12, 13, 15, 16) and before the full render (the layout probe: 9, 11). Only 1 Provenance, 2 Format, 6 Motion, 14 Review and 17 Pixels wait for the MP4. The table is `CHECK_PHASES` in `lib/studio/qa/phases.ts`.

# Ryan Studio (repo copy, shared by Claude Code and Grok CLI)

Build to the mandatory rules above from the start. Then write the brief and run video_gate as the backup check before any render.

Technique library: `techniques/` (one recipe per file) + `techniques/registry.json`. Choose by name; unknown names fail the gate.

1. Read `references/RULEBOOK.md` (Matt's locked rules; wins over every other skill).
2. Pick the type card in `rules/VIDEO_TYPES.md`: listing, market_update, news_civic, closing, neighborhood_spotlight, buyer_ad, brand_film, story_teaser. Every card = hook, intro, body, payoff, end card.
3. Write `brief.json` to `templates/brief.schema.json` (video_type, hook text + time, length, every number with source and exact window, footage with rights, end card) and `timeline.json` (beats with role, start, end, text, number, optional text boxes).
4. Run `node .claude/skills/ryan-studio/tools/video_gate.mjs brief.json timeline.json`. Non-zero exit = fix it; do not render. Tests: `node --test .claude/skills/ryan-studio/tools/tests/`.
5. Render through the one factory: `npm run studio:render -- brief.json timeline.json` (runs video_gate, the preflight steps b, c and d, renders to `out/studio/<slug>/final.mp4` with its manifest, then `video:check`, which proves on the file what the preflight already decided). Sample: `lib/studio/timeline/fixtures/bend-mos.*.json` (refused at the signature floor until Matt approves a signature technique). Contract: `docs/plans/STUDIO_ONE_FACTORY.md`.
6. Then follow `motion-stats-craft`, `imagine-video-craft`, `motion-render-quality`. Creative Desk watches every render with audio. Matt posts himself; never publish.

Items marked PROPOSED in VIDEO_TYPES.md are not rules until Matt says yes. Box source of truth: `/workspace/studio/` (keep both in sync).
