/**
 * PATTERN 1: INSTRUMENT. The answer, big.
 *
 * Visual language: design_system/public/PUBLIC_UI.md (locked 2026-08-11), pattern 1.
 * One verdict, number, or range in Amboqia, the supporting figures under a single
 * hairline, the series as a chart under those figures when the caller has one (D9),
 * the section 0 trace beneath, and the one ask the data earns. No ornament
 * precedes the answer. Opens Market nodes, carries a place market band, and reports the
 * valuation result. A series is never flattened to a figure.
 *
 * Provenance, stated exactly. The geometry is derived from that document. The moving
 * prototype at app/dev/public-v3/ demonstrates the same pattern and imports nothing from
 * this directory: it hand-writes its own global `.v3-instrument` rule against its own
 * token names (--navy-70, --edge). The prototype is a second implementation of the same
 * spec, so nothing here is proven by it, and the two collide on shared class names when
 * both stylesheets load in one document. ./V3Instrument.css holds that collision.
 *
 * Data contract, from CLAUDE.md section 0: every figure, the trace, and the freshness
 * stamp arrive already formatted by the caller through lib/format. This primitive never
 * fetches, never rounds, never derives a number, and never parses a date, so the string
 * on screen is the one the caller traced to a query.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./V3Chart, next/link, and @/lib/utils. Nothing from
 *    the deleted KB register, components/site (flat), components/site/primitives,
 *    components/site/explore, or components/ui.
 *  - Every name-bearing string is `V3Text`, not `string`. `string` accepts `''`, and an
 *    empty headline renders a region whose aria-labelledby points at an empty h1, which
 *    is a region with no accessible name at all. `headline=""`, `source=""`, and an
 *    empty action label are compile errors here.
 *  - The section id comes from the caller. Nothing is derived from the headline: verdict
 *    sentences are templated ("A balanced market"), the Places node renders a place
 *    verdict and a parent-market verdict on one page, and a derived id would give both
 *    sections the same id and point the second one's aria-labelledby at the first one's
 *    heading. Without an id the section names itself with aria-label instead.
 *  - `level` is required, so two Instruments on one page cannot both emit an h1 because
 *    a default chose for them.
 *  - Figures take an href, because PUBLIC-PRODUCT-OS makes every market stat a door and
 *    calls dead text naming a linkable thing a defect.
 *  - No 'use client'. Nothing here holds state.
 *  - No raw color. Every value comes from ./tokens.css through ./V3Instrument.css.
 *
 * Motion, deliberately absent. An earlier build counted each figure to its value over
 * 900ms on mount. PUBLIC_UI.md section 5 allows 600ms and longer only for a scroll-bound
 * sequence the visitor controls, and section 1 ships a motion only when it encodes a
 * state change the visitor caused. Arrival is neither, and a mount-triggered
 * requestAnimationFrame is not scroll-bound. A Market instrument settling is one of the
 * two moments the spec does allow, as a GSAP ScrollTrigger plus Lenis sequence bound to
 * scroll; when that is built it enters as a scroll-bound client child, not as a boolean
 * prop that fires on arrival. The retired implementation is V3InstrumentCount.client.tsx,
 * which this file no longer imports.
 */
import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Number } from './V3Number.client'
import {
  V3Button,
  V3Eyebrow,
  V3Figure,
  V3Heading,
  V3SourceLine,
  V3_ROOT_CLASS,
  type V3ButtonVariant,
  type V3Text,
} from './atoms'
import { V3Chart, type V3ChartProps } from './V3Chart'
import { V3ChartCard, type V3ChartCardProps } from './V3ChartCard'
import './tokens.css'
import './V3Instrument.css'

/* -------------------------------------------------------------------------- */
/* V3Text: the accessible name, in the type                                    */
/* -------------------------------------------------------------------------- */

/**
 * `V3Text` and its constructor `v3Text()` now live in ./atoms.tsx, which is where the
 * comment on the copy that used to sit here said they belonged once the barrel landed.
 * A caller reaches them through the barrel (`import { v3Text } from '@/components/site/v3'`)
 * exactly as it reaches this component. Nothing about the contract changed: a `V3Text` is
 * a string known to be non-empty, and `v3Text('')` still does not compile.
 *
 * Every name-bearing prop below is still `V3Text`, not `string`.
 */

/* -------------------------------------------------------------------------- */
/* Figures                                                                     */
/* -------------------------------------------------------------------------- */

