/**
 * V3Pulse — the live read of a place, drawn.
 *
 * PATTERN 7 (the set is OPEN; PUBLIC_UI.md section 3). A low band that publishes
 * the two or three counts that are true about a place RIGHT NOW, with a mark
 * per listing plotted where it sits, the moment of the read, and the trace.
 *
 * WHY IT IS NOT AN INSTRUMENT. Instrument is the answer, big: one verdict in
 * Amboqia carrying a page. This is instrumentation — a band under a hero that
 * says what the inventory is doing before the visitor scrolls, without taking
 * the page's opening away from the photograph or the search. It reads as a
 * gauge, not as a section, and that is deliberate: the homepage already stacks
 * eyebrow-heading-rows three times below it, and a fourth would be the tell
 * TASTE.md names (`the stacked-section page`).
 *
 * WHY IT IS NOT A KPI GRID. The banned form is "a number, a percentage, and
 * jargon" — a figure with nothing beside it saying what it means. Here the CLAIM
 * is the heading and the figures answer it; every reading carries a rule whose
 * length is that reading's share of the whole read, so the three fills tile one
 * track and the composition of the market lands before a numeral is read; and
 * selecting a reading lights that population on the map and publishes what it
 * counts, in a sentence, with its window.
 *
 * NO JAVASCRIPT. The switch is a native radio group and CSS sibling state, so
 * the whole band — figures, marks, plot, definitions, doors — is in the server
 * HTML and works with scripting off, on a crawler, and in an AI answer engine.
 * `checked` is set on the first reading at render, so there is no unselected
 * frame and nothing moves on hydration.
 *
 * SECTION 0. Every figure arrives PREFORMATTED (check-public-v3 rule 3): this
 * file never rounds, never localizes, never derives. `definition` says what the
 * figure counts and over what window; `source` carries the full trace behind a
 * disclosure; `note` is the moment of the read. A caller that cannot fill those
 * is publishing an unsourced number and should not mount this band.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Heading, V3SourceDisclosure, type V3Text } from './atoms'
import './tokens.css'
import './V3Pulse.css'

/** One live count, its meaning, its marks, and its door. */
export type V3PulseReading = {
  /** Stable population key: 'active', 'pending', 'sold'. Never shown. */
  key: string
  /** The count, formatted by the caller: "3,284". */
  figure: string
  /** What the count is, in plain words: "homes for sale". Never a slug. */
  label: string
  /**
   * This reading's share of the WHOLE set, 0..1 — so the fills of all the
   * readings together fill exactly one track, and the block is a part-to-whole
   * and not a bar beside a full-width bar. It is the LENGTH of the rule, so the
   * reader sees the composition before reading a numeral.
   *
   * Scaled against the largest reading instead, the biggest population is
   * pinned at 1 by construction and its row does no design work (2026-09-08
   * evaluator). The ratios between the rules are identical either way; what
   * changes is that the track now means something — the whole read.
   */
  share: number
  /** What is counted and over what window, in one sentence a visitor reads. */
  definition: string
  /** SVG path data for this population in the band's shared frame. */
  path?: string
  /** The door for this population, when one exists. */
  href?: string
  /** The door's visible words, and therefore its accessible name. */
  hrefLabel?: string
}

export type V3PulseProps = {
  /** The section id, and the stem of every control id in the band. */
  id: string
  /**
   * The claim, as a sentence. It is the heading and the accessible name, so the
   * band cannot ship as a bare figure row.
   */
  claim: V3Text
  readings: readonly V3PulseReading[]
  /** The shared frame the paths were projected into. */
  field?: { w: number; h: number }
  /** What the plot shows, for a reader who cannot see it. */
  fieldAlt?: string
  /** The one line under the drawing that names what is drawn. Never an instruction. */
  plotCaption?: string
  /** The moment of the read, formatted: "Read Sep 8, 2026, 7:03 AM". */
  note: string
  /** The full section 0 trace, collapsed behind "Source". */
  source: string
  className?: string
}

/** The most readings the band draws. Past this it is a table, not a gauge. */
const MAX_READINGS = 4

export function V3Pulse({
  id,
  claim,
  readings,
  field,
  fieldAlt,
  plotCaption,
  note,
  source,
  className,
}: V3PulseProps) {
  const shown = readings.filter((r) => r.figure.trim() && r.label.trim()).slice(0, MAX_READINGS)
  if (shown.length === 0) return null

  const headingId = `${id}-claim`
  const group = `${id}-population`
  const plotted = shown.filter((r) => typeof r.path === 'string' && r.path.length > 0)
  const showPlot = field != null && plotted.length > 0

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-pulse', className)}
      aria-labelledby={headingId}
    >
      <div className="v3-pulse__inner">
        {/* The switch comes first in the DOM so plain sibling combinators can
            carry its state to every part of the band. Visually hidden, never
            display:none — it stays focusable, and arrow keys move through it
            exactly as a radio group should. */}
        {shown.map((reading, i) => (
          <input
            key={`radio-${reading.key}`}
            type="radio"
            name={group}
            id={`${id}-${reading.key}`}
            value={reading.key}
            defaultChecked={i === 0}
            className={cn('v3-pulse__radio', `v3-pulse__radio--${i + 1}`)}
          />
        ))}

        <V3Heading level={2} id={headingId} className="v3-pulse__claim">
          {claim}
        </V3Heading>

        <div className="v3-pulse__body">
          <ul className="v3-pulse__readings">
            {shown.map((reading, i) => (
              <li key={reading.key} className={cn('v3-pulse__reading', `v3-pulse__reading--${i + 1}`)}>
                <label className="v3-pulse__pick" htmlFor={`${id}-${reading.key}`}>
                  <span className="v3-pulse__figure">{reading.figure}</span>
                  <span className="v3-pulse__name">{reading.label}</span>
                  <span
                    className="v3-pulse__rule"
                    aria-hidden="true"
                    style={{ ['--v3-pulse-share' as string]: String(Math.max(0.02, Math.min(1, reading.share))) }}
                  >
                    <span className="v3-pulse__rule-fill" />
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {showPlot && field ? (
            <figure className="v3-pulse__plot">
              <svg
                className="v3-pulse__map"
                viewBox={`0 0 ${field.w} ${field.h}`}
                width={field.w}
                height={field.h}
                role="img"
                aria-label={fieldAlt ?? 'Every listing plotted where it sits'}
                focusable="false"
              >
                {plotted.map((reading) => (
                  <path
                    key={`path-${reading.key}`}
                    d={reading.path}
                    className={cn(
                      'v3-pulse__dots',
                      `v3-pulse__dots--${shown.findIndex((r) => r.key === reading.key) + 1}`,
                    )}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              {plotCaption ? <figcaption className="v3-pulse__caption">{plotCaption}</figcaption> : null}
            </figure>
          ) : null}

          <div className="v3-pulse__foot">
            <p className="v3-pulse__note">{note}</p>
            {shown.map((reading, i) => (
              <p
                key={`def-${reading.key}`}
                className={cn('v3-pulse__def', `v3-pulse__def--${i + 1}`)}
              >
                {reading.definition}
                {reading.href && reading.hrefLabel ? (
                  <>
                    {' '}
                    <a className="v3-pulse__go" href={reading.href}>
                      {reading.hrefLabel}
                    </a>
                  </>
                ) : null}
              </p>
            ))}
            <V3SourceDisclosure source={source} className="v3-pulse__source" />
          </div>
        </div>
      </div>
    </section>
  )
}
