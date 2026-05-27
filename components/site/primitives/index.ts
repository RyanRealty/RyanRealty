/**
 * Atomic display primitives for the Ryan Realty site v2.
 *
 * Locked tokens (per Design System v2):
 *   - Navy #102742 + cream #faf8f4 two-color palette
 *   - Tabular numerals on every numeric surface
 *   - Currency rounded to nearest thousand
 *   - Days = integer + " days"
 *   - Percent change = signed arrow + 1 decimal
 *   - Middle dot · as the canonical separator
 *
 * Per docs/EXECUTION_PLAN.md §9 Wave 2 Layer 1. Composition blocks
 * (Hero/MarketSnapshot/etc.) live in components/site/, listing detail
 * surface components land in components/site/listing-detail/ when Wave
 * 2 Layer 4 ships.
 */

export { Price } from './Price'
export { TabularNumber } from './TabularNumber'
export { PercentChange } from './PercentChange'
export { DaysCount } from './DaysCount'
export { Eyebrow } from './Eyebrow'
export { MiddleDot } from './MiddleDot'
export { DisplayHeading } from './DisplayHeading'
export { H1, H2, H3 } from './Headings'
export { Body, Caption } from './Body'
export { Container, Section, Stack, Grid } from './Layout'
export { Logo, RyanRealtyMark, JaxMascot } from './Logo'
