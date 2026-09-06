# TASTE — how an agent judges a public page (Matt, 2026-09-01)

PUBLIC_UI.md says what the patterns ARE. This file is how you decide whether a
built page is BEAUTIFUL and whether a data display EARNS its place. It exists
because "run the gates" proves correctness, not taste — taste is a second,
mandatory pass done with eyes on the rendered page, and (since 2026-09-01) by a
second pair of eyes that did not build it.

**Matt's verdict on the site as of 2026-09-01, verbatim in spirit:** "We are a
wall of text, scrolling lists, and boring." The standard is "absolutely visually
breathtaking," with "engaging and interactive content on every single page," and
the test is competitive: for every place page and every listing page, "there is
no page for that place that we won't beat in every single metric." Every rule
below serves that verdict. A section that is correct, gated, on-token, and dull
has failed.

## Why our pages come out generic when the model can clearly do better

Research (2026-09-01, `docs/research/taste-for-agents.md`) and our own history
agree on the cause, and it is not the model's ceiling:

1. **Distributional convergence.** Absent a specific instruction, the model
   reaches for the statistically safest layout. Ours is not the purple-gradient
   SaaS template — it is the *stacked-section page*: eyebrow, heading, figure
   row, ledger, source line, repeat. Correct every time, identical every time.
2. **Self-evaluation does not work.** Anthropic's own harness work found agents
   "confidently praise their own work even when quality is mediocre." Every
   page here was judged by the agent that built it, under gate pressure, in the
   last minute of a task. That is why the ritual below now requires a separate
   evaluator.
3. **Construction, not composition.** We add a section, move a section, fix a
   section. Nobody composes the page as one object with a rhythm, a reveal, and
   a reason to keep scrolling. The breathtaking demos are composed whole, from
   a brief, with references in hand.
4. **Restraint mistaken for the goal.** Two colors, hairlines, and Amboqia are
   the *material*, not the design. Quiet is the register; dull is a failure of
   form. The fix is always the FORM of the display, never the color.

## The binding ritual (builder)

After building any public surface: render it at desktop and 375px, screenshot
both, **look at the screenshots as a person would**, and answer these in the
session before handing it to the evaluator. `ci:gates` passing is not this
pass. Reading the component is not this pass. Matt 2026-09-05: we build, we
read the code, we do not look, and a human opens it and it is gross.

The object to copy when a data surface needs to feel like this shop: **V3Atlas**
(cream field, navy marks, place names, toggles that reveal more). Not a Google
default map. Not a row of percent tiles. If Atlas itself is cramped, a caption
is teaching zoom, or a leftover rail is stealing the field, that is a format
bug on a good object — fix the format, do not replace Atlas with a portal map.

Place pages: the differentiator is graphics that translate sales data for
people who do not sell houses. Spec: `docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md`.
One question per drawing. MOS is two bars (homes for sale vs a month of sales),
not a tile that says 3.9.

1. **What is this section's claim?** Every data section is a sentence first,
   figures second. If you cannot state the claim in one plain sentence, the
   section is not done — a chart with no point is decoration.
2. **Is the first read instant?** One glance = the claim lands. If the reader
   must study the display to find the point, use a stronger form.
3. **What does the reader DO here?** Every data section on a public page gives
   the reader something to do that reveals more data: hover a mark and see the
   row, scrub a timeline, toggle a segment or a property type, compare two
   places, brush a price range, tap a map cell. A static figure row is the
   floor, never the ceiling. Interaction that decorates instead of revealing is
   banned (hover bounces, glows, parallax for its own sake).
4. **Does it breathe?** Thin marks, hairline rules, generous padding, the 72rem
   / 44rem measures. When in doubt, remove one element.
5. **Does anything embarrass us at 375px?** Wrapped numerals, clipped labels,
   horizontal scroll outside a scroll container, tap targets under 44px.
6. **Would you stop scrolling here?** Honest answer. If a section is technically
   correct but dull, name what is dull and change the FORM, not the color.
7. **Does it beat the best page for this subject?** Name the page (the resort's
   own site, the competitor brokerage's neighborhood page, the portal's place
   page) and the metric where we win: data depth, freshness, interactivity,
   clarity, speed, how easy it is to reach a broker. If you cannot name a win,
   the section is not done.

