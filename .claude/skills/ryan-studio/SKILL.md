---
name: ryan-studio
description: >-
  Use before any Ryan Realty video, Reel, ad, or social creative (Claude Code or
  Grok CLI): Matt's locked rulebook, per-type video rule cards, the brief schema,
  and the video_gate that must pass before any render.
---
# Ryan Studio (repo copy, shared by Claude Code and Grok CLI)

**Every video must have a brief and pass video_gate before any render** (draft or final).

1. Read `references/RULEBOOK.md` (Matt's locked rules; wins over every other skill).
2. Pick the type card in `rules/VIDEO_TYPES.md`: listing, market_update, news_civic, closing, neighborhood_spotlight, buyer_ad, brand_film, story_teaser. Every card = hook, intro, body, payoff, end card.
3. Write `brief.json` to `templates/brief.schema.json` (video_type, hook text + time, length, every number with source and exact window, footage with rights, end card) and `timeline.json` (beats with role, start, end, text, number, optional text boxes).
4. Run `node .claude/skills/ryan-studio/tools/video_gate.mjs brief.json timeline.json`. Non-zero exit = fix it; do not render. Tests: `node --test .claude/skills/ryan-studio/tools/tests/`.
5. Then follow `motion-stats-craft`, `imagine-video-craft`, `motion-render-quality`. Creative Desk watches every render with audio. Matt posts himself; never publish.

Items marked PROPOSED in VIDEO_TYPES.md are not rules until Matt says yes. Box source of truth: `/workspace/studio/` (keep both in sync).
