/**
 * HOW A MARKET REPORT OPENS. One cap, one fold label, four routes (SITE-41).
 *
 * /housing-market/annual-review, /housing-market/<city>, /housing-market/<city>/<community>
 * and /housing-market/central-oregon all open on the same object: a verdict, the year
 * overlay, and a short row of figures that say what they mean. Before this file the
 * three numbers deciding that shape lived in three route folders, and they had already
 * drifted — sixteen figures open on the annual review, every figure folded on Bend and
 * on the region, and a summary reading "ALL 42 FIGURES" on two of them.
 *
 * TASTE.md, consistency: two sections doing the same job on two pages are the same
 * primitive with the same variant. The primitive is V3Instrument; this is the variant.
 *
 * Nothing here is data. No figure, no number a reader sees, no source trace.
 */

/**
 * How many figures lead the opening before the rest fold.
 *
 * FOUR, and the number is a reading decision, not a layout one. TASTE.md bans the KPI
 * grid by name — "a number, a percentage, and jargon", a figure with no plain sentence
 * beside it saying what it means for the reader — so every LEAD figure carries that
 * sentence, and four sentences is what a person reads before they stop reading. The
 * tail is never cut: every figure the page published is still in the HTML, one tap
 * away, under a summary that names what is in it.
 */
export const MARKET_LEAD_FIGURES = 4

/**
 * What the fold reveals, in the reader's words rather than the database's.
 *
 * The default V3Instrument summary is "All {n} figures", which rendered on the live
 * market pages as "ALL 42 FIGURES +": a row count, offered as a reason to tap. This
 * names the three things actually behind it — supply broken out by property type, the
 * pace figures over their own windows, and the feature shares — so a reader can decide
 * whether they want them.
 */
export const MARKET_FOLD_LABEL = 'Supply by property type, sale pace, and what the houses have'

/**
 * The same cap for a closed-sales band, one lower.
 *
 * THREE, not four, and the reason is mechanical rather than aesthetic: V3Instrument
 * refuses to fold a single figure (a summary reading "All 5 figures" that hides one of
 * them is worse than no fold), so a five-figure set with a cap of four renders all
 * five. Three leads, two fold, and no market row on the site is longer than four.
 */
export const CLOSED_LEAD_FIGURES = 3

/**
 * The closed-YEAR band's cap: the two totals, and the property-type shares behind the
 * fold. The shares are already drawn as the composition chart under the same
 * instrument, so leaving eight of them open printed the chart twice — once as a
 * drawing and once as a wall of percentages.
 */
export const CLOSED_YEAR_LEAD_FIGURES = 2
