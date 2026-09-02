/**
 * components/site/v3 — THE BARREL.
 *
 * THIS FILE IS THE PRESSURE VALVE. A migration that needs a control this set
 * does not have ADDS A PRIMITIVE HERE. It does not reach back into
 * the deleted KB register, the flat legacy files at components/site/*.tsx,
 * components/site/primitives, components/site/explore, or components/ui. Those
 * registers are a different visual language with a different token layer, and
 * one import from any of them puts two languages on one page, which is the
 * defect this rebuild exists to end. If a page needs something missing, the
 * work is a new primitive or a new prop on an existing one, reviewed against
 * design_system/public/PUBLIC_UI.md and exported below.
 *
 * THE PATTERN SET IS OPEN (Matt 2026-08-27). Six today; a seventh is allowed and
 * expected when a section's job is not one of them. Adding one is BUILDING one:
 * a component here, its own stylesheet reading ./tokens.css, exported below.
 * What is forbidden is the one-off — a page hand-rolling section markup with its
 * own look, which is a second design system arriving one page at a time.
 * Atoms grow the same way and always did.
 *
 * WHAT A CONSUMER GETS, AND WHAT IT STILL OWES:
 *  - Mounting: every pattern puts V3_ROOT_CLASS on its own outermost element,
 *    so a surface renders correctly with no wrapper. V3_ROOT_CLASS is exported
 *    for a page that wants the token scope around a whole route.
 *  - Data: no primitive here fetches, formats, rounds, or parses a date. Every
 *    figure, stamp, and trace arrives as a string the caller already formatted
 *    through lib/format, so the number on screen is the number the caller's
 *    source trace covers (CLAUDE.md section 0).
 *  - Names: every region and every control requires its accessible name in the
 *    type. The four patterns differ in how the run-time half is enforced, and
 *    each states its own discipline in its header: Stage throws in development,
 *    Instrument and Ledger take a branded V3Text built by v3Text(), and Field,
 *    Quiet, and Sheet drop what cannot be rendered honestly and warn.
 */

/* -------------------------------------------------------------------------- */
/* Token scope + name safety                                                   */
/* -------------------------------------------------------------------------- */

export {
  /** The class that opens the token scope. Every pattern renders it itself. */
  V3_ROOT_CLASS,
  /**
   * THE LOOK (Matt 2026-08-26): the Ledger register for search/data surfaces.
   * Mounted beside V3_ROOT_CLASS on a page root; content surfaces mount
   * nothing and wear the Broadside default. PUBLIC_UI.md section 6 records
   * which register each surface wears.
   */
  V3_LEDGER_CLASS,
  V3_LISTING_CLASS,
  V3_LOOK,
  /** Builds a V3Text. Throws on a blank string; `v3Text('')` does not compile. */
  v3Text,
} from './atoms'

export type { V3LookName } from './atoms'

export type {
  /** A string known to be non-empty, for anything that computes an accessible name. */
  V3Text,
  /** Rejects the empty string literal while leaving a plain `string` alone. */
  V3NonEmpty,
} from './atoms'

/* -------------------------------------------------------------------------- */
/* Atoms — the small pieces the six patterns share                             */
/* -------------------------------------------------------------------------- */

export {
  V3Button,
  V3Figure,
  V3SourceLine,
  V3SourceDisclosure,
  V3Eyebrow,
  V3Heading,
  V3Lede,
} from './atoms'

export type {
  V3ButtonProps,
  V3ButtonVariant,
  V3FigureProps,
  V3SourceLineProps,
  V3SourceDisclosureProps,
  V3EyebrowProps,
  V3HeadingProps,
  V3HeadingSize,
  V3LedeProps,
} from './atoms'

/**
 * The series atom. Instrument mounts it under the figures (D9). Not a seventh
 * pattern. A family page passes a preformatted series on `V3Instrument.chart`.
 */
export { V3Chart } from './V3Chart'

/** How many series a YoY overlay can keep apart — the categorical token count. */
export { V3_CHART_CATEGORY_SLOTS } from './V3Chart'

export type {
  V3ChartProps,
  V3ChartSeries,
  V3ChartPoint,
  V3ChartKind,
  V3ChartBand,
  V3ChartRangeRow,
  V3ChartSample,
} from './V3Chart'

/**
 * The segmented control the chart-room forms put over pre-rendered views of
 * one figure (range, sort, comparison). A client island; the panels arrive
 * server-rendered as children. An atom, not a seventh pattern.
 */
/**
 * The hover layer V3Chart mounts over a line plot: crosshair, a dot per
 * series, the reading. Exported so the barrel stays whole; V3Chart mounts it.
 */
export { V3ChartHover } from './V3ChartHover.client'

export type { V3ChartHoverProps, V3ChartHoverColumn, V3ChartHoverReading } from './V3ChartHover.client'