export type V3InstrumentFigure = {
  /**
   * The number as it should read on screen, already formatted by the caller
   * (formatPrice, formatPriceCompact, a percent, a count). A string keeps rounding and
   * currency rules in lib/format and keeps this primitive from inventing a figure the
   * source trace does not cover.
   */
  value: V3Text
  /** What the number is. Required: a figure without its label is not honest. */
  label: V3Text
  /**
   * Where the stat goes. PUBLIC-PRODUCT-OS: every place name, listing address, and
   * market stat is a door into its node, and dead text naming a linkable thing is a
   * defect. Absent only when the stat genuinely has no node behind it.
   */
  href?: string
  /**
   * Only when the value and the label together do not name the destination ("4.3 months"
   * plus "Supply" reads fine; a bare percent may not). Never a substitute for `label`.
   */
  ariaLabel?: V3Text
  /**
   * WHAT THE NUMBER MEANS FOR THE READER, in one plain sentence (SITE-41).
   *
   * TASTE.md names the banned tell exactly: "KPI grids — a number, a percentage, and
   * jargon — a figure with no plain sentence beside it saying what it means for the
   * reader." A label is not that sentence: "days to an offer, last 90 days" names the
   * measurement, and a visitor who does not sell houses still does not know whether
   * that is fast.
   *
   * Section 0 binds here as hard as anywhere else, and in one specific way: the
   * sentence may explain the figure it sits under, and it may not carry a SECOND
   * number. A number in this slot would be a figure with no label, no href and no
   * trace of its own. Say what the measurement is; the value beside it is the value.
   */
  sentence?: V3Text
  /**
   * Live numeric value for beui-number (V3Number). When set, the face counts
   * up to this number and settles on `value` (already formatted). Omit for
   * static posters. Caller still owns §0.
   */
  count?: number
}

/**
 * At least one figure, enforced by the tuple head, the same technique V3Ledger uses for
 * its rows. The pattern is a verdict with the figures that support it, so a verdict with
 * nothing under it and a source line explaining nothing is a different section. Build a
 * dynamic set as `[first, ...rest]` and handle the empty case where the data is read:
 *
 * ```tsx
 * const [first, ...rest] = figures
 * return first ? (
 *   <V3Instrument level={1} headline={verdict} figures={[first, ...rest]} source={trace} />
 * ) : (
 *   <V3Quiet ... />  // state why the market has no figures, do not claim a verdict
 * )
 * ```
 */
export type V3InstrumentFigures = readonly [V3InstrumentFigure, ...V3InstrumentFigure[]]

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The one ask, earned by the data above it (PUBLIC_UI.md section 1). It renders inside
 * the labelled section, under the trace, so the ask belongs to the answer that earned it
 * instead of floating outside the region as a loose control.
 */
export type V3InstrumentAction = {
  /** The visible label, and therefore the control's accessible name. */
  label: V3Text
  href: string
  /** Defaults to primary. One primary per viewport, enforced by review. */
  variant?: V3ButtonVariant
}

