'use client'

/* ===========================================================================
   PATTERN 10: SLOTS — a tool's empty state, drawn as the thing it makes.

   WHY IT EXISTS (site queue SITE-50, 2026-09-09). /compare's landing state was
   a heading, one two-sentence paragraph and a text link. The 2026-09-08 taste
   table scored the class 29 and named it exactly: "the single most generic
   empty-state pattern available — heading, sentence, link — indistinguishable
   from any SaaS empty-cart screen", with "no illustration of what a finished
   four-home comparison looks like and no visible slot the visitor can watch
   fill". A tool that describes itself in prose has not shown itself.

   THE FORM. Two parts, and both are the product rather than a description of
   it: the SLOTS — one outlined box per place the tool holds, filled ones
   carrying what is in them and empty ones carrying the way to fill them — and
   a WORKED EXAMPLE, the tool's real output over real rows, labelled in a word
   the reader cannot miss so nobody mistakes the example for their own.

   NOT A SIXTH SECTION ON A PAGE THAT HAS ONE. This replaces a Quiet block on
   /compare; it does not sit beside one. Any tool with a bounded tray and an
   output worth previewing takes it: a saved-search tray, a comp picker.

   HONESTY IS STRUCTURAL. `sample.label` is a required string and it renders as
   visible words beside the example, not as a styling cue — a faded table is
   not a disclosure. The columns are whatever the caller read live, and the
   caller's §0 trace rides under them in the same disclosure every other
   pattern uses.
   =========================================================================== */

import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading, V3SourceDisclosure, type V3Text } from './atoms'
import './tokens.css'
import './V3Slots.css'

/** One column of the worked example: a real subject and its row values. */
export type V3SlotsColumn = {
  /** The id the tool takes for this subject. Never shown. */
  key: string
  /** The subject's own page. */
  href: string
  /** Where "add" goes without JavaScript — a real URL, so the example works
   *  before hydration and for a reader who never gets it. */
  addHref: string
  /** The column head, e.g. a street address. */
  title: string
  /** The quieter second line under the head, e.g. a city. */
  place?: string
  photoUrl?: string
  /** One value per `sample.rows` entry, in the same order. Short strings. */
  facts: readonly string[]
  /**
   * Optional share, 0..1, per `sample.rows` entry — this column's value as a
   * fraction of the largest value in that ROW. Drawn as a length under the
   * figure, so a reader sees which home is biggest before reading a numeral.
   *
   * The CALLER computes it, from the same numbers it formatted into `facts`
   * (the rule every encoded primitive here follows: the component never does
   * arithmetic it could then disagree with the trace about). `null` on a row
   * that a length would not teach anything about — a year built, where four
   * homes all sit at 99% of the newest — and the cell prints the value alone.
   */
  weights?: readonly (number | null)[]
}

/** What is in a slot right now. */
export type V3SlotsFill = {
  key: string
  label: string
  href?: string
}

export type V3SlotsProps = {
  id: string
  /** The page's or section's own name. */
  headline: V3Text
  /** 2 by default; 1 when this block opens the page, as it does on /compare. */
  headingLevel?: 1 | 2
  eyebrow?: string
  /** One sentence saying what the tool does. Not a paragraph. */
  claim: string
  /** How many subjects the tool holds. Clamped to 2..6. */
  slots: number
  /** The filled slots, in order. Anything past `slots` is ignored. */
  filled?: readonly V3SlotsFill[]
  /** The words inside an empty slot. */
  emptyLabel: string
  /** Where an empty slot goes: the place a visitor finds subjects. */
  emptyHref: string
  sample: {
    /** The visible word that says this is an example. Required, and shown. */
    label: string
    /** One sentence under the label. */
    caption: string
    /** The compared fields, in row order. */
    rows: readonly string[]
    columns: readonly V3SlotsColumn[]
    /** The words on each column's add control. */
    addLabel: string
  }
  /** The full section 0 trace for the example's figures, behind "Source". */
  source: string
  /** Called with a column key when the reader adds it. The navigation still
   *  happens through `addHref`; this only keeps a local tray in step. */
  onAdd?: (key: string) => void
  className?: string
}

const MIN_SLOTS = 2
const MAX_SLOTS = 6
/** Four columns is the widest an example stays legible at 375 in a scroller. */
const MAX_COLUMNS = 4

