---
name: motion-design
description: >
  Code-drawn motion graphics and sound for Ryan Realty video, in the one
  factory (lib/studio). Load BEFORE touching lib/studio/motion or
  lib/studio/score, adding a Studio scene or format, animating a chart, map,
  meter or type, scoring a film, or when Matt shares motion-design work
  (prompt-motion.com, HyperFrames, Remotion, "make it move", kinetic type,
  animated chart, map reveal, sound design). Method: verified data in, a pure
  function of time out, sound read off the same timeline, measured QA, a
  separate critic, draft only.
---

# Motion design (Ryan Realty)

Matt 2026-10-07: "we need to be able to do these, incorporate these skills and
find ways to use them in our application" (prompt-motion.com: 231 motion films
made with Opus 5.5, their prompts, and four published skills). This skill is
how the Studio does that work: in our code, our brand, under §0.

**Required references, read first:** [design system](../../../design_system/ryan-realty/SKILL.md),
[platform best practices](../../../social_media_skills/platform-best-practices/SKILL.md),
[dataviz](../dataviz/SKILL.md) for any chart or meter, [creative brain](../creative-brain/SKILL.md)
for anything creative, [GROK craft canon](../../../docs/GROK_CRAFT_CANON.md) when Grok footage is under the type.
What the research found, with sources and licenses: [references/prompt-motion.md](references/prompt-motion.md).

## One factory

Everything renders through `lib/studio/motion` (picture) and `lib/studio/score`
(sound). Remotion, HyperFrames, Manim, Blender, p5 and Python film engines are
ideas, never a second renderer (CLAUDE.md §4). A film is one of two kinds:

| Kind | Picture | Example formats |
|---|---|---|
| Over footage | the stage lays cards over a Grok clip or a pan across a real photo | `listing_film`, `listing_motion`, `market_pulse`, `place_video` |
| Paper | the stage draws the whole film on cream from verified data; no generator, $0 but the caption | `market_trend` (price line, then the meter), `place_map` (city, camera in, outline, figures) |

## The contract (each line is a failure we already paid for, or the field's)

1. **Every frame is a pure function of t.** Node computes state (`cues.ts frameState`), the page only applies it (`__rrApply`). No CSS transitions, keyframes, timers, `Date`, `Math.random`, or state carried between frames. Byte-identical re-renders.
2. **Fonts fail loudly.** The renderer loads every face and refuses to draw unless each reports `loaded`.
3. **Colour is converted on purpose.** bt709 limited range, tagged; brand navy must land on (16,39,66) and cream on (250,248,244). The int test holds both.
4. **Frame 0 is the whole opening picture** (the heading, the scale, the first month on its ring; the city, the place's name, the locator), never blank paper or a footnote. Content text is up by 1.0s; the first number by 3s.
5. **No frame of a move is empty, and nothing is cut by a box.** A camera zoom carries the place's faint outline the whole way (the map film's first cut had a second of nothing), and the city fades while the camera leaves it so no line is seen ending on the map's edge. Beats overlap: the outline starts drawing at 60% of the move.
6. **Entrances decay, exits accelerate.** Brand ease-out `cubic-bezier(.22,.61,.36,1)` for type, `(.65,0,.35,1)` for a draw or a camera. Zoom in log space about the fixed point. Overshoot only on a true landing, at most two per film.
7. **Nothing readable for less than 2.5s; the logo is a closer, not an opener.** The end card is the final 2.5s (Matt 2026-10-07).
8. **Shape is sacred.** A photo is scaled uniformly and cropped, never stretched (`lib/video/pan.ts`). A generated still must already be the clip's shape.

## Numbers (§0, absolute)

- Every number on screen is a subject figure, written exactly as its trace holds it. `figureLeaks` checks the plan AND the text the page actually drew; a leak kills the draft.
- A figure and its citation are produced together in `lib/data/studio/` or not at all. Never compute a new statistic in a film: a monthly median is a published Market Truth cell; a 3-month rolling median is not, so it is not drawn (checked 2026-10-07: only window 1, and 12 at the latest month, exist for Bend).
- **A label must point at exactly one value.** A value set beside a line sits over some other month's stretch of it and reads as that month (the trend film's first cut put $759,000 under a $708,047 trough). The latest value is an end-of-line label at its own height beside its dot; the first hangs over the line's own start on a full-ink leader that touches its ring.
- **No floor under a near-data line.** An unlabelled rule under it reads as $0 (it drew a 6.9% dip as a 31% fall). The scale is two or three hairline gridlines at round values, labelled in a gutter as a ruler; those labels are authored text, not figures. Gaps stay gaps; the calendar is kept.
- **Say what a figure measures.** When a trace says `segment='detached'`, the card says single-family (`figureScope`): Bend's 3.5 months is single-family; the whole market was 3.69 the same day.
- **A meter fills to its value.** The verdict's zone is lit in its label, never by a bar that runs to the zone's edge (it read as 4).
- Verdict words, meter zones and the number come from one `marketVerdict` call.

## Sound (lib/studio/score)

- One timeline for picture and sound. `lib/studio/motion/sound.ts` reads every event off the plan and the same curves the picture uses: card in, marker lands, the line passes a month, the outline closes, the mark resolves. Never a typed timestamp (hand-typed sync lands 8-11 frames off).
- Personality: calm, precise, expensive, warm. Felt keys, a warm pad, one bell, air. No kicks, claps, booms, risers, drops. Listings are `calm` (no percussion, platform canon); market and place films `measured` (a soft pulse).
- Data sonification: a trend film plays one note per plotted month, pitched by its own verified value. The sound of the line is the data.
- Coverage is all or nothing: every card entrance gets its note; every plotted month gets its own.
- The lockup is the most resolved moment, not the loudest.
- Master to -14 LUFS integrated, true peak at or under -1 dBTP after AAC. We cannot listen, so we measure: the int test runs ffmpeg `ebur128` on the muxed file.
- `generate_audio` stays off on Grok. A score that cannot be made ships a silent film and says so; it never loses the picture.

## Adding a scene type

1. A pure geometry module beside `chart.ts` / `map.ts`, with unit tests (shape kept, bounds held, timing curves invertible).
2. A cue kind in `cues.ts`: the type, `CUE_PARTS`, a planner, `frameState` fields, `cueTexts`, `figureLeaks` authored text, `stillTimes` once the picture has finished.
3. Markup and runtime in `page.ts`; navy and cream only (the page test fails any other hex or rgba).
4. Sound events in `sound.ts`, computed from the same curves.
5. A format row in `formats.ts`; the subject and its citations in `lib/data/studio/subjects.ts` via a DAL read; nothing raw.
6. Tests: unit (`paper.test.ts` pattern), compose with fakes, and a real Chromium + ffmpeg pixel and loudness case in `compose.int.test.ts`.
7. QA renders to `out/motion-qa/` (gitignored) from real data, then a contact sheet: frame 0, every move's middle, every hold, the closer. Look for label collisions, empty frames, overlapping cards, a value near the wrong point.
8. A separate-agent critic pass on the sheet and stills before Matt sees it ("first impressions are the audience's; after reading the code you will forgive things the audience will not").

## Approval

Drafts only. A film lands `ready` on `/admin/studio`; it posts only on Matt's approval plus `publisher-sweep` (CLAUDE.md §1). Renders for review go to `out/`, never to a tracked `public/` path.