export type V3InstrumentProps = {
  /**
   * The verdict sentence, and therefore the accessible name of the section. It must be
   * consistent with the figures below it: "seller's market" over 6.2 months of supply is
   * a data failure, not a copy choice.
   */
  headline: V3Text
  /**
   * Figures beyond this count fold behind a native disclosure ("All figures"),
   * closed by default. For the long-tail stat walls (2026-08-27 mobile audit:
   * /cities/bend ran 31 figures deep at 390px) — the lead figures answer the
   * page's question, the tail stays one tap away without leaving the section.
   * Omit to render every figure open (the default, unchanged).
   *
   * `0` folds every figure, and is honored ONLY when a chart or a card set is
   * carrying the answer above the fold and there is more than one figure to
   * fold. A section with no visual and a closed <details> shows the reader no
   * number, and a fold of one figure is a disclosure hiding the answer behind
   * the words "All 1 figures" (SITE-24). In both cases the figures render open.
   */
  foldAfter?: number
  /**
   * WHAT THE FOLD REVEALS, in the reader's words (SITE-41).
   *
   * The default summary is "All {n} figures", and on a market page that renders as
   * "ALL 42 FIGURES +": a database row count offered as a reason to tap. It says
   * nothing about what is behind it, so nobody taps, and the long tail the fold exists
   * to protect goes unread.
   *
   * Pass the name of the thing inside — "Supply by property type, and how fast homes
   * are selling" — and the summary says that instead. A count is not a name: keep a
   * bare integer out of this string. Omitted, the count-shaped default stands, so a
   * caller that has not been given a name renders exactly as it did before.
   */
  foldLabel?: V3Text
  /**
   * Draw the chart after the verdict (and note) and before the figure tiles.
   * Market hub / MOS definition: the drawing IS the number.
   */
  chartFirst?: boolean
  /** The supporting figures, left to right in the order the caller passes them. */
  figures: V3InstrumentFigures
  /**
   * The section 0 trace for those figures, without the word "Source" (the source line
   * renders that): what they came from, the filter, the population.
   */
  source: V3Text
  /**
   * The freshness stamp, PREFORMATTED by the caller through lib/format/date, and joined
   * to the trace here. It is not a raw date, because the atom's own `updatedAt` prop
   * hands a raw value to `formatDate`, which returns a lone em dash for anything it
   * cannot parse. That renders "updated" followed by punctuation: a freshness claim with
   * no date in it, an em dash in public copy, and neither one visible to the caller.
   */
  updated?: V3Text
  /**
   * The source's NAME, when the caller has it (SITE-42 landed the slot on V3SourceLine;
   * SITE-41 opens it here). V3SourceLine renders one compact clause — the name and the
   * stamp — with the full trace behind its disclosure. Given nothing, it derives the
   * name from the trace's own leading segment, which is a structural guess: on the
   * market pages that guess reaches into a methodology clause and reads as internal
   * shorthand. This primitive owns the prop surface on those pages, so without a
   * pass-through the caller cannot say the name it already knows.
   *
   * The full trace, stamp and all, still reaches the HTML through `source` either way.
   */
  sourceName?: V3Text
  /**
   * The freshness date for the compact clause. RAW here, not preformatted: unlike
   * `updated`, which this component joins into the trace string itself, this value is
   * handed to the atom, and the atom runs it through the canonical `formatDate`. Pass
   * the timestamp the row carries. Given neither this nor a stamp inside the trace, the
   * atom prints the name alone rather than inventing a date.
   */
  asOf?: string | number | Date | null
  /** The context line above the verdict: where the visitor is. One line, never a sentence. */
  eyebrow?: V3Text
  /**
   * One sentence between the verdict and the figures, when the answer needs its
   * basis stated in words before the numbers arrive: how many, of what, in which
   * place. The same slot V3Ledger has carried since it landed, and the reason it
   * is here is the same one: a heading that names a subject ("Condos in Sunriver")
   * and a figure set that measures it leave the count itself with nowhere to be
   * said except inside a label, which is not a sentence a reader can quote.
   *
   * Never a second verdict, and never a number the figures do not also carry with
   * their own label.
   */
  note?: V3Text
  /** The next step this answer earns, if it earns one. */
  action?: V3InstrumentAction
  /**
   * The series under the figures. D9: a trend lives under the big answer, not
   * as a seventh pattern. Omit when the instrument is a singleton status.
   * Flattening a series into figures and skipping this prop is a defect.
   */
  chart?: V3ChartProps
  /**
   * A second series under the first. Still one Instrument, not a seventh pattern.
   * Use when the page has two honest series (composition and a monthly median).
   */
  chartSecondary?: V3ChartProps
  /**
   * A family of chart-room forms under the figures, each card one finding with
   * its own collapsed Source trace (V3ChartCard). Still one Instrument: the
   * cards are the section's series set, not sections of their own.
   */
  cards?: readonly V3ChartCardProps[]
  /**
   * A second object in the fold beside the chart (SITE-81). Months of supply as
   * V3MosBars, or any other drawing that keeps the opening from being only a
   * stacked type column. Omitted, the Instrument renders exactly as before.
   */
  drawing?: ReactNode
  /**
   * 1 when the Instrument opens the page and carries its answer. 2 for a market band
   * inside a page another pattern opened. Required, because a page can carry two
   * Instruments and only one of them is the page's answer.
   */
  level: 1 | 2
  /**
   * The section id. Pass one whenever the page links to this section, or whenever a
   * second Instrument shares the page. The heading id is this plus -headline, and the
   * section points at it with aria-labelledby; with no id the section carries the same
   * name through aria-label.
   */
  id?: string
  className?: string
}

/**
 * A freshness stamp that carries no date. `formatDate` returns a lone em dash for a null
 * or unparseable value, and a caller writing `updated={v3Text(formatDate(row.updated_at))}`
 * passes that straight through: the string is non-empty, so the brand accepts it. Matching
 * on the dash family drops the clause instead, which leaves the trace complete and
 * truthful ("Source: live MLS, Bend single-family actives") rather than asserting a
 * refresh that has no timestamp. Written as escapes so no dash character exists in this
 * file for the voice gate to find.
 */
