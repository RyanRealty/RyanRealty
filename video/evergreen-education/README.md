# Evergreen Education Video Pipeline

Remotion-based pipeline for the **Evergreen Explainer** format defined in
`video_production_skills/VISUAL_STRATEGY.md §4` and `WORKFLOWS.md §4`.

Default output: 60s vertical (1080×1920) explainer with stylized Grok Imagine
illustrations + Remotion data viz + Victoria VO + word-by-word kinetic captions
+ ambient music bed.

First topic shipped: **The 4 Pillars of Real Estate Wealth** (`data/4-pillars.json`).

Reusable for the other 19 topics in `VISUAL_STRATEGY.md §4` matrix by swapping
the data file and re-running the script chain below.

## One-time setup

```bash
npm install --prefix video/evergreen-education
npm run video:evergreen:setup
```

The `setup` step copies the commercial brand fonts (Amboqia, AzoSans) from
`/public/fonts` into `public/`. The fonts are gitignored — they must be present
locally before render.

## Run sequence (4-pillars topic)

```bash
# Phase B — equity computation (no API calls, no key needed)
npm run video:evergreen:equity

# Phase C — assets
npm run video:evergreen:illustrations    # Grok Imagine — needs XAI_API_KEY
npm run video:evergreen:scout-grok       # Grok Video i2v scout — needs XAI_API_KEY + SUPABASE_*
npm run video:evergreen:music            # picks 2 Incompetech CC-BY tracks; auto-promotes long-stroll

# Phase D — VO synth (needs ELEVENLABS_API_KEY locally)
npm run video:evergreen:synth-vo
# OR for a visual-only render without VO + captions:
node video/evergreen-education/scripts/synth-vo.mjs --skip

# Phase E — render
npm run video:evergreen:render

# Phase F — quality gate
npm run video:evergreen:qc

# Phase H — delivery email (after Matt approves)
npm run video:evergreen:email
```

## Required env

| Var | Purpose | Required for |
|---|---|---|
| `XAI_API_KEY` | Grok Imagine + Grok Video | illustrations + scout-grok |
| `ELEVENLABS_API_KEY` | Victoria VO synth | synth-vo |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Storage upload for Grok Video i2v source | scout-grok |
| `RESEND_API_KEY` | Delivery email | email |

## Layout

```
data/
  4-pillars.json                      # locked inputs + script + prompts
  4-pillars-equity-by-year.json       # computed totals (audit trail)
out/4-pillars/                        # gitignored — drafts land here
  4-pillars.mp4                       # the rendered video (NEVER auto-promoted)
  illustrations/*.png                 # Grok Imagine output
  grok-video-scouts/                  # i2v scouts + decisions
  music-candidates/                   # audition options
  post-scripts/                       # per-platform copy
  citations.json                      # source trace per CLAUDE.md §0
  scorecard.json                      # viral guardrails 100-pt rubric
  qc-report.json                      # ffprobe + blackdetect + audits
public/
  4-pillars/                          # promoted assets (illustrations, music, video overlays)
  library/                            # final approved MP4s land here AFTER Matt approves
  Amboqia_Boriango.otf  AzoSans-Medium.ttf   # gitignored
src/
  Root.tsx + index.ts                 # Remotion entry
  EvergreenExplainer.tsx              # main composition (props-driven, reusable for other topics)
  beats/{Intro,Pillar,StackedSummary,Outro}Beat.tsx
  components/{CaptionBand,CountUpPill,BarFillViz,BarShrinkViz,StackedTaxList,StackedEquityChart}.tsx
  brand.ts + fonts.ts
scripts/                              # see "Run sequence" above
```

## Hard rules

This pipeline obeys (in priority order):

1. `CLAUDE.md` §0 — Data Accuracy. Numbers trace to citations.json or are
   flagged illustrative. Spoken-vs-shown audit in qc.mjs.
2. `CLAUDE.md` §0.5 — Captions. Reserved zone y 1480-1720, word-by-word
   kinetic, forced-alignment-driven. No other component renders into the zone.
3. `CLAUDE.md` Draft-First. **MP4 stays in `out/` until Matt approves**, then
   promotes to `public/library/`. The agent never commits the rendered MP4
   without explicit approval.
4. `VIDEO_PRODUCTION_SKILL.md` §1 — Victoria voice locked, banned words, no
   logo / agent / phone in frame.
5. `VIRAL_GUARDRAILS.md` — scorecard ≥ 80 (evergreen format minimum).

## Adding the next topic

Each topic in the 20-topic matrix (`VISUAL_STRATEGY.md §4`) follows the same
shape:

1. Copy `data/4-pillars.json` → `data/<topic-slug>.json`
2. Edit script segments + illustrationPrompts + grokVideoPrompts
3. Run the script chain above with `--topic=<topic-slug>` (TODO: scripts hard-code
   `4-pillars` for the proof; parameterize when shipping topic 2)
4. Same comp, same beat structure, same post-script template

The `<EvergreenExplainer>` Remotion comp is props-driven — no comp rewrite needed
for new topics, only data + illustrations.