## The receipt (`tasteReview` on the route's `parity.json`) is not a score in a
JSON file. As of 2026-09-05 it is:

```json
{
  "evaluatedAt": "YYYY-MM-DD",
  "score": 0,
  "beats": "named competing page and the metric we win",
  "evaluator": "separate agent id — never the builder, never 'pending'",
  "shots": {
    "desktop": "path/to/1440.png",
    "mobile375": "path/to/375.png"
  }
}
```

Both PNGs must exist in the repo. `ci:taste-canon` fails a new review without
them. Leftover HUD (`PlaceFaceStrip` on a place opening) and the Atlas
"pinch to zoom" sentence are mechanical tells: a score of 86 cannot outvote
them (`scripts/taste-tells-baseline.json`, shrink-only). X research:
`docs/research/taste-on-x-2026-09-05.md`.

The critique pass is a SEPARATE agent (mandatory since 2026-09-01)

The builder never grades its own page. After the ritual, spawn an evaluator
(`Agent`, any model, with the desktop + 375px screenshots and the rendered
page's URL) with this rubric. It returns named defects with the section id;
the builder fixes and re-submits. Ship only when the evaluator passes every
row. Weights are deliberate: craft and function are what the model already
does well; the bland-output problem lives in design quality and originality.

| Criterion | Weight | Passing looks like |
|---|---|---|
| Design quality | 30 | One coherent identity across the page; rhythm, not a stack. A reader could name the brand from a cropped section. |
| Originality | 30 | Deliberate choices a template would not make. The reader would screenshot a section to show someone. No section shape repeats down the page. |
| Interaction | 15 | Every data section rewards a hover, tap, scrub, or toggle with more data. Nothing moves for decoration. |
| Craft | 15 | Hierarchy by size AND weight, spacing on the scale, AA contrast, tabular numerals, no orphaned labels at 375, and one radius and one spacing rhythm across everything visible in a viewport. |
| Honesty and function | 10 | Every figure has its section 0 trace; loading, empty, and error states render; the page's job (search, value, contact) completes in one path. |

The evaluator's prompt wording is itself a design lever (Anthropic found "museum
quality" pushed outputs into an unintended register). Use this file's words:
quiet, editorial, expensive, data-first, Central Oregon, never "modern SaaS."

## Banned on the public site — named tells

- **Walls of text.** A section whose primary content is more than two
  paragraphs of prose with no figure, image, map, or interactive element.
  FAQ blocks count. If the prose is needed for search, it sits under a
  disclosure or beside a display, never as the section.
- **Scrolling lists as the design.** A Ledger past six rows with no visual
  encoding (no mark, no bar, no map, no image) is a table wearing hairlines.
  Encode the value or cut the rows.
- **KPI grids.** "A number, a percentage, and jargon" — a figure with no plain
  sentence beside it saying what it means for the reader.
- **The stacked-section page.** Three or more consecutive sections built as
  eyebrow → heading → rows → source. Compose: vary the form, the width, the
  media, the density.
- **Raw slugs, internal labels, methodology jargon** in anything a visitor
  reads ("caldera-springs", "median to pending · 90 days" as a label).
- **The generic tells** the two-color system already makes impossible, kept
  here so nobody argues them back in: a purple gradient at the top of the page,
  Inter/Roboto, card grids with icons, frosted-glass panels, one corner radius
  on every container as the whole visual system, shadow soup,
  centered-everything heroes, emoji headers, hover bounce.
- **Missing states.** A display that only renders the happy path.

## Chart craft — the house method

The full method is the `dataviz` skill (form → color → validate → marks → hover
→ look). The Ryan Realty parameters for it:

- **The system is near-monochrome navy on cream.** That is a FEATURE: it forces
  the emphasis pattern — the subject series in `--rr-navy`, context series in
  navy tints (`rgba(16,39,66,…)` steps), never a new hue. Categorical series cap
  at 3; past that, fold or facet into small multiples.
- **`--rr-exception` is the ONLY second hue**, and it means a data exception
  (drawdown, decline, breached threshold) — the diverging pole, never an accent.
- **Is it even a chart?** A single current value is a stat tile. A handful of
  headline numbers is a figure row. One ratio is a meter. More than ~7
  meaningful classes is a table. Do not build a chart to say one number.
- **Forms we reach for** (house preference order): hero figure · stat tile with
  sparkline · emphasis line with a scrubber · horizontal bar (names are long) ·
  dot strip / distribution with hover rows · slope (two-point change) · small
  multiples · beeswarm of actual listings · map with data-encoded cells ·
  table. Never: dual axes, pies for comparison, rainbow ramps, a hue per rank.
- **Hover is not optional.** An HTML chart is interactive; a crosshair and
  tooltip on every line, a per-mark tooltip on every bar, dot, and cell, hit
  targets larger than the mark. A chart the reader cannot interrogate is a
  picture of a chart.
- **Motion bands:** micro 100–150ms, standard 150–250ms, entrances ≤300ms,
  transform and opacity only, one orchestrated page reveal beats twenty
  micro-interactions, and anything seen a hundred times a day gets none.
- **Every figure keeps its trace** (§0). A beautiful chart with an unsourced
  number is a failure, not a trade-off.

## Reference-driven, not adjective-driven

"The AI doesn't invent criteria; it averages them" (X, 2026-09-01 research,
`docs/research/taste-for-agents-x.md`). "Make it elegant" transfers nothing.
Before composing a page class, write down three to five references and *what
specifically works in each*, and design against those sentences. Two stronger
forms of the same discipline: point the builder at REAL component code (a
shipped library's markup and CSS) to adapt rather than generate from a
description, and feed a machine-readable token sheet from a shipped site you
admire as pre-build context. An installed generic "anti-slop" skill file is a
starting constraint, never the answer: used alone it swaps one default
aesthetic for another, shared by everyone who installed it. Our references are
our own — the brand tokens, the Old Mill hero, Central Oregon itself. The
standing set for this site:

- **Editorial data journalism** (the claim-first headline over a chart; the
  scrubber that lets the reader find their own year; annotation on the mark).
- **Stripe / Linear restraint** (hairlines, tabular numerals, one accent).
  Motion that *is* the data (draw-on, scrub, replay, Atlas density) is the flex.
  Motion that decorates (bounce, entrance on every section, numbers counting
  up on load) stays banned. Reduced-motion: same graphic, already complete.
- **The trading-desk / premium-chart bar** (Matt 2026-09-05): density, hover,
  animation that explains the series. Not their palette. Not a second library.
  Navy on cream, our plot.ts geometry, our Atlas. Every kept page ships one.
- **The best portal place pages** as the FLOOR, not the target: they have the
  data and show it flat. We beat them on depth (every subdivision, every
  property type, closed sales the portals do not show), on interaction, and on
  a broker one tap away.
- **The subject's own site** (the resort, the HOA, the developer) as the page
  to beat on identity: they own the photographs and the story; we own the
  numbers and the map. The page wins when it has both.

## The variants rule — options, then one winner

A NEW data-display section is built as **two or three named variants** behind
one prop, rendered side by side on a decision sheet (screenshots, desktop +
mobile) for Matt to pick per surface. The picked variant becomes the one canon
for that section; the losing variants are DELETED in the commit that records
the pick. One surface, one look, forever (anti-Frankenstein).

## Design the CLASS, not the instance (Matt 2026-09-01: "one-off approach")

Before building a display for one place page, review the class of pages it
belongs to (every city, every neighborhood, every community, every subdivision)
and design the display for the class, with the data cube's full contents in
view: every property type, every subdivision, every closed-sale fact we hold.
A section that only works for Tetherow is a one-off; a section that makes
Tetherow, Northwest Crossing, Old Bend, and West Hills each look like the best
page about that place is the product.

## Consistency is a taste rule, not just a gate

Two sections doing the same job on two pages must be the same primitive with
the same variant. Before building a display, grep for the job — if a primitive
already does it, use it or improve it in place for every caller. A second way
to show the same thing is how one site becomes two.

## Where taste comes from (keep feeding it)

Editorial data design (the claim-first habit), Stripe/Linear restraint, the
`dataviz` skill's anti-pattern catalog, and the research file above. When
judging, compare against the best version of the idea you have seen, not
against the previous version of our page.