/**
 * Proof: verified third-party words with their record — figures the source
 * supports, every review as a mark on its month, year chips, and the quotes
 * as cards whose first sentence wears the display face. The reviews page.
 */
export { V3Proof } from './V3Proof.client'

export type { V3ProofProps, V3ProofQuote, V3ProofFigure } from './V3Proof.client'

/**
 * Ask: one screen, every field, one button. The contact form. The Sheet stays
 * the one-question-at-a-time pattern for a valuation.
 */
export { V3Ask } from './V3Ask.client'

export type { V3AskProps, V3AskField, V3AskOption, V3AskResult } from './V3Ask.client'

export { V3ChartSwitch } from './V3ChartSwitch.client'

export type { V3ChartSwitchProps, V3ChartSwitchItem } from './V3ChartSwitch.client'

/**
 * One chart-room form as a page card: a computed finding, one display line,
 * the chart (or a segmented set of views), and the section 0 trace collapsed
 * into a Source disclosure. Instrument mounts a grid of these via `cards`.
 */
export { V3ChartCard } from './V3ChartCard'

export type { V3ChartCardProps, V3ChartCardSwitch } from './V3ChartCard'

/* -------------------------------------------------------------------------- */
/* Pattern 1 — INSTRUMENT: the answer, big                                     */
/* -------------------------------------------------------------------------- */

export { V3Instrument } from './V3Instrument'

export type {
  V3InstrumentProps,
  V3InstrumentAction,
  V3InstrumentFigure,
  V3InstrumentFigures,
} from './V3Instrument'

/* -------------------------------------------------------------------------- */
/* Pattern 2 — FIELD: inventory as a spatial surface                           */
/* -------------------------------------------------------------------------- */

export { V3Field, useV3FieldBinding } from './V3Field'

export type {
  V3FieldProps,
  V3FieldItem,
  V3FieldBinding,
  V3FieldMapSlot,
} from './V3Field'

/* -------------------------------------------------------------------------- */
/* Pattern 3 — LEDGER: a scannable list where every row is a door              */
/* -------------------------------------------------------------------------- */

export { V3Ledger } from './V3Ledger'

export type {
  V3LedgerProps,
  V3LedgerAction,
  V3LedgerRow,
  V3LedgerFigureRow,
  V3LedgerPlainRow,
  V3LedgerRows,
} from './V3Ledger'

/**
 * The listing unit for Ledger-register search surfaces: one live listing as a
 * dense ledger row (small thumb, address block, mono tabular figures). Not a
 * seventh pattern — a composition unit the search list/rail chrome stacks,
 * data-shape-compatible with the flat register's ListingCard so a consumer
 * swaps an import, not a mapper.
 */
export { V3ListingRow } from './V3ListingRow'

export type { V3ListingRowData, V3ListingRowBadge } from './V3ListingRow'

/* -------------------------------------------------------------------------- */
/* Pattern 4 — STAGE: full-bleed owned media, one line, one action             */
/* -------------------------------------------------------------------------- */

export { V3Stage } from './V3Stage'

export type { V3StageProps, V3StageAction, V3StageOverlay } from './V3Stage'

/* -------------------------------------------------------------------------- */
/* Pattern 5 — SHEET: the working surface for a step                           */
/* -------------------------------------------------------------------------- */

export { V3Sheet } from './V3Sheet'

export type {
  V3SheetProps,
  V3SheetStep,
  V3SheetTrap,
  V3SheetField,
  V3SheetOption,
  V3SheetProse,
  V3SheetBlock,
  V3SheetFact,
  V3SheetColumn,
  V3SheetCompareRow,
  V3SheetAdvance,
} from './V3Sheet'

/* -------------------------------------------------------------------------- */
/* Pattern 6 — QUIET: hairline supporting content, the graph's outbound edges  */
/* -------------------------------------------------------------------------- */

export { V3Doors } from './V3Doors'
export { V3Atlas } from './V3Atlas.client'
export type { V3AtlasProps, AtlasDot, AtlasEvent, AtlasRegion, AtlasType } from './V3Atlas.client'
export type { V3Door, V3DoorsProps } from './V3Doors'

export { V3Quiet } from './V3Quiet'

export type { V3QuietProps, V3QuietItem, V3QuietLink, V3QuietProse } from './V3Quiet'

/* -------------------------------------------------------------------------- */
/* Pattern 8 — ANSWERS: a question set the reader opens                        */
/* -------------------------------------------------------------------------- */

/**
 * Quiet renders every answer expanded, which TASTE.md (Matt 2026-09-01) bans
 * by name once a section is more than two paragraphs of prose with no figure,
 * image, map or control — "FAQ blocks count". Answers is that section's form:
 * native disclosures (so every answer stays in the served HTML), the title and
 * the outbound doors in a left rail, the questions beside them. Quiet keeps
 * prose that must read as prose.
 */
export { V3Answers, splitQuietItems } from './V3Answers'

export type { V3AnswersProps, V3Answer, V3AnswersDoor } from './V3Answers'

