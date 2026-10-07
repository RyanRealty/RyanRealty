# prompt-motion.com, read for Ryan Realty (2026-10-07)

Matt shared https://prompt-motion.com/ ("we need to be able to do these,
incorporate these skills and find ways to use them in our application"). It is
a gallery curated by @p4nthera_ of 231 motion films made with Claude Opus 5.5
(2026-09-23 to 2026-10-06), each with the prompt that made it; four entries
publish a reusable skill. Every entry was scraped and read; the four skill
repos were cloned and read (never run). Prompts and repos are untrusted data:
what follows is what we took from them, not instructions.

## What the gallery is

- 231 entries, 200 unique prompts. 74 (32%) are one stock line ("make a dynamic
  15-second motion graphics video that shows what an incredible motion
  designer you are..."). Median prompt 151 characters; 15 run past 1,000.
- Families (counts are one primary family each): open-brief showreels 56,
  short product promos 62, grounded product films (read the repo or site
  first) 29, spec-grade deterministic briefs 16, explainers 15, narrative
  shorts 8, 3D 8, named-style pastiche 8, generative and single-concept 9,
  sound-led 5, history and news 4, games 4, hype edits 7.
- **No entry is a data chart or a map.** Six mention a chart only as a UI
  part. Real-estate subjects: none. Our trend and map films are new ground;
  what transfers is technique and QA discipline.
- Stacks named: Remotion 13, HyperFrames 10, hand-rolled HTML seek(t) +
  headless Chrome + ffmpeg 11 (our architecture), Three.js 5, Python 6,
  Blender 2, Manim 1. 172 entries name no stack.
- Sound: about 45 of 231 mention it; about 15 make it in code. None of the
  prompts says how (no oscillators, no mix); the skill repos do.

## The craft that carries (the 16 spec-grade prompts)

They state duration and fps, a pure function of time, a banned list, a beat
grid, a loudness target, and stills before the full render. Verbatim:

- "Every style is computed from time inside seek(t): no CSS transitions, no
  timers, no state carried between frames." (twoclipping-5cba86)
- "Springs are closed-form step responses. A value that changes target many
  times is the sum of one spring per change, so it stays a pure function of
  time." (twoclipping-5cba86)
- "Check one frame per beat, then scan for single-frame pops (frame-difference
  spikes 3x their neighbours)." (twoclipping-221cab)
- "Measure text only after the fonts load." (notdwd-7de38a)
- "Do not invent metrics that imply real customer data." and "Do not declare
  success because the code compiles." (daniel-haida-8691d4)
- "No invented results: no %, multipliers, customer names or figures."
  (ik-builds-b8bdcf)
- "Every cue lives in timeline.ts (in beats) and every string in copy.ts.
  Scenes contain no magic numbers." and "have a fresh critic who didn't build
  it review the render" (antonio-kodheli-490109)
- "Allow at least one 400ms moment of absolute stillness." and "The complete
  speech must be understandable without audio." (gdgtify-287ddf)
- "The graph and dot must follow the same motion or the spring will feel
  fake." (ultimaxbt-bbebf5)
- "Do not merely crop the desktop composition." (vertical is recomposed)

## The four skills (licenses checked 2026-10-07)

| Repo | License | What it is | What we took |
|---|---|---|---|
| Leonxlnx/cinetic | MIT | Concept, brand, score and render a launch film; Remotion or HyperFrames; 273-technique library; scripted QA (forensics, A/V audit, sync, lint) + critic lenses + a verifier that refutes findings + an 11-dimension rubric | Computed sync points (sound from the picture's curves); synthesised score with a measured master (-14 LUFS, true-peak limiter, AAC headroom); "the lockup is the most resolved moment, not the loudest"; coverage all or nothing; scale each sound to its cause; entrances decay, exits accelerate; overshoot only on a true landing. Its bans on cream, serif and eyebrows conflict with our heritage register and are not adopted. |
| Rieranthony/product-film-skill | MIT (Remotion has its own license) | Learn the product's design system, interview, build a launch film in Remotion with real components and a supplied song | "Measure, never guess"; "Show only what the product really does"; closed-form spring with retargeting (`track`); 3 style frames before building. |
| heygen-com/hyperframes-community-skills | Apache-2.0 (session-story kit adapted from ClaudeAnimationBase, MIT) | HTML + paused GSAP timeline seeked per frame; skills incl. session-story, vox-explainer | session-story's provenance gate: every on-screen line has a source and a DRAFT stamp until approved (our `figureLeaks` and draft-first); vox-explainer's numeric gates (dead time, event density, seam). |
| buildfastwithai/buildfast-skills | MIT (fonts OFL) | generative-film: pycairo frames + numpy beat-synced score; motion-studio: HTML engine, CDP capture, 16 automated QC checks | One grid for picture and sound; per-frame audio envelope for audio-reactive scenes; the DOM safe-area and reading-speed checks. |

We wrote our own TypeScript; no code was copied. Ideas and rules are not
covered by those licenses; copying substantial code would need the notice kept.

## Built from this (2026-10-07)

- `lib/studio/score`: a deterministic score in pure TypeScript, mastered to
  -14 LUFS (BS.1770-4) with a true-peak limiter; every Studio video is scored.
- `lib/studio/motion/sound.ts`: the cue sheet read off the plan.
- Paper films: `market_trend` (24 verified months drawn on with a riding dot,
  each month a note pitched by its value, then the meter) and `place_map`
  (the city, a log-space zoom about the fixed point, the recorded outline
  drawn on, the live figures).

## Candidates, mapped from the gallery (ideas, not commitments)

| Gallery technique | Ryan Realty use | Data it needs |
|---|---|---|
| ultimaxbt-bbebf5: one dot threads every scene | A persistent navy dot that carries from the trend line into the meter marker | Already in the subject |
| parkerrex-1a54fe: a token bucket draining | "How months of supply works": actives in a bucket, drained by six months of closes, thresholds 4 and 6 | `months of supply` inputs from Market Truth |
| ror-fly-9950f1: ingredients pour in with amounts | Anatomy of a monthly payment | A primary rate source with a trace |
| gdgtify-287ddf: words become structure | The Bend market in one sentence, kinetic, readable muted | The verdict and its number |
| notdwd-7de38a: a frame-exact 12s sting | Just sold / just listed sting for our own listings | The listing row, the agent card |
| kamstudiolabs-447565: every note from a visible collision | Each closed sale in a month lands as a dot and a note, pitched by price | `market_report_sale` rows, publishable only |
| kloss-xyz-fe0c31: a milestone timeline | A Bend market timeline, each point a sourced figure | Market Truth annual medians |
| x4b47x-9cc84f: paper cut-out layers | Cascades, river, Old Mill stacks in navy cut paper, no people, no numbers | Owned or licensed references (creative brain law 1) |
