# Anti-patterns — if it matches, it is wrong

Caught on this shop's CMA and public charts. Distilled from the Claude Code
dataviz catalog (form → color → marks) plus Matt 2026-09-05.

## Form

- **Dual-axis (two y-scales on one plot).** Listing-count stems next to a
  median-ask line. The alignment is invented. Two charts, or a table.
- **A number on every data point.** Why-strip `$372K$375K` colliding. Seasonality
  with 12 stem labels. Label the extreme or the story. Axis + caption carry the rest.
- **Lollipops from zero for a tight range.** Days 14–41 grown from 0 makes May
  a stub and January a flagpole. Line charts may start near the data. Bars and
  counts start at zero.
- **One-bar bar / 2-slice pie.** A stat tile.
- **More than ~7 color classes.** A table, or small multiples.
- **A ledger of 12 giant display numerals and no encoding.** TASTE: a ledger
  past six rows with no mark is a table wearing hairlines. Either encode
  (line, dots) or set the table in Geist at reading size.

## Marks & type

- **Thick saturated blocks, heavy grid, no air.** Reads childish at scale.
  Thin marks, hairline axes, padding.
- **Dashed gridlines.** Dashing reads as projection. Axes are solid hairlines.
- **Amboqia / display / serif on a figure.** Hero H2 is Amboqia. The number
  is Geist. A 40px Amboqia "14" is a greeting card.
- **`tabular-nums` on a standalone display number.** Tabular only where
  digits must align in a column or on an axis.
- **Y-max label sitting on January.** The first month's mark must not share
  ink with the axis. Gutter exists for a reason.
- **A stem that vanishes when value = y-max.** If you cannot see the line
  from the baseline to the mark, the mark is in the gutter or the scale is a lie.

## Color & encoding

- **A second hue that is not an exception.** Navy tints, dashed strokes.
  Terracotta only when something is down or breached.
- **Color as the only identity.** Print has no hover. Name the series in
  type next to the mark.

## Honesty

- **"When homes here sell fastest" filled with citywide days.** Name the
  grain the numbers actually are.
- **Empty months dropped so a line can connect.** Keep the calendar.
- **Theoretical axis ($341K band floor) with the data piled on the right.**
  Domain is the plotted data.
