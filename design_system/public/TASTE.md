# TASTE — how an agent judges a public page (Matt, 2026-09-01)

PUBLIC_UI.md says what the six patterns ARE. This file is how you decide whether a
built page is BEAUTIFUL and whether a data display EARNS its place. It exists
because "run the gates" proves correctness, not taste — taste is a second,
mandatory pass done with eyes on the rendered page.

**The binding ritual.** After building any public surface: render it at desktop and
375px, screenshot both, and answer these out loud in the session before shipping:

1. **What is this section's claim?** Every data section is a sentence first, figures
   second. If you cannot state the claim in one plain sentence, the section is not
   done — a chart with no point is decoration. (The headline is the hypothesis;
   the reader should know what to look for before they look.)
2. **Is the first read instant?** One glance = the claim lands. If the reader must
   study the display to find the point, use a stronger form: a stat tile beats a
   one-bar chart, a hero figure beats a KPI grid, emphasis (one navy series, the
   rest in muted tint) beats six competing lines.
3. **Does it breathe?** Thin marks, hairline rules, generous padding, the 72rem /
   44rem measures. Heavy saturated blocks and dense grids read loud and cheap.
   When in doubt, remove one element.
4. **Does anything embarrass us at 375px?** Wrapped numerals, clipped labels,
   horizontal scroll outside a scroll container, tap targets under 44px.
5. **Would you stop scrolling here?** Honest answer. If a section is technically
   correct but dull, it is not done. Name what is dull and change the FORM, not
   the color.

## Chart craft — the house method

The full method is the `dataviz` skill (form → color → validate → marks → hover →
look). The Ryan Realty parameters for it:

- **The system is near-monochrome navy on cream.** That is a FEATURE: it forces
  the emphasis pattern — the subject series in `--rr-navy`, context series in
  navy tints (`rgba(16,39,66,…)` steps), never a new hue. Categorical series cap
  at 3; past that, fold or facet into small multiples.
- **`--rr-exception` is the ONLY second hue**, and it means a data exception
  (drawdown, decline, breached threshold) — it is the diverging pole, never a
  brand accent.
- **Is it even a chart?** A single current value is a stat tile. A handful of
  headline numbers is a figure row. One ratio is a meter. More than ~7 meaningful
  classes is a table. The Instrument pattern already encodes this — do not build
  a chart to say one number.
- **Forms we reach for** (in order of house preference): hero figure · stat tile
  with sparkline · emphasis line · bar (horizontal when names are long) · dot
  strip / distribution · slope (two-point change) · small multiples · table.
  Never: dual axes, pies for comparison, rainbow ramps, a hue per rank.
- **Every figure keeps its trace** (§0). A beautiful chart with an unsourced
  number is a failure, not a trade-off.

## The variants rule — options, then one winner

A NEW data-display section is built as **two or three named variants** behind one
prop (`variant="strip" | "cards" | "chart"` …), rendered side by side on a
decision sheet (screenshots, desktop + mobile) for Matt to pick per surface.
The picked variant becomes the one canon for that section; the losing variants
are DELETED in the same commit that records the pick — options are for choosing,
not for keeping. One surface, one look, forever (anti-Frankenstein).

## Consistency is a taste rule, not just a gate

Two sections doing the same job on two pages must be the same primitive with the
same variant. Before building a display, grep for the job — if a primitive
already does it, use it or improve it in place for every caller. A second way to
show the same thing is how one site becomes two.

## Where taste comes from (keep feeding it)

Editorial data design (the claim-first habit), Stripe/Linear restraint (the
foundation PUBLIC_UI already names), and the `dataviz` skill's anti-pattern
catalog — check every chart against it. When judging, compare against the best
version of the idea you have seen, not against the previous version of our page.