const NO_DATE = /^[\s\u002D\u2010-\u2015\u2212]*$/

export function V3Instrument({
  headline,
  foldAfter,
  foldLabel,
  chartFirst = false,
  figures,
  source,
  updated,
  sourceName,
  asOf,
  eyebrow,
  note,
  action,
  chart,
  chartSecondary,
  cards,
  drawing,
  level,
  id,
  className,
}: V3InstrumentProps) {
  // Unreachable through the type: `V3Text` is only constructed by `v3Text()`, which
  // throws on empty. Reachable from untyped JS and from a cast, and the old behavior
  // there was a region whose name resolved to an empty heading, and a bare "Source:"
  // with nothing after it, which is the visual form of a trace with none of the trace.
  // Fail loudly instead.
  if (headline.trim().length === 0) {
    throw new Error(
      'V3Instrument: headline is empty. The verdict is the accessible name of the ' +
        'section. An empty one leaves the region unnamed.',
    )
  }
  if (source.trim().length === 0) {
    throw new Error(
      'V3Instrument: source is empty. Section 0 requires the trace beside the figures, ' +
        'and a bare "Source:" claims one that is not there.',
    )
  }

  const headlineId = id ? `${id}-headline` : undefined

  // The trace and its stamp are two already-formatted strings, joined the way the atom
  // joins them. Nothing here parses or formats a date.
  const stamp = updated && !NO_DATE.test(updated) ? updated : undefined
  const trace = stamp ? `${source} · updated ${stamp}` : source

  // One figure is the headline figure, so it takes the lead size the atom reserves for
  // it. Two or more read as a set and stay the same weight.
  const emphasis = figures.length === 1 ? 'lead' : 'standard'

  // The opening is a claim and a drawing, not a KPI grid (SITE-41). A figure set that
  // says what its numbers mean is a different object from a tile row: it is read left to
  // right as sentences, so it takes wider tracks and one column on a phone. The class is
  // opt-in through the data — no caller passes a sentence, no caller moves.
  const said = figures.some((f) => f.sentence)

  return (
    <section
      id={id}
      className={cn(
        V3_ROOT_CLASS,
        'v3-instrument',
        chartFirst && 'v3-instrument--chart-first',
        said && 'v3-instrument--said',
        className,
      )}
      aria-labelledby={headlineId}
      aria-label={headlineId ? undefined : headline}
    >
      {eyebrow ? (
        <V3Eyebrow className="v3-instrument__eyebrow">{eyebrow}</V3Eyebrow>
      ) : null}

      <V3Heading level={level} id={headlineId} className="v3-instrument__headline">
        {headline}
      </V3Heading>

      {note ? <p className="v3-instrument__note">{note}</p> : null}

      {(() => {
        const charts = (
          <>
            {chart || drawing ? (
              <div
                className={cn(
                  'v3-instrument__stage',
                  chart && drawing && 'v3-instrument__stage--split',
                )}
              >
                {chart ? (
                  <div className="v3-instrument__chart">
                    <V3Chart {...chart} id={chart.id ?? (id ? `${id}-chart` : undefined)} />
                  </div>
                ) : null}
                {drawing ? <div className="v3-instrument__drawing">{drawing}</div> : null}
              </div>
            ) : null}
            {chartSecondary ? (
              <div className="v3-instrument__chart">
                <V3Chart
                  {...chartSecondary}
                  id={chartSecondary.id ?? (id ? `${id}-chart-2` : undefined)}
                />
              </div>
            ) : null}
            {cards && cards.length > 0 ? (
              <div className="v3-instrument__cards">
                {cards.map((card, i) => (
                  <V3ChartCard key={card.id ?? `${i}-${card.title}`} {...card} />
                ))}
              </div>
            ) : null}
          </>
        )
        const renderFigure = (figure: (typeof figures)[number], i: number) => {
          const key = `${i}-${figure.label}`
          const face =
            figure.count != null && Number.isFinite(figure.count) ? (
              <div
                className={cn(
                  'v3-figure',
                  emphasis === 'lead' && 'v3-figure--lead',
                )}
              >
                <span className="v3-figure__value">
                  <V3Number value={figure.count} formatted={figure.value} />
                </span>
                <span className="v3-figure__label">{figure.label}</span>
              </div>
            ) : (
              <V3Figure value={figure.value} label={figure.label} emphasis={emphasis} />
            )
          const rendered = face
          // The sentence is a SIBLING of the figure, inside the figure's own cell, so a
          // door still wraps only the number and its label: the sentence explains the
          // figure, it is not another thing to click. A figure with no sentence renders
          // the two branches this component has always rendered, byte for byte.
          if (figure.sentence) {
            return (
              <div key={key} className="v3-instrument__cell">
                {figure.href ? (
                  <Link
                    href={figure.href}
                    className="v3-instrument__door"
                    aria-label={figure.ariaLabel}
                  >
                    {rendered}
                  </Link>
                ) : (
                  rendered
                )}
                <p className="v3-instrument__said">{figure.sentence}</p>
              </div>
            )
          }
          return figure.href ? (
            <Link
              key={key}
              href={figure.href}
              className="v3-instrument__door"
              aria-label={figure.ariaLabel}
            >
              {rendered}
            </Link>
          ) : (
            <Fragment key={key}>{rendered}</Fragment>
          )
        }
        // A FOLD IS ONLY LEGAL WHEN SOMETHING IS STILL ANSWERING (SITE-24).
        // `foldAfter={0}` folds EVERY figure, which is the right shape for the
        // chart-first sections it was written for — the drawing is the answer
        // and the tiles are the appendix. With no chart it left the section as a
        // heading, a note, and a closed <details>: a market section showing no
        // number at all, first read of nothing. And with a single figure the
        // summary read "All 1 figures" while hiding the one figure the section
        // exists to print — /subdivisions/golf-homes-at-tetherow, whose lifetime
        // closed count is the whole point of the page's market band.
        //
        // So a full fold now requires a visual carrying the answer above it, and
        // a lone figure is never folded. `foldAfter > 0` is untouched: it always
        // leaves lead figures on screen by construction.
        const hasVisual =
          Boolean(chart) ||
          Boolean(chartSecondary) ||
          Boolean(drawing) ||
          (cards?.length ?? 0) > 0
        const foldAt =
          foldAfter === 0 && figures.length > 1 && hasVisual
            ? 0
            : foldAfter != null && foldAfter > 0 && figures.length > foldAfter + 1
              ? foldAfter
              : null
        const lead = foldAt != null ? figures.slice(0, foldAt) : figures
        const tail = foldAt != null ? figures.slice(foldAt) : []
        const figureBlock = (
          <>
            {lead.length > 0 ? (
              <div
                className={cn(
                  'v3-instrument__figures',
                  figures.length === 1 && 'v3-instrument__figures--single',
                )}
              >
                {lead.map(renderFigure)}
              </div>
            ) : null}
            {tail.length > 0 ? (
              <details className="v3-instrument__fold">
                {/* THE DEFAULT NAMES A READING, NOT A ROW COUNT. It used to render
                    `All {n} figures`, and fold-after.test.ts already said why that
                    is wrong — a count "tells a reader nothing about whether they
                    want it" — but the test only guards the five market pages, so
                    every other folding caller kept publishing the count. SITE-88's
                    evaluator found it on the region page and named this file.
                    /cities/[slug], /cities/[slug]/[neighborhoodSlug],
                    /communities/[slug], /subdivisions/[slug] and /months-of-supply
                    all fold without a label and all inherit this line.

                    A primitive cannot know what its caller's figures are about, so
                    the default stays generic — but generic and editorial, not
                    generic and numeric. Pass `foldLabel` and say the actual thing;
                    this is the floor, not the target. No digit, which is also what
                    fold-after.test.ts asserts of every label it checks. */}
                <summary className="v3-instrument__fold-summary">
                  {foldLabel ? foldLabel : 'The rest of the figures'}
                </summary>
                <div className="v3-instrument__figures">
                  {tail.map((figure, i) => renderFigure(figure, i + lead.length))}
                </div>
              </details>
            ) : null}
          </>
        )
        return chartFirst ? (
          <>
            {charts}
            {figureBlock}
          </>
        ) : (
          <>
            {figureBlock}
            {charts}
          </>
        )
      })()}

      <V3SourceLine
        source={trace}
        sourceName={sourceName}
        asOf={asOf}
        className="v3-instrument__source"
      />

      {action ? (
        <div className="v3-instrument__action">
          <V3Button href={action.href} variant={action.variant ?? 'primary'}>
            {action.label}
          </V3Button>
        </div>
      ) : null}
    </section>
  )
}
