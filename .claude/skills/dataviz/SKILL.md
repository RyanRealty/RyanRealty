---
name: dataviz
description: >
  Draw charts for Ryan Realty. Load BEFORE writing any chart, graph, plot,
  sparkline, stat tile, meter, KPI row, print SVG, or CMA data graphic.
  Triggers on chart, graph, plot, data viz, visualization, seasonality,
  lollipop, dual axis, asking prices, days to pending, CMA charts.
  Method: form first, then navy-on-cream color, then thin marks, then look
  at a screenshot. Never dual axis. Never a number on every point. Never
  Amboqia on a figure.
---

# Dataviz (Ryan Realty)

TASTE.md names this method. Until this file existed, agents invented charts.
That is how the CMA grew dual-axis plots, lollipops-from-zero with a label
on every stem, and Amboqia numerals that read as a greeting card.

**Load this before the first SVG or table.** Then
[`design_system/public/TASTE.md`](../../../design_system/public/TASTE.md)
and, for public pages, [`docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md`](../../../docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md).
Print extras: [`references/print.md`](references/print.md).

Geometry stays in `lib/charts/plot.ts`. Public skin is `V3Chart`. Print skin
is `lib/charts/print-svg.ts`. No Recharts, no D3 app, no second kit.

## Procedure (do in order)

Color last. Most bad charts pick colors first.

1. **Is it even a chart?** One current value → stat tile. A handful of
   headlines → figure row. One ratio → meter. More than ~7 classes that all
   carry meaning → a table (or table + chart). Do not chart one number.
2. **Pick the form from the job.** Trend → line. Ranking of named things →
   horizontal lollipop / bar. Two units → two charts or a table, never two
   y-scales. One series is the point, the rest are context → emphasis (navy
   on the subject, tint/hollow on the rest).
3. **Color.** Near-monochrome navy `#102742` on cream `#faf8f4`. Subject
   series full navy. Context is navy tints or a dashed stroke. `--rr-exception`
   `#A8452B` only for a real decline or breach. Cap categorical series at 3;
   past that, fold or facet.
4. **Marks.** Thin stems and 2px lines. Markers r≥3. Hairline solid axes,
   never dashed grids. Direct-label the endpoint, the extreme, or the one
   series the story is about. A number on every point is unread chaos.
5. **HTML hover.** Crosshair + tooltip on lines. Per-mark tooltip on bars
   and dots. Hit target ≥24px. Tooltips enhance; they never gate the value.
   Print cannot hover — every labeled value must live on the graphic or in
   a table twin. See print.md.
6. **Look at a screenshot.** The validator is your eyes. Label collisions,
   a stem that vanishes at y-max, a y-axis number sitting on January, a
   display face on a figure: fix before showing Matt.

Then check [`references/anti-patterns.md`](references/anti-patterns.md).
A match is a fail.

## Ryan Realty parameters

| Slot | Value |
|---|---|
| Surface | cream `#faf8f4` |
| Ink | navy `#102742` |
| Muted / axes | `rgba(16,39,66,0.55)` / `0.22` |
| Exception | `--rr-exception` `#A8452B` |
| Type on figures | Geist. Tabular only in columns and axis ticks. **Amboqia never sits on a number.** |
| Type on claims | Amboqia on the H2. Geist on the sentence under it. |

## CMA print — form by question

| The seller is asking | Form |
|---|---|
| When do homes here sell fastest? (12 months, one unit) | Line. Emphasize the short months. Label those. Not a lollipop from zero with 12 numbers. |
| How many listed, and at what ask? (two units) | Table: month columns, Listed row, Ask row. Empty months stay as —. Never dual axis. |
| Why this list vs these sales? | One named row per sale, shared price scale, This list filled. |
| What sold vs what died in this band? | Named rows on one scale. Crop to the data, not a theoretical 85% floor. |
| Median close by year | Line. Prices do not grow from $0. |

## Look test (print)

Show the graphic to someone who does not sell houses. They should answer the
question in two seconds without a footnote. If they ask what the drawing
means, the form is wrong — change the form, not the caption.
