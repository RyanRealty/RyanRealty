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
- [ ] Pick techniques by name from `.claude/skills/ryan-studio/techniques/registry.json` and list them in `brief.techniques`.
`video_gate.mjs` checks the paperwork; `npm run video:check` measures the finished file and is the gate.

# Ryan Studio (the repo is the one source; Claude Code, Grok CLI, Cursor)

**One factory (Matt 2026-10-13).** Every video renders through this repo's `lib/studio` code, on Matt's Mac mini or in a cloud session: same code, same check, same result. Imagine makes footage clips only, never a finished cut. The old box pipeline (`/workspace/motion-clips` HTML + `render.mjs`) is retired (RULEBOOK C10). Contract: `docs/plans/STUDIO_ONE_FACTORY.md`.

**The spine is the same in every video; the creative layer is different every time.** The spine (hook, length, holds, no frozen frame, the female voice with captions synced to it, sourced numbers, loudness, safe area, loop, locked end card) is measured on the finished file. The creative layer is chosen per film from `techniques/registry.json`: only `ready` techniques exist as code, every film needs a ready hook, scene and type technique, and its hook device and scene set may not repeat any of the last five films (`data/studio/film-ledger.jsonl`). A `planned` technique is an idea with a named home; build it before you brief it.

1. Read `references/RULEBOOK.md` (Matt's locked rules; wins over every other skill) and the creative brain (`.claude/skills/creative-brain`): one feeling, one sentence, one constraint, before anything else.
2. Pick the type card in `rules/VIDEO_TYPES.md`: listing, market_update, news_civic, closing, neighborhood_spotlight, buyer_ad, brand_film, story_teaser. Every card = hook, intro, body, payoff, end card.
3. Write `brief.json` to `templates/brief.schema.json` (video_type, hook text + time, length, every number with source and exact window, footage with rights, end card, the ready techniques) and `timeline.json` (beats with role, start, end, text, number, footage, scene, cards; voice script; topic CTA).
4. Run `node .claude/skills/ryan-studio/tools/video_gate.mjs brief.json timeline.json` on the paperwork. Non-zero exit = fix it; do not render.
5. Render: `npm run studio:render -- brief.json timeline.json`. It writes `final.mp4` and `final.manifest.json` and runs the check.
6. Measure: `npm run video:check -- final.mp4` opens the file and runs every check in the contract. Look at `final.contact.png` yourself.
7. Review: a separate agent (never the builder) watches the contact sheet, listens to the audio and writes `final.review.json`. Then `npm run video:check -- final.mp4 --final` must pass. Only a `--final` pass goes to Matt. Matt posts himself; never publish.

Craft: `.claude/skills/motion-design/SKILL.md` (pure function of t, sound read off the picture's own curves). Ad copy, VO markup and captions: `docs/ai-voiceover-scripts.md`. Items marked PROPOSED in VIDEO_TYPES.md are not rules until Matt says yes.