export function V3Slots({
  id,
  headline,
  headingLevel = 2,
  eyebrow,
  claim,
  slots,
  filled,
  emptyLabel,
  emptyHref,
  sample,
  source,
  onAdd,
  className,
}: V3SlotsProps) {
  const count = Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, Math.round(slots)))
  const taken = (filled ?? []).slice(0, count)
  const columns = sample.columns.filter((c) => c.key && c.title.trim()).slice(0, MAX_COLUMNS)
  const rows = sample.rows.map((r) => r.trim()).filter(Boolean)
  const sampleLabel = sample.label.trim()
  // A worked example with no label is an example nobody was told about, which
  // is the one thing this pattern exists to prevent. No label, no example.
  const showSample = columns.length > 0 && rows.length > 0 && sampleLabel.length > 0

  const headingId = `${id}-heading`
  /* SITE-65: an all-empty tray above the sample is four dashed boxes the
     visitor has to look past to see the comparison. When the sample is
     present and the personal tray is empty, the sample IS the opening.
     The tray comes back the moment the visitor has a home in it, or when
     there is no labelled sample to stand in. */
  const showTray = taken.length > 0 || !showSample

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-slots', className)}
      aria-labelledby={headingId}
    >
      <div className="v3-slots__inner">
        {eyebrow ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id={headingId} className="v3-slots__headline">
          {headline}
        </V3Heading>
        <p className="v3-slots__claim">{claim}</p>

        {showSample ? (
          <figure className="v3-slots__sample">
            <figcaption className="v3-slots__sample-head">
              <span className="v3-slots__sample-tag">{sampleLabel}</span>
              <span className="v3-slots__sample-caption">{sample.caption}</span>
            </figcaption>

            {/* The example is a real table with a real header row, so a screen
                reader gets the same object a sighted reader does. It scrolls
                inside itself at 375; the page never scrolls sideways. */}
            <div className="v3-slots__scroller">
              <table className="v3-slots__table">
                <caption className="v3-slots__table-caption">
                  {sampleLabel}: {sample.caption}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="v3-slots__rowhead">
                      <span className="v3-slots__sr">What is compared</span>
                    </th>
                    {columns.map((c) => (
                      <th scope="col" key={`h-${c.key}`} className="v3-slots__col">
                        {c.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- one
                          // remote MLS photo per example column, already sized by
                          // the CSS; next/image would add a loader round trip to a
                          // block that is deliberately cheap.
                          <img
                            className="v3-slots__photo"
                            src={c.photoUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                        <a className="v3-slots__col-title" href={c.href}>
                          {c.title}
                        </a>
                        {c.place ? <span className="v3-slots__col-place">{c.place}</span> : null}
                        {/* The add sits with the home it adds, in the head, not
                            in a row at the bottom of the table: a control the
                            reader has to scroll past every value to reach is a
                            control most readers never see. */}
                        <a
                          className="v3-slots__add"
                          href={c.addHref}
                          onClick={() => onAdd?.(c.key)}
                        >
                          {sample.addLabel}
                          <span className="v3-slots__sr"> — {c.title}</span>
                        </a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={`r-${row}`}>
                      <th scope="row" className="v3-slots__rowhead">
                        {row}
                      </th>
                      {columns.map((c) => {
                        const weight = c.weights?.[r]
                        const encoded =
                          typeof weight === 'number' && Number.isFinite(weight) && weight > 0
                            ? Math.min(1, weight)
                            : null
                        return (
                          <td key={`c-${c.key}-${r}`} className="v3-slots__cell">
                            <span className="v3-slots__value">{c.facts[r] ?? '—'}</span>
                            {/* The length under the figure. Four numbers in a
                                row of hairlines is a table wearing hairlines
                                (TASTE.md); the same four with a mark each is a
                                comparison you can read at a glance. */}
                            {encoded != null ? (
                              <span
                                className="v3-slots__bar"
                                aria-hidden="true"
                                style={{ ['--v3-slots-w' as string]: String(encoded) }}
                              >
                                <span className="v3-slots__bar-fill" />
                              </span>
                            ) : null}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </figure>
        ) : null}

        {showTray ? (
          <ol className="v3-slots__tray" style={{ ['--v3-slots-n' as string]: String(count) }}>
            {Array.from({ length: count }, (_, i) => {
              const fill = taken[i]
              return (
                <li
                  key={`slot-${i}`}
                  className={cn('v3-slots__slot', fill ? 'v3-slots__slot--full' : 'v3-slots__slot--empty')}
                  data-slot={i + 1}
                  data-state={fill ? 'full' : 'empty'}
                >
                  <span className="v3-slots__ordinal" aria-hidden="true">
                    {i + 1}
                  </span>
                  {fill ? (
                    fill.href ? (
                      <a className="v3-slots__slot-link" href={fill.href}>
                        {fill.label}
                      </a>
                    ) : (
                      <span className="v3-slots__slot-label">{fill.label}</span>
                    )
                  ) : (
                    <a className="v3-slots__slot-link v3-slots__slot-add" href={emptyHref}>
                      {emptyLabel}
                    </a>
                  )}
                </li>
              )
            })}
          </ol>
        ) : null}

        <V3SourceDisclosure source={source} className="v3-slots__source" />
      </div>
    </section>
  )
}
