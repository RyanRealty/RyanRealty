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
- [ ] **RENDER GATE (hard fail, mandatory):** run `python3 .claude/skills/ryan-studio/tools/video_render_gate.py <final.mp4> [--silent]` on the FINAL mp4. It OCRs the frames and HARD-FAILS (exit 1) on: end sequence not logo -> Quality/Local/Service -> "Call now" + 541.703.3095 in the last 4 s (or any other CTA there), non-loopable ending (first vs last frame mean diff > 0.20 or SSIM < 0.35), length outside 15-30 s, no hook text by 2 s, missing burned-in captions on a voiced cut (buyer_ad silent cut needs `--silent`), "top team" anywhere, any <= 3 s price + closed/sold segment. No warnings, no overrides.
- [ ] **Delivery only through `tools/deliver_video.sh <final.mp4> <dest>`** (Ryan Reels, Desktop, Drive, chat). It refuses unless the render gate wrote a passing `<file>.gate.json` stamp for that exact sha256. Never cp/AirDrop/upload a video any other way.
`video_gate.mjs` checks the brief/timeline before render; `video_render_gate.py` checks the actual render and is mandatory before anything leaves the box.

# Ryan Studio (repo copy, shared by Claude Code and Grok CLI)

Build to the mandatory rules above from the start. Then write the brief and run video_gate as the backup check before any render.

Technique library: `techniques/` (one recipe per file) + `techniques/registry.json`. Choose by name; unknown names fail the gate.

1. Read `references/RULEBOOK.md` (Matt's locked rules; wins over every other skill).
2. Pick the type card in `rules/VIDEO_TYPES.md`: listing, market_update, news_civic, closing, neighborhood_spotlight, buyer_ad, brand_film, story_teaser. Every card = hook, intro, body, payoff, end card.
3. Write `brief.json` to `templates/brief.schema.json` (video_type, hook text + time, length, every number with source and exact window, footage with rights, end card) and `timeline.json` (beats with role, start, end, text, number, optional text boxes).
4. Run `node .claude/skills/ryan-studio/tools/video_gate.mjs brief.json timeline.json`. Non-zero exit = fix it; do not render. Tests: `node --test .claude/skills/ryan-studio/tools/tests/`.
5. Then follow `motion-stats-craft`, `imagine-video-craft`, `motion-render-quality`. Creative Desk watches every render with audio. Matt posts himself; never publish.

Items marked PROPOSED in VIDEO_TYPES.md are not rules until Matt says yes. Box source of truth: `/workspace/studio/` (keep both in sync).