/* -------------------------------------------------------------------------- */
/* PLACE SECTIONS — compositions of the six, not a seventh                     */
/* -------------------------------------------------------------------------- */

/**
 * Three sections every place grain shares (subdivision, community,
 * neighborhood). Each is ONE of the six patterns with place data poured into
 * it, and each names its pattern and defends the choice in its own header:
 *
 *   V3PlaceDocuments      Ledger    recorded instruments, every row a door
 *   V3PlaceCharacter      Quiet     build years and HOA, stated as sentences
 *                                   because PLACE_CONTENT_RULES R1-R3 forbid
 *                                   publishing them as bare figures
 *   V3PlacePropertyTypes  Instrument  one per property type the place holds
 *
 * They live in the barrel rather than beside it because they were the last
 * place sections still rendering `section`/`wrap`/`sec-head`/`sec-title`, four
 * class names with no unscoped definition in this repo, and a shared component
 * that only renders styled under someone else's root class is a defect waiting
 * for its first reuse. Growing this list is ordinary; growing the pattern set
 * above it is not.
 */
export { V3PlaceDocuments } from './V3PlaceDocuments'

export {
  V3PlaceCharacter,
  placeCharacterHeading,
  yearBuiltSentence,
  hoaPresenceSentence,
  duesSentence,
} from './V3PlaceCharacter'

export { V3PlacePropertyTypes } from './V3PlacePropertyTypes'

export type { PlaceSegmentInput } from './V3PlacePropertyTypes'

/* -------------------------------------------------------------------------- */
/* CHROME: the persistent frame the six patterns sit inside                    */
/* -------------------------------------------------------------------------- */

/**
 * Header, footer, and trail. Not patterns: chrome is what surrounds a page's
 * sections, so it is exempt from the rhythm rule and from "no two adjacent
 * sections share a pattern". It obeys everything else, including the one that
 * decides its shape: ONE primary CTA per viewport. That primary is the
 * valuation ask in V3Chrome on Sell, which is why V3Footer carries no button at all.
 *
 * Every destination in all three comes from lib/site-nav.ts, read at module
 * load. No href is typed inside these files, so a link cannot drift out of the
 * single source of truth by being copied into the chrome. The nav LABELS follow
 * the locked IA (Homes, Places, Market, Sell, About, with Saved as an account
 * affordance); the DESTINATIONS stay whatever site-nav says they are.
 */
export { V3Chrome } from './V3Chrome'

export type { V3ChromeProps, V3ChromeGroup, V3ChromeLive, V3ChromeLiveGroup, V3ChromeLiveFact } from './V3Chrome'

/** V3_FOOTER_COLUMNS and V3_FOOTER_LEGAL are the canonical site-nav projections. */
export { V3Footer, V3_FOOTER_COLUMNS, V3_FOOTER_LEGAL } from './V3Footer'

export type { V3FooterProps, V3FooterColumn, V3FooterLink } from './V3Footer'

export { V3Breadcrumb } from './V3Breadcrumb'

export type { V3BreadcrumbProps, V3Crumb } from './V3Breadcrumb'

/* -------------------------------------------------------------------------- */
/* TRACKING ISLAND — not a seventh pattern                                     */
/* -------------------------------------------------------------------------- */

/**
 * Section + scroll tracking. Chrome surrounds a page; this island records it.
 * Same contract as the retired kb tracker: observe `.v3 section[id]` and
 * `the deleted KB root class section[id]`, fire `section_view` at 55% and scroll-depth
 * 25/50/75/100, dual-sink `trackEvent` + `/api/visitors/track` with full
 * `location.href`. Tracking must never break the page. Not a visual pattern.
 * Growing the closed set of six is a change to the locked visual language.
 */
export { V3SectionTracker } from './V3SectionTracker.client'

export type { V3SectionTrackerProps } from './V3SectionTracker.client'

/* -------------------------------------------------------------------------- */
/* Deliberately NOT exported                                                   */
/* -------------------------------------------------------------------------- */

/**
 * THE COUNTING FIGURE IS GONE, not merely unexported. V3InstrumentCount.client.tsx
 * (V3CountingFigure, parseFigureValue, renderFigureAt) was deleted; this block used
 * to describe it as a file sitting on disk awaiting revival, which is the kind of
 * note that gets a dead thing rebuilt.
 *
 * The rule it existed for still stands and is why it should not come back as it
 * was: PUBLIC_UI.md section 5 allows a 600ms-plus sequence only when the visitor
 * controls it by scrolling, and a mount-triggered requestAnimationFrame is not
 * that. When the Market instrument's settle is built it enters as a scroll-bound
 * client child, never as a boolean prop that fires on arrival. It must also read
 * its duration from the token rather than hardcoding one: the deleted file carried
 * SWEEP_MS = 900 mirroring --v3-dur-sequence, one duration with two definitions,
 * which drifts the moment the token moves.
 */
